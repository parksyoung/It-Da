import React from 'react';
import { AnalysisResult, RelationshipMode } from '../types';
import RelationshipGauge from './RelationshipGauge';
import { ChatBubbleIcon, TagIcon, BarChartIcon, ExclamationTriangleIcon } from './icons';
import { RELATIONSHIP_THEMES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  mode: RelationshipMode;
  chatHistory?: string[]; // 실제 대화 텍스트 히스토리
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const MetricRow: React.FC<{ label: string; value: number; barClassName: string }> = ({ label, value, barClassName }) => {
  const pct = clampPercent(value);

  return (
    <div className="flex items-center gap-4 w-full">
      <div className="min-w-16 text-sm font-semibold text-gray-700 flex-shrink-0">{label}</div>
      <div className="flex-1 min-w-0">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
          <div className={`${barClassName} h-full smooth-transition`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-12 text-right text-sm font-bold text-gray-800 flex-shrink-0">{Math.round(value)}</div>
    </div>
  );
};

const buildWordCloud = (chatHistory?: string[]) => {
  // 실제 대화 텍스트가 없으면 빈 배열 반환
  if (!chatHistory || chatHistory.length === 0) {
    return [] as { word: string; count: number }[];
  }

  // 모든 대화를 하나의 문자열로 합치기
  const raw = chatHistory.join(' ');
  
  // 대화 형식에서 이름: 부분 제거 (예: "철수: 안녕" -> "안녕")
  const withoutNames = raw.replace(/^[^:]+:\s*/gm, '');
  
  // 정규화: 소문자 변환, 특수문자 제거
  const normalized = withoutNames
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [] as { word: string; count: number }[];

  // 불용어 목록 (조사, 접속사, 의미 없는 단어)
  const stop = new Set([
    // 영어 불용어
    'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'it', 'as', 'at', 'by', 'from', 'you', 'your', 'we', 'our', 'they', 'their', 'i', 'me', 'my',
    // 한국어 불용어
    '그리고', '하지만', '그래서', '또한', '그냥', '정말', '너무', '조금', '좀', '저', '나', '너', '우리', '그', '이', '저는',
    '그게', '이게', '저게', '그건', '이건', '저건', '그거', '이거', '저거',
    '있어', '없어', '있고', '없고', '있는', '없는', '있어서', '없어서',
    '하는', '하는데', '해서', '하면', '하니', '하지만', '하니까',
    '되는', '되는데', '돼서', '되면', '되니', '되지만',
    '같은', '같아', '같은데', '같아서', '같으면',
    '좋은', '좋아', '좋은데', '좋아서', '좋으면',
    '안', '못', '안해', '못해', '안돼', '못돼',
    '오전', '오후', '아침', '점심', '저녁', '밤',
    '한시간', '한시', '두시', '세시', '네시', '다섯시',
    '사진', '이미지', '파일', '기능', '상담', '테스트',
    '연수', '학교', '다들', '아니', '네', '응', '어', '음',
  ]);

  // 시간 표현 패턴 (예: "오전 9시", "3시", "한시간" 등)
  const timePattern = /^\d+시$|^오전|^오후|^한시간|^두시간|^세시간|^네시간|^다섯시간|^여섯시간|^일곱시간|^여덟시간|^아홉시간|^열시간/i;
  
  // 인명 패턴 (한글 이름, 영문 이름)
  const namePattern = /^[가-힣]{2,4}$|^[A-Z][a-z]+$/;

  const counts = new Map<string, number>();
  const tokens = normalized.split(' ');
  
  for (const token of tokens) {
    const w = token.trim();
    if (!w) continue;
    
    // 2글자 미만 제거
    if (w.length < 2) continue;
    
    // 불용어 제거
    if (stop.has(w)) continue;
    
    // 시간 표현 제거
    if (timePattern.test(w)) continue;
    
    // 인명 제거 (2-4글자 한글 또는 영문 이름)
    if (namePattern.test(w) && w.length <= 4) continue;
    
    // 숫자만 있는 경우 제거
    if (/^\d+$/.test(w)) continue;
    
    counts.set(w, (counts.get(w) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // 최대 10개까지만
};

const getRomanceStageIndex = (result: AnalysisResult) => {
  const intimacy = clampPercent(result.intimacyScore);
  const positivity = clampPercent(result.sentiment?.positive ?? 0);
  const weighted = intimacy * 0.75 + positivity * 0.25;

  if (weighted < 30) return 0; // 친구
  if (weighted < 55) return 1; // 썸 초입
  if (weighted < 75) return 2; // 썸
  return 3; // 연인
};

const RomanceStageCard: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  if (mode !== RelationshipMode.ROMANCE) return null;

  const { t } = useLanguage();
  const theme = RELATIONSHIP_THEMES[mode];
  const stages = [
    { key: 'romanceStageFriend', desc: 'romanceStageDescriptionFriend' },
    { key: 'romanceStageFlirtingStart', desc: 'romanceStageDescriptionFlirtingStart' },
    { key: 'romanceStageFlirting', desc: 'romanceStageDescriptionFlirting' },
    { key: 'romanceStageDating', desc: 'romanceStageDescriptionDating' },
  ] as const;
  const stageIndex = getRomanceStageIndex(result);
  
  // Calculate position: 0 = 0%, 1 = 33.33%, 2 = 66.66%, 3 = 100%
  const markerPct = (stageIndex / (stages.length - 1)) * 100;
  const fillPct = markerPct;

  return (
    <div className="itda-card p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">{t('romanceRelationshipPosition')}</h3>
      
      {/* Stage labels above bar */}
      <div className="flex justify-between mb-2 text-sm font-semibold text-gray-700">
        <span>{t(stages[0].key)}</span>
        <span>{t(stages[1].key)}</span>
        <span>{t(stages[2].key)}</span>
        <span>{t(stages[3].key)}</span>
      </div>

      {/* Progress bar with triangle indicator */}
      <div className="relative mb-6">
        {/* Progress bar */}
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
          <div 
            className="h-full rounded-full" 
            style={{ 
              width: `${fillPct}%`, 
              background: 'linear-gradient(90deg, #ff4fb3, #ec4899)',
              transition: 'width 0.5s ease'
            }} 
          />
        </div>
        {/* Triangle indicator - positioned above the bar */}
        <div
          className="absolute"
          style={{ 
            left: `${markerPct}%`, 
            bottom: '100%',
            transform: 'translateX(-50%)',
            marginBottom: '4px'
          }}
        >
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderBottom: '12px solid #ff4fb3',
            }}
          />
        </div>
      </div>

      {/* Description text */}
      <p className="text-base text-gray-700">
        {(() => {
          const desc = t(stages[stageIndex].desc);
          const stageName = t(stages[stageIndex].key);
          const parts = desc.split(stageName);
          if (parts.length > 1) {
            return (
              <>
                {parts[0]}
                <span className="font-bold text-pink-600">{stageName}</span>
                {parts.slice(1).join(stageName)}
              </>
            );
          }
          return desc;
        })()}
      </p>
    </div>
  );
};

const WordCloud: React.FC<{ result: AnalysisResult; mode: RelationshipMode; chatHistory?: string[] }> = ({ result, mode, chatHistory }) => {
  const theme = RELATIONSHIP_THEMES[mode];
  const words = buildWordCloud(chatHistory);

  if (words.length === 0) {
    return <div className="text-sm text-gray-600">-</div>;
  }

  const max = Math.max(...words.map((w) => w.count));
  const min = Math.min(...words.map((w) => w.count));
  const scale = (count: number) => {
    if (max === min) return 16;
    const t = (count - min) / (max - min);
    return 12 + t * 18;
  };

  return (
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <span
            key={w.word}
          className="itda-pill text-gray-800"
            style={{
              fontSize: `${scale(w.count)}px`,
              lineHeight: 1.1,
              fontWeight: 800,
            background: 'rgba(147, 51, 234, 0.15)',
            border: '1px solid rgba(147, 51, 234, 0.25)',
            color: '#6b21a8',
            padding: '6px 12px',
            borderRadius: '20px',
            }}
            title={`${w.word} (${w.count})`}
          >
            {w.word}
          </span>
        ))}
    </div>
  );
};

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, mode, chatHistory }) => {
  const { t } = useLanguage();
  const theme = RELATIONSHIP_THEMES[mode];
  const isRomance = mode === RelationshipMode.ROMANCE;

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-8 fade-in">
      {/* Top Section: Gauge and Summary */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
        <RelationshipGauge score={result.intimacyScore} mode={mode} />
        <div className="flex-1 w-full text-center md:text-left">
          <h2 className="text-3xl font-bold text-gray-800">{t('analysisResults')}</h2>
          <p className={`mt-2 text-lg font-medium ${theme.text}`}>{result.summary}</p>
          {!isRomance && (
          <div className="itda-alert itda-alert-warn mt-4" style={{ borderLeftWidth: 4 }}>
            <p className="font-bold">{t('recommendationTitle')}</p>
            <p>{result.recommendation}</p>
          </div>
          )}
        </div>
      </div>

      {isRomance ? (
        <>
          {/* Romance Mode: Relationship Stage Card */}
          <RomanceStageCard result={result} mode={mode} />

          {/* Romance Mode: Bottom Section - Metrics and Keywords */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Relationship Metrics Summary */}
            <div className="itda-card p-5">
              <div className="flex items-center text-gray-700 mb-4">
                <BarChartIcon className="w-5 h-5 mr-2 text-pink-500" />
                <h3 className="font-bold text-xl">{t('relationshipMetricsSummary')}</h3>
              </div>
              <div className="space-y-5">
                <MetricRow label={t('participation')} value={result.balanceRatio.speaker1.percentage} barClassName={theme.medium} />
                <MetricRow label={t('positivity')} value={result.sentiment.positive} barClassName={theme.medium} />
                <MetricRow label={t('intimacy')} value={result.intimacyScore} barClassName={theme.medium} />
              </div>
              <p className="mt-4 text-sm text-gray-600">
                서로를 배려하며 비교적 안정적인 대화 흐름을 유지하고 있어요.
              </p>
            </div>

            {/* Right: Conversation Keywords */}
            <div className="itda-card p-5">
              <div className="flex items-center text-gray-700 mb-3">
                <TagIcon className="w-5 h-5 mr-2 text-indigo-500" />
                <h3 className="font-bold text-xl">대화 키워드</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                실제 대화에서 자주 등장한 표현을 시각화했어요
              </p>
              <WordCloud result={result} mode={mode} chatHistory={chatHistory} />
            </div>
          </div>
        </>
      ) : (
        /* Other Modes: Original Layout */
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 md:gap-6">
        <div className="itda-card p-5 md:col-span-2">
          <div className="space-y-3">
            <MetricRow label={t('participation')} value={result.balanceRatio.speaker1.percentage} barClassName={theme.medium} />
            <MetricRow label={t('positivity')} value={result.sentiment.positive} barClassName={theme.medium} />
            <MetricRow label={t('intimacy')} value={result.intimacyScore} barClassName={theme.medium} />
          </div>
        </div>
        <div className="itda-card p-5 md:col-span-3">
          <div className="flex items-center text-gray-700 mb-3">
            <TagIcon className="w-5 h-5 mr-2 text-indigo-500" />
            <h3 className="font-bold">Word Cloud</h3>
          </div>
          <WordCloud result={result} mode={mode} />
        </div>
      </div>
      )}

      {/* Next Step Suggestions Section */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-800">{t('nextStepTitle')}</h3>
        
        {/* Top Section: 2-column layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Suggested Replies */}
          <div className="itda-card p-5">
            <div className="flex items-center text-gray-700 mb-3">
              <ChatBubbleIcon className="w-6 h-6 mr-2 text-purple-500" />
              <h4 className="font-bold">{t('suggestedRepliesTitle')}</h4>
            </div>
            <div className="space-y-2">
              {result.suggestedReplies && result.suggestedReplies.length > 0 ? (
                result.suggestedReplies.map((reply, index) => (
                  <div key={index} className="p-3 rounded-lg text-sm" style={{ background: 'rgba(139, 92, 246, 0.10)', color: '#5b21b6' }}>
                    {reply}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">분석 중...</div>
              )}
            </div>
          </div>

          {/* Right: Attention Points */}
          <div className="itda-card p-5">
            <div className="flex items-center text-gray-700 mb-3">
              <ExclamationTriangleIcon className="w-6 h-6 mr-2 text-amber-500" />
              <h4 className="font-bold">{t('attentionPointsTitle' as any)}</h4>
            </div>
            <div className="space-y-2">
              {result.attentionPoints && result.attentionPoints.length > 0 ? (
                result.attentionPoints.map((point, index) => (
                  <div key={index} className="p-3 rounded-lg text-sm" style={{ background: 'rgba(251, 191, 36, 0.10)', color: '#92400e' }}>
                    {point}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">분석 중...</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Suggested Topics */}
        <div className="itda-card p-6">
          <div className="flex items-center text-gray-700 mb-2">
            <TagIcon className="w-6 h-6 mr-2 text-indigo-500" />
            <h4 className="font-bold text-lg">{t('suggestedTopicsTitle' as any)}</h4>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {t('suggestedTopicsSubtitle' as any)}
          </p>
          <div className="flex flex-wrap gap-3">
            {result.suggestedTopics && result.suggestedTopics.length > 0 ? (
              result.suggestedTopics.map((topic, index) => (
                <button
                  key={index}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105"
                  style={{
                    background: 'rgba(99, 102, 241, 0.10)',
                    color: '#3730a3',
                    border: '1px solid rgba(99, 102, 241, 0.25)',
                    cursor: 'pointer',
                  }}
                  onClick={() => {
                    // 클릭 시 동작 (선택사항)
                    console.log('Selected topic:', topic);
                  }}
                >
                  {topic}
                </button>
              ))
            ) : (
              <div className="text-sm text-gray-500">분석 중...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;