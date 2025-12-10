import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    // 1. 설정 불러오기 (환경변수 사용)
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });

    // 2. 질문을 벡터로 변환
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(message);
    const queryVector = result.embedding.values;

    // 3. 파인콘 검색
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME!);
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });

    // 4. 문맥 정리
    const context = queryResponse.matches.map((match: any) => match.metadata.text).join("\n\n");

    // 5. Gemini 답변 생성
    const chatModel = genAI.getGenerativeModel({ model: "gemini-pro" });
    const prompt = `
    다음 정보를 바탕으로 질문에 답해줘. 정보에 없으면 모른다고 해.
    
    [정보]
    ${context}
    
    [질문]
    ${message}
    `;
    
    const response = await chatModel.generateContent(prompt);
    const text = response.response.text();

    return NextResponse.json({ reply: text });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Error processing request" }, { status: 500 });
  }
}
