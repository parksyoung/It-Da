import React, { useEffect, useState } from 'react';
import { RelationshipMode } from '../types';
import { HeartIcon } from './icons';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface RelationshipGaugeProps {
  score: number;
  mode: RelationshipMode;
}

const RelationshipGauge: React.FC<RelationshipGaugeProps> = ({ score, mode }) => {
  const [displayScore, setDisplayScore] = useState(0);
  const { t } = useLanguage();
  const { theme: appTheme } = useTheme();

  const ringColor = (() => {
    switch (mode) {
      case RelationshipMode.WORK:
        return appTheme === 'dark' ? '#6db6ff' : '#3b82f6';
      case RelationshipMode.FRIEND:
        return appTheme === 'dark' ? '#5eead4' : '#14b8a6';
      case RelationshipMode.ROMANCE:
        return appTheme === 'dark' ? '#fb7185' : '#ec4899';
      case RelationshipMode.OTHER:
      default:
        return appTheme === 'dark' ? '#b989ff' : '#8b5cf6';
    }
  })();

  useEffect(() => {
    // Smoothly animate score changes
    const timeoutId = setTimeout(() => setDisplayScore(score), 100);
    return () => clearTimeout(timeoutId);
  }, [score]);

  const circumference = 2 * Math.PI * 45; // radius = 45
  const offset = circumference - (displayScore / 100) * circumference;

  return (
    <div
      className="relative w-64 h-64 rounded-full flex items-center justify-center p-4 shadow-lg smooth-transition"
      style={{
        background:
          appTheme === 'dark'
            ? `radial-gradient(60% 60% at 30% 24%, ${ringColor}22 0%, transparent 62%), linear-gradient(180deg, rgba(22, 23, 36, 0.78) 0%, rgba(12, 12, 18, 0.62) 100%)`
            : `radial-gradient(60% 60% at 30% 24%, ${ringColor}18 0%, transparent 62%), linear-gradient(180deg, rgba(255, 255, 255, 0.92) 0%, rgba(255, 255, 255, 0.76) 100%)`,
        border: '1px solid var(--itda-border)',
        boxShadow: 'var(--itda-shadow-md)',
      }}
    >
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Background circle - very subtle, desaturated ring with low saturation and high lightness */}
        <circle
          strokeWidth="10"
          stroke="var(--itda-border-strong)"
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
        />

        {/* Progress circle */}
        <circle
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          stroke={ringColor}
          fill="transparent"
          r="45"
          cx="50"
          cy="50"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-sm font-semibold text-gray-600">{t('relationshipGauge')}</span>
        <span className="text-5xl font-bold text-gray-900">{Math.round(displayScore)}</span>
        <HeartIcon className="w-8 h-8 mt-2" style={{ color: ringColor }} />
      </div>
    </div>
  );
};

export default RelationshipGauge;