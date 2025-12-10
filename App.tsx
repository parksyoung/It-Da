import React, { useState, useCallback, useEffect } from 'react';
import { AnalysisResult, RelationshipMode, StoredAnalysis } from './types';
import { RELATIONSHIP_THEMES } from './constants';
import { analyzeConversation, extractTextFromImage } from './services/geminiService';
import { getPersonData, savePersonData } from './services/firebase';
import AnalysisDashboard from './components/AnalysisDashboard';
import LandingPage from './components/LandingPage';
import RelationshipMap from './components/RelationshipMap';
import { SparklesIcon, ArrowLeftIcon, PlusIcon } from './components/icons';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import ChatInputForm from './components/ChatInputForm';

type View = 'landing' | 'map' | 'input' | 'dashboard';

const LanguageToggle: React.FC = () => {
    const { language, setLanguage } = useLanguage();
    const toggleLanguage = () => setLanguage(language === 'ko' ? 'en' : 'ko');
    return (
        <button
            onClick={toggleLanguage}
            className="absolute top-4 right-24 bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-sm font-semibold text-gray-600 shadow-md hover:bg-gray-100 smooth-transition z-20"
        >
            {language === 'ko' ? 'EN' : '한국어'}
        </button>
    );
};

const UserInfo: React.FC = () => {
    const { currentUser, logout } = useAuth();
    
    return (
        <div className="absolute top-4 right-4 flex items-center gap-3 z-20">
            <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold text-gray-700 shadow-md">
                {currentUser?.email || currentUser?.displayName || '사용자'}
            </div>
            <button
                onClick={logout}
                className="bg-red-500/80 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-semibold text-white shadow-md hover:bg-red-600 smooth-transition"
            >
                로그아웃
            </button>
        </div>
    );
};

const fileToGenerativePart = async (file: File) => {
    const base64EncodedDataPromise = new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
    });
    return {
        inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
    };
};

const App: React.FC = () => {
  const { currentUser } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<StoredAnalysis | null>(null);
  const [prefilledData, setPrefilledData] = useState<{ name: string; mode: RelationshipMode } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { language, t } = useLanguage();

  // Firestore에서 모든 분석 데이터 로드
  const loadAnalysesFromFirestore = async () => {
    if (!currentUser?.uid) return;

    try {
      const { getAllPersonsAsAnalyses } = await import('./services/firebase');
      const loadedAnalyses = await getAllPersonsAsAnalyses();
      setAnalyses(loadedAnalyses);
    } catch (err: any) {
      console.error('[App] Failed to load analyses from Firestore:', err);
      // 오프라인 오류는 조용히 처리 (빈 배열 반환)
      if (err?.message?.includes('offline') || err?.code === 'unavailable') {
        console.warn('[App] Firestore is offline. Using cached data if available.');
        setAnalyses([]);
        return;
      }
      // 권한 오류는 사용자에게 알림
      if (err?.message?.includes('Permission denied') || err?.code === 'permission-denied') {
        console.error('[App] Firestore permission denied. Check security rules.');
        setAnalyses([]);
        return;
      }
      // 기타 오류
      setAnalyses([]);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAnalysesFromFirestore();
    }
  }, [currentUser]);

  const handleNewAnalysis = async (chatText: string, mode: RelationshipMode, speaker1Name: string, speaker2Name: string) => {
    if (!chatText.trim()) {
      setError(t('errorInputRequired'));
      return;
    }

    if (!currentUser?.uid) {
      setError('로그인이 필요합니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const personName = speaker2Name; // 상대방 이름을 personName으로 사용
      
      // 1. Firestore에서 기존 히스토리 가져오기
      const existingData = await getPersonData(personName);
      
      // 2. 새 대화를 히스토리에 추가
      const updatedHistory = existingData 
        ? [...existingData.history, chatText]
        : [chatText];
      
      // 3. 전체 히스토리를 하나의 문자열로 합치기
      const historyString = updatedHistory.join('\n\n---\n\n');
      
      // 4. 전체 히스토리를 기반으로 재분석
      const result = await analyzeConversation(historyString, mode, language);
      
      // 5. Firestore에 업데이트된 히스토리와 분석 결과 저장
      await savePersonData(personName, {
        history: updatedHistory,
        analysis: result,
        mode,
      });
      
      // 6. RelationshipMap 업데이트를 위해 analyses 상태 갱신
      await loadAnalysesFromFirestore();
      
      // 7. 대시보드에 표시할 현재 분석 결과 설정
      const newAnalysis: StoredAnalysis = {
        id: `${currentUser.uid}-${personName}`,
        date: new Date().toISOString(),
        mode,
        speaker1Name,
        speaker2Name,
        result
      };
      setCurrentAnalysis(newAnalysis);
      setPrefilledData(null); // Clear prefilled data
      setView('dashboard'); // 분석 결과 페이지로 이동
    } catch (err: any) {
      let errorMessage = '알 수 없는 오류가 발생했습니다.';
      
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      // 사용자 친화적인 에러 메시지로 변환
      if (errorMessage.includes('offline') || errorMessage.includes('internet connection')) {
        errorMessage = '인터넷 연결을 확인해주세요. Firestore가 오프라인 상태입니다.';
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('permission')) {
        errorMessage = '데이터 접근 권한이 없습니다. Firestore 보안 규칙을 확인해주세요.';
      } else if (errorMessage.includes('not authenticated') || errorMessage.includes('로그인이 필요')) {
        errorMessage = '로그인이 필요합니다. 다시 로그인해주세요.';
      } else if (errorMessage.includes('Failed to analyze')) {
        errorMessage = '대화 분석에 실패했습니다. 잠시 후 다시 시도해주세요.';
      }
      
      console.error('[App] Analysis error:', err);
      setError(errorMessage);
      // Stay on the input page if there's an error
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>, onTextExtracted: (text: string) => void) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsExtracting(true);
    setError(null);
    try {
        const part = await fileToGenerativePart(file);
        const extracted = await extractTextFromImage(part.inlineData.data, part.inlineData.mimeType);
        onTextExtracted(`--- ${t('imageChatExtraction')} ---\n` + extracted);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(errorMessage);
    } finally {
        setIsExtracting(false);
        if(event.target) {
            event.target.value = "";
        }
    }
  };

  const handleSelectAnalysis = async (analysis: StoredAnalysis) => {
    // Firestore에서 최신 분석 데이터 가져오기
    try {
      const personName = analysis.speaker2Name;
      const personData = await getPersonData(personName);
      
      if (personData) {
        // 최신 분석 결과로 업데이트
        const updatedAnalysis: StoredAnalysis = {
          ...analysis,
          result: personData.analysis,
        };
        setCurrentAnalysis(updatedAnalysis);
      } else {
        // 데이터가 없으면 기존 분석 사용
        setCurrentAnalysis(analysis);
      }
    } catch (err: any) {
      console.error('[App] Failed to load latest analysis:', err);
      // 오프라인 오류는 조용히 처리 (기존 분석 사용)
      if (err?.message?.includes('offline') || err?.code === 'unavailable') {
        console.warn('[App] Firestore is offline. Using cached analysis data.');
      }
      // 에러 발생 시 기존 분석 사용
      setCurrentAnalysis(analysis);
    }
    setView('dashboard');
  };

  const handleStartAdd = (name: string, mode: RelationshipMode) => {
    setPrefilledData({ name, mode });
    setView('input');
  };

  const renderContent = () => {
    switch (view) {
      case 'landing':
        return <LandingPage onStart={() => setView('map')} />;
      case 'map':
        return <RelationshipMap analyses={analyses} onAdd={handleStartAdd} onSelect={handleSelectAnalysis} onBack={() => setView('landing')} />;
      case 'input':
        const title = prefilledData
          ? t('chatInputTitleFor', { name: prefilledData.name })
          : t('chatInputTitle');
        return (
            <div className={`min-h-screen w-full smooth-transition bg-gradient-to-br from-purple-50 via-pink-50 to-white relative`}>
                <button
                    onClick={() => { setView('map'); setPrefilledData(null); }}
                    className="absolute top-6 left-6 flex items-center px-4 py-2 bg-white text-gray-700 font-semibold rounded-full shadow-md hover:bg-gray-100 smooth-transition z-10"
                >
                    <ArrowLeftIcon className="w-5 h-5 mr-2" />
                    {t('backToMap')}
                </button>
                <div className="container mx-auto px-4 py-16 md:py-20 flex flex-col items-center">
                    <div className="text-center w-full">
                        <h1 className="text-3xl lg:text-4xl font-bold text-gray-800 mb-2">{title}</h1>
                        <p className="text-gray-600 mb-8">{t('chatInputSubtitle')}</p>
                    </div>
                    <ChatInputForm
                        onAnalyze={handleNewAnalysis}
                        isLoading={isLoading}
                        isExtracting={isExtracting}
                        handleImageUpload={handleImageUpload}
                        prefilledData={prefilledData}
                    />
                    <p className="text-center text-sm text-gray-500 mt-6">{t('tip')}</p>
                    {error && <div className="max-w-3xl w-full mx-auto mt-4 p-4 text-center text-red-700 bg-red-100 border border-red-400 rounded-lg fade-in">{error}</div>}
                    {isLoading && (
                        <div className="text-center p-10 fade-in">
                            <SparklesIcon className={`w-12 h-12 text-purple-500 mx-auto animate-pulse`} />
                            <p className="mt-4 text-lg font-semibold text-gray-700 whitespace-pre-line">{t('loadingMessage')}</p>
                        </div>
                    )}
                </div>
            </div>
        );
      case 'dashboard':
        if (!currentAnalysis) {
            setView('map'); // Should not happen, but as a fallback
            return null;
        }
        const theme = RELATIONSHIP_THEMES[currentAnalysis.mode];
        return (
            <div className={`min-h-screen w-full smooth-transition ${theme.light} relative`}>
                <div className="container mx-auto px-4 py-8 pb-28">
                    <AnalysisDashboard
                        result={currentAnalysis.result}
                        mode={currentAnalysis.mode}
                    />
                    <div className="text-center mt-8">
                        <button
                            onClick={() => setView('map')}
                            className="px-6 py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-md hover:bg-gray-100 smooth-transition"
                        >
                            {t('backToMap')}
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => handleStartAdd(currentAnalysis.speaker2Name, currentAnalysis.mode)}
                    className="fixed bottom-8 right-8 w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full shadow-lg flex items-center justify-center smooth-transition hover:scale-110 hover:shadow-xl focus:outline-none focus:ring-4 focus:ring-purple-300 z-10"
                    aria-label={t('addMoreConversation')}
                >
                    <PlusIcon className="w-8 h-8" />
                </button>
            </div>
        )
      default:
        return <LandingPage onStart={() => setView('map')} />;
    }
  };

  // 로그인하지 않은 경우 LandingPage 표시 (LandingPage에서 Google 로그인 처리)
  if (!currentUser) {
    return (
      <>
        <LanguageToggle />
        <LandingPage onStart={() => setView('map')} />
      </>
    );
  }

  return (
    <>
      <LanguageToggle />
      <UserInfo />
      {renderContent()}
    </>
  );
};

export default App;