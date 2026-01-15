import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 1️⃣ [순서 중요] 가장 먼저 프론트엔드에서 보낸 데이터를 받습니다.
    // 여기서 conversationContext가 정의됩니다.
    const { message, conversationContext } = req.body;

    // 🕵️‍♂️ 데이터 확인용 로그 (터미널에서 확인)
    console.log("📨 프론트에서 받은 대화 길이:", conversationContext ? conversationContext.length : 0);

    if (!PINECONE_API_KEY || !OPENAI_API_KEY || !GEMINI_API_KEY) {
      throw new Error('API Keys are missing');
    }

    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.index('hci-project-rag');
    
    // 임베딩 (Google)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });
    
    // 채팅 (OpenAI)
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // 2️⃣ 사용자의 질문(message)을 임베딩합니다.
    const embeddingResult = await embeddingModel.embedContent(message);
    const vector = embeddingResult.embedding.values;

    // 3️⃣ Pinecone에서 관련된 심리학 정보를 찾습니다.
    const queryResponse = await index.query({
      vector: vector,
      topK: 3,
      includeMetadata: true,
    });

    // 4️⃣ [순서 중요] 여기서 psychologyContext가 정의됩니다.
    const psychologyContext = queryResponse.matches
      .map((match) => match.metadata?.text || '')
      .join('\n\n');

    console.log('🌲 Pinecone 검색 완료');

    // 5️⃣ [순서 중요] 위에서 모든 재료(변수)가 준비된 후에 systemPrompt를 만듭니다.
    // 이제 빨간 줄이 안 뜰 겁니다!
    const systemPrompt = `
      당신은 'It-Da' 서비스의 AI 연애/관계 상담사입니다.
      
      [필수 지시사항]
      1. 아래 제공된 [사용자가 업로드한 대화 내용]을 '사실(Fact)'로 받아들이고 분석하세요.
      2. 답변할 때 **업로드된 대화 내용 중 특정 단어, 문장, 말투를 반드시 인용**하여 근거를 대세요.
      3. 사용자의 고민에 대해 [심리학/인간관계론 정보]를 연결하여 실질적인 조언을 해주세요.
      4. 절대 "대화 내용이 부족하다"거나 "업로드해주세요"라는 말을 하지 마세요. 있는 정보 내에서 최대한 답변하세요.
      [사용자가 업로드한 대화 내용 (Context)]:
      ${conversationContext && conversationContext.length > 0 ? conversationContext : "없음 (이 경우 사용자에게 대화 파일이 없다고 말할 것)"}

      [심리학/인간관계론 정보 (RAG 검색 결과)]:
      ${psychologyContext}
    `;

    // 6️⃣ GPT에게 최종 질문 던지기
    const completion = await openai.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      model: "gpt-4o-mini",
    });

    const reply = completion.choices[0].message.content;

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ error: 'Failed to process request' });
  }
}