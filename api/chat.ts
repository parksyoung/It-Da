import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
  // 1. POST 요청만 허용
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;

    // 2. 임베딩 (라이브러리 X -> 구글에 직접 요청)
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`,
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
       const err = await embeddingResponse.text();
       console.error("임베딩 에러:", err);
       throw new Error(`Embedding Failed: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const queryVector = embeddingData.embedding.values;

    // 3. 파인콘 검색 (이건 이미 잘 됨!)
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });

    const context = queryResponse.matches.map((match) => match.metadata.text).join("\n\n");
    console.log("파인콘 검색 내용:", context);

    // 4. Gemini 답변 (라이브러리 X -> 구글에 직접 요청)
    // ★ gemini-1.5-flash 모델 사용 (직접 부르면 404 안 남)
    const prompt = `
    당신은 카네기 인간관계론 전문가입니다. 아래 [참고 자료]를 바탕으로 조언해주세요.
    
    [참고 자료]
    ${context}
    
    [질문]
    ${message}
    
    답변 끝에 "🥕당근"을 꼭 붙여주세요.
    `;

    const chatResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    if (!chatResponse.ok) {
        const errText = await chatResponse.text();
        console.error("Gemini API Error:", errText);
        throw new Error(`Gemini Error: ${chatResponse.status}`);
    }

    const chatData = await chatResponse.json();
    const text = chatData.candidates[0].content.parts[0].text;

    return res.status(200).json({ reply: text });

  } catch (error) {
    console.error("서버 내부 오류:", error);
    return res.status(500).json({ error: error.message });
  }
}
