import { Pinecone } from "@pinecone-database/pinecone";

export default async function handler(req, res) {
  // 1. 보안: POST 요청만 받음
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { message } = req.body;
    
    const googleApiKey = process.env.GOOGLE_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!googleApiKey || !openaiApiKey) {
        throw new Error("API 키가 설정되지 않았습니다.");
    }

    // 2. 임베딩 (구글)
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

    if (!embeddingResponse.ok) throw new Error("구글 임베딩 실패");

    const embeddingData = await embeddingResponse.json();
    const queryVector = embeddingData.embedding.values;

    // 3. 파인콘 검색
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    const queryResponse = await index.query({
      vector: queryVector,
      topK: 3,
      includeMetadata: true,
    });

    const context = queryResponse.matches.map((match) => match.metadata.text).join("\n\n");
    console.log("파인콘 검색(RAG) 성공:", context);

    // 4. OpenAI 답변 생성
    const systemPrompt = `
    당신은 데일 카네기 인간관계론 전문가입니다.
    아래 [참고 자료]를 바탕으로 사용자의 질문에 친절하게 조언해주세요.
    
    [참고 자료]
    ${context}
    
    답변 끝에 "🥕(OpenAI)"를 꼭 붙여주세요.
    `;

    const chatResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message }
        ],
        temperature: 0.7
      })
    });

    if (!chatResponse.ok) {
        const err = await chatResponse.text();
        throw new Error(`OpenAI Error: ${err}`);
    }

    const chatData = await chatResponse.json();
    const aiText = chatData.choices[0].message.content;

    // ★★★ 여기가 핵심 수정! ★★★
    // 화면이 하얗게 되지 않도록, 화면이 원하는 '종합 선물 세트(JSON)' 모양을 만들어줍니다.
    const result = {
      // 1. 점수 (일단 랜덤이나 고정값으로 넣어줌)
      intimacyScore: 85,
      balanceRatio: { speaker1: 50, speaker2: 50 },
      sentiment: { positive: 60, neutral: 20, negative: 20 },
      averageResponseTime: { speaker1: 5, speaker2: 10 },
      
      // 2. 제목 및 요약
      summary: "카네기 챗봇의 분석 결과입니다.",
      
      // 3. ★ OpenAI가 만든 답변을 여기에 넣습니다!
      recommendation: aiText,
      
      // 4. 그래프용 더미 데이터 (화면 깨짐 방지)
      sentimentFlow: Array(20).fill(null).map((_, i) => ({ time_percentage: i * 5, sentiment_score: 0.5 })),
      responseHeatmap: Array(24).fill(0),
      
      // 5. 추천 대답
      suggestedReplies: ["그렇군요.", "좋은 조언 감사합니다.", "노력해볼게요."],
      suggestedTopics: ["대화법", "인간관계", "경청"]
    };

    // 포장된 데이터를 보냅니다.
    return res.status(200).json(result);

  } catch (error) {
    console.error("서버 에러:", error);
    return res.status(500).json({ error: error.message });
  }
}
