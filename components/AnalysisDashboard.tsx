import React, { useState } from 'react';
import { AnalysisResult, RelationshipMode } from '../types';
import RelationshipGauge from './RelationshipGauge';
import { ChatBubbleIcon, TagIcon, CheckCircleIcon } from './icons';
import { RELATIONSHIP_THEMES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  mode: RelationshipMode;
}

// 가로 막대 그래프 컴포넌트 (3-column grid 구조)
const HorizontalProgressBar: React.FC<{ label: string; value: number; themeColor: string; }> = ({ label, value, themeColor }) => {
  const width = Math.max(0, Math.min(100, value));
  return (
    <div className="grid grid-cols-[96px_1fr_48px] items-center w-full gap-4">
      {/* 지표명 - 첫 번째 column (96px 고정) */}
      <span className="text-lg font-semibold text-gray-700">{label}</span>
      {/* 가로 진행 바 - 두 번째 column (1fr, 가변) */}
      <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
        <div 
          className={`h-full ${themeColor} smooth-transition rounded-full`} 
          style={{ width: `${width}%`, transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
        ></div>
      </div>
      {/* 수치 - 세 번째 column (48px 고정, 오른쪽 정렬) */}
      <span className="text-lg font-bold text-gray-800 text-right">{Math.round(value)}</span>
    </div>
  );
};

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, mode }) => {
  const { t, language } = useLanguage();
  const theme = RELATIONSHIP_THEMES[mode];
  const isRomance = mode === RelationshipMode.ROMANCE;
  
  // 챗봇 상태 (인라인)
  const [chatbotMessages, setChatbotMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [chatbotInput, setChatbotInput] = useState('');
  const [chatbotLoading, setChatbotLoading] = useState(false);

  // 관계 단계 계산 (romance 전용)
  const getRelationshipStage = () => {
    const score = result.intimacyScore;
    let stage: string;
    let description: string;
    let position: number;

    // score를 0~100%로 직접 매핑 (레이블: 친구 0%, 썸 초입 33%, 썸 66%, 연인 100%)
    position = Math.min(100, Math.max(0, score));
    
    // 막대 끝(100%)에서는 약간 안쪽으로 clamp 처리 (최대 95%)
    if (position >= 100) {
      position = 95;
    }

    // 단계 판단 (점수 구간별)
    if (score <= 30) {
      stage = t('romanceStageFriend');
      description = t('romanceStageDescriptionFriend');
    } else if (score <= 55) {
      stage = t('romanceStageFlirtingStart');
      description = t('romanceStageDescriptionFlirtingStart');
    } else if (score <= 75) {
      stage = t('romanceStageFlirting');
      description = t('romanceStageDescriptionFlirting');
    } else {
      stage = t('romanceStageDating');
      description = t('romanceStageDescriptionDating');
    }

    return { stage, description, position };
  };

  const relationshipStage = isRomance ? getRelationshipStage() : null;

  // 관계 지표 요약 문장 생성
  const getMetricsSummary = (): string => {
    const participation = result.balanceRatio.speaker1.percentage;
    const positivity = result.sentiment.positive;
    const intimacy = result.intimacyScore;
    const balance = Math.abs(participation - result.balanceRatio.speaker2.percentage);

    // 참여도, 긍정성, 친밀도를 종합한 요약 문장 생성
    if (positivity > 60 && intimacy > 50 && balance < 30) {
      return language === 'ko' 
        ? '서로를 배려하며 비교적 안정적인 대화 흐름을 유지하고 있어요.'
        : 'Maintaining a relatively stable conversation flow with mutual consideration.';
    } else if (positivity > 50 && intimacy > 40) {
      return language === 'ko'
        ? '감정 표현이 자연스럽고 긍정적인 소통이 중심이 되는 관계예요.'
        : 'A relationship centered on natural emotional expression and positive communication.';
    } else if (positivity > 40) {
      return language === 'ko'
        ? '전반적으로 긍정적이고 편안한 소통이 이루어지고 있는 관계예요.'
        : 'Overall, positive and comfortable communication is taking place in this relationship.';
    } else {
      return language === 'ko'
        ? '대화를 통해 서로를 알아가고 있는 단계예요.'
        : 'A stage of getting to know each other through conversation.';
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-8 fade-in">
      {/* Top Section: Gauge and Summary */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
        <RelationshipGauge score={result.intimacyScore} mode={mode} />
        <div className="flex-1 w-full text-center md:text-left">
            <h2 className="text-3xl font-bold text-gray-800">{t('analysisResults')}</h2>
            <p className={`mt-2 text-lg font-medium ${theme.text}`}>{result.summary}</p>
            {/* It-Da 추천 박스: romance에서만 제거 */}
            {!isRomance && (
              <div className="mt-4 bg-yellow-100 border-l-4 border-yellow-400 text-yellow-700 p-4 rounded-md">
                <p className="font-bold">{t('recommendationTitle')}</p>
                <p>{result.recommendation}</p>
              </div>
            )}
        </div>
      </div>

      {/* 관계 위치 진단 섹션 (romance 전용) */}
      {isRomance && relationshipStage && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <h3 className="text-xl font-bold text-gray-800 mb-4">{t('romanceRelationshipPosition')}</h3>
          <div className="space-y-4">
            {/* 관계 단계 바 */}
            <div className="relative">
              {/* 진행 바 */}
              <div className="relative h-8 bg-gray-200 rounded-full overflow-visible mb-2">
                <div 
                  className={`absolute h-full ${theme.medium} smooth-transition rounded-full`}
                  style={{ width: `${relationshipStage.position}%`, transition: 'width 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
                ></div>
                {/* 현재 위치 마커 - 화살표 (막대 위, 막대 기준으로만 위치 계산) */}
                <div
                  className="absolute bottom-full left-0 flex flex-col items-center"
                  style={{ 
                    left: `${relationshipStage.position}%`,
                    transform: 'translateX(-50%)',
                    marginBottom: '4px'
                  }}
                >
                  {/* 현재 단계 텍스트 */}
                  <div className="mb-1">
                    <span className="text-xs font-semibold text-pink-600 whitespace-nowrap">{relationshipStage.stage}</span>
                  </div>
                  <div className="text-white text-xs font-bold bg-pink-600 px-2 py-0.5 rounded shadow-md">
                    ▲
                  </div>
                </div>
              </div>
              {/* 단계 레이블 (막대 아래) - 0%, 33%, 66%, 100% 위치에 배치 */}
              <div className="relative text-sm text-gray-600" style={{ height: '20px' }}>
                <span className="absolute left-0 text-center" style={{ transform: 'translateX(-50%)' }}>{t('romanceStageFriend')}</span>
                <span className="absolute left-0 text-center" style={{ left: '33%', transform: 'translateX(-50%)' }}>{t('romanceStageFlirtingStart')}</span>
                <span className="absolute left-0 text-center" style={{ left: '66%', transform: 'translateX(-50%)' }}>{t('romanceStageFlirting')}</span>
                <span className="absolute left-0 text-center" style={{ left: '100%', transform: 'translateX(-50%)' }}>{t('romanceStageDating')}</span>
              </div>
            </div>
            <p className="text-gray-700 leading-relaxed mt-4">{relationshipStage.description}</p>
          </div>
        </div>
      )}

      {/* Core Metrics + Keyword Cloud (2분할) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 모바일: 워드 클라우드가 위 (order-1), 데스크탑: 오른쪽 (order-2) */}
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 order-1 md:order-2">
          <h3 className="text-xl font-bold text-gray-800 mb-2">대화 키워드</h3>
          <p className="text-sm text-gray-600 mb-4">실제 대화에서 자주 등장한 표현을 시각화했어요</p>
          <div className="flex flex-wrap gap-2 items-center justify-center min-h-[200px] py-4">
            {['시험', '피곤', '걱정', '웃음', '응원'].map((keyword, index) => (
              <span
                key={index}
                className="text-base font-semibold px-3 py-1.5 rounded-full border text-pink-600 bg-pink-50 border-pink-200"
              >
                {keyword}
              </span>
            ))}
          </div>
        </div>
        
        {/* 모바일: 지표 그래프가 아래 (order-2), 데스크탑: 왼쪽 (order-1) */}
        <div className="bg-white p-6 pb-8 rounded-2xl shadow-lg border border-gray-100 order-2 md:order-1">
          <h3 className="text-xl font-bold text-gray-800 mb-5">{t('relationshipMetricsSummary')}</h3>
          <div className="space-y-5">
            <HorizontalProgressBar label={t('participation')} value={result.balanceRatio.speaker1.percentage} themeColor={theme.medium} />
            <HorizontalProgressBar label={t('positivity')} value={result.sentiment.positive} themeColor={theme.medium} />
            <HorizontalProgressBar label={t('intimacy')} value={result.intimacyScore} themeColor={theme.medium} />
          </div>
          {/* 요약 문장 */}
          <p className="text-sm text-gray-600 leading-relaxed mt-6">
            {getMetricsSummary()}
          </p>
        </div>
      </div>

       {/* Next Step Suggestions Section */}
       <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
         <h3 className="text-xl font-bold text-gray-800 mb-4">{t('nextStepTitle')}</h3>
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           {/* 답장 추천 */}
           <div>
              <div className="flex items-center text-gray-700 mb-3">
                <ChatBubbleIcon className={`w-6 h-6 mr-2 ${isRomance ? 'text-pink-500' : 'text-purple-500'}`} />
                <h4 className="font-bold">{t('suggestedRepliesTitle')}</h4>
              </div>
              <div className="space-y-2">
                {result.suggestedReplies.map((reply, index) => (
                    <div 
                      key={index} 
                      className={`p-3 rounded-lg text-sm ${
                        isRomance 
                          ? 'bg-pink-50 text-pink-800 border border-pink-200' 
                          : 'bg-purple-50 text-purple-800'
                      }`}
                    >
                      {reply}
                    </div>
                ))}
              </div>
           </div>
           {/* 오른쪽 영역: romance에서는 주의 포인트, 다른 카테고리에서는 대화 주제 추천 */}
           {isRomance ? (
             <div>
               <div className="flex items-center text-gray-700 mb-3">
                 <CheckCircleIcon className="w-6 h-6 mr-2 text-pink-500" />
                 <h4 className="font-bold">{t('romanceAttentionPoints' as any)}</h4>
               </div>
               <div className="space-y-3">
                 <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm text-yellow-800">
                   감정 표현은 좋지만, 너무 빠른 확신 표현은 부담이 될 수 있어요.
                 </div>
                 <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm text-yellow-800">
                   상대의 반응 속도와 리액션 강도를 먼저 맞추는 게 중요해요.
                 </div>
                 <div className="p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded text-sm text-yellow-800">
                   질문은 열어두되, 답을 재촉하지 않는 태도가 좋아요.
                 </div>
               </div>
             </div>
           ) : (
             <div>
                <div className="flex items-center text-gray-700 mb-3">
                  <TagIcon className="w-6 h-6 mr-2 text-indigo-500" />
                  <h4 className="font-bold">{t('suggestedTopicsTitle')}</h4>
                </div>
                <div className="space-y-2">
                  {result.suggestedTopics.map((topic, index) => (
                      <div key={index} className="p-3 bg-indigo-50 rounded-lg text-sm text-indigo-800">{topic}</div>
                  ))}
                </div>
             </div>
           )}
         </div>
         
         {/* 대화 주제 추천 섹션 (romance 전용, 답장 추천/주의 포인트 아래, 챗봇 위) */}
         {isRomance && result.suggestedTopics.length > 0 && (
           <div className="mt-6 pt-6 border-t border-gray-200">
             <div className="flex items-baseline mb-2">
               <TagIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 text-pink-500" />
               <h4 className="font-bold text-gray-800 leading-tight">{t('suggestedTopicsTitle')}</h4>
             </div>
             <p className="text-sm text-gray-600 mb-4 ml-7">{t('romanceTopicsSubtitle' as any)}</p>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
               {result.suggestedTopics.map((topic, index) => (
                 <div 
                   key={index} 
                   className="p-4 rounded-lg text-sm bg-pink-50 text-gray-800 border border-pink-200"
                 >
                   {topic}
                 </div>
               ))}
             </div>
           </div>
         )}
       </div>

       {/* 챗봇 섹션 (romance 전용, 맨 하단, 인라인) */}
       {isRomance && (
         <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
           <h3 className="text-xl font-bold text-gray-800 mb-2">{t('romanceChatbotTitle')}</h3>
           <p className="text-sm text-gray-600 mb-4">{t('romanceChatbotDesc')}</p>
           
           {/* 메시지 영역 */}
           <div className="bg-gray-50 rounded-lg p-4 mb-4 h-64 overflow-y-auto space-y-3">
             {chatbotMessages.length === 0 && (
               <div className="text-center text-gray-500 py-8">
                 <p className="text-sm">
                   {language === 'ko' 
                     ? '관계에 대해 궁금한 것을 물어보세요.'
                     : 'Ask anything about your relationship.'}
                 </p>
               </div>
             )}
             {chatbotMessages.map((msg, index) => (
               <div
                 key={index}
                 className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
               >
                 <div
                   className={`max-w-[80%] rounded-lg p-3 text-sm ${
                     msg.role === 'user'
                       ? 'bg-pink-500 text-white'
                       : 'bg-white text-gray-800 border border-gray-200'
                   }`}
                 >
                   <p className="whitespace-pre-wrap">{msg.content}</p>
                 </div>
               </div>
             ))}
             {chatbotLoading && (
               <div className="flex justify-start">
                 <div className="bg-white rounded-lg p-3 border border-gray-200">
                   <div className="flex space-x-1">
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                     <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                   </div>
                 </div>
               </div>
             )}
           </div>

           {/* 입력 영역 */}
           <div className="flex gap-2">
             <input
               type="text"
               value={chatbotInput}
               onChange={(e) => setChatbotInput(e.target.value)}
               onKeyPress={(e) => {
                 if (e.key === 'Enter' && !e.shiftKey) {
                   e.preventDefault();
                   // 실제 AI 연동은 하지 않음 (UI만 구현)
                   if (chatbotInput.trim() && !chatbotLoading) {
                     const userMessage = chatbotInput.trim();
                     setChatbotInput('');
                     setChatbotMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
                     setChatbotLoading(true);
                     // 간단한 응답 시뮬레이션 (실제로는 AI 연동)
                     setTimeout(() => {
                       setChatbotMessages((prev) => [...prev, { 
                         role: 'assistant', 
                         content: language === 'ko' 
                           ? '이 기능은 곧 제공될 예정입니다. 분석 결과를 바탕으로 관계 조언을 제공할 수 있어요.'
                           : 'This feature will be available soon. I can provide relationship advice based on your analysis results.'
                       }]);
                       setChatbotLoading(false);
                     }, 1000);
                   }
                 }
               }}
               placeholder={t('romanceChatbotPlaceholder')}
               className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
               disabled={chatbotLoading}
             />
             <button
               onClick={() => {
                 if (chatbotInput.trim() && !chatbotLoading) {
                   const userMessage = chatbotInput.trim();
                   setChatbotInput('');
                   setChatbotMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
                   setChatbotLoading(true);
                   // 간단한 응답 시뮬레이션 (실제로는 AI 연동)
                   setTimeout(() => {
                     setChatbotMessages((prev) => [...prev, { 
                       role: 'assistant', 
                       content: language === 'ko' 
                         ? '이 기능은 곧 제공될 예정입니다. 분석 결과를 바탕으로 관계 조언을 제공할 수 있어요.'
                         : 'This feature will be available soon. I can provide relationship advice based on your analysis results.'
                     }]);
                     setChatbotLoading(false);
                   }, 1000);
                 }
               }}
               disabled={chatbotLoading || !chatbotInput.trim()}
               className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
             >
               {t('romanceChatbotSend')}
             </button>
           </div>
         </div>
       )}
    </div>
  );
};

export default AnalysisDashboard;