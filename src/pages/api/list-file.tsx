import type { NextApiRequest, NextApiResponse } from 'next'

import {
  S3Client,
  HeadBucketCommand,
  ListObjectsCommand,
  CreateBucketCommand
} from "@aws-sdk/client-s3";

export const S3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: `${process.env.CLOUDFLARE_SECRET_KEY}`,
    secretAccessKey: `${process.env.CLOUDFLARE_SECRET_ACCESS_KEY}`,
  },
});
 
export default async function  handler(req: NextApiRequest, res: NextApiResponse) {
  // get appId from header
  const appId = req.headers.app_id as string;
  const Bucket = `doc-${appId}`;
  let listFiles: any[] = [];
  try {
    //await S3.send(new HeadBucketCommand({ Bucket }));
    //get list
    const list = await S3.send(new ListObjectsCommand({ Bucket }));
    list.Contents?.forEach((item:any) => {
      listFiles.push({
        name: item.Key,
        url: item.ETag,
        size : item.Size,
        time: item.LastModified
      });
    });
  } catch (error) {
    //await S3.send(new CreateBucketCommand({ Bucket }));
  }
  //ascending order
  listFiles.sort((a, b) => a.time - b.time);
  res.status(200).json({ files: listFiles })
}