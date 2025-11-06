import React, { useState, useEffect } from 'react'; // ✅ useEffect 추가
import { StoredAnalysis, RelationshipMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { PlusIcon, ArrowLeftIcon } from './icons';
import { RELATIONSHIP_THEMES } from '../constants';

interface RelationshipMapProps {
  analyses: StoredAnalysis[];
  onAdd: (name: string, mode: RelationshipMode) => void;
  onSelect: (analysis: StoredAnalysis) => void;
  onBack: () => void;
}

const RelationshipMap: React.FC<RelationshipMapProps> = ({ analyses, onAdd, onSelect, onBack }) => {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // ✅ 로컬스토리지에서 데이터 불러오기
  useEffect(() => {
    const saved = localStorage.getItem("relationshipData");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // 저장된 데이터가 있다면 analyses로 반영
        if (Array.isArray(parsed) && parsed.length > 0) {
          parsed.forEach((item: any) => {
            // 중복 방지: 기존에 없는 사람만 추가
            const exists = analyses.find(a => a.id === item.id);
            if (!exists) onAdd(item.speaker2Name, item.mode);
          });
        }
      } catch (e) {
        console.error("Error parsing relationshipData:", e);
      }
    }
  }, []);

  // ✅ 데이터가 바뀔 때마다 저장
  useEffect(() => {
    if (analyses.length > 0) {
      localStorage.setItem("relationshipData", JSON.stringify(analyses));
    }
  }, [analyses]);

  const handleAddPerson = (name: string, mode: RelationshipMode) => {
    onAdd(name, mode);
    setIsModalOpen(false);
  };

  // 👇 아래는 기존 코드 그대로 유지
  const width = 1600;
  const height = 1600;
  const center = { x: width / 2, y: height / 2 };
  const mainRadius = Math.min(width, height) / 3;
  const clusterRadius = 220;
  const meNodeRadius = 90;
  const relationshipNodeRadius = 80;
  const categoryNodeRadius = 75;

  const themeColors = Object.entries(RELATIONSHIP_THEMES).reduce((acc, [key, value]) => {
    const colorMap: { [key: string]: string } = {
      'bg-blue-500': '#3b82f6',
      'bg-pink-500': '#ec4899',
      'bg-teal-500': '#14b8a6',
      'bg-gray-500': '#6b7280',
    };
    acc[key] = colorMap[value.medium] || '#9ca3af';
    return acc;
  }, {} as { [key: string]: string });

  const categories = [
    { mode: RelationshipMode.WORK, angle: -90, name: t('WORK' as any) },
    { mode: RelationshipMode.FRIEND, angle: 0, name: t('FRIEND' as any) },
    { mode: RelationshipMode.OTHER, angle: 90, name: t('OTHER' as any) },
    { mode: RelationshipMode.ROMANCE, angle: 180, name: t('ROMANCE' as any) },
  ];

  const categoryAnchors = categories.map(cat => ({
    ...cat,
    x: center.x + mainRadius * Math.cos(cat.angle * Math.PI / 180),
    y: center.y + mainRadius * Math.sin(cat.angle * Math.PI / 180),
  }));

  const analysesByMode = analyses.reduce((acc, analysis) => {
    if (Object.values(RelationshipMode).includes(analysis.mode)) {
      (acc[analysis.mode] = acc[analysis.mode] || []).push(analysis);
    }
    return acc;
  }, {} as { [key in RelationshipMode]?: StoredAnalysis[] });

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-white p-4 fade-in overflow-hidden relative">
      {/* 이하 원래 코드 그대로 유지 */}
    </div>
  );
};

export default RelationshipMap;