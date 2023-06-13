import type { NextApiRequest, NextApiResponse } from 'next'
import { promisify } from 'util';
import stream from 'stream';
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
    GetObjectCommand,
    S3Client,
    GetObjectOutput
} from "@aws-sdk/client-s3";

import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { DocxLoader } from "langchain/document_loaders/fs/docx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { Document } from "langchain/document";

import { PineconeClient, QueryRequest } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";

function transformDoc(doc: Document, { userId, name }: { userId: string; name: string }) {
    return new Document({
        pageContent: doc.pageContent,
        metadata: {
            userId,
            name,
        },
    });
}
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

export async function getObject(Bucket: string, Key: string): Promise<GetObjectOutput> {
    const getObjectCommand = new GetObjectCommand({
        Bucket,
        Key,
    });

    const response = await S3.send(getObjectCommand);
    return response;
}

export async function streamToBlob(stream: ReadableStream, contentType: string): Promise<Blob> {
    const response = new Response(stream);
    const blob = await response.blob();
    return new Blob([blob], { type: contentType });
}

export async function getObjectAsBlob(
    Bucket: string,
    Key: string,
): Promise<{ blob: Blob; contentType: string }> {
    const objectResponse = await getObject(Bucket, Key);
    const contentType = objectResponse.ContentType || "";
    const stream = objectResponse.Body as ReadableStream;
    const blob = await streamToBlob(stream, contentType);
    return { blob, contentType };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const appId = req.headers.app_id as string;
    const Key = req.headers.key as string;
    const ETag = req.headers.e_tag as string;
    const Bucket = `doc-${appId}`;
    const pipeline = promisify(stream.pipeline);

    try {
        const { blob, contentType } = await getObjectAsBlob(Bucket, Key);
        await pineClient.init({
            apiKey: `${process.env.PINECONE_API_KEY}`,
            environment: `${process.env.PINECONE_ENVIRONMENT}`,
        });
        const pineconeIndex = pineClient.Index(`${process.env.PINECONE_INDEX}`);
        //const vectors = [...Array(1536)].map(() => 0);
        //check if file exists with Key
        // const queryRequest: QueryRequest = {
        //     topK: 1,
        //     vector: vectors,
        //     filter: {
        //         userId: appId,
        //         name: Key,
        //     },
        //     includeMetadata: true,
        //     includeValues: true,
        //     namespace: ""
        // }
        var error = false;

        try {

            var myHeaders: HeadersInit = new Headers()
            myHeaders.append("Api-Key", process.env.PINECONE_API_KEY as string);
            myHeaders.append("Content-Type", "application/json");

            var raw = JSON.stringify({
                "filter": {
                    "userId": appId,
                    "name": Key
                }
            });

            var requestOptions = {
                method: 'POST',
                headers: myHeaders,
                body: raw,
            };

            //check if vector database for current file exists
            fetch(`https://${process.env.PINECONE_INDEX_HOST}/describe_index_stats`, requestOptions)
                .then(response => response.json())
                .then(async (result:any) => {
                    const namespace = result.namespaces;
                    if (namespace != undefined && (namespace[""]  == undefined || (namespace[""]  != undefined && namespace[""].vectorCount.length <= 0))) {
                        console.log("File not found in pinecone, adding to pinecone")
                        try {
                            let Loader;
                            switch (contentType) {
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
                                    throw new Error(`Unsupported file type: ${contentType}`);
                            }
            
                            const loader = new Loader(blob, {
                                // you may need to add `.then(m => m.default)` to the end of the import
                                pdfjs: () => import("pdfjs-dist/legacy/build/pdf.js"),
                            });
                            const rawDocs = await loader.load();
                            const needsSplitting = contentType === "text/plain";
                            const textSplitter = new RecursiveCharacterTextSplitter();
                            const docs = needsSplitting ? await textSplitter.splitDocuments(rawDocs) : rawDocs;
                            const formattedDocs = docs.map((doc) => transformDoc(doc, { userId: appId, name: Key as string }));
            
                            await PineconeStore.fromDocuments(formattedDocs, embeddings, {
                                pineconeIndex,
                            });
                        } catch (_error) {
                            console.log('error index document', _error)
                            error = true;
                            res.status(500).json({ error: "error index document" })
                        }
                    }
                })
                .catch(_error => {

                    console.log('error get blob', _error)
                    if(!error){
                        error = true;
                        res.status(500).json({ error: "error get fetch document" })
                    }
                   
                });

            // const queryResponse = await pineconeIndex.query({ queryRequest })

            // console.log(res,queryResponse.results)
            
        } catch (_error) {
            console.log("error get file" ,_error)
            if(!error){
                error = true;
                res.status(500).json({ error: "error get file" })
                return;
            }
        }

        if(!error){
            // console.log(contentType)
            const url = await getSignedUrl(S3, new GetObjectCommand({ Bucket, Key }), { expiresIn: 3000 });
            //get blob
            const response = await fetch(url); // replace this with your API call & options
            if (!response.ok) {
                error = true;
                res.status(500).json({ error: response.statusText })
                return;
            } else {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', 'attachment; filename=dummy.pdf');
                await pipeline(response.body as any, res);
            }

            
        }


        


    } catch (_error) {
        console.log("error get file",_error)
        res.status(500).json({ error: "error get file" })
    }

}