import React, { useState, useEffect } from 'react';
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

  // ✅ 로컬스토리지에서 불러오기
  useEffect(() => {
    if (typeof window !== 'undefined') { // SSR 보호
      const saved = localStorage.getItem("relationshipData");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            parsed.forEach((item: any) => {
              const exists = analyses.find(a => a.speaker2Name === item.speaker2Name);
              if (!exists) onAdd(item.speaker2Name, item.mode);
            });
          }
        } catch (e) {
          console.error("Error reading relationshipData:", e);
        }
      }
    }
  }, []);

  // ✅ 데이터가 바뀔 때마다 저장
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem("relationshipData", JSON.stringify(analyses));
    }
  }, [analyses]);

  const handleAddPerson = (name: string, mode: RelationshipMode) => {
    onAdd(name, mode);
    setIsModalOpen(false);
  };

  // ⚙️ 나머지 기존 시각화/버튼 코드는 그대로 두면 됩니다.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-purple-50 via-pink-50 to-white p-4 fade-in relative">
      {/* 여기에 기존의 SVG나 버튼 등 기존 코드 그대로 */}
    </div>
  );
};

export default RelationshipMap;
