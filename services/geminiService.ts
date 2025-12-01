import { GoogleGenAI, Type } from '@google/genai';
import { AnalysisResult, RelationshipMode, SimulationParams, SimulationResult } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
                    // FIX: Removed `nullable: true` as it is not a valid property in the schema. The model can return null for the 'time' field.
                    time: { type: Type.NUMBER, description: 'Average response time in minutes for speaker 1. Null if cannot be calculated.' },
                },
                required: ['name', 'time']
            },
            speaker2: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'Name of the second speaker.' },
                    // FIX: Removed `nullable: true` as it is not a valid property in the schema. The model can return null for the 'time' field.
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
    suggestedTopics: {
      type: Type.ARRAY,
      description: 'An array of 2-3 interesting topics to discuss next, based on the conversation.',
      items: { type: Type.STRING }
    }
  },
  required: ['intimacyScore', 'balanceRatio', 'sentiment', 'avgResponseTime', 'summary', 'recommendation', 'sentimentFlow', 'responseHeatmap', 'suggestedReplies', 'suggestedTopics'],
};



// 원래 있던 analyzeChat을 지우고 이 코드를 붙여넣으세요!
export const analyzeChat = async (chatText: string, mode: RelationshipMode, language: 'ko' | 'en'): Promise<AnalysisResult> => {
  try {
    // 1. 우리가 만든 RAG 서버(api/chat)에게 질문 보내기
    // (Carnegie 조언을 구하러 감!)
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: chatText }),
    });

    if (!response.ok) {
      throw new Error('RAG 서버 연결 실패');
    }

    const data = await response.json();
    const ragAdvice = data.reply; // 여기에 "🥕당근"과 카네기 조언이 들어있음!

    // 2. 화면에 보여줄 결과 만들기 (AnalysisResult 형식 맞추기)
    // 점수나 그래프는 일단 고정된 값(테스트용)을 넣고, 
    // ★핵심: 'recommendation' 부분에 RAG 답변을 넣습니다!
    return {
      intimacyScore: 85,
      balanceRatio: { speaker1: 50, speaker2: 50 },
      sentiment: { positive: 40, neutral: 30, negative: 30 },
      averageResponseTime: { speaker1: 5, speaker2: 10 },
      
      // 제목에 테스트 성공 여부 표시
      summary: language === 'ko' 
        ? "RAG 연동 테스트 결과입니다. (아래 추천 내용을 확인하세요!)" 
        : "RAG Integration Test Result. (Check recommendation below!)",
        
      // ★ 여기가 중요! RAG가 준 답변을 여기에 보여줍니다.
      recommendation: ragAdvice, 
      
      // 나머지는 화면 깨짐 방지용 더미 데이터
      sentimentFlow: Array(20).fill(null).map((_, i) => ({ time_percentage: i * 5, sentiment_score: 0.5 })),
      responseHeatmap: Array(24).fill(0),
      suggestedReplies: ["알겠습니다.", "그렇군요.", "이해했습니다."],
      suggestedTopics: ["관계 개선", "대화법", "취미 공유"]
    };

  } catch (error) {
    console.error("Error analyzing chat:", error);
    throw new Error("분석 중 오류가 발생했습니다.");
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
