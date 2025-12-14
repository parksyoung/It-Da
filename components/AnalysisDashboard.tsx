import React from 'react';
import { AnalysisResult, RelationshipMode } from '../types';
import RelationshipGauge from './RelationshipGauge';
import { ChatBubblePlusIcon, TagIcon } from './icons';
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

  if (weighted < 40) return 0;
  if (weighted < 70) return 1;
  return 2;
};

const RomanceStageBar: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  if (mode !== RelationshipMode.ROMANCE) return null;

  const theme = RELATIONSHIP_THEMES[mode];
  const stages = ['친구/썸초입', '썸', '연인'] as const;
  const stageIndex = getRomanceStageIndex(result);
  const markerPct = (stageIndex / (stages.length - 1)) * 100;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="text-sm font-bold text-gray-800">관계 단계</div>
        <div className="itda-pill" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <span className={`font-bold ${theme.text}`}>현재: {stages[stageIndex]}</span>
        </div>
      </div>

      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
        <div className={`${theme.medium} h-full`} style={{ width: `${markerPct}%`, opacity: 0.85 }} />
        <div
          className="absolute top-1/2"
          style={{ left: `${markerPct}%`, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="w-4 h-4 rounded-full"
            style={{
              background: 'rgba(255,255,255,0.75)',
              border: '2px solid rgba(255,255,255,0.25)',
              boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            }}
          />
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 text-xs font-semibold text-gray-600">
        <div className="text-left">{stages[0]}</div>
        <div className="text-center">{stages[1]}</div>
        <div className="text-right">{stages[2]}</div>
      </div>
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
    <div>
      <RomanceStageBar result={result} mode={mode} />
      <div className="flex flex-wrap gap-2">
        {words.map((w) => (
          <span
            key={w.word}
            className={`itda-pill ${theme.text}`}
            style={{
              fontSize: `${scale(w.count)}px`,
              lineHeight: 1.1,
              fontWeight: 800,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
            }}
            title={`${w.word} (${w.count})`}
          >
            {w.word}
          </span>
        ))}
      </div>
    </div>
  );
};

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, mode }) => {
  const { t } = useLanguage();
  const theme = RELATIONSHIP_THEMES[mode];

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-8 fade-in">
      {/* Top Section: Gauge and Summary */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
        <RelationshipGauge score={result.intimacyScore} mode={mode} />
        <div className="flex-1 w-full text-center md:text-left">
          <h2 className="text-3xl font-bold text-gray-800">{t('analysisResults')}</h2>
          <p className={`mt-2 text-lg font-medium ${theme.text}`}>{result.summary}</p>
          <div className="itda-alert itda-alert-warn mt-4" style={{ borderLeftWidth: 4 }}>
            <p className="font-bold">{t('recommendationTitle')}</p>
            <p>{result.recommendation}</p>
          </div>
        </div>
      </div>

      {/* Core Metrics Thermometers */}
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