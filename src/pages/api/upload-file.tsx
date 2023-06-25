import type { NextApiRequest, NextApiResponse } from 'next'
import formidable, { File } from 'formidable';
import { promises as fs } from "fs";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
    S3Client,
    HeadBucketCommand,
    CreateBucketCommand,
    PutBucketCorsCommand,
    PutObjectCommand,
    DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";

import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";
const embeddings = new OpenAIEmbeddings({ openAIApiKey: process.env.OPENAI_API_KEY });
export const pineClient = new PineconeClient();

export const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: `${process.env.CLOUDFLARE_SECRET_KEY}`,
        secretAccessKey: `${process.env.CLOUDFLARE_SECRET_ACCESS_KEY}`,
    },
});
export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
export const config = {
    api: {
        bodyParser: false,
    }
};
function transformDoc(doc: Document, { userId, name }: { userId: string; name: string }) {
    return new Document({
        pageContent: doc.pageContent,
        metadata: {
            userId,
            name,
        },
    });
}
type ProcessedFiles = Array<[string, File]>;
export default async function handler(
    req: NextApiRequest,
    res: NextApiResponse
) {
    //get file
    // const file = req.body.file;
    // //console.log(file);
    const appId = req.headers.app_id as string;
    const Bucket = `doc-${appId}`;
    let status = 200;
    let resultBody;
    const files = await new Promise<ProcessedFiles | undefined>((resolve, reject) => {
        const form = new formidable.IncomingForm({
            maxFileSize: 5 * 1024 * 1024, //5MB,
            filter: function (part) {
                // keep only images
                return part.mimetype != undefined && part.mimetype.includes("pdf");
            }
        });
        const files: ProcessedFiles = [];
        form.on('file', function (field: string, file: any) {
            files.push([field, file]);
        })
        form.on('end', () => resolve(files));
        form.on('error', (err: any) => reject(err));
        form.parse(req, (err) => {
            if (err != null) {
                //console.log(1, err);
                status = 400;
                resultBody = {
                    status: 'fail', message: 'Upload error'
                }
                // reject(err);
            }
        });
    }).catch(e => {
        //console.log(2, e);
        status = 500;
        resultBody = {
            status: 'fail', message: 'Upload error : ' + e.message
        }
    });

    if (files?.length && status === 200) {

        for (const file of files) {
            const tempPath = file[1].filepath;
            const Key = file[1].originalFilename as string;
            try {
                await S3.send(new HeadBucketCommand({ Bucket }));
            } catch (e) {
                await S3.send(new CreateBucketCommand({ Bucket }));
                await sleep(2000); // allow bucket to propagate
                await S3.send(
                    new PutBucketCorsCommand({
                        Bucket,
                        CORSConfiguration: {
                            CORSRules: [
                                {
                                    AllowedHeaders: ["*"],
                                    AllowedMethods: ["PUT"],
                                    AllowedOrigins: ["*"],
                                    MaxAgeSeconds: 300,
                                },
                            ],
                        },
                    }),
                );
                await sleep(2000); // allow cors to propagate
            }
            try {
                const url = await getSignedUrl(S3, new PutObjectCommand({ Bucket: Bucket, Key: Key }), { expiresIn: 300 });
                //upload file from PersistentFile to S3
                const persistentFile = file[1]
                //get tmpfile
                const tmpFile = await fs.readFile(tempPath);
                //upload to S3
                const response = await fetch(url, {
                    method: 'PUT',
                    body: tmpFile,
                });


                if (response.status !== 200) {

                    status = 500;
                    resultBody = {
                        status: 'fail', message: 'Upload error'
                    }
                } else {
                    let url = response.headers.get('etag') || ""
                    //remove " from etag
                    url = url?.replace(/"/g, "");
                    resultBody = {
                        status: 'success', message: 'Upload success', data: {
                            name: Key,
                            size: persistentFile.size,
                            url: url,
                            LastModified: new Date().toISOString(),
                        }
                    }
                    let Loader;
                    const contentType = persistentFile.mimetype;
                    //hanya support pdf, karena perlu viewer untuk dokumen lain di bagian frontend
                    switch (persistentFile.mimetype) {
                        case "application/pdf":
                            Loader = PDFLoader;
                            break;
                        case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
                            Loader = DocxLoader;
                            break;
                        case "application/msword":
                            Loader = DocxLoader;
                            break;
                        case "text/plain":
                            Loader = TextLoader;
                            break;
                        default:
                            throw new Error(`Unsupported file type: ${persistentFile.mimetype}`);
                    }
                    const blobFile = await new Blob([new Uint8Array(tmpFile)], { type: contentType as string });
                    const loader = new Loader(blobFile, {
                        // you may need to add `.then(m => m.default)` to the end of the import
                        pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"),
                    });
                    const rawDocs = await loader.load();
                    console.log(rawDocs.length);
                    if (rawDocs.length <= 0) {
                        status = 500;
                        resultBody = {
                            status: 'fail', message: 'Halaman pdf tidak terbaca'
                        }
                        //delete file from S3
                        await S3.send(new DeleteObjectCommand({ Bucket: Bucket, Key: Key }));
                        break;
                    }
                    //max 200 halaman
                    if (rawDocs.length > 100) {
                        status = 500;
                        resultBody = {
                            status: 'fail', message: 'Jumlah halaman tidak boleh lebih dari 100'
                        }
                        //delete file from S3
                        await S3.send(new DeleteObjectCommand({ Bucket: Bucket, Key: Key }));
                        break;
                    }
                    const needsSplitting = contentType === "text/plain";
                    const textSplitter = new RecursiveCharacterTextSplitter();
                    textSplitter.chunkSize = 500;
                    textSplitter.chunkOverlap = 10;
                    // const docs = needsSplitting ? await textSplitter.splitDocuments(rawDocs) : rawDocs;
                    const docs = await textSplitter.splitDocuments(rawDocs);
                    const formattedDocs = docs.map((doc) => transformDoc(doc, { userId: appId, name: persistentFile.originalFilename as string }));

                    try {
                        await pineClient.init({
                            apiKey: `${process.env.PINECONE_API_KEY}`,
                            environment: `${process.env.PINECONE_ENVIRONMENT}`,
                        });
                        const pineconeIndex = pineClient.Index(`${process.env.PINECONE_INDEX}`);
    
                        await PineconeStore.fromDocuments(formattedDocs, embeddings, {
                            pineconeIndex,
                        });
                    } catch (e) {
                        //jika gagal membuat vector hapus file dari S3
                        console.log(e);
                        status = 500;
                        resultBody = {
                            status: 'fail', message: 'Vector Database Error'
                        }
                        //delete file from S3
                        await S3.send(new DeleteObjectCommand({ Bucket: Bucket, Key: Key }));
                    }
                }
            } catch (e) {
                console.log(e);
                status = 500;
                resultBody = {
                    status: 'fail', message: 'Upload error'
                }
            }

        }

    }
    console.log(status, resultBody);
    return res.status(status).json(resultBody);
    
}