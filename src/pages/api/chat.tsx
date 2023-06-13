import type { NextApiRequest, NextApiResponse } from 'next'
import { OpenAIEmbeddings } from "langchain/embeddings/openai";
import { ChatOpenAI } from "langchain/chat_models/openai";
import { ConversationalRetrievalQAChain } from "langchain/chains";
import { HumanChatMessage, AIChatMessage } from "langchain/schema";


import { PineconeClient } from "@pinecone-database/pinecone";
import { PineconeStore } from "langchain/vectorstores/pinecone";

const pineClient = new PineconeClient();
const model = new ChatOpenAI({ openAIApiKey: process.env.OPENAI_API_KEY, modelName: "gpt-3.5-turbo" });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = req.headers.app_id as string;
  const Key = req.headers.key as string;
  const body = JSON.parse(req.body);
  const question = body.question as string;
  const chatHistory = body.chat_history as any[];

  let chat_history: any[] = [];
  for (let i = 0; i < chatHistory.length; i++) {
    const element = chatHistory[i];
    if (element.isMe) {
      chat_history.push(new HumanChatMessage(element.text))
    } else {
      chat_history.push(new AIChatMessage(element.text))
    }
  }

  await pineClient.init({
    apiKey: `${process.env.PINECONE_API_KEY}`,
    environment: `${process.env.PINECONE_ENVIRONMENT}`,
  });
  const pineconeIndex = pineClient.Index(`${process.env.PINECONE_INDEX}`);

  const vectorStore = await PineconeStore.fromExistingIndex(
    new OpenAIEmbeddings(),
    { pineconeIndex }
  );


  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorStore.asRetriever(undefined, {
      "userId": appId,
      "name": Key,
    }),
    {
      returnSourceDocuments: true,
    }
  );
  try {
    const response = await chain.call({ question: `${question}. berikan jawaban dalam bahasa indonesia dalam format markdown`, chat_history: chat_history });
    const responseText = response.text as string;
    res.status(200).json({ response: responseText, sourceDocuments: response.sourceDocuments });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error });
  }


}