import React, { useState } from 'react';
import { StoredAnalysis, RelationshipMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { PlusIcon, ArrowLeftIcon } from './icons';
import { RELATIONSHIP_THEMES } from '../constants';

interface RelationshipMapProps {
  analyses: StoredAnalysis[];
  onAdd: (name: string, mode: RelationshipMode) => void; // Called when modal confirms new person - creates NEW person
  onSelect: (analysis: StoredAnalysis) => void;
  onBack: () => void;
  embedded?: boolean;
  showBackButton?: boolean;
}

const AddPersonModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (name: string, mode: RelationshipMode) => void;
}> = ({ isOpen, onClose, onAdd }) => {
    const { t } = useLanguage();
    const [name, setName] = useState('');
    const [mode, setMode] = useState<RelationshipMode>(RelationshipMode.FRIEND);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (name.trim()) {
            onAdd(name, mode);
            setName('');
            setMode(RelationshipMode.FRIEND);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 fade-in" onClick={onClose}>
            <div className="itda-surface p-8 w-full max-w-md m-4" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-2xl font-bold text-gray-800 mb-6">{t('addPersonModalTitle')}</h3>
                <div className="space-y-4">
                    <div>
                        <label htmlFor="person-name" className="block text-sm font-bold text-gray-700 mb-1">{t('nameLabel')}</label>
                        <input
                            id="person-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            // FIX: Replaced invalid translation key 'speaker2Name' with 'namePlaceholder'.
                            placeholder={t('namePlaceholder')}
                            className="itda-field smooth-transition"
                        />
                    </div>
                    <div>
                        <label htmlFor="relationship-type" className="block text-sm font-bold text-gray-700 mb-1">{t('relationshipTypeLabel')}</label>
                        <select
                            id="relationship-type"
                            value={mode}
                            onChange={(e) => setMode(e.target.value as RelationshipMode)}
                            className="itda-field smooth-transition"
                        >
                            {Object.values(RelationshipMode).map((m) => (
                                <option key={m} value={m}>{t(m as any)}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="flex justify-end gap-4 mt-8">
                    <button onClick={onClose} className="itda-btn itda-btn-secondary px-6 py-2 smooth-transition">{t('cancelButton')}</button>
                    <button onClick={handleSubmit} disabled={!name.trim()} className="itda-btn itda-btn-primary px-6 py-2 smooth-transition disabled:opacity-50 disabled:cursor-not-allowed">{t('addButton')}</button>
                </div>
            </div>
        </div>
    );
};

const RelationshipMap: React.FC<RelationshipMapProps> = ({ analyses, onAdd, onSelect, onBack, embedded = false, showBackButton = true }) => {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const width = 1600;
  const height = 1600;
  const center = { x: width / 2, y: height / 2 };

  // Tree layout (top is smaller y)
  const leafBaseY = 520;
  const categoryY = 860;
  const trunkSplitY = 1060;

  const mePos = { x: center.x, y: 1320 };
  const categoryNodeRadius = 70;
  const relationshipNodeRadius = 74;
  const meNodeRadius = 88;


  const themeColors: { [key in RelationshipMode]: { stroke: string; fill: string } } = {
    [RelationshipMode.WORK]: { stroke: '#7dd3fc', fill: 'rgba(125, 211, 252, 0.18)' },
    [RelationshipMode.FRIEND]: { stroke: '#6ee7b7', fill: 'rgba(110, 231, 183, 0.18)' },
    [RelationshipMode.ROMANCE]: { stroke: '#fb7185', fill: 'rgba(251, 113, 133, 0.18)' },
    [RelationshipMode.OTHER]: { stroke: '#c4b5fd', fill: 'rgba(196, 181, 253, 0.18)' },
  };

  const categories = [
    { mode: RelationshipMode.WORK, x: center.x - 500, y: categoryY, name: t('WORK' as any) },
    { mode: RelationshipMode.FRIEND, x: center.x - 260, y: categoryY, name: t('FRIEND' as any) },
    { mode: RelationshipMode.ROMANCE, x: center.x + 260, y: categoryY, name: t('ROMANCE' as any) },
    { mode: RelationshipMode.OTHER, x: center.x + 500, y: categoryY, name: t('OTHER' as any) },
  ];

  const analysesByMode = analyses.reduce((acc, analysis) => {
    if (Object.values(RelationshipMode).includes(analysis.mode)) {
        (acc[analysis.mode] = acc[analysis.mode] || []).push(analysis);
    }
    return acc;
  }, {} as { [key in RelationshipMode]?: StoredAnalysis[] });

  const handleAddPerson = (name: string, mode: RelationshipMode) => {
    onAdd(name, mode);
    setIsModalOpen(false);
  };

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const buildLeafPositions = (mode: RelationshipMode, anchorX: number, anchorY: number, nodes: StoredAnalysis[]) => {
    const total = nodes.length;
    const regionWidth = mode === RelationshipMode.WORK || mode === RelationshipMode.OTHER ? 560 : 420;
    const regionMinX = anchorX - regionWidth / 2;
    const regionMaxX = anchorX + regionWidth / 2;

    const minSpacingX = relationshipNodeRadius * 2 + 52;
    const minSpacingY = relationshipNodeRadius * 2 + 78;

    const maxCols = mode === RelationshipMode.WORK || mode === RelationshipMode.OTHER ? 3 : 2;
    const cols = total <= 1 ? 1 : Math.min(maxCols, Math.max(2, Math.ceil(Math.sqrt(total))));
    const rows = Math.max(1, Math.ceil(total / cols));

    const usableWidth = regionWidth - 20;
    const spacingX = cols === 1 ? 0 : Math.max(minSpacingX, usableWidth / (cols - 1));
    const spacingY = Math.max(minSpacingY, 190);

    const startX = anchorX - ((cols - 1) / 2) * spacingX;
    const startY = anchorY - 260;

    const placed: { id: string; x: number; y: number }[] = [];
    const minDist = relationshipNodeRadius * 2 + 32;

    for (let i = 0; i < total; i++) {
      const node = nodes[i];
      const seed = (node.speaker2Name || '').length + node.result.intimacyScore;
      const col = i % cols;
      const row = Math.floor(i / cols);

      let x = startX + col * spacingX + Math.sin(seed * 0.9 + i * 1.7) * 10;
      let y = startY - row * spacingY + Math.cos(seed * 0.7 + i * 1.3) * 6;

      x = clamp(x, regionMinX + relationshipNodeRadius + 12, regionMaxX - relationshipNodeRadius - 12);
      y = clamp(y, 140, anchorY - 180);

      // Simple collision resolution within the same category region
      for (let iter = 0; iter < 10; iter++) {
        let moved = false;
        for (const prev of placed) {
          const dx = x - prev.x;
          const dy = y - prev.y;
          const d = Math.hypot(dx, dy) || 0.0001;
          if (d < minDist) {
            const push = (minDist - d) * 0.7;
            const dir = i % 2 === 0 ? 1 : -1;
            x += dir * push;
            y -= push * 0.55;
            moved = true;
          }
        }
        x = clamp(x, regionMinX + relationshipNodeRadius + 12, regionMaxX - relationshipNodeRadius - 12);
        y = clamp(y, 140, anchorY - 180);
        if (!moved) break;
      }

      placed.push({ id: node.id, x, y });
    }

    return placed.reduce((acc, p) => {
      acc[p.id] = { x: p.x, y: p.y };
      return acc;
    }, {} as Record<string, { x: number; y: number }>);
  };

  const leafPosById = categories.reduce((acc, cat) => {
    const nodes = analysesByMode[cat.mode] || [];
    const positions = buildLeafPositions(cat.mode, cat.x, cat.y, nodes);
    for (const n of nodes) {
      acc[n.id] = positions[n.id] || { x: cat.x, y: cat.y - 260 };
    }
    return acc;
  }, {} as Record<string, { x: number; y: number }>);

  const branchPath = (x1: number, y1: number, x2: number, y2: number) => {
    const midY = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;
  };


  return (
    <div className={embedded ? "w-full h-full p-2 md:p-4 fade-in overflow-hidden relative" : "min-h-screen w-full flex flex-col items-center justify-center p-4 fade-in overflow-hidden relative"}>
        <h2 className={embedded ? "text-2xl md:text-3xl font-black mb-4" : "text-3xl font-bold text-gray-800 mb-4"}>{t('relationshipMapTitle')}</h2>
        
        <div className={embedded ? "relative w-full max-w-5xl mx-auto aspect-square" : "relative w-[90vw] h-[90vw] max-w-5xl max-h-5xl"}>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
                <defs>
                    <filter id="softShadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="18" stdDeviation="14" floodColor="rgba(31,22,53,0.16)" />
                    </filter>

                    <filter id="leafGlow" x="-40%" y="-40%" width="180%" height="180%">
                      <feGaussianBlur stdDeviation="6" result="blur" />
                      <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    <linearGradient id="trunk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(167, 119, 92, 0.26)" />
                      <stop offset="100%" stopColor="rgba(167, 119, 92, 0.42)" />
                    </linearGradient>

                    {Object.values(RelationshipMode).map((m) => (
                      <linearGradient key={m} id={`branch-${m}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(167, 119, 92, 0.40)" />
                        <stop offset="100%" stopColor={themeColors[m as RelationshipMode].stroke} />
                      </linearGradient>
                    ))}
                </defs>

                {/* Trunk (double stroke for depth) */}
                <path
                  d={branchPath(mePos.x, mePos.y - (meNodeRadius + 10), center.x, trunkSplitY)}
                  stroke="url(#trunk)"
                  strokeWidth={28}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.60}
                />
                <path
                  d={branchPath(mePos.x, mePos.y - (meNodeRadius + 10), center.x, trunkSplitY)}
                  stroke="url(#trunk)"
                  strokeWidth={18}
                  strokeLinecap="round"
                  fill="none"
                  opacity={0.92}
                />

                {/* Branches from Trunk to Categories */}
                {categories.map((cat) => (
                  <path
                    key={`branch-to-${cat.mode}`}
                    d={branchPath(center.x, trunkSplitY, cat.x, cat.y)}
                    stroke={`url(#branch-${cat.mode})`}
                    strokeWidth={14}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.95}
                  />
                ))}

                {/* Branches from Categories to People */}
                {categories.map(({ mode, x: anchorX, y: anchorY }) => {
                  const groupAnalyses = analysesByMode[mode] || [];
                  const numNodes = groupAnalyses.length;

                  return groupAnalyses.map((node, index) => {
                    const p = leafPosById[node.id] || { x: anchorX, y: anchorY - 260 };
                    return (
                      <path
                        key={`leaf-branch-${mode}-${node.id}`}
                        d={branchPath(anchorX, anchorY - 10, p.x, p.y + 34)}
                        stroke={`url(#branch-${mode})`}
                        strokeWidth={8}
                        strokeLinecap="round"
                        fill="none"
                        opacity={0.82}
                      />
                    );
                  });
                })}

                {/* Me Node */}
                <g transform={`translate(${mePos.x}, ${mePos.y})`} className="cursor-default">
                  <circle r={meNodeRadius + 10} fill="rgba(255,255,255,0.85)" filter="url(#softShadow)" />
                  <circle r={meNodeRadius} fill="rgba(255,255,255,0.92)" stroke="rgba(255, 79, 179, 0.55)" strokeWidth="8" />
                  <text textAnchor="middle" dy=".3em" className="text-4xl font-extrabold fill-current text-gray-800">{t('me')}</text>
                </g>

                {/* Category and Relationship Nodes */}
                {categories.map(({ mode, name, x: anchorX, y: anchorY }) => {
                  const groupAnalyses = analysesByMode[mode] || [];
                  const numNodes = groupAnalyses.length;

                  return (
                    <g key={mode}>
                      {/* Category Node */}
                      <g transform={`translate(${anchorX}, ${anchorY})`} className="cursor-default">
                        <circle r={categoryNodeRadius + 10} fill="rgba(255,255,255,0.70)" filter="url(#softShadow)" />
                        <circle r={categoryNodeRadius} fill={themeColors[mode].fill} stroke={themeColors[mode].stroke} strokeWidth="7" />
                        <text textAnchor="middle" dy=".3em" className="text-2xl font-extrabold fill-current text-gray-800">
                          {name}
                        </text>
                      </g>

                      {/* Relationship Nodes (Leaves/Fruit) */}
                      {groupAnalyses.map((node, index) => {
                        const p = leafPosById[node.id] || { x: anchorX, y: anchorY - 260 };
                        const modeColor = themeColors[node.mode].stroke;
                        const modeFill = themeColors[node.mode].fill;

                        return (
                          <g
                            key={node.id}
                            transform={`translate(${p.x}, ${p.y})`}
                            onClick={() => onSelect(node)}
                            className="cursor-pointer group"
                          >
                            <circle
                              r={relationshipNodeRadius + 16}
                              fill="rgba(255,255,255,0.55)"
                              className="opacity-0 group-hover:opacity-100 smooth-transition"
                              filter="url(#leafGlow)"
                            />
                            <circle r={relationshipNodeRadius + 10} fill="rgba(255,255,255,0.92)" filter="url(#softShadow)" />
                            <circle
                              r={relationshipNodeRadius}
                              fill={modeFill}
                              stroke={modeColor}
                              strokeWidth="7"
                              className="smooth-transition group-hover:scale-110"
                            />
                            <text textAnchor="middle" dy={-10} className="text-2xl font-extrabold fill-current text-gray-800">
                              {node.speaker2Name}
                            </text>
                            <text textAnchor="middle" dy={24} className="text-xl fill-current text-gray-600 font-bold">
                              {node.result.intimacyScore}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  );
                })}
            </svg>
        </div>
        
        {showBackButton && !embedded && (
            <button
                onClick={onBack}
                className="itda-btn itda-btn-secondary absolute top-6 left-6 px-4 py-2 smooth-transition"
            >
                <ArrowLeftIcon className="w-5 h-5 mr-2" />
                {t('backToHome')}
            </button>
        )}

        <button
            onClick={() => setIsModalOpen(true)}
            className="absolute bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center smooth-transition hover:scale-110 hover:shadow-xl focus:outline-none"
            aria-label={t('addPerson')}
        >
            <PlusIcon className="w-8 h-8" />
        </button>

        <AddPersonModal 
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onAdd={handleAddPerson}
        />
    </div>
  );
};

export default RelationshipMap;
