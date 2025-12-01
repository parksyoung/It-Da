import { GoogleGenerativeAI } from "@google/generative-ai";
import { Pinecone } from "@pinecone-database/pinecone";

// Vercel이 알아서 처리해주는 백엔드 함수야
export default async function handler(req, res) {
  // 1. 오직 POST 요청만 받기
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // 사용자가 보낸 질문 받기
    const { message } = req.body;

    // 2. 설정 불러오기
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

    // 3. 질문을 벡터로 변환 (Embedding)
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(message);
    const queryVector = result.embedding.values;

    // 4. 파인콘 검색
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });

    // 5. 문맥 정리
    const context = queryResponse.matches.map((match) => match.metadata.text).join("\n\n");

    // ★ 디버깅용 로그 (Vercel에서 확인 가능)
    console.log("검색된 내용:", context);

    // 6. Gemini 답변 생성 (강력한 프롬프트)
    const chatModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    당신은 데일 카네기의 '인간관계론' 전문가입니다. 
    사용자가 입력한 [대화 내용]을 분석하고, 오직 아래 제공된 [참고 자료]에 있는 원칙만을 근거로 조언을 해주세요.
    
    주의사항:
    1. 'I-message'나 일반적인 심리학 조언은 절대 하지 마세요.
    2. [참고 자료]에 있는 문구(예: '꿀을 얻으려면 벌통을 걷어차지 마라' 등)를 직접 인용해서 답변하세요.
    3. [참고 자료]와 관련 없는 내용이라면 "관련된 카네기의 조언을 찾을 수 없습니다"라고 말하세요.
    4. 답변의 맨 마지막 줄에 반드시 "🥕당근"이라고 적어주세요.

    [참고 자료]
    ${context}
    
    [대화 내용]
    ${message}
    `;

    const response = await chatModel.generateContent(prompt);
    const text = response.response.text();

    // 7. 결과 보내기
    return res.status(200).json({ reply: text });

  } catch (error) {
    console.error("에러 발생:", error);
    return res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
}
