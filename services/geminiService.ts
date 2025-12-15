import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisResult, RelationshipMode, SimulationParams, SimulationResult } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

const getAi = () => {
  if (!apiKey) {
    throw new Error('Gemini API key is not set. Please add VITE_GEMINI_API_KEY to your .env.local file.');
  }
  return new GoogleGenAI({ apiKey });
};

const analysisSchema = {
  type: Type.OBJECT,
  properties: {
    intimacyScore: {
      type: Type.INTEGER,
      description: 'A score from 0 to 100 representing the intimacy level. 100 is the highest.',
    },
    balanceRatio: {
      type: Type.OBJECT,
      properties: {
        speaker1: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Name of the first speaker.' },
            percentage: { type: Type.NUMBER, description: 'Percentage of conversation volume for speaker 1.' },
          },
          required: ['name', 'percentage'],
        },
        speaker2: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: 'Name of the second speaker.' },
            percentage: { type: Type.NUMBER, description: 'Percentage of conversation volume for speaker 2.' },
          },
          required: ['name', 'percentage'],
        },
      },
      required: ['speaker1', 'speaker2'],
    },
    sentiment: {
      type: Type.OBJECT,
      properties: {
        positive: { type: Type.NUMBER, description: 'Percentage of positive sentiment.' },
        negative: { type: Type.NUMBER, description: 'Percentage of negative sentiment.' },
        neutral: { type: Type.NUMBER, description: 'Percentage of neutral sentiment.' },
      },
      required: ['positive', 'negative', 'neutral'],
    },
    avgResponseTime: {
        type: Type.OBJECT,
        properties: {
            speaker1: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'Name of the first speaker.' },
                    time: { type: Type.NUMBER, description: 'Average response time in minutes for speaker 1. Null if cannot be calculated.' },
                },
                required: ['name', 'time']
            },
            speaker2: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'Name of the second speaker.' },
                    time: { type: Type.NUMBER, description: 'Average response time in minutes for speaker 2. Null if cannot be calculated.' },
                },
                required: ['name', 'time']
            }
        },
        required: ['speaker1', 'speaker2']
    },
    summary: {
      type: Type.STRING,
      description: 'A concise, 2-3 sentence summary of the relationship dynamic based on the chat.',
    },
    recommendation: {
      type: Type.STRING,
      description: 'A single, actionable recommendation to improve the relationship dynamic.',
    },
    sentimentFlow: {
        type: Type.ARRAY,
        description: 'An array of sentiment scores over time. Should contain around 20 data points.',
        items: {
            type: Type.OBJECT,
            properties: {
            time_percentage: { type: Type.NUMBER, description: 'Percentage of conversation progress (0-100).' },
            sentiment_score: { type: Type.NUMBER, description: 'Sentiment score from -1 (very negative) to 1 (very positive).' }
            },
            required: ['time_percentage', 'sentiment_score']
        }
    },
    responseHeatmap: {
        type: Type.ARRAY,
        description: 'An array of 24 numbers representing message counts for each hour of the day (0-23). The array must have exactly 24 elements.',
        items: { type: Type.NUMBER }
    },
    suggestedReplies: {
      type: Type.ARRAY,
      description: 'An array of 2-3 concise, potential replies to the last message in the conversation.',
      items: { type: Type.STRING }
    },
    attentionPoints: {
      type: Type.ARRAY,
      description: 'An array of 2-3 specific points to be cautious about in this relationship, based on the conversation analysis. Each point should be a short, advisory sentence.',
      items: { type: Type.STRING }
    },
    suggestedTopics: {
      type: Type.ARRAY,
      description: 'An array of 3-4 conversation topics that naturally flow at the current relationship stage. Each topic should be a short, engaging phrase suitable for the relationship type (romance/friend/work). Topics should be based on the actual conversation content and relationship dynamics.',
      items: { type: Type.STRING }
    },
    safetyWarnings: {
      type: Type.OBJECT,
      description: 'Safety-related warnings if concerning signals are detected in the conversation. Use this to flag potential abuse, coercion, threats, harassment, stalking, financial control, or self-harm risk. If no safety concern is detected, set detected=false and level="none" with empty arrays.',
      properties: {
        detected: { type: Type.BOOLEAN, description: 'Whether any safety concern is detected.' },
        level: {
          type: Type.STRING,
          description: 'Severity level of the detected concern: none | low | medium | high.',
        },
        messages: {
          type: Type.ARRAY,
          description: '2-5 short warning messages describing what was detected and why it may be risky. Must be grounded in the conversation content.',
          items: { type: Type.STRING },
        },
        guidance: {
          type: Type.ARRAY,
          description: '2-5 short, practical safety guidance steps (e.g., set boundaries, seek help, talk to trusted person, contact local resources). Avoid diagnosing; be supportive.',
          items: { type: Type.STRING },
        },
      },
      required: ['detected', 'level', 'messages', 'guidance'],
    },
  },
  required: ['intimacyScore', 'balanceRatio', 'sentiment', 'avgResponseTime', 'summary', 'recommendation', 'sentimentFlow', 'responseHeatmap', 'suggestedReplies', 'attentionPoints', 'suggestedTopics', 'safetyWarnings'],
};


/**
 * Analyzes a conversation history string and returns analysis results.
 * This function takes the entire conversation history (accumulated conversations) as input.
 * @param historyString - The complete conversation history as a string
 * @param mode - The relationship mode (WORK, ROMANCE, FRIEND, OTHER)
 * @param language - The language for the output ('ko' or 'en')
 * @returns Promise<AnalysisResult> - The analysis results
 */
export const analyzeConversation = async (historyString: string, mode: RelationshipMode, language: 'ko' | 'en'): Promise<AnalysisResult> => {
  const prompt = `
    You are a world-class relationship analysis AI named 'It-Da'. Your task is to analyze a conversation text and provide a structured JSON output based on the provided schema. The analysis must be objective, data-driven, and insightful.

    **IMPORTANT: The entire JSON output, including all text fields like 'summary', 'recommendation', 'suggestedReplies', 'attentionPoints', and 'suggestedTopics', MUST be in ${language === 'ko' ? 'Korean' : 'English'}.**

    The conversation is between two people. First, identify the two main speakers from the chat log. The format is typically 'Name: Message'.

    Here is the analysis context:
    - Relationship Mode: ${mode}
    - Your analysis should reflect the nuances of this specific relationship type.
    - This conversation history may contain multiple conversation sessions accumulated over time. Analyze the entire history to provide comprehensive insights.

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
    12. **Safety Warnings (안전 경고):** Carefully check for safety red flags grounded in the conversation text, such as threats, insults and intimidation, coercion, controlling behavior, stalking, sexual coercion, financial control, harassment at work, doxxing, or self-harm risk. If detected, set safetyWarnings.detected=true, choose an appropriate safetyWarnings.level (low/medium/high), and provide concise safetyWarnings.messages and safetyWarnings.guidance. If not detected, set detected=false, level="none", and empty arrays.

    Conversation history to analyze:
    ---
    ${historyString}
    ---
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
      },
    });
    
    const jsonString = response.text.trim();
    return JSON.parse(jsonString) as AnalysisResult;

  } catch (error) {
    console.error("Error analyzing conversation:", error);
    throw new Error("Failed to analyze the conversation. The AI model might be experiencing issues.");
  }
};

/**
 * Legacy function for backward compatibility.
 * Analyzes a single chat text (not accumulated history).
 * @deprecated Use analyzeConversation instead for accumulated history analysis.
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
- Translate all user-facing text fields: summary, recommendation, suggestedReplies, attentionPoints, suggestedTopics, safetyWarnings.messages, safetyWarnings.guidance.

Input JSON:
${JSON.stringify(source)}
`;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: analysisSchema,
      },
    });

    const jsonString = response.text.trim();
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
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error('Error counseling conversation:', error);
    throw new Error(language === 'ko' ? '상담 답변 생성에 실패했습니다. 잠시 후 다시 시도해주세요.' : 'Failed to generate an answer. Please try again later.');
  }
};

const simulationSchema = {
    type: Type.OBJECT,
    properties: {
        newIntimacyScore: {
            type: Type.INTEGER,
            description: 'The predicted new intimacy score (0-100) after the behavioral change.'
        },
        newRecommendation: {
            type: Type.STRING,
            description: 'A new, concise recommendation based on the simulated change.'
        }
    },
    required: ['newIntimacyScore', 'newRecommendation']
};

export const simulateChange = async (
  currentAnalysis: AnalysisResult,
  params: SimulationParams,
  mode: RelationshipMode,
  language: 'ko' | 'en'
): Promise<SimulationResult> => {
  const prompt = `
    You are a relationship simulation expert 'It-Da'. Based on an initial analysis, predict the change in the relationship if one person alters their behavior.

    **IMPORTANT: The 'newRecommendation' field in the JSON output MUST be in ${language === 'ko' ? 'Korean' : 'English'}.**

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
    const ai = getAi();
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            responseMimeType: 'application/json',
            responseSchema: simulationSchema,
        }
    });

    const jsonString = response.text.trim();
    return JSON.parse(jsonString) as SimulationResult;
  } catch (error) {
      console.error("Error simulating change:", error);
      throw new Error("Failed to run the simulation. The AI model might be having trouble.");
  }
};

export const askRelationshipCoach = async (
  question: string,
  analysisResult: AnalysisResult,
  mode: RelationshipMode,
  language: 'ko' | 'en'
): Promise<string> => {
  const prompt = `
    You are 'It-Da', a relationship coach AI. Based on the analysis results provided, answer the user's question about their relationship.
    
    **IMPORTANT: Your response MUST be in ${language === 'ko' ? 'Korean' : 'English'}.**
    
    Analysis Results:
    - Relationship Mode: ${mode}
    - Intimacy Score: ${analysisResult.intimacyScore}
    - Summary: ${analysisResult.summary}
    - Balance: ${analysisResult.balanceRatio.speaker1.name} (${analysisResult.balanceRatio.speaker1.percentage}%) vs ${analysisResult.balanceRatio.speaker2.name} (${analysisResult.balanceRatio.speaker2.percentage}%)
    - Sentiment: Positive ${analysisResult.sentiment.positive}%, Negative ${analysisResult.sentiment.negative}%, Neutral ${analysisResult.sentiment.neutral}%
    
    User's Question: ${question}
    
    Please provide helpful, empathetic advice based on the analysis results. Focus on being a relationship coach, not a free-form chat assistant.
    Keep your response concise and actionable.
  `;

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error asking relationship coach:", error);
    throw new Error(language === 'ko' 
      ? '답변을 생성하는 중 오류가 발생했습니다.' 
      : 'An error occurred while generating a response.');
  }
};

export const extractTextFromImage = async (imageBase64: string, mimeType: string): Promise<string> => {
  const imagePart = {
    inlineData: {
      mimeType: mimeType,
      data: imageBase64,
    },
  };
  const textPart = {
    text: 'This is a screenshot of a chat conversation. Please accurately extract all the text from the image, maintaining the original structure. Focus only on the speaker and the message content.'
  };

  try {
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    return response.text;
  } catch (error) {
    console.error("Error extracting text from image:", error);
    throw new Error("Failed to read text from the image. The image might be unclear or the model is busy.");
  }
};

/**
 * Self Analysis Schema - analyzes user's own conversation style
 */
const selfAnalysisSchema = {
  type: Type.OBJECT,
  properties: {
    initiative: {
      type: Type.NUMBER,
      description: 'Score from 0-100. 0 = Responder (답장러), 100 = Initiator (선톡러). Based on ratio of conversations initiated by the user.',
    },
    emotion: {
      type: Type.NUMBER,
      description: 'Score from 0-100. 0 = Thinking/Problem-solving (해결형), 100 = Feeling/Empathetic (공감형). Based on positive/negative word ratio, emoji usage, and emotional expressions.',
    },
    expression: {
      type: Type.NUMBER,
      description: 'Score from 0-100. 0 = Text-oriented (텍스트파), 100 = Emoji-oriented (이모지파). Based on average message length and emoji/emoticon usage ratio.',
    },
    tempo: {
      type: Type.NUMBER,
      description: 'Score from 0-100. 0 = Slow response (느긋), 100 = Fast response (칼답). Based on average response time.',
    },
  },
  required: ['initiative', 'emotion', 'expression', 'tempo'],
};

/**
 * Analyzes the user's own conversation style across all their conversations
 * 
 * IMPORTANT: This function is separate from analyzeConversation().
 * - analyzeConversation: Analyzes relationship between two people
 * - analyzeSelfConversation: Analyzes user's own communication style
 * 
 * These functions do NOT share logic or state.
 * 
 * @param allConversations - Combined conversation history from all relationships
 * @param language - The language for any descriptive text ('ko' or 'en')
 * @returns Promise with 4-axis scores (0-100 each)
 */
export const analyzeSelfConversation = async (
  allConversations: string,
  language: 'ko' | 'en'
): Promise<{ initiative: number; emotion: number; expression: number; tempo: number }> => {
  const prompt = `
    You are 'It-Da', a world-class conversation style analysis AI. Your task is to analyze a user's conversation style across ALL their conversations with different people to determine their consistent communication patterns.

    **IMPORTANT: The JSON output MUST contain only numeric values (0-100) for each axis. No text fields.**

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
    const ai = getAi();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: selfAnalysisSchema,
      },
    });
    
    const jsonString = response.text.trim();
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