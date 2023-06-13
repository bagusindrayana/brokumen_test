import type { NextApiRequest, NextApiResponse } from 'next'

import {
    S3Client,
    DeleteObjectCommand
} from "@aws-sdk/client-s3";
import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";

export const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: `${process.env.CLOUDFLARE_SECRET_KEY}`,
        secretAccessKey: `${process.env.CLOUDFLARE_SECRET_ACCESS_KEY}`,
    },
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

    const appId = req.headers.app_id as string;
    const Bucket = `doc-${appId}`;
    const Key = req.headers.key as string;

    const pineClient = new PineconeClient();
    await pineClient.init({
        apiKey: `${process.env.PINECONE_API_KEY}`,
        environment: `${process.env.PINECONE_ENVIRONMENT}`,
    });
    const pineconeIndex = pineClient.Index(`${process.env.PINECONE_INDEX}`);
    
    try {
        await S3.send(new DeleteObjectCommand({ Bucket, Key }));
        await pineconeIndex._delete({
            deleteRequest: {
                filter: {
                    userId: appId,
                    name: Key,
                },
            }
        });
        res.status(200).json({ message: "success" })
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: error })
    }

}