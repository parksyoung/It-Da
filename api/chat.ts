import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai'; // 구글 가져오기
import OpenAI from 'openai'; // OpenAI 가져오기

// 환경변수 3개 다 필요해!
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY; // 구글 키도 다시 사용!

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;

    if (!PINECONE_API_KEY || !OPENAI_API_KEY || !GEMINI_API_KEY) {
      throw new Error('API Keys are missing (Pinecone, OpenAI, or Gemini)');
    }

    // 1. 설정 (하이브리드!)
    const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
    const index = pinecone.index('hci-project-rag');
    
    // 임베딩(검색용 숫자 변환)은 구글한테 맡김 (DB랑 규격 맞추기 위해)
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: 'text-embedding-004' });

    // 대답(채팅)은 OpenAI한테 맡김 (똑똑하고 안정적이니까)
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

    // 2. 구글 모델로 질문을 768차원 숫자로 변환
    const embeddingResult = await embeddingModel.embedContent(message);
    const vector = embeddingResult.embedding.values;

    // 3. Pinecone 검색 (이제 규격이 맞아서 에러 안 남!)
    const queryResponse = await index.query({
      vector: vector,
      topK: 3,
      includeMetadata: true,
    });

    const contextText = queryResponse.matches
      .map((match) => match.metadata?.text || '')
      .join('\n\n');

    console.log('🌲 Pinecone에서 찾아낸 내용:', contextText);

    // 4. GPT에게 줄 프롬프트
    const systemPrompt = `
      당신은 'It-Da' 서비스의 AI 상담사입니다.
      아래 [관련 정보]를 바탕으로 사용자 질문에 답변하세요.
      
      규칙:
      1. 제공된 심리학/인간관계론 정보를 자연스럽게 인용하여 조언하세요.
      2. 따뜻하고 공감하는 말투를 사용하세요.
      3. 정보가 없으면 일반적인 공감과 함께 솔직하게 답변하세요.

      [관련 정보]:
      ${contextText}
    `;

    // 5. GPT-4o-mini가 답변 생성
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