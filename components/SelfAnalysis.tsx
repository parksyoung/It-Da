import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { getAllPersonsHistory } from '../services/firebase';
import { analyzeSelfConversation } from '../services/geminiService';

interface SelfAnalysisData {
  initiative: number; // 0-100: 0 = 답장러(R), 100 = 선톡러(I)
  emotion: number; // 0-100: 0 = 해결형(T), 100 = 공감형(F)
  expression: number; // 0-100: 0 = 텍스트파(Tx), 100 = 이모지파(Em)
  tempo: number; // 0-100: 0 = 느긋(Slw), 100 = 칼답(Fst)
}

// Personality Code Types
type InitiativeCode = 'I' | 'R';
type EmotionCode = 'F' | 'T';
type ExpressionCode = 'Tx' | 'Em';
type TempoCode = 'Fst' | 'Slw';

interface PersonalityCode {
  initiative: InitiativeCode;
  emotion: EmotionCode;
  expression: ExpressionCode;
  tempo: TempoCode;
}

interface PersonaInfo {
  name: string;
  subtitle: string;
  summary: string;
  tips: string[];
}

// Convert numeric values to personality codes
const getPersonalityCode = (data: SelfAnalysisData): PersonalityCode => {
  return {
    initiative: data.initiative >= 50 ? 'I' : 'R',
    emotion: data.emotion >= 50 ? 'F' : 'T',
    expression: data.expression >= 50 ? 'Em' : 'Tx',
    tempo: data.tempo >= 50 ? 'Fst' : 'Slw',
  };
};

// Personality code to persona mapping (Korean)
const personaMap: Record<string, PersonaInfo> = {
  'I-F-Tx-Fst': {
    name: '먼저 건네는 대화가',
    subtitle: '말을 아끼지 않는 공감 리더',
    summary: '당신은 대화를 시작하는 데 망설임이 적은 편이에요. 상대가 답장을 늦게 하더라도 크게 신경 쓰지 않는 타입이죠. 감정을 먼저 나누는 것을 선호하지만, 표현은 텍스트 중심으로 깔끔하게 정리하는 스타일입니다. 빠른 응답으로 상대방의 대화 흐름을 놓치지 않으려는 노력이 보여요.',
    tips: [
      '답장이 조금 늦어도 관심이 없는 건 아닐 수 있어요.',
      '공감을 먼저 해주면 마음의 문이 빨리 열립니다.',
      '긴 설명보다 한 문장의 리액션도 충분해요.',
    ],
  },
  'I-F-Em-Fst': {
    name: '즉흥 에너지 충',
    subtitle: '이모지로 감정을 전달하는 친근한 리더',
    summary: '대화를 시작하는 것이 어렵지 않은 타입이에요. 이모지와 다양한 표현으로 감정을 풍부하게 전달하는 스타일입니다. 빠른 응답으로 관계의 템포를 이끌어가지만, 가끔은 한 템포 쉬어가는 여유도 관계에 도움이 될 수 있어요.',
    tips: [
      '짧고 명확한 메시지에 반응하는 것을 선호합니다.',
      '이모지 하나로도 충분히 감정을 전달할 수 있어요.',
      '답장이 늦어도 "지금 바쁘니 나중에" 한 마디면 충분합니다.',
    ],
  },
  'I-F-Tx-Slw': {
    name: '신중한 공감 리더',
    subtitle: '텍스트로 차분하게 이끄는 타입',
    summary: '대화를 먼저 시작하는 것을 주저하지 않지만, 답장은 여유롭게 하는 스타일이에요. 감정을 먼저 나누는 것을 선호하지만, 표현은 텍스트로 차분하게 정리합니다. 깊이 있는 대화를 선호하며, 빠른 응답보다는 진심이 담긴 답장을 중요하게 생각해요.',
    tips: [
      '공감을 먼저 해주면 마음의 문이 빨리 열립니다.',
      '답장이 늦어도 따뜻하게 기다릴 준비가 되어 있어요.',
      '텍스트 중심의 깔끔하고 깊이 있는 메시지를 선호합니다.',
    ],
  },
  'I-F-Em-Slw': {
    name: '따뜻한 시작가',
    subtitle: '이모지로 감정 나누는 여유로운 리더',
    summary: '대화를 먼저 시작하는 것을 주저하지 않지만, 답장은 여유롭게 하는 스타일이에요. 감정을 이모지로 풍부하게 표현하며, 상대방과의 깊이 있는 감정 공유를 중시합니다. 빠른 응답보다는 진심이 담긴 답장을 선호해요.',
    tips: [
      '공감과 이모지 리액션이 큰 힘이 됩니다.',
      '답장이 늦어도 따뜻하게 기다릴 준비가 되어 있어요.',
      '감정을 먼저 나누면 더 깊은 대화로 이어질 수 있습니다.',
    ],
  },
  'I-T-Tx-Fst': {
    name: '효율적인 솔루션 파트너',
    subtitle: '문제 해결 중심의 빠른 소통가',
    summary: '대화를 적극적으로 이끌어가며, 목적 지향적인 커뮤니케이션을 선호해요. 감정보다는 해결책에 집중하는 스타일이고, 텍스트 중심으로 명확하게 전달합니다. 빠른 응답으로 효율성을 중시하지만, 때로는 상대방의 감정적 요구도 고려해볼 필요가 있어요.',
    tips: [
      '직설적인 말투가 무뚝뚝해 보일 수 있지만 의도를 악의적으로 해석하지 마세요.',
      '문제를 해결하려는 마음이 앞서 감정 표현이 부족할 수 있어요.',
      '명확하고 구체적인 피드백을 선호합니다.',
    ],
  },
  'I-T-Em-Fst': {
    name: '현실적 유머러스',
    subtitle: '이모지로 분위기 띄우는 솔루션 파인더',
    summary: '대화의 주도권을 잡는 것을 좋아하며, 현실적이고 해결 중심적인 접근을 선호해요. 이모지를 활용해 분위기를 부드럽게 만들면서도 핵심은 명확하게 전달하는 스타일입니다. 빠른 응답으로 효율적인 소통을 중시하지만, 이모지를 통해 무뚝뚝해 보일 수 있는 부분을 완화하려는 배려심이 보여요.',
    tips: [
      '유머러스하지만 핵심이 빠르게 전달되는 대화를 선호합니다.',
      '불필요한 설명보다는 결론과 이모지 리액션이 더 효과적이에요.',
      '빠른 응답에 압박을 느낄 수 있으니 편하게 답장해도 됩니다.',
    ],
  },
  'I-T-Tx-Slw': {
    name: '신중한 기획자',
    subtitle: '생각을 정리한 후 시작하는 논리형',
    summary: '대화를 시작하는 것을 두려워하지 않지만, 내용을 신중하게 생각한 후에 메시지를 보내는 타입이에요. 논리적이고 해결 중심적이며, 텍스트로 명확하게 정리된 메시지를 선호합니다. 여유롭게 생각을 정리한 후 깊이 있는 대화를 나누는 스타일입니다.',
    tips: [
      '명확하고 논리적인 설명을 선호합니다.',
      '답장도 여유롭게 생각을 정리한 후 받을 준비가 되어 있어요.',
      '직설적인 말투가 무뚝뚝해 보일 수 있지만 의도는 따뜻합니다.',
    ],
  },
  'I-T-Em-Slw': {
    name: '여유로운 해결 리더',
    subtitle: '이모지로 분위기 띄우는 신중한 타입',
    summary: '대화를 먼저 시작하는 것을 두려워하지 않지만, 내용을 신중하게 생각한 후에 메시지를 보내는 타입이에요. 해결 중심적이지만 이모지를 활용해 분위기를 부드럽게 만들며, 여유롭게 답장하는 것을 선호합니다. 논리적이면서도 친근한 소통을 중시하는 스타일입니다.',
    tips: [
      '명확하고 논리적인 설명을 선호합니다.',
      '이모지로 분위기를 완화하려는 배려심이 보여요.',
      '답장도 여유롭게 생각을 정리한 후 받을 준비가 되어 있어요.',
    ],
  },
  'R-F-Tx-Fst': {
    name: '빠른 공감자',
    subtitle: '텍스트로 빠르게 반응하는 감성형',
    summary: '대화를 먼저 시작하기보다는 상대방의 말에 빠르게 공감하며 반응하는 스타일이에요. 감정을 잘 읽고 텍스트로 차분하게 표현하며, 빠른 응답으로 상대방의 대화 흐름을 놓치지 않으려는 노력이 보여요.',
    tips: [
      '공감을 먼저 해주면 마음의 문이 빨리 열립니다.',
      '빠른 답장으로 신뢰를 쌓는 타입이에요.',
      '텍스트 중심의 깔끔한 메시지를 선호합니다.',
    ],
  },
  'R-F-Em-Fst': {
    name: '즉각 반응형',
    subtitle: '이모지로 빠르게 공감하는 친근한 타입',
    summary: '대화를 먼저 시작하기보다는 상대방의 메시지에 이모지로 즉각 반응하는 스타일이에요. 감정을 이모지로 풍부하게 표현하며, 빠른 응답으로 상대방의 대화 흐름을 놓치지 않으려는 배려심이 보여요.',
    tips: [
      '이모지 하나로도 충분히 감정을 전달할 수 있어요.',
      '빠른 답장으로 관계의 템포를 맞추는 타입입니다.',
      '짧고 명확한 메시지에 반응하는 것을 선호합니다.',
    ],
  },
  'R-F-Tx-Slw': {
    name: '조용한 관찰자',
    subtitle: '필요할 때 정확히 반응하는 타입',
    summary: '먼저 대화를 시작하기보다는 상대방의 말에 신중하게 반응하는 스타일이에요. 감정을 잘 읽고 공감하지만, 표현은 텍스트로 차분하게 정리합니다. 천천히 깊이 있는 대화를 선호하며, 즉각적인 응답보다는 생각을 정리한 후 답장하는 편이에요.',
    tips: [
      '답장이 늦어도 관심이 없어서가 아니라 생각을 정리하는 시간이 필요해요.',
      '공감을 먼저 해주면 마음의 문이 빨리 열립니다.',
      '긴 대화보다는 깊이 있는 짧은 메시지를 선호합니다.',
    ],
  },
  'R-F-Em-Slw': {
    name: '따뜻한 반응형',
    subtitle: '이모지로 따뜻함을 전하는 신중한 파트너',
    summary: '대화를 먼저 시작하기보다는 상대방의 메시지에 따뜻하게 반응하는 스타일이에요. 이모지를 활용해 감정을 풍부하게 표현하지만, 답장은 여유롭게 하는 편입니다. 깊이 있는 감정 공유를 중시하지만, 즉각적인 응답보다는 진심이 담긴 답장을 선호해요.',
    tips: [
      '답장이 늦어도 따뜻하게 반응할 준비가 되어 있어요.',
      '이모지와 함께 짧은 공감 메시지가 큰 힘이 됩니다.',
      '무리하게 빠른 답장을 요구하지 않으면 더 편하게 소통할 수 있어요.',
    ],
  },
  'R-T-Tx-Fst': {
    name: '효율적 반응자',
    subtitle: '빠르고 명확한 솔루션 제공자',
    summary: '대화를 먼저 시작하기보다는 상대방의 메시지에 빠르고 논리적으로 반응하는 타입이에요. 해결 중심적이며 텍스트로 명확하게 정리된 답장을 선호합니다. 빠른 응답으로 효율적인 소통을 중시하지만, 때로는 감정적 공감도 함께 해줄 수 있다면 더 좋아요.',
    tips: [
      '명확하고 구체적인 피드백을 선호합니다.',
      '빠른 응답으로 효율성을 중시하는 타입이에요.',
      '직설적인 말투가 무뚝뚝해 보일 수 있지만 의도를 악의적으로 해석하지 마세요.',
    ],
  },
  'R-T-Em-Fst': {
    name: '빠른 해결자',
    subtitle: '이모지로 부드럽게 반응하는 효율형',
    summary: '대화를 먼저 시작하기보다는 상대방의 메시지에 빠르게 반응하며, 해결 중심적인 접근을 선호해요. 이모지를 활용해 분위기를 부드럽게 만들면서도 핵심은 명확하게 전달하는 스타일입니다.',
    tips: [
      '유머러스하면서도 논리적인 대화를 선호합니다.',
      '빠른 응답에 압박을 느낄 수 있으니 편하게 답장해도 됩니다.',
      '불필요한 설명보다는 결론과 이모지 리액션이 더 효과적이에요.',
    ],
  },
  'R-T-Tx-Slw': {
    name: '신중한 분석가',
    subtitle: '깊이 생각한 후 답하는 논리형',
    summary: '대화를 시작하는 것보다는 상대방의 말을 신중하게 분석하고 반응하는 타입이에요. 감정보다는 논리적 해결책에 집중하며, 텍스트로 명확하게 정리된 메시지를 선호합니다. 여유롭게 생각을 정리한 후 답장하는 스타일이에요.',
    tips: [
      '답장이 늦어도 신중하게 생각하고 있다는 뜻이에요.',
      '논리적이고 명확한 설명을 선호합니다.',
      '직설적인 말투가 무뚝뚝해 보일 수 있지만 의도는 따뜻합니다.',
    ],
  },
  'R-T-Em-Slw': {
    name: '여유로운 해결자',
    subtitle: '이모지로 분위기를 완화하는 신중한 타입',
    summary: '대화를 먼저 시작하기보다는 상황을 관찰하고 필요할 때 반응하는 스타일이에요. 해결 중심적이지만 이모지를 활용해 분위기를 부드럽게 만들며, 여유롭게 답장하는 것을 선호합니다.',
    tips: [
      '답장이 늦어도 생각을 정리하는 시간이 필요해요.',
      '유머러스하면서도 논리적인 대화를 선호합니다.',
      '무리하게 빠른 답장을 요구하지 않으면 더 편하게 소통할 수 있어요.',
    ],
  },
};

// Get persona info for a personality code
const getPersonaInfo = (code: PersonalityCode): PersonaInfo => {
  const codeString = `${code.initiative}-${code.emotion}-${code.expression}-${code.tempo}`;
  return personaMap[codeString] || personaMap['I-F-Tx-Fst'];
};

interface AxisProps {
  title: string;
  value: number;
  leftLabel: string;
  rightLabel: string;
  leftCode: string;
  rightCode: string;
  theme?: 'purple' | 'blue' | 'orange' | 'pink';
}

const AxisCard: React.FC<AxisProps> = ({
  title,
  value,
  leftLabel,
  rightLabel,
  leftCode,
  rightCode,
  theme = 'purple',
}) => {
  const clampedValue = Math.max(0, Math.min(100, value));
  const isRightSide = clampedValue >= 50;
  const activeCode = isRightSide ? rightCode : leftCode;
  const activeLabel = isRightSide ? rightLabel : leftLabel;

  const themeClasses = {
    purple: {
      leftColor: '#c084fc',
      rightColor: '#7c3aed',
      text: 'text-purple-700',
      bg: 'bg-gradient-to-br from-purple-50 to-purple-100',
      border: 'border-purple-300',
      shadow: 'shadow-purple-200/50',
    },
    blue: {
      leftColor: '#60a5fa',
      rightColor: '#3b82f6',
      text: 'text-blue-700',
      bg: 'bg-gradient-to-br from-blue-50 to-blue-100',
      border: 'border-blue-300',
      shadow: 'shadow-blue-200/50',
    },
    orange: {
      leftColor: '#fb923c',
      rightColor: '#ea580c',
      text: 'text-orange-700',
      bg: 'bg-gradient-to-br from-orange-50 to-orange-100',
      border: 'border-orange-300',
      shadow: 'shadow-orange-200/50',
    },
    pink: {
      leftColor: '#f472b6',
      rightColor: '#db2777',
      text: 'text-pink-700',
      bg: 'bg-gradient-to-br from-pink-50 to-pink-100',
      border: 'border-pink-300',
      shadow: 'shadow-pink-200/50',
    },
  };

  const currentTheme = themeClasses[theme];

  return (
    <div className={`itda-card p-5 hover:scale-[1.02] transition-all duration-300 ${currentTheme.bg} border-2 ${currentTheme.border} shadow-lg ${currentTheme.shadow}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800">{title}</h3>
        <span className={`text-xs font-mono font-extrabold px-3 py-1.5 rounded-full ${currentTheme.text} bg-white/80 border ${currentTheme.border} shadow-sm`}>
          {activeCode}
        </span>
      </div>
      
      {/* Spectrum Bar */}
      <div className="mb-4">
        <div className="relative h-10 rounded-full overflow-hidden shadow-inner" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
          {/* Full gradient spectrum background */}
          <div
            className="absolute inset-0 h-full transition-all duration-500"
            style={{
              background: `linear-gradient(to right, ${currentTheme.leftColor}40, ${currentTheme.rightColor}80)`,
            }}
          />
          {/* Active portion with glow effect */}
          <div
            className="h-full transition-all duration-500 relative"
            style={{
              width: `${clampedValue}%`,
              background: `linear-gradient(to right, ${currentTheme.leftColor}, ${currentTheme.rightColor})`,
            }}
          >
            <div className="absolute inset-0 bg-white/20 blur-sm" />
          </div>
          {/* Indicator marker */}
          <div
            className="absolute top-1/2 -translate-y-1/2 z-10 transition-all duration-500"
            style={{
              left: `${clampedValue}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="w-3 h-12 bg-white rounded-full shadow-xl border-2"
              style={{
                borderColor: currentTheme.rightColor,
                boxShadow: `0 4px 12px ${currentTheme.rightColor}80, 0 0 20px ${currentTheme.rightColor}40`,
              }}
            />
          </div>
        </div>
        
        {/* Labels */}
        <div className="flex justify-between mt-3 text-xs font-semibold text-gray-600">
          <span className="opacity-70">{leftLabel}</span>
          <span className="opacity-70">{rightLabel}</span>
        </div>
      </div>

      {/* Active Label */}
      <div className={`text-center py-2.5 px-4 rounded-xl ${currentTheme.bg} border-2 ${currentTheme.border} shadow-md backdrop-blur-sm`}>
        <span className={`text-sm font-bold ${currentTheme.text}`}>{activeLabel}</span>
      </div>
    </div>
  );
};

interface PersonalityBadgeProps {
  code: PersonalityCode;
}

const PersonalityBadge: React.FC<PersonalityBadgeProps> = ({ code }) => {
  const codeString = `${code.initiative}-${code.emotion}-${code.expression}-${code.tempo}`;
  
  return (
    <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-gradient-to-r from-purple-100 via-pink-100 to-blue-100 border-2 border-purple-300 shadow-xl backdrop-blur-sm">
      <span className="font-mono text-lg font-black text-gray-800 tracking-wider drop-shadow-sm">
        {codeString}
      </span>
    </div>
  );
};

/**
 * SelfAnalysis Component
 * 
 * IMPORTANT: This component is completely independent from Person Analysis logic.
 * 
 * Data Flow:
 * 1. Fetches all conversation histories using getAllPersonsHistory() (Firebase)
 * 2. Combines all conversations into a single string
 * 3. Analyzes user's own conversation style using analyzeSelfConversation() (Gemini API)
 * 4. Displays 4-axis personality analysis
 * 
 * This does NOT:
 * - Use handleNewAnalysis or analyzeConversation (person-specific analysis)
 * - Use savePersonData or person creation logic
 * - Share any mutable state with person analysis
 * - Depend on StoredAnalysis or PersonData structures
 */
const SelfAnalysis: React.FC = () => {
  const { t, language } = useLanguage();
  const { currentUser } = useAuth();
  const [analysisData, setAnalysisData] = useState<SelfAnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAttemptedAnalysis, setHasAttemptedAnalysis] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // Guard against rapid clicks

  // Load cached result from localStorage on mount
  useEffect(() => {
    if (!currentUser?.uid) return;
    
    try {
      const cached = localStorage.getItem(`selfAnalysis_${currentUser.uid}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Check if cache is from today (optional: could add timestamp check)
        setAnalysisData(parsed);
        setHasAttemptedAnalysis(true);
      }
    } catch (err) {
      console.warn('[SelfAnalysis] Failed to load cached result:', err);
    }
  }, [currentUser]);

  /**
   * Check if error is a quota/rate-limit error (429)
   */
  const isQuotaError = (err: any): boolean => {
    if (!err) return false;
    
    // Check for 429 status code
    if (err.status === 429 || err.code === 429) return true;
    
    // Check error message for quota/rate-limit keywords
    const message = err.message?.toLowerCase() || '';
    const errorString = JSON.stringify(err).toLowerCase();
    
    return (
      message.includes('429') ||
      message.includes('resource_exhausted') ||
      message.includes('quota') ||
      message.includes('rate limit') ||
      errorString.includes('resource_exhausted') ||
      errorString.includes('quota')
    );
  };

  /**
   * Handle self analysis - only runs when user clicks button
   */
  const handleAnalyze = async () => {
    if (!currentUser?.uid) {
      setError('로그인이 필요합니다.');
      return;
    }

    // Guard against rapid clicks
    if (isAnalyzing) {
      return;
    }

    try {
      setIsLoading(true);
      setIsAnalyzing(true);
      setError(null);
      setHasAttemptedAnalysis(true);

      // Step 1: Get all conversation histories from all persons
      // This reads raw history arrays from Firestore - independent of person analysis structure
      const histories = await getAllPersonsHistory();
      
      if (histories.length === 0) {
        setError('분석할 대화가 없습니다. 먼저 관계 맵에 사람을 추가하고 대화를 분석해주세요.');
        setIsLoading(false);
        setIsAnalyzing(false);
        return;
      }

      // Step 2: Combine all conversations into a single string
      const combinedHistory = histories.join('\n\n--- 다른 사람과의 대화 ---\n\n');

      // Step 3: Analyze self conversation style using dedicated self-analysis function
      // This is completely separate from analyzeConversation (person-specific)
      const result = await analyzeSelfConversation(combinedHistory, language);
      
      // Step 4: Save to cache
      setAnalysisData(result);
      try {
        localStorage.setItem(`selfAnalysis_${currentUser.uid}`, JSON.stringify(result));
      } catch (cacheErr) {
        console.warn('[SelfAnalysis] Failed to cache result:', cacheErr);
      }
    } catch (err: any) {
      console.error('[SelfAnalysis] Failed to analyze:', err);
      
      // Handle quota/rate-limit errors with friendly message
      if (isQuotaError(err)) {
        setError('오늘의 AI 분석 사용량을 모두 사용했어요. 내일 다시 시도해주세요.');
        // Don't clear cached data on quota error - keep showing previous result if available
      } else {
        // Other errors - show actual error message
        setError(err.message || '자기 분석에 실패했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setIsLoading(false);
      // Debounce: allow new request after 1 second
      setTimeout(() => setIsAnalyzing(false), 1000);
    }
  };

  // Show loading state only when actively analyzing
  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6 fade-in">
        <div className="itda-card p-12 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-64 mx-auto" />
            <div className="h-4 bg-gray-200 rounded w-48 mx-auto" />
            <div className="mt-8 space-y-3">
              <div className="h-24 bg-gray-200 rounded-lg" />
              <div className="h-24 bg-gray-200 rounded-lg" />
              <div className="h-24 bg-gray-200 rounded-lg" />
              <div className="h-24 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no analysis data and no error yet, show the initial state with button
  if (!analysisData && !hasAttemptedAnalysis && !error) {
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6 fade-in">
        <div className="itda-card p-8 md:p-10 text-center">
          <h2 className="text-2xl md:text-3xl font-black text-gray-800 mb-3">
            {t('selfAnalysisTitle')}
          </h2>
          <p className="text-lg text-gray-600 mb-6">
            {t('selfAnalysisDescription')}
          </p>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !currentUser?.uid}
            className="itda-btn itda-btn-primary px-8 py-3 text-lg smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('startSelfAnalysis')}
          </button>
        </div>
      </div>
    );
  }

  // If we have error but no data, show error with retry option (unless it's quota error)
  if (error && !analysisData) {
    const isQuota = error.includes('오늘의 AI 분석 사용량');
    return (
      <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6 fade-in">
        <div className={`itda-card p-8 text-center ${isQuota ? 'bg-yellow-50 border-yellow-200' : ''}`}>
          <div className={`font-semibold ${isQuota ? 'text-yellow-700' : 'text-red-500'} mb-4`}>
            {error}
          </div>
          {!isQuota && (
            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing}
              className="itda-btn itda-btn-primary px-6 py-2 smooth-transition disabled:opacity-50"
            >
              다시 시도
            </button>
          )}
        </div>
      </div>
    );
  }

  // If no analysis data at this point, don't render anything
  if (!analysisData) {
    return null;
  }

  const personalityCode = getPersonalityCode(analysisData);
  const persona = getPersonaInfo(personalityCode);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6 fade-in">
      {/* Header with re-analyze button */}
      <div className="itda-card p-5 flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-800">
            {t('selfAnalysisTitle')}
          </h2>
          <p className="text-gray-600 mt-1">{t('selfAnalysisDescription')}</p>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="itda-btn itda-btn-secondary px-4 py-2 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? '분석 중...' : '다시 분석하기'}
        </button>
      </div>

      {/* Show quota error message if present (non-blocking) */}
      {error && error.includes('오늘의 AI 분석 사용량') && (
        <div className="itda-card p-4 bg-yellow-50 border-yellow-200 border-2">
          <div className="text-yellow-700 text-sm font-medium text-center">
            {error}
          </div>
        </div>
      )}

      {/* Personality Header */}
      <div className="itda-card p-8 md:p-10 text-center bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 border-2 border-purple-300 shadow-2xl">
        <div className="mb-6">
          <PersonalityBadge code={personalityCode} />
        </div>
        <h2 className="text-3xl md:text-4xl font-black text-gray-800 mb-3 drop-shadow-sm">
          {persona.name}
        </h2>
        <p className="text-xl text-gray-700 font-semibold">
          {persona.subtitle}
        </p>
      </div>

      {/* 4 Axes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <AxisCard
          title={t('initiativeAxis')}
          value={analysisData.initiative}
          leftLabel={t('initiativeReplier')}
          rightLabel={t('initiativeInitiator')}
          leftCode="R"
          rightCode="I"
          theme="purple"
        />
        
        <AxisCard
          title={t('emotionAxis')}
          value={analysisData.emotion}
          leftLabel={t('emotionThinking')}
          rightLabel={t('emotionFeeling')}
          leftCode="T"
          rightCode="F"
          theme="blue"
        />
        
        <AxisCard
          title={t('expressionAxis')}
          value={analysisData.expression}
          leftLabel={t('expressionTextType')}
          rightLabel={t('expressionEmojiType')}
          leftCode="Tx"
          rightCode="Em"
          theme="orange"
        />
        
        <AxisCard
          title={t('tempoAxis')}
          value={analysisData.tempo}
          leftLabel={t('tempoLeisurely')}
          rightLabel={t('tempoQuick')}
          leftCode="Slw"
          rightCode="Fst"
          theme="pink"
        />
      </div>

      {/* Summary Section */}
      <div className="itda-card p-7 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 shadow-xl">
        <h3 className="text-2xl font-black text-gray-800 mb-5 flex items-center gap-3">
          <span className="w-1 h-8 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
          {t('analysisSummary')}
        </h3>
        <p className="text-gray-700 leading-relaxed text-base pl-4">
          {persona.summary}
        </p>
      </div>

      {/* Tips Section */}
      <div className="itda-card p-7 bg-gradient-to-br from-purple-50/80 via-pink-50/80 to-blue-50/80 border-2 border-purple-300 shadow-xl backdrop-blur-sm">
        <h3 className="text-xl font-black text-gray-800 mb-5 flex items-center gap-3">
          <span className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
          {t('howToGetAlong')}
        </h3>
        <ul className="space-y-4 pl-4">
          {persona.tips.map((tip, index) => (
            <li key={index} className="flex items-start gap-4 group">
              <span className="flex-shrink-0 w-2 h-2 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 mt-2 group-hover:scale-150 transition-transform shadow-sm" />
              <span className="text-gray-700 text-base leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default SelfAnalysis;
