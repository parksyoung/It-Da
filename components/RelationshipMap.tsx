import React, { useMemo, useState } from 'react';
import { StoredAnalysis, RelationshipMode } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { PlusIcon, ArrowLeftIcon } from './icons';

interface RelationshipMapProps {
  analyses: StoredAnalysis[];
  onAdd: (name: string, mode: RelationshipMode) => void; // Called when modal confirms new person - creates NEW person
  onSelect: (analysis: StoredAnalysis) => void;
  onDelete?: (analysis: StoredAnalysis) => void;
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

const RelationshipMap: React.FC<RelationshipMapProps> = ({ analyses, onAdd, onSelect, onDelete, onBack, embedded = false, showBackButton = true }) => {
  const { t } = useLanguage();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const width = 2000;
  const height = 1400;
  const center = { x: width / 2, y: height / 2 };

  const mePos = { x: center.x, y: center.y };
  const categoryNodeRadius = 84;
  const relationshipNodeRadius = 72;
  const meNodeRadius = 96;


  const themeColors: { [key in RelationshipMode]: { stroke: string; fill: string } } = {
    [RelationshipMode.WORK]: { stroke: '#7dd3fc', fill: 'rgba(125, 211, 252, 0.18)' },
    [RelationshipMode.FRIEND]: { stroke: '#6ee7b7', fill: 'rgba(110, 231, 183, 0.18)' },
    [RelationshipMode.ROMANCE]: { stroke: '#fb7185', fill: 'rgba(251, 113, 133, 0.18)' },
    [RelationshipMode.OTHER]: { stroke: '#c4b5fd', fill: 'rgba(196, 181, 253, 0.18)' },
  };

  const layoutStretchX = embedded ? 1 : 1.22;
  const polar = (angleDeg: number, radius: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: center.x + Math.cos(rad) * radius * layoutStretchX, y: center.y + Math.sin(rad) * radius };
  };

  const scale = Math.min(width, height) / 1600;
  const categoryRingR = 320 * scale;
  const peopleBaseRingR = 610 * scale;

  const categories = useMemo(() => {
    const angles: { [key in RelationshipMode]: number } = {
      [RelationshipMode.WORK]: -120,
      [RelationshipMode.FRIEND]: -20,
      [RelationshipMode.ROMANCE]: 70,
      [RelationshipMode.OTHER]: 165,
    };

    return (Object.values(RelationshipMode) as RelationshipMode[]).map((mode) => {
      const p = polar(angles[mode], categoryRingR);
      return { mode, x: p.x, y: p.y, angle: angles[mode], name: t(mode as any) };
    });
  }, [t]);

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

  const handleDeletePerson = (analysis: StoredAnalysis) => {
    if (!onDelete) return;
    const ok = window.confirm(`${analysis.speaker2Name}을(를) 삭제할까요?`);
    if (!ok) return;
    onDelete(analysis);
  };

  const buildOrbitPositions = (baseAngle: number, nodes: StoredAnalysis[]) => {
    const total = nodes.length;
    const maxPerRing = 7;
    const ringStep = 150 * scale;
    const arcBase = 72;

    const placed: { id: string; x: number; y: number; angle: number }[] = [];

    for (let i = 0; i < total; i++) {
      const node = nodes[i];
      const ring = Math.floor(i / maxPerRing);
      const idx = i % maxPerRing;
      const countOnRing = Math.min(maxPerRing, total - ring * maxPerRing);

      const arc = Math.min(120, arcBase + ring * 14);
      const t01 = countOnRing <= 1 ? 0.5 : idx / (countOnRing - 1);
      const offset = (t01 - 0.5) * arc;
      const seed = (node.speaker2Name || '').length * 13 + node.result.intimacyScore * 7 + i * 31;
      const jitterA = Math.sin(seed) * 7;
      const jitterR = Math.cos(seed * 0.7) * 10;

      const angle = baseAngle + offset + jitterA;
      const radius = peopleBaseRingR + ring * ringStep + jitterR;
      const p = polar(angle, radius);
      placed.push({ id: node.id, x: p.x, y: p.y, angle });
    }

    return placed.reduce((acc, p) => {
      acc[p.id] = { x: p.x, y: p.y, angle: p.angle };
      return acc;
    }, {} as Record<string, { x: number; y: number; angle: number }>);
  };

  const leafPosById = useMemo(() => {
    return categories.reduce((acc, cat) => {
      const nodes = analysesByMode[cat.mode] || [];
      const positions = buildOrbitPositions(cat.angle, nodes);
      for (const n of nodes) {
        acc[n.id] = positions[n.id] || { x: cat.x, y: cat.y, angle: cat.angle };
      }
      return acc;
    }, {} as Record<string, { x: number; y: number; angle: number }>);
  }, [analysesByMode, categories]);

  const smoothLink = (x1: number, y1: number, x2: number, y2: number, bend: number) => {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const d = Math.hypot(dx, dy) || 1;
    const nx = (-dy / d) * bend;
    const ny = (dx / d) * bend;
    const cx = mx + nx;
    const cy = my + ny;
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };


  const mapWidth = embedded ? 'min(100%, 1320px)' : 'min(100%, 1560px)';
  const mapHeight = embedded ? 'clamp(580px, 78vh, 900px)' : 'clamp(640px, 86vh, 980px)';

  return (
    <div className={embedded ? "w-full h-full min-h-0 p-2 md:p-4 fade-in overflow-hidden relative flex flex-col" : "min-h-screen w-full flex flex-col items-center justify-center p-4 fade-in overflow-hidden relative"}>
        <h2 className={embedded ? "text-2xl md:text-3xl font-black mb-4" : "text-3xl font-bold text-gray-800 mb-4"}>{t('relationshipMapTitle')}</h2>
        
        <div
          className={embedded ? "relative mx-auto" : "relative mx-auto"}
          style={{ width: mapWidth, height: mapHeight }}
        >
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
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

                    <filter id="linkGlow" x="-60%" y="-60%" width="220%" height="220%">
                      <feGaussianBlur stdDeviation="2.6" result="blur" />
                      <feColorMatrix
                        in="blur"
                        type="matrix"
                        values="
                          1 0 0 0 0
                          0 1 0 0 0
                          0 0 1 0 0
                          0 0 0 0.85 0
                        "
                        result="coloredBlur"
                      />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>

                    <filter id="linkSoftShadow" x="-40%" y="-40%" width="180%" height="180%">
                      <feDropShadow dx="0" dy="1.2" stdDeviation="1.6" floodColor="rgba(17,24,39,0.14)" />
                    </filter>

                    <linearGradient id="trunk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgba(167, 119, 92, 0.26)" />
                      <stop offset="100%" stopColor="rgba(167, 119, 92, 0.42)" />
                    </linearGradient>

                    <radialGradient id="bg" cx="50%" cy="35%" r="85%">
                      <stop offset="0%" stopColor="rgba(255,255,255,1)" />
                      <stop offset="55%" stopColor="rgba(246,245,255,1)" />
                      <stop offset="100%" stopColor="rgba(238,236,255,1)" />
                    </radialGradient>

                    <radialGradient id="glassBlobPink" cx="35%" cy="30%" r="60%">
                      <stop offset="0%" stopColor="rgba(99, 102, 241, 0.10)" />
                      <stop offset="50%" stopColor="rgba(99, 102, 241, 0.05)" />
                      <stop offset="100%" stopColor="rgba(99, 102, 241, 0.0)" />
                    </radialGradient>

                    <radialGradient id="glassBlobBlue" cx="70%" cy="65%" r="65%">
                      <stop offset="0%" stopColor="rgba(16, 185, 129, 0.08)" />
                      <stop offset="55%" stopColor="rgba(16, 185, 129, 0.04)" />
                      <stop offset="100%" stopColor="rgba(16, 185, 129, 0.0)" />
                    </radialGradient>

                    <radialGradient id="meCore" cx="35%" cy="30%" r="70%">
                      <stop offset="0%" stopColor="rgba(255,255,255,1)" />
                      <stop offset="45%" stopColor="rgba(255,255,255,0.98)" />
                      <stop offset="100%" stopColor="rgba(214, 232, 255, 0.90)" />
                    </radialGradient>

                    <linearGradient id="orbitRing" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="rgba(17, 24, 39, 0.10)" />
                      <stop offset="55%" stopColor="rgba(17, 24, 39, 0.18)" />
                      <stop offset="100%" stopColor="rgba(17, 24, 39, 0.08)" />
                    </linearGradient>

                    <linearGradient id="glassLine" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="rgba(17, 24, 39, 0.05)" />
                      <stop offset="55%" stopColor="rgba(17, 24, 39, 0.22)" />
                      <stop offset="100%" stopColor="rgba(17, 24, 39, 0.05)" />
                    </linearGradient>

                    {Object.values(RelationshipMode).map((m) => (
                      <linearGradient key={m} id={`branch-${m}`} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(167, 119, 92, 0.40)" />
                        <stop offset="100%" stopColor={themeColors[m as RelationshipMode].stroke} />
                      </linearGradient>
                    ))}
                </defs>

                <rect x="0" y="0" width={width} height={height} fill="url(#bg)" />

                <g opacity={0.92}>
                  <ellipse cx={center.x} cy={center.y} rx={(peopleBaseRingR + 210) * layoutStretchX} ry={peopleBaseRingR + 210} fill="none" stroke="url(#orbitRing)" strokeWidth={3} opacity={0.26} />
                  <ellipse cx={center.x} cy={center.y} rx={peopleBaseRingR * layoutStretchX} ry={peopleBaseRingR} fill="none" stroke="url(#orbitRing)" strokeWidth={4} opacity={0.36} strokeDasharray="10 18">
                    <animateTransform attributeName="transform" type="rotate" from={`0 ${center.x} ${center.y}`} to={`360 ${center.x} ${center.y}`} dur="38s" repeatCount="indefinite" />
                  </ellipse>
                  <ellipse cx={center.x} cy={center.y} rx={categoryRingR * layoutStretchX} ry={categoryRingR} fill="none" stroke="url(#orbitRing)" strokeWidth={6} opacity={0.32} strokeDasharray="2 14">
                    <animateTransform attributeName="transform" type="rotate" from={`360 ${center.x} ${center.y}`} to={`0 ${center.x} ${center.y}`} dur="26s" repeatCount="indefinite" />
                  </ellipse>
                </g>

                {/* Branches from Trunk to Categories */}
                {categories.map((cat) => (
                  <path
                    key={`branch-to-${cat.mode}`}
                    d={smoothLink(mePos.x, mePos.y, cat.x, cat.y, 70)}
                    stroke="url(#glassLine)"
                    strokeWidth={7}
                    strokeLinecap="round"
                    fill="none"
                    opacity={0.72}
                    filter="url(#linkSoftShadow)"
                  />
                ))}

                {/* Branches from Categories to People */}
                {categories.map(({ mode, x: anchorX, y: anchorY, angle }) => {
                  const groupAnalyses = analysesByMode[mode] || [];
                  const bend = Math.sin((angle * Math.PI) / 180) * 90;

                  return groupAnalyses.map((node) => {
                    const p = leafPosById[node.id] || { x: anchorX, y: anchorY, angle };
                    return (
                      <path
                        key={`leaf-branch-${mode}-${node.id}`}
                        d={smoothLink(anchorX, anchorY, p.x, p.y, bend)}
                        stroke="url(#glassLine)"
                        strokeWidth={6}
                        strokeLinecap="round"
                        fill="none"
                        opacity={0.58}
                        filter="url(#linkSoftShadow)"
                      />
                    );
                  });
                })}

                {/* Me Node */}
                <g transform={`translate(${mePos.x}, ${mePos.y})`} className="cursor-default">
                  <circle r={meNodeRadius + 30} fill="rgba(255,255,255,0.38)" opacity={0.55} filter="url(#softShadow)">
                    <animate attributeName="r" values={`${meNodeRadius + 18};${meNodeRadius + 30};${meNodeRadius + 18}`} dur="4.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.18;0.35;0.18" dur="4.4s" repeatCount="indefinite" />
                  </circle>
                  <circle r={meNodeRadius + 12} fill="rgba(255,255,255,0.48)" filter="url(#softShadow)" />
                  <circle r={meNodeRadius} fill="rgba(255,255,255,0.26)" stroke="rgba(255, 255, 255, 0.62)" strokeWidth="8" />
                  <circle r={meNodeRadius - 8} fill="url(#meCore)" opacity={0.9} />
                  <text textAnchor="middle" dy=".3em" className="text-4xl font-extrabold fill-current text-gray-900">{t('me')}</text>
                </g>

                {/* Category and Relationship Nodes */}
                {categories.map(({ mode, name, x: anchorX, y: anchorY }) => {
                  const groupAnalyses = analysesByMode[mode] || [];

                  return (
                    <g key={mode}>
                      {/* Category Node */}
                      <g transform={`translate(${anchorX}, ${anchorY})`} className="cursor-default">
                        <circle r={categoryNodeRadius + 22} fill="rgba(255,255,255,0.22)" opacity={0.60} filter="url(#softShadow)" />
                        <circle r={categoryNodeRadius + 10} fill="rgba(255,255,255,0.34)" opacity={0.85} />
                        <circle r={categoryNodeRadius} fill={themeColors[mode].fill} stroke={themeColors[mode].stroke} strokeWidth="9" />
                        <circle r={categoryNodeRadius + 4} fill="none" stroke="rgba(17, 24, 39, 0.18)" strokeWidth="2.5" strokeDasharray="3 9" opacity={0.75} />
                        <circle r={categoryNodeRadius - 18} fill="rgba(255,255,255,0.20)" opacity={0.85} />
                        <text textAnchor="middle" dy=".3em" className="text-2xl font-extrabold fill-current text-gray-900">
                          {name}
                        </text>
                      </g>

                      {/* Relationship Nodes (Leaves/Fruit) */}
                      {groupAnalyses.map((node) => {
                        const p = leafPosById[node.id] || { x: anchorX, y: anchorY, angle: 0 };
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
                              r={relationshipNodeRadius + 14}
                              fill="rgba(255,255,255,0.40)"
                              className="opacity-0 group-hover:opacity-100 smooth-transition"
                              filter="url(#softShadow)"
                            />
                            <circle r={relationshipNodeRadius + 9} fill="rgba(255,255,255,0.62)" filter="url(#softShadow)" />
                            <circle
                              r={relationshipNodeRadius}
                              fill="rgba(255,255,255,0.12)"
                              stroke={modeColor}
                              strokeWidth="7"
                              className="smooth-transition group-hover:scale-110"
                            />
                            <circle r={relationshipNodeRadius - 26} fill="rgba(255,255,255,0.14)" />
                            <text textAnchor="middle" dy={-10} className="text-2xl font-extrabold fill-current text-gray-900">
                              {node.speaker2Name}
                            </text>
                            <text textAnchor="middle" dy={24} className="text-xl fill-current text-gray-600 font-bold">
                              {node.result.intimacyScore}
                            </text>

                            {onDelete && (
                              <g
                                transform={`translate(${relationshipNodeRadius - 14}, ${-(relationshipNodeRadius - 14)})`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePerson(node);
                                }}
                                className="opacity-0 group-hover:opacity-100 smooth-transition"
                              >
                                <circle r={16} fill="rgba(255,255,255,0.92)" stroke="rgba(239, 68, 68, 0.70)" strokeWidth={2} />
                                <text textAnchor="middle" dy=".35em" className="text-lg font-black fill-current" style={{ fill: 'rgba(239, 68, 68, 0.92)' }}>
                                  ×
                                </text>
                              </g>
                            )}
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
