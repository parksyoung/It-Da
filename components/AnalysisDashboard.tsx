import React from 'react';
import { AnalysisResult, RelationshipMode } from '../types';
import RelationshipGauge from './RelationshipGauge';
import { ChatBubblePlusIcon, TagIcon, BarChartIcon } from './icons';
import { RELATIONSHIP_THEMES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import SentimentChart from './SentimentChart';
import RadarChart from './RadarChart';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  mode: RelationshipMode;
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

const MetricRow: React.FC<{ label: string; value: number; barClassName: string }> = ({ label, value, barClassName }) => {
  const pct = clampPercent(value);

  return (
    <div className="flex items-center gap-3">
      <div className="min-w-24 text-sm font-semibold text-gray-700">{label}</div>
      <div className="flex-1">
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
          <div className={`${barClassName} h-full smooth-transition`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <div className="w-12 text-right text-sm font-bold text-gray-800">{Math.round(value)}</div>
    </div>
  );
};

const buildWordCloud = (result: AnalysisResult) => {
  const sourceParts = [
    result.summary,
    result.recommendation,
    ...(result.suggestedTopics || []),
    ...(result.suggestedReplies || []),
  ].filter(Boolean);

  const raw = sourceParts.join(' ');
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [] as { word: string; count: number }[];

  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'it', 'as', 'at', 'by', 'from', 'you', 'your', 'we', 'our', 'they', 'their', 'i', 'me', 'my',
    '그리고', '하지만', '그래서', '또한', '그냥', '정말', '너무', '조금', '좀', '저', '나', '너', '우리', '그', '이', '저는',
  ]);

  const counts = new Map<string, number>();
  for (const token of normalized.split(' ')) {
    const w = token.trim();
    if (!w) continue;
    if (w.length < 2) continue;
    if (stop.has(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 28);
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
      <div className="relative h-4 rounded-full overflow-visible" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
        <div 
          className="h-full rounded-full" 
          style={{ 
            width: `${fillPct}%`, 
            background: 'linear-gradient(90deg, #ff4fb3, #ec4899)',
            transition: 'width 0.5s ease'
          }} 
        />
        {/* Triangle indicator */}
        <div
          className="absolute top-full"
          style={{ 
            left: `${markerPct}%`, 
            transform: 'translateX(-50%)',
            marginTop: '-2px'
          }}
        >
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: '12px solid #ff4fb3',
            }}
          />
        </div>
      </div>

      {/* Description text */}
      <p className="mt-4 text-base text-gray-700">
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

const WordCloud: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  const theme = RELATIONSHIP_THEMES[mode];
  const words = buildWordCloud(result);

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

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, mode }) => {
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
                <h3 className="font-bold text-lg">{t('relationshipMetricsSummary')}</h3>
              </div>
              <div className="space-y-4">
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
                <h3 className="font-bold text-lg">대화 키워드</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                실제 대화에서 자주 등장한 표현을 시각화했어요
              </p>
              <WordCloud result={result} mode={mode} />
              {/* Legend */}
              <div className="flex items-center gap-4 mt-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-pink-400"></div>
                  <span className="text-gray-600">감정</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-purple-400"></div>
                  <span className="text-gray-600">상황</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-orange-400"></div>
                  <span className="text-gray-600">관계/행동</span>
                </div>
              </div>
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

      {/* Visualizations Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 pt-4">
        <SentimentChart data={result.sentimentFlow} mode={mode} />
        <RadarChart result={result} mode={mode} />
      </div>

      {/* Next Step Suggestions Section */}
      <div className="itda-card p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">{t('nextStepTitle')}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex items-center text-gray-700 mb-3">
              <ChatBubblePlusIcon className="w-6 h-6 mr-2 text-purple-500" />
              <h4 className="font-bold">{t('suggestedRepliesTitle')}</h4>
            </div>
            <div className="space-y-2">
              {result.suggestedReplies.map((reply, index) => (
                <div key={index} className="p-3 rounded-lg text-sm" style={{ background: 'rgba(139, 92, 246, 0.10)', color: '#5b21b6' }}>{reply}</div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center text-gray-700 mb-3">
              <TagIcon className="w-6 h-6 mr-2 text-indigo-500" />
              <h4 className="font-bold">{t('suggestedTopicsTitle')}</h4>
            </div>
            <div className="space-y-2">
              {result.suggestedTopics.map((topic, index) => (
                <div key={index} className="p-3 rounded-lg text-sm" style={{ background: 'rgba(99, 102, 241, 0.10)', color: '#3730a3' }}>{topic}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;