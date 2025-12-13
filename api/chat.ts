export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  try {
    const { message } = await req.json();

    // 1. Google 임베딩 (API 키는 Vercel 환경변수에서 가져옴)
    const embeddingResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GOOGLE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text: message }] },
        }),
      }
    );

    const embeddingData = await embeddingResponse.json();
    const vector = embeddingData.embedding?.values || embeddingData.values;

    if (!vector) {
      console.error('Google Embedding Error:', embeddingData);
      throw new Error('임베딩 실패');
    }

    // 2. Pinecone 검색
    const pineconeResponse = await fetch(
      `${process.env.PINECONE_HOST}/query`,
      {
        method: 'POST',
        headers: {
          'Api-Key': process.env.PINECONE_API_KEY!,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vector: vector,
          topK: 5,
          includeMetadata: true,
        }),
      }
    );

    const pineconeData = await pineconeResponse.json();
    const contextText = pineconeData.matches
      ?.map((match: any) => match.metadata?.text || '')
      .join('\n\n');

    // 3. OpenAI 답변 생성
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `너는 데일 카네기의 '인간관계론'을 기반으로 상담해주는 챗봇 '잇다(It-Da)'야. 
            아래 [Context] 내용을 참고해서 따뜻하게 조언해줘.
            [Context]: ${contextText}`
          },
          { role: 'user', content: message },
        ],
      }),
    });

    const openAIData = await openAIResponse.json();
    const answer = openAIData.choices[0].message.content;

    return new Response(JSON.stringify({ answer }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: '서버 에러 발생' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
