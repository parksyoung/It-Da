import React, { useEffect, useMemo, useState } from 'react';
import { AnalysisResult, RelationshipMode } from '../types';
import RelationshipGauge from './RelationshipGauge';
import { ChatBubbleIcon, TagIcon, BarChartIcon, ExclamationTriangleIcon } from './icons';
import { RELATIONSHIP_THEMES } from '../constants';
import { useLanguage } from '../contexts/LanguageContext';
import { translateAnalysisResult } from '../services/geminiService';

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
  if (!chatHistory || chatHistory.length === 0) {
    return [] as { word: string; count: number }[];
  }

  const raw = chatHistory.join(' ');
  const withoutNames = raw.replace(/^[^:]+:\s*/gm, '');

  const normalized = withoutNames
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [] as { word: string; count: number }[];

  const stop = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'to', 'of', 'in', 'on', 'for', 'with', 'is', 'are', 'was', 'were', 'be',
    'this', 'that', 'it', 'as', 'at', 'by', 'from', 'you', 'your', 'we', 'our', 'they', 'their', 'i', 'me', 'my',
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

  const timePattern = /^\d+시$|^오전|^오후|^한시간|^두시간|^세시간|^네시간|^다섯시간|^여섯시간|^일곱시간|^여덟시간|^아홉시간|^열시간/i;
  const namePattern = /^[가-힣]{2,4}$|^[A-Z][a-z]+$/;

  const counts = new Map<string, number>();
  const tokens = normalized.split(' ');

  for (const token of tokens) {
    const w = token.trim();
    if (!w) continue;
    if (w.length < 2) continue;
    if (stop.has(w)) continue;
    if (timePattern.test(w)) continue;
    if (namePattern.test(w) && w.length <= 4) continue;
    if (/^\d+$/.test(w)) continue;
    counts.set(w, (counts.get(w) || 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
};

const getRomanceStageIndex = (result: AnalysisResult) => {
  const intimacy = clampPercent(result.intimacyScore);
  const positivity = clampPercent(result.sentiment?.positive ?? 0);
  const weighted = intimacy * 0.75 + positivity * 0.25;

  if (weighted < 30) return 0;
  if (weighted < 55) return 1;
  if (weighted < 75) return 2;
  return 3;
};

const getFriendStageIndex = (result: AnalysisResult) => {
  const intimacy = clampPercent(result.intimacyScore);
  const positivity = clampPercent(result.sentiment?.positive ?? 0);
  const balance = 100 - Math.abs(result.balanceRatio.speaker1.percentage - result.balanceRatio.speaker2.percentage);
  const weighted = intimacy * 0.4 + positivity * 0.35 + balance * 0.25;

  if (weighted < 25) return 0;
  if (weighted < 50) return 1;
  if (weighted < 75) return 2;
  return 3;
};

const getWorkStageIndex = (result: AnalysisResult) => {
  const intimacy = clampPercent(result.intimacyScore);
  const positivity = clampPercent(result.sentiment?.positive ?? 0);
  const balance = 100 - Math.abs(result.balanceRatio.speaker1.percentage - result.balanceRatio.speaker2.percentage);
  const weighted = balance * 0.4 + intimacy * 0.35 + positivity * 0.25;

  if (weighted < 25) return 0;
  if (weighted < 50) return 1;
  if (weighted < 75) return 2;
  return 3;
};

const getOtherStageIndex = (result: AnalysisResult) => {
  const intimacy = clampPercent(result.intimacyScore);
  const positivity = clampPercent(result.sentiment?.positive ?? 0);
  const balance = 100 - Math.abs(result.balanceRatio.speaker1.percentage - result.balanceRatio.speaker2.percentage);
  const weighted = intimacy * 0.45 + positivity * 0.30 + balance * 0.25;

  if (weighted < 25) return 0;
  if (weighted < 50) return 1;
  if (weighted < 75) return 2;
  return 3;
};

const getWorkMetrics = (result: AnalysisResult) => {
  const politeness = clampPercent(result.sentiment.positive * 0.6 + result.sentiment.neutral * 0.4);
  const balance = 100 - Math.abs(result.balanceRatio.speaker1.percentage - result.balanceRatio.speaker2.percentage);
  const clarity = clampPercent(balance * 0.7 + result.sentiment.neutral * 0.3);
  const sentimentIntensity = Math.abs(result.sentiment.positive - result.sentiment.negative);
  const emotionalInvolvement = clampPercent(result.intimacyScore * 0.5 + sentimentIntensity * 50 * 0.5);

  return {
    politeness,
    clarity,
    emotionalInvolvement,
  };
};

// Generate relationship-specific summary text based on metrics and relationship type
const getRelationshipSummary = (
  result: AnalysisResult,
  relationshipType: 'friend' | 'lover' | 'other',
  language: 'ko' | 'en'
): string => {
  const { intimacyScore, sentiment, balanceRatio } = result;
  const participation = balanceRatio.speaker1.percentage;
  const positivity = sentiment.positive;
  const intimacy = intimacyScore;

  if (relationshipType === 'friend') {
    // Friend relationship summaries
    if (language === 'ko') {
      if (participation > 70 && intimacy < 40) {
        return '자주 소통하지만 감정적인 교류는 아직 친구 수준에 머물러 있어요.';
      } else if (positivity > 60 && intimacy >= 40 && intimacy < 70) {
        return '편안하고 긍정적인 친구 관계가 안정적으로 유지되고 있어요.';
      } else if (intimacy >= 70) {
        return '단순한 친구를 넘어 깊은 신뢰가 형성된 관계로 보여요.';
      } else if (positivity < 40) {
        return '친구 관계에서 긍정적인 감정 교류가 다소 부족해 보입니다.';
      } else if (participation < 40) {
        return '소통 빈도가 낮아 관계가 소원해질 수 있어요.';
      } else {
        return '서로를 배려하며 비교적 안정적인 친구 관계를 유지하고 있어요.';
      }
    } else {
      // English
      if (participation > 70 && intimacy < 40) {
        return 'You communicate frequently, but emotional exchange remains at a friend level.';
      } else if (positivity > 60 && intimacy >= 40 && intimacy < 70) {
        return 'A comfortable and positive friendship is being maintained steadily.';
      } else if (intimacy >= 70) {
        return 'This relationship goes beyond simple friendship, showing deep trust.';
      } else if (positivity < 40) {
        return 'Positive emotional exchange seems somewhat lacking in this friendship.';
      } else if (participation < 40) {
        return 'Low communication frequency may lead to a distant relationship.';
      } else {
        return 'You maintain a relatively stable friendship while being considerate of each other.';
      }
    }
  } else if (relationshipType === 'lover') {
    // Romantic relationship summaries
    if (language === 'ko') {
      if (intimacy < 40) {
        return '연인 관계이지만 감정 표현이나 교감이 충분히 드러나지 않고 있어요.';
      } else if (positivity < 40) {
        return '연인 간의 대화에서 긍정적인 감정 교류가 다소 부족해 보입니다.';
      } else if (intimacy >= 70 && positivity >= 60) {
        return '서로에 대한 애정과 배려가 대화 전반에 자연스럽게 드러나는 관계예요.';
      } else if (intimacy >= 50 && positivity >= 50) {
        return '연인으로서 서로에 대한 관심과 긍정적인 감정이 잘 형성되어 있어요.';
      } else if (participation < 40) {
        return '소통 빈도가 낮아 연인 관계 발전에 제약이 있을 수 있어요.';
      } else {
        return '연인 관계에서 서로를 배려하며 대화를 이어가고 있어요.';
      }
    } else {
      // English
      if (intimacy < 40) {
        return 'Although in a romantic relationship, emotional expression and connection are not fully revealed.';
      } else if (positivity < 40) {
        return 'Positive emotional exchange seems somewhat lacking in conversations between lovers.';
      } else if (intimacy >= 70 && positivity >= 60) {
        return 'Affection and care for each other naturally appear throughout the conversation.';
      } else if (intimacy >= 50 && positivity >= 50) {
        return 'As lovers, interest in each other and positive emotions are well-formed.';
      } else if (participation < 40) {
        return 'Low communication frequency may limit the development of the romantic relationship.';
      } else {
        return 'You continue conversations while being considerate of each other in your romantic relationship.';
      }
    }
  } else {
    // Other relationship type - use generic summary
    if (language === 'ko') {
      return '서로를 배려하며 비교적 안정적인 대화 흐름을 유지하고 있어요.';
    } else {
      return 'You are maintaining a relatively stable conversation flow while being considerate of each other.';
    }
  }
};

// Generate workplace-appropriate summary text
const getWorkMetricsSummary = (result: AnalysisResult, t: (key: string) => string): string => {
  const metrics = getWorkMetrics(result);
  if (metrics.politeness > 70 && metrics.clarity > 60) {
    return t('workMetricsSummary');
  } else if (metrics.politeness < 50) {
    return t('workMetricsSummaryLowPoliteness');
  } else if (metrics.clarity < 50) {
    return t('workMetricsSummaryLowClarity');
  } else {
    return t('workMetricsSummaryNeutral');
  }
};

interface RelationshipProgressProps {
  result: AnalysisResult;
  mode: RelationshipMode;
  titleKey: string;
  stages: Array<{ key: string; desc: string }>;
  getStageIndex: (result: AnalysisResult) => number;
  arrowColor: string;
  barGradient: string;
}

const RelationshipProgress: React.FC<RelationshipProgressProps> = ({
  result,
  mode,
  titleKey,
  stages,
  getStageIndex,
  arrowColor,
  barGradient,
}) => {
  const { t } = useLanguage();
  const theme = RELATIONSHIP_THEMES[mode];
  const stageIndex = getStageIndex(result);
  const markerPct = (stageIndex / (stages.length - 1)) * 100;
  const fillPct = markerPct;

  return (
    <div className="itda-card p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">{t(titleKey as any)}</h3>

      <div className="flex justify-between mb-3 text-sm font-semibold text-gray-700">
        {stages.map((stage, index) => (
          <span key={index}>{t(stage.key as any)}</span>
        ))}
      </div>

      <div className="relative mb-2">
        <div className="relative h-4 rounded-full overflow-hidden" style={{ background: 'rgba(255, 255, 255, 0.3)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${fillPct}%`,
              background: barGradient,
              transition: 'width 0.5s ease',
            }}
          />
        </div>
      </div>

      <div className="relative mb-6" style={{ height: '12px' }}>
        <div
          className="absolute"
          style={{
            left: `${markerPct}%`,
            top: '0',
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderBottom: `12px solid ${arrowColor}`,
            }}
          />
        </div>
      </div>

      <p className="text-base text-gray-700">
        {(() => {
          const desc = t(stages[stageIndex].desc as any);
          const stageName = t(stages[stageIndex].key as any);
          const parts = desc.split(stageName);
          if (parts.length > 1) {
            return (
              <>
                {parts[0]}
                <span className={`font-bold ${theme.text}`}>{stageName}</span>
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

const RomanceStageCard: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  if (mode !== RelationshipMode.ROMANCE) return null;

  const stages = [
    { key: 'romanceStageFriend', desc: 'romanceStageDescriptionFriend' },
    { key: 'romanceStageFlirtingStart', desc: 'romanceStageDescriptionFlirtingStart' },
    { key: 'romanceStageFlirting', desc: 'romanceStageDescriptionFlirting' },
    { key: 'romanceStageDating', desc: 'romanceStageDescriptionDating' },
  ] as const;

  return (
    <RelationshipProgress
      result={result}
      mode={mode}
      titleKey="romanceRelationshipPosition"
      stages={stages}
      getStageIndex={getRomanceStageIndex}
      arrowColor="#ff4fb3"
      barGradient="linear-gradient(90deg, #ff4fb3, #ec4899)"
    />
  );
};

const FriendStageCard: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  if (mode !== RelationshipMode.FRIEND) return null;

  const stages = [
    { key: 'friendStageBusiness', desc: 'friendStageDescriptionBusiness' },
    { key: 'friendStageAwkward', desc: 'friendStageDescriptionAwkward' },
    { key: 'friendStageSchool', desc: 'friendStageDescriptionSchool' },
    { key: 'friendStageSoulmate', desc: 'friendStageDescriptionSoulmate' },
  ] as const;

  return (
    <RelationshipProgress
      result={result}
      mode={mode}
      titleKey="friendRelationshipPosition"
      stages={stages}
      getStageIndex={getFriendStageIndex}
      arrowColor="#14b8a6"
      barGradient="linear-gradient(90deg, #14b8a6, #0d9488)"
    />
  );
};

const WorkStageCard: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  if (mode !== RelationshipMode.WORK) return null;

  const stages = [
    { key: 'workStageFormal', desc: 'workStageDescriptionFormal' },
    { key: 'workStageCollaboration', desc: 'workStageDescriptionCollaboration' },
    { key: 'workStageTrust', desc: 'workStageDescriptionTrust' },
    { key: 'workStageCorePartner', desc: 'workStageDescriptionCorePartner' },
  ] as const;

  return (
    <RelationshipProgress
      result={result}
      mode={mode}
      titleKey="workRelationshipPosition"
      stages={stages}
      getStageIndex={getWorkStageIndex}
      arrowColor="#3b82f6"
      barGradient="linear-gradient(90deg, #3b82f6, #2563eb)"
    />
  );
};

const OtherStageCard: React.FC<{ result: AnalysisResult; mode: RelationshipMode }> = ({ result, mode }) => {
  if (mode !== RelationshipMode.OTHER) return null;

  const stages = [
    { key: 'otherStageDistant', desc: 'otherStageDescriptionDistant' },
    { key: 'otherStageAcquaintance', desc: 'otherStageDescriptionAcquaintance' },
    { key: 'otherStageClose', desc: 'otherStageDescriptionClose' },
    { key: 'otherStageBond', desc: 'otherStageDescriptionBond' },
  ] as const;

  return (
    <RelationshipProgress
      result={result}
      mode={mode}
      titleKey="otherRelationshipPosition"
      stages={stages}
      getStageIndex={getOtherStageIndex}
      arrowColor="#6b7280"
      barGradient="linear-gradient(90deg, #6b7280, #4b5563)"
    />
  );
};

const WordCloud: React.FC<{ result: AnalysisResult; mode: RelationshipMode; chatHistory?: string[] }> = ({ mode, chatHistory }) => {
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
  const { t, language } = useLanguage();
  const theme = RELATIONSHIP_THEMES[mode];
  const isRomance = mode === RelationshipMode.ROMANCE;
  const isFriend = mode === RelationshipMode.FRIEND;
  const isWork = mode === RelationshipMode.WORK;
  const isOther = mode === RelationshipMode.OTHER;

  const [translatedResult, setTranslatedResult] = useState<AnalysisResult | null>(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const needsTranslation = useMemo(() => {
    if (language !== 'en') return false;

    const fields: string[] = [
      inputResult.summary,
      inputResult.recommendation,
      ...(inputResult.suggestedReplies || []),
      ...(inputResult.attentionPoints || []),
      ...(inputResult.suggestedTopics || []),
      ...(inputResult.safetyWarnings?.messages || []),
      ...(inputResult.safetyWarnings?.guidance || []),
    ].filter(Boolean);

    return fields.some((s) => /[가-힣]/.test(s));
  }, [inputResult, language]);

  useEffect(() => {
    let cancelled = false;
    setTranslatedResult(null);

    const run = async () => {
      if (!needsTranslation) return;

      setIsTranslating(true);
      try {
        const translated = await translateAnalysisResult(inputResult, 'en');
        if (cancelled) return;
        setTranslatedResult(translated);
      } catch (e) {
        if (cancelled) return;
        setTranslatedResult(null);
      } finally {
        if (cancelled) return;
        setIsTranslating(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [inputResult, needsTranslation]);

  const result = translatedResult ?? inputResult;

  const getSafetyLevelLabel = (level?: 'none' | 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'high':
        return t('safetyLevelHigh');
      case 'medium':
        return t('safetyLevelMedium');
      case 'low':
        return t('safetyLevelLow');
      default:
        return t('safetyLevelNone');
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-8 fade-in">
      {/* Top Section: Gauge and Summary */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
        <RelationshipGauge score={result.intimacyScore} mode={mode} />
        <div className="flex-1 w-full text-center md:text-left">
          <h2 className="text-3xl font-bold text-gray-800">{t('analysisResults')}</h2>
          {isTranslating && (
            <div className="mt-2 text-xs text-gray-500">{t('analyzing')}</div>
          )}
          <p className={`mt-2 text-lg font-medium ${theme.text}`}>{result.summary}</p>
          <div className="itda-alert itda-alert-warn mt-4" style={{ borderLeftWidth: 4 }}>
            <p className="font-bold">{t('recommendationTitle')}</p>
            <p>{result.recommendation}</p>
          </div>

          {result.safetyWarnings?.detected && (
            <div className="itda-alert itda-alert-error mt-3" style={{ borderLeftWidth: 4 }}>
              <div className="flex items-start justify-between gap-3">
                <p className="font-bold">{t('safetyWarningTitle')}</p>
                <span
                  className="itda-pill"
                  style={{
                    background: 'rgba(255, 46, 129, 0.12)',
                    borderColor: 'rgba(255, 46, 129, 0.20)',
                    color: 'rgba(107, 4, 48, 0.94)',
                  }}
                >
                  {getSafetyLevelLabel(result.safetyWarnings.level)}
                </span>
              </div>

              <p className="mt-1 text-sm">{t('safetyWarningNote')}</p>

              {result.safetyWarnings.messages?.length > 0 && (
                <div className="mt-3 space-y-2">
                  {result.safetyWarnings.messages.map((msg, idx) => (
                    <div key={idx} className="text-sm">
                      - {msg}
                    </div>
                  ))}
                </div>
              )}

              {result.safetyWarnings.guidance?.length > 0 && (
                <div className="mt-4">
                  <p className="font-bold text-sm">{t('safetyGuidanceTitle')}</p>
                  <div className="mt-2 space-y-2">
                    {result.safetyWarnings.guidance.map((g, idx) => (
                      <div key={idx} className="text-sm">
                        - {g}
                      </div>
                    ))}
                  </div>
                </div>
              )}
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
                {getRelationshipSummary(result, 'lover', language)}
              </p>
            </div>

            {/* Right: Conversation Keywords */}
            <div className="itda-card p-5">
              <div className="flex items-center text-gray-700 mb-3">
                <TagIcon className="w-5 h-5 mr-2 text-indigo-500" />
                <h3 className="font-bold text-xl">{t('conversationKeywords')}</h3>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                {t('conversationKeywordsDesc')}
              </p>
              <WordCloud result={result} mode={mode} chatHistory={chatHistory} />
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Friend Mode: Relationship Stage Card */}
          {isFriend && <FriendStageCard result={result} mode={mode} />}
          
          {/* Work Mode: Relationship Stage Card */}
          {isWork && <WorkStageCard result={result} mode={mode} />}
          
          {/* Other Mode: Relationship Stage Card */}
          {isOther && <OtherStageCard result={result} mode={mode} />}
          
          {/* Friend Mode: Same layout as Romance - Metrics and Keywords */}
          {isFriend ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Relationship Metrics Summary */}
              <div className="itda-card p-5">
                <div className="flex items-center text-gray-700 mb-4">
                  <BarChartIcon className="w-5 h-5 mr-2 text-teal-500" />
                  <h3 className="font-bold text-xl">{t('relationshipMetricsSummary')}</h3>
                </div>
                <div className="space-y-5">
                  <MetricRow label={t('participation')} value={result.balanceRatio.speaker1.percentage} barClassName={theme.medium} />
                  <MetricRow label={t('positivity')} value={result.sentiment.positive} barClassName={theme.medium} />
                  <MetricRow label={t('intimacy')} value={result.intimacyScore} barClassName={theme.medium} />
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  {getRelationshipSummary(result, 'friend', language)}
                </p>
              </div>

              {/* Right: Conversation Keywords */}
              <div className="itda-card p-5">
                <div className="flex items-center text-gray-700 mb-3">
                  <TagIcon className="w-5 h-5 mr-2 text-indigo-500" />
                  <h3 className="font-bold text-xl">{t('conversationKeywords')}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {t('conversationKeywordsDesc')}
                </p>
                <WordCloud result={result} mode={mode} chatHistory={chatHistory} />
              </div>
            </div>
          ) : isWork ? (
            /* Work Mode: Workplace-specific Metrics Layout */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Workplace Relationship Metrics Summary */}
              <div className="itda-card p-5">
                <div className="flex items-center text-gray-700 mb-4">
                  <BarChartIcon className="w-5 h-5 mr-2 text-blue-500" />
                  <h3 className="font-bold text-xl">{t('relationshipMetricsSummary')}</h3>
                </div>
                <div className="space-y-5">
                  {(() => {
                    const metrics = getWorkMetrics(result);
                    return (
                      <>
                        <MetricRow label={t('workMetricsPoliteness')} value={metrics.politeness} barClassName={theme.medium} />
                        <MetricRow label={t('workMetricsClarity')} value={metrics.clarity} barClassName={theme.medium} />
                        <MetricRow label={t('workMetricsEmotionalInvolvement')} value={metrics.emotionalInvolvement} barClassName={theme.medium} />
                      </>
                    );
                  })()}
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  {getWorkMetricsSummary(result, t)}
                </p>
              </div>

              {/* Right: Conversation Keywords */}
              <div className="itda-card p-5">
                <div className="flex items-center text-gray-700 mb-3">
                  <TagIcon className="w-5 h-5 mr-2 text-indigo-500" />
                  <h3 className="font-bold text-xl">{t('conversationKeywords')}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {t('conversationKeywordsDesc')}
                </p>
                <WordCloud result={result} mode={mode} chatHistory={chatHistory} />
              </div>
            </div>
          ) : isOther ? (
            /* Other Mode: Same layout as Romance and Friend - Metrics and Keywords */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Relationship Metrics Summary */}
              <div className="itda-card p-5">
                <div className="flex items-center text-gray-700 mb-4">
                  <BarChartIcon className="w-5 h-5 mr-2 text-gray-500" />
                  <h3 className="font-bold text-xl">{t('relationshipMetricsSummary')}</h3>
                </div>
                <div className="space-y-5">
                  <MetricRow label={t('participation')} value={result.balanceRatio.speaker1.percentage} barClassName={theme.medium} />
                  <MetricRow label={t('positivity')} value={result.sentiment.positive} barClassName={theme.medium} />
                  <MetricRow label={t('intimacy')} value={result.intimacyScore} barClassName={theme.medium} />
                </div>
                <p className="mt-4 text-sm text-gray-600">
                  {getRelationshipSummary(result, 'other', language)}
                </p>
              </div>

              {/* Right: Conversation Keywords */}
              <div className="itda-card p-5">
                <div className="flex items-center text-gray-700 mb-3">
                  <TagIcon className="w-5 h-5 mr-2 text-indigo-500" />
                  <h3 className="font-bold text-xl">{t('conversationKeywords')}</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                  {t('conversationKeywordsDesc')}
                </p>
                <WordCloud result={result} mode={mode} chatHistory={chatHistory} />
              </div>
            </div>
          ) : (
            /* Fallback: Original Layout for any other modes */
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
                  <h3 className="font-bold">{t('wordCloud')}</h3>
          </div>
          <WordCloud result={result} mode={mode} />
        </div>
      </div>
          )}
        </>
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
                <div className="text-sm text-gray-500">{t('analyzing')}</div>
              )}
            </div>
          </div>

          {/* Right: Attention Points */}
          <div className="itda-card p-5">
            <div className="flex items-center text-gray-700 mb-3">
              <ExclamationTriangleIcon className="w-6 h-6 mr-2 text-amber-500" />
              <h4 className="font-bold">{t('attentionPointsTitle')}</h4>
            </div>
            <div className="space-y-2">
              {result.attentionPoints && result.attentionPoints.length > 0 ? (
                result.attentionPoints.map((point, index) => (
                  <div key={index} className="p-3 rounded-lg text-sm" style={{ background: 'rgba(251, 191, 36, 0.10)', color: '#92400e' }}>
                    {point}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500">{t('analyzing')}</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section: Suggested Topics */}
        <div className="itda-card p-6">
          <div className="flex items-center text-gray-700 mb-2">
            <TagIcon className="w-6 h-6 mr-2 text-indigo-500" />
            <h4 className="font-bold text-lg">{t('suggestedTopicsTitle')}</h4>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {t('suggestedTopicsSubtitle')}
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
                    // Topic selection handler (optional)
                  }}
                >
                  {topic}
                </button>
              ))
            ) : (
              <div className="text-sm text-gray-500">{t('analyzing')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;