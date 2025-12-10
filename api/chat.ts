import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
  // 1. 보안: POST 요청만 받음
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;
    
    // ★ 중요: 키 2개를 다 가져옵니다.
    const googleApiKey = process.env.GOOGLE_API_KEY; // 기억 검색용 (무료)
    const openaiApiKey = process.env.OPENAI_API_KEY; // 대답 생성용 (유료)

    if (!googleApiKey || !openaiApiKey) {
        throw new Error("API 키가 설정되지 않았습니다. (GOOGLE 또는 OPENAI)");
    }

    // ============================================================
    // 2. 임베딩 (파인콘과 맞추기 위해 구글 모델 사용)
    // ============================================================
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: message }] }
        })
      }
    );

    if (!embeddingResponse.ok) {
        throw new Error("구글 임베딩 실패 (GOOGLE_API_KEY 확인)");
    }

    const embeddingData = await embeddingResponse.json();
    const queryVector = embeddingData.embedding.values;

    // ============================================================
    // 3. 파인콘 검색 (기억 찾아오기)
    // ============================================================
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });

    const context = queryResponse.matches.map((match) => match.metadata.text).join("\n\n");
    console.log("파인콘 검색(RAG) 성공:", context);

    // ============================================================
    // 4. OpenAI 답변 생성 (★ 여기가 핵심!)
    // ============================================================
    const systemPrompt = `
    당신은 데일 카네기 인간관계론 전문가입니다.
    아래 [참고 자료]를 바탕으로 사용자의 질문에 친절하게 조언해주세요.
    
    [참고 자료]
    ${context}
    `;

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // 가장 가성비 좋고 똑똑한 모델
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7
      })
    });

    if (!chatResponse.ok) {
        const err = await chatResponse.text();
        console.error("OpenAI 에러:", err);
        throw new Error(`OpenAI Error: ${chatResponse.status}`);
    }

    const chatData = await chatResponse.json();
    const text = chatData.choices[0].message.content;

    // 5. 결과 반환 (테스트용 당근 추가!)
    return res.status(200).json({ reply: text + "\n\n(🥕OpenAI 성공!)" });

  } catch (error) {
    console.error("서버 에러:", error);
    return res.status(500).json({ error: error.message });
  }
}
