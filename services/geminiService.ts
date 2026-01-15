import { AnalysisResult, RelationshipMode, SimulationParams, SimulationResult } from '../types';

// Luxia Cloud Bridge API 설정
const LUXIA_API_ENDPOINT = 'https://bridge.luxiacloud.com/llm/google/gemini/generate/flash20/content';
const apiKey = import.meta.env.VITE_LUXIA_API_KEY || (typeof process !== 'undefined' ? process.env.VITE_LUXIA_API_KEY : undefined);

// Luxia API 응답 타입 정의
interface LuxiaApiResponse {
  data?: {
    results?: Array<{
      candidates?: Array<{
        content?: {
          parts?: Array<{
            text?: string;
          }>;
        };
      }>;
    }>;
  };
  error?: {
    message?: string;
    code?: string;
  };
}

/**
 * Luxia Cloud Bridge API를 호출하는 헬퍼 함수
 */
const callLuxiaAPI = async (prompt: string): Promise<string> => {
  if (!apiKey) {
    throw new Error('Luxia API 키가 설정되지 않았습니다. .env.local에 VITE_LUXIA_API_KEY를 추가해주세요.');
  }

  try {
    const response = await fetch(LUXIA_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        model: 'gemini-2.0-flash',
        contents: prompt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Luxia API 요청 실패 (${response.status}): ${errorText}`);
    }

    const data: LuxiaApiResponse = await response.json();

    // 안전하게 응답 텍스트 추출
    const text = data?.data?.results?.[0]?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Unexpected API response structure:', data);
      throw new Error('API 응답에서 텍스트를 찾을 수 없습니다. 응답 구조가 예상과 다릅니다.');
    }

    return text.trim();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Luxia API 호출 중 알 수 없는 오류가 발생했습니다.');
  }
};


/**
 * Analyzes a conversation history string and returns analysis results.
 */
export const analyzeConversation = async (historyString: string, mode: RelationshipMode, language: 'ko' | 'en'): Promise<AnalysisResult> => {
  const prompt = `
    You are a world-class relationship analysis AI named 'It-Da'. Your task is to analyze a conversation text and provide a structured JSON output. The analysis must be objective, data-driven, and insightful.

    **CRITICAL: You MUST respond with ONLY valid JSON, no additional text before or after. The entire JSON output, including all text fields like 'summary', 'recommendation', 'suggestedReplies', 'attentionPoints', and 'suggestedTopics', MUST be in ${language === 'ko' ? 'Korean' : 'English'}.**

    The conversation is between two people. First, identify the two main speakers from the chat log. The format is typically 'Name: Message'.

    Here is the analysis context:
    - Relationship Mode: ${mode}
    - Your analysis should reflect the nuances of this specific relationship type.
    - This conversation history may contain multiple conversation sessions accumulated over time. Analyze the entire history to provide comprehensive insights.

    You must return a JSON object with the following exact structure:
    {
      "intimacyScore": <number 0-100>,
      "balanceRatio": {
        "speaker1": { "name": "<string>", "percentage": <number> },
        "speaker2": { "name": "<string>", "percentage": <number> }
      },
      "sentiment": {
        "positive": <number>,
        "negative": <number>,
        "neutral": <number>
      },
      "avgResponseTime": {
        "speaker1": { "name": "<string>", "time": <number | null> },
        "speaker2": { "name": "<string>", "time": <number | null> }
      },
      "summary": "<string>",
      "recommendation": "<string>",
      "sentimentFlow": [
        { "time_percentage": <number 0-100>, "sentiment_score": <number -1 to 1> },
        ... (exactly 20 data points)
      ],
      "responseHeatmap": [<number>, ...] (exactly 24 numbers, one for each hour 0-23),
      "suggestedReplies": ["<string>", ...] (2-3 items),
      "attentionPoints": ["<string>", ...] (2-3 items),
      "suggestedTopics": ["<string>", ...] (3-4 items)
    }

    Please perform the following analysis:
    1.  **Intimacy Score (친밀도):** Calculate a score from 0-100 based on the entire conversation history.
    2.  **Balance Ratio (균형):** Calculate the percentage of total message volume for each speaker across all conversations.
    3.  **Sentiment (감정 톤):** Analyze the overall emotional tone and provide percentages for positive, negative, and neutral sentiments across all conversations.
    4.  **Average Response Time (평균 응답 시간):** Calculate the average time in minutes for each person to respond. If timestamps are not present, return null for time values.
    5.  **Summary (요약):** Provide a short summary of the relationship's state based on the entire conversation history.
    6.  **Recommendation (추천):** Give one concrete, actionable piece of advice based on the overall relationship dynamic.
    7.  **Sentiment Flow (감정 흐름):** Analyze the conversation chronologically and provide an array of sentiment scores over time. Generate exactly 20 data points, evenly spaced from time_percentage 0 to 100. Each data point should have a 'time_percentage' (0-100) and a 'sentiment_score' (-1 to 1).
    8.  **Response Heatmap (응답 패턴 히트맵):** Analyze message timestamps if available. Provide an array of exactly 24 numbers, where each index (0-23) represents an hour of the day and its value is the total message count for that hour. If there are no timestamps, return an array of 24 zeros.
    9.  **Next Conversation Suggestions:** Based on the last few messages, provide an array of 2-3 potential replies to the last message.
    10. **Attention Points (주의할 포인트):** Based on the conversation analysis, provide an array of 2-3 specific points to be cautious about in this relationship. Each point should be a short, advisory sentence that helps maintain or improve the relationship. Focus on communication patterns, emotional dynamics, or potential misunderstandings observed in the conversation.
    11. **Suggested Topics (대화 주제 추천):** Based on the conversation history and current relationship stage, provide an array of 3-4 conversation topics that naturally flow at this relationship stage. Each topic should be a short, engaging phrase (not a full sentence) that fits the relationship type. For romance mode, suggest topics that help deepen the relationship. For friend mode, suggest casual, friendly topics. For work mode, suggest professional but warm topics.

    Conversation history to analyze:
    ---
    ${historyString}
    ---
  `;

  try {
    const responseText = await callLuxiaAPI(prompt);
    
    // JSON 파싱 시도 (마크다운 코드 블록 제거)
    let jsonString = responseText.trim();
    // JSON 코드 블록이 있는 경우 제거
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(jsonString) as AnalysisResult;

  } catch (error) {
    console.error("Error analyzing conversation:", error);
    throw new Error("Failed to analyze the conversation. The AI model might be experiencing issues.");
  }
};

/**
 * Legacy function for backward compatibility.
 */
export const analyzeChat = async (chatText: string, mode: RelationshipMode, language: 'ko' | 'en'): Promise<AnalysisResult> => {
  return analyzeConversation(chatText, mode, language);
};

export const translateAnalysisResult = async (
  source: AnalysisResult,
  targetLanguage: 'ko' | 'en'
): Promise<AnalysisResult> => {
  const prompt = `
You are a professional translator.

Task:
- Translate the following JSON analysis result to ${targetLanguage === 'ko' ? 'Korean' : 'English'}.

Rules:
- Output MUST be valid JSON matching the provided schema.
- Preserve the exact JSON structure and keep all numbers unchanged.
- Do NOT translate proper names (e.g., speaker names) or identifiers.
- Translate all user-facing text fields: summary, recommendation, suggestedReplies, attentionPoints, suggestedTopics.

**CRITICAL: You MUST respond with ONLY valid JSON, no additional text before or after.**

You must return a JSON object with the following exact structure:
{
  "intimacyScore": <number 0-100>,
  "balanceRatio": {
    "speaker1": { "name": "<string>", "percentage": <number> },
    "speaker2": { "name": "<string>", "percentage": <number> }
  },
  "sentiment": {
    "positive": <number>,
    "negative": <number>,
    "neutral": <number>
  },
  "avgResponseTime": {
    "speaker1": { "name": "<string>", "time": <number | null> },
    "speaker2": { "name": "<string>", "time": <number | null> }
  },
  "summary": "<string>",
  "recommendation": "<string>",
  "sentimentFlow": [
    { "time_percentage": <number 0-100>, "sentiment_score": <number -1 to 1> },
    ... (exactly 20 data points)
  ],
  "responseHeatmap": [<number>, ...] (exactly 24 numbers, one for each hour 0-23),
  "suggestedReplies": ["<string>", ...] (2-3 items),
  "attentionPoints": ["<string>", ...] (2-3 items),
  "suggestedTopics": ["<string>", ...] (3-4 items)
}

Input JSON:
${JSON.stringify(source)}
`;

  try {
    const responseText = await callLuxiaAPI(prompt);
    
    // JSON 파싱 시도 (마크다운 코드 블록 제거)
    let jsonString = responseText.trim();
    // JSON 코드 블록이 있는 경우 제거
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(jsonString) as AnalysisResult;
  } catch (error) {
    console.error('Error translating analysis result:', error);
    throw new Error(targetLanguage === 'ko' ? '분석 결과 번역에 실패했습니다.' : 'Failed to translate the analysis result.');
  }
};

export const counselConversation = async (
  historyString: string,
  userQuestion: string,
  mode: RelationshipMode,
  language: 'ko' | 'en',
  speaker1Name?: string,
  speaker2Name?: string
): Promise<string> => {
  const trimmedQuestion = userQuestion?.trim();
  if (!trimmedQuestion) {
    throw new Error(language === 'ko' ? '질문을 입력해주세요.' : 'Please enter a question.');
  }

  const maxChars = 16000;
  const safeHistory = (historyString || '').slice(-maxChars);

  const prompt = `
You are 'It-Da', a warm, practical relationship counseling assistant.

IMPORTANT:
- Answer in ${language === 'ko' ? 'Korean' : 'English'}.
- Be empathetic but concrete: give step-by-step suggestions, example messages, and what to avoid.
- Use the conversation history as context, but do not hallucinate facts not present.
- If the user asks for harmful/illegal actions, refuse and offer safer alternatives.

Context:
- Relationship Mode: ${mode}
- Speaker 1: ${speaker1Name || 'User'}
- Speaker 2: ${speaker2Name || 'Partner'}

Conversation history (may contain multiple sessions over time):
---
${safeHistory}
---

User question:
${trimmedQuestion}
`;

  try {
    const responseText = await callLuxiaAPI(prompt);
    return responseText.trim();
  } catch (error) {
    console.error('Error counseling conversation:', error);
    throw new Error(language === 'ko' ? '상담 답변 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' : 'Failed to generate an answer. Please try again later.');
  }
};

export const simulateChange = async (
  currentAnalysis: AnalysisResult,
  params: SimulationParams,
  mode: RelationshipMode,
  language: 'ko' | 'en'
): Promise<SimulationResult> => {
  const prompt = `
    You are a relationship simulation expert 'It-Da'. Based on an initial analysis, predict the change in the relationship if one person alters their behavior.

    **CRITICAL: You MUST respond with ONLY valid JSON, no additional text before or after. The 'newRecommendation' field in the JSON output MUST be in ${language === 'ko' ? 'Korean' : 'English'}.**

    You must return a JSON object with the following exact structure:
    {
      "newIntimacyScore": <number 0-100>,
      "newRecommendation": "<string>"
    }

    Initial Analysis Summary:
    - Relationship Mode: ${mode}
    - Current Intimacy Score: ${currentAnalysis.intimacyScore}
    - Summary: ${currentAnalysis.summary}
    - Speaker 1 (${currentAnalysis.balanceRatio.speaker1.name}) talked ${currentAnalysis.balanceRatio.speaker1.percentage}% of the time.
    - Speaker 2 (${currentAnalysis.balanceRatio.speaker2.name}) talked ${currentAnalysis.balanceRatio.speaker2.percentage}% of the time.

    Simulation Request:
    Predict the new intimacy score and provide a new recommendation if the user's average response time changes by ${params.responseTimePercentage}%. A negative percentage means responding faster, a positive percentage means responding slower.

    Based on this change, provide a new predicted intimacy score and a short, encouraging recommendation in ${language === 'ko' ? 'Korean' : 'English'}.
  `;
  
  try {
    const responseText = await callLuxiaAPI(prompt);
    
    // JSON 파싱 시도 (마크다운 코드 블록 제거)
    let jsonString = responseText.trim();
    // JSON 코드 블록이 있는 경우 제거
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    return JSON.parse(jsonString) as SimulationResult;
  } catch (error) {
      console.error("Error simulating change:", error);
      throw new Error("Failed to run the simulation. The AI model might be having trouble.");
  }
};

export const extractTextFromImage = async (imageBase64: string, mimeType: string): Promise<string> => {
  // Note: Luxia Cloud Bridge API의 현재 엔드포인트는 텍스트만 지원합니다.
  // 이미지 처리가 필요한 경우, 별도의 이미지 처리 엔드포인트가 필요할 수 있습니다.
  // 현재는 텍스트 기반 프롬프트로 대체합니다.
  const prompt = `This is a screenshot of a chat conversation. Please accurately extract all the text from the image, maintaining the original structure. Focus only on the speaker and the message content.

Note: The image data (base64: ${imageBase64.substring(0, 50)}...) with mime type ${mimeType} was provided, but this API endpoint currently supports text-only prompts. If image processing is required, please use a different endpoint that supports multimodal input.`;

  try {
    const responseText = await callLuxiaAPI(prompt);
    return responseText.trim();
  } catch (error) {
    console.error("Error extracting text from image:", error);
    throw new Error("Failed to read text from the image. The image might be unclear or the model is busy.");
  }
};

/**
 * Analyzes the user's own conversation style across all their conversations
 */
export const analyzeSelfConversation = async (
  allConversations: string,
  language: 'ko' | 'en'
): Promise<{ initiative: number; emotion: number; expression: number; tempo: number }> => {
  const prompt = `
    You are 'It-Da', a world-class conversation style analysis AI. Your task is to analyze a user's conversation style across ALL their conversations with different people to determine their consistent communication patterns.

    **CRITICAL: You MUST respond with ONLY valid JSON, no additional text before or after. The JSON output MUST contain only numeric values (0-100) for each axis. No text fields.**

    You must return a JSON object with the following exact structure:
    {
      "initiative": <number 0-100>,
      "emotion": <number 0-100>,
      "expression": <number 0-100>,
      "tempo": <number 0-100>
    }

    The conversation data provided contains conversations between the user (labeled as various names like "나", "Me", or their actual name) and multiple different people. Analyze the user's behavior patterns consistently across ALL conversations.

    Analyze the following 4 axes:

    1. **Initiative (주도성)**: How often does the user initiate conversations vs. responding?
        - 0-49: Responder (답장러) - User mostly responds to others' messages
        - 50-100: Initiator (선톡러) - User frequently starts conversations
        - Calculation: Ratio of conversations/messages where the user sends the first message in a conversation thread

    2. **Emotion (감성도)**: Does the user express feelings/empathy or focus on problem-solving?
        - 0-49: Thinking/Problem-solving (해결형) - User focuses on solutions, facts, logic
        - 50-100: Feeling/Empathetic (공감형) - User expresses emotions, uses empathetic language, emojis like ㅠㅠ, ㅋㅋ, 감탄사
        - Calculation: Consider positive/negative word ratios, emoji usage frequency, emotional expressions, empathetic phrases

    3. **Expression Style (표현 방식)**: Does the user prefer text or emoji/emoticons?
        - 0-49: Text-oriented (텍스트파) - Longer messages, fewer emojis/emoticons
        - 50-100: Emoji-oriented (이모지파) - Frequent use of emojis, emoticons, shorter messages
        - Calculation: Average message length, emoji/emoticon usage ratio per message

    4. **Tempo (속도)**: How quickly does the user respond?
        - 0-49: Slow response (느긋) - Takes time to respond, longer gaps
        - 50-100: Fast response (칼답) - Quick responses, short gaps between messages
        - Calculation: Average response time in minutes (if timestamps available), or message frequency

    Analyze the combined conversation history and provide scores for each axis (0-100).

    Combined conversation history (user's messages across all relationships):
    ---
    ${allConversations}
    ---
  `;

  try {
    const responseText = await callLuxiaAPI(prompt);
    
    // JSON 파싱 시도 (마크다운 코드 블록 제거)
    let jsonString = responseText.trim();
    // JSON 코드 블록이 있는 경우 제거
    if (jsonString.startsWith('```json')) {
      jsonString = jsonString.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (jsonString.startsWith('```')) {
      jsonString = jsonString.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const result = JSON.parse(jsonString);
    
    // Ensure values are within 0-100 range
    return {
      initiative: Math.max(0, Math.min(100, result.initiative || 50)),
      emotion: Math.max(0, Math.min(100, result.emotion || 50)),
      expression: Math.max(0, Math.min(100, result.expression || 50)),
      tempo: Math.max(0, Math.min(100, result.tempo || 50)),
    };
  } catch (error: any) {
    console.error("Error analyzing self conversation:", error);
    
    // Preserve quota/rate-limit errors so they can be handled specially
    if (error?.status === 429 || error?.code === 429) {
      const quotaError: any = new Error("Quota exceeded");
      quotaError.status = 429;
      quotaError.code = 429;
      quotaError.originalError = error;
      throw quotaError;
    }
    
    // Check for quota-related error messages
    const errorMessage = error?.message?.toLowerCase() || '';
    if (errorMessage.includes('resource_exhausted') || errorMessage.includes('quota')) {
      const quotaError: any = new Error("Quota exceeded");
      quotaError.status = 429;
      quotaError.code = 429;
      quotaError.originalError = error;
      throw quotaError;
    }
    
    throw new Error("Failed to analyze self conversation style. The AI model might be experiencing issues.");
  }
};