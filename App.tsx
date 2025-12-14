import React, { useState, useEffect } from 'react';
import { RelationshipMode, StoredAnalysis } from './types';
import { analyzeConversation, extractTextFromImage } from './services/geminiService';
import { deletePerson, getPersonData, savePersonData } from './services/firebase';
import AnalysisDashboard from './components/AnalysisDashboard';
import LandingPage from './components/LandingPage';
import RelationshipMap from './components/RelationshipMap';
import SelfAnalysis from './components/SelfAnalysis';

import { HeartIcon, MapIcon, SparklesIcon, ArrowLeftIcon, PlusIcon, UserIcon } from './components/icons';
import { useLanguage } from './contexts/LanguageContext';
import { useAuth } from './contexts/AuthContext';
import ChatInputForm from './components/ChatInputForm';
import CounselChat from './components/CounselChat';

type View = 'landing' | 'map' | 'input' | 'dashboard' | 'selfAnalysis';
type DashboardTab = 'analysis' | 'counsel';

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
  const { currentUser, logout } = useAuth();
  const [view, setView] = useState<View>('landing');
  const [analyses, setAnalyses] = useState<StoredAnalysis[]>([]);
  const [currentAnalysis, setCurrentAnalysis] = useState<StoredAnalysis | null>(null);
  const [prefilledData, setPrefilledData] = useState<{ name: string; mode: RelationshipMode } | null>(null);
  const [isCreatingNewPerson, setIsCreatingNewPerson] = useState(false); // Track if we're creating a new person vs adding to existing
  const [dashboardTab, setDashboardTab] = useState<DashboardTab>('analysis');
  const [currentHistory, setCurrentHistory] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { language, t, setLanguage } = useLanguage();

  const toggleLanguage = () => setLanguage(language === 'ko' ? 'en' : 'ko');

  // Firestore에서 모든 분석 데이터 로드
  const loadAnalysesFromFirestore = async () => {
    if (!currentUser?.uid) return;

    try {
      const { getAllPersonsAsAnalyses } = await import('./services/firebase');
      const loadedAnalyses = await getAllPersonsAsAnalyses();
      setAnalyses(loadedAnalyses);
    } catch (err: any) {
      console.error('[App] Failed to load analyses from Firestore:', err);
      if (err?.message?.includes('offline') || err?.code === 'unavailable') {
        console.warn('[App] Firestore is offline. Using cached data if available.');
        setAnalyses([]);
        return;
      }
      if (err?.message?.includes('Permission denied') || err?.code === 'permission-denied') {
        console.error('[App] Firestore permission denied. Check security rules.');
        setAnalyses([]);
        return;
      }
      setAnalyses([]);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadAnalysesFromFirestore();
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser && view === 'landing') {
      setView('map');
    }
  }, [currentUser, view]);

  /**
   * Handle conversation analysis for a person
   * This function handles TWO different scenarios:
   * 1. Creating a NEW person (isCreatingNewPerson = true): Creates a new person entity with the conversation
   * 2. Adding conversation to EXISTING person (isCreatingNewPerson = false): Appends conversation to existing person
   */
  /**
   * Handle conversation analysis for a person
   * 
   * IMPORTANT: The speaker2Name parameter is the user-provided name and is the source of truth.
   * This name is stored explicitly in Firestore and is NEVER overwritten by analysis results.
   * 
   * This function handles TWO different scenarios:
   * 1. Creating a NEW person (isCreatingNewPerson = true): Creates a new person entity with the conversation
   * 2. Adding conversation to EXISTING person (isCreatingNewPerson = false): Appends conversation to existing person
   */
  const handleNewAnalysis = async (chatText: string, mode: RelationshipMode, speaker1Name: string, speaker2Name: string) => {
    if (!chatText.trim()) {
      setError(t('errorInputRequired'));
      return;
    }

    if (!currentUser?.uid) {
      setError(t('loginRequired'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const personName = speaker2Name; // 상대방 이름을 personName으로 사용
      
      let updatedHistory: string[];
      
      if (isCreatingNewPerson) {
        // SCENARIO 1: Creating a NEW person
        // Check if person already exists - if so, this is an error (name collision)
        const existingData = await getPersonData(personName);
        
        if (existingData) {
          // Person with this name already exists - this should not happen
          // User should use "추가 대화 분석하기" to add conversation to existing person
          throw new Error(t('personAlreadyExists', { name: personName }));
        }
        
        // Create new person with initial conversation (fresh start)
        updatedHistory = [chatText];
      } else {
        // SCENARIO 2: Adding conversation to EXISTING person
        // Get existing history and append new conversation
        const existingData = await getPersonData(personName);
        
        if (!existingData) {
          // Person doesn't exist - this shouldn't happen in normal flow
          // But we'll treat it as creating a new person
          console.warn(`[App] Person "${personName}" not found. Creating new person instead.`);
          updatedHistory = [chatText];
        } else {
          // Append to existing history
          updatedHistory = [...existingData.history, chatText];
        }
      }
      
      // 3. Combine all conversations into a single string for analysis
      const historyString = updatedHistory.join('\n\n---\n\n');
      
      // 4. Analyze the conversation (or all conversations if adding to existing)
      const result = await analyzeConversation(historyString, mode, language);
      
      // 5. Save to Firestore (this will create a new document if isCreatingNewPerson=true and person doesn't exist)
      // CRITICAL: Store personName explicitly - this is the source of truth for the person's name
      await savePersonData(personName, {
        name: personName, // Store name explicitly - user input is source of truth
        history: updatedHistory,
        analysis: result,
        mode,
      });
      
      // 6. Reload all analyses to update the relationship map
      await loadAnalysesFromFirestore();
      
      // 7. Create StoredAnalysis for display
      // CRITICAL: Use personName (user input) as speaker2Name, NOT analysis result
      // The person's name comes ONLY from user input, never from analysis
      const newAnalysis: StoredAnalysis = {
        id: `${currentUser.uid}-${personName}`,
        date: new Date().toISOString(),
        mode,
        speaker1Name: t('me'), // Always 'Me' for the user
        speaker2Name: personName, // Use user-provided name, NOT analysis result
        result
      };
      
      // 8. Update UI state
      setCurrentAnalysis(newAnalysis);
      setCurrentHistory(updatedHistory);
      setDashboardTab('analysis');
      setPrefilledData(null); // Clear prefilled data
      setIsCreatingNewPerson(false); // Reset flag
      setView('dashboard'); // Navigate to analysis results
    } catch (err: any) {
      let errorMessage = t('unknownError');
      const errorCode = err?.code;

      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }

      if (errorMessage.includes('offline') || errorMessage.includes('internet connection')) {
        errorMessage = t('checkInternetConnection');
      } else if (errorMessage.includes('Permission denied') || errorMessage.includes('permission')) {
        errorMessage = t('noDataAccess');
      } else if (errorMessage.includes('not authenticated') || errorMessage.includes('로그인이 필요') || errorMessage.includes('login required')) {
        errorMessage = t('loginRequiredRetry');
      } else if (errorMessage.includes('Failed to analyze')) {
        errorMessage = t('analysisFailed');
      }

      if (errorCode) {
        errorMessage = `${errorMessage} (code: ${errorCode})`;
      }

      console.error('[App] Analysis error:', err);
      setError(errorMessage);
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

  /**
   * Handle selecting an existing analysis/person
   * Uses the stored person name from StoredAnalysis (which comes from user input, not analysis)
   */
  const handleSelectAnalysis = async (analysis: StoredAnalysis) => {
    // Firestore에서 최신 분석 데이터 가져오기
    // Use speaker2Name from StoredAnalysis which is the user-provided name
    try {
      const personName = analysis.speaker2Name; // This is the user-provided name, stored in Firestore
      const personData = await getPersonData(personName);
      
      if (personData) {
        // 최신 분석 결과로 업데이트 (but preserve the person name from user input)
        const updatedAnalysis: StoredAnalysis = {
          ...analysis,
          result: personData.analysis,
          speaker2Name: personData.name || analysis.speaker2Name, // Use stored name, preserve user input
        };
        setCurrentAnalysis(updatedAnalysis);
        setCurrentHistory(personData.history || []);
      } else {
        setCurrentAnalysis(analysis);
        setCurrentHistory([]);
      }
    } catch (err: any) {
      console.error('[App] Failed to load latest analysis:', err);
      if (err?.message?.includes('offline') || err?.code === 'unavailable') {
        console.warn('[App] Firestore is offline. Using cached analysis data.');
      }
      setCurrentAnalysis(analysis);
      setCurrentHistory([]);
    }
    setDashboardTab('analysis');
    setView('dashboard');
  };

  /**
   * Handle adding conversation to an EXISTING person
   * Called when user clicks "추가 대화 분석하기" button in dashboard
   */
  const handleStartAdd = (name: string, mode: RelationshipMode) => {
    setIsCreatingNewPerson(false); // Adding to existing person
    setPrefilledData({ name, mode });
    setView('input');
  };

  /**
   * Handle creating a NEW person
   * Called when user clicks "사람 추가" button in sidebar or "+" button in relationship map
   */
  const handleStartAddEmpty = () => {
    setIsCreatingNewPerson(true); // Creating a new person
    setPrefilledData(null); // No prefilled data - user will enter name
    setView('input');
  };

  const handleDeleteAnalysis = async (analysis: StoredAnalysis) => {
    if (!currentUser?.uid) {
      setError(t('loginRequired'));
      return;
    }

    const uidPrefix = `${currentUser.uid}-`;
    const personKey = analysis.id?.startsWith(uidPrefix) ? analysis.id.slice(uidPrefix.length) : analysis.speaker2Name;

    try {
      // Optimistic UI update (RelationshipMap + Recent)
      setAnalyses((prev) => prev.filter((a) => a.id !== analysis.id));

      await deletePerson(personKey);
      await loadAnalysesFromFirestore();

      if (currentAnalysis?.speaker2Name === analysis.speaker2Name) {
        setCurrentAnalysis(null);
        setCurrentHistory([]);
        setView('map');
      }
    } catch (err: any) {
      console.error('[App] Failed to delete person:', err);
      const message = err instanceof Error ? err.message : t('deleteError');
      setError(message);

      // Roll back by reloading authoritative data
      await loadAnalysesFromFirestore();
      window.alert(message);
    }
  };

  const sortedAnalyses = [...analyses].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const renderContent = () => {
    switch (view) {
      case 'landing':
        return <LandingPage onStart={() => setView('map')} />;
      case 'map':
        return (
          <div className="p-4 md:p-6 h-full relative" style={{ 
            background: 'transparent',
            border: 'none',
            boxShadow: 'none',
          }}>
            <RelationshipMap
              analyses={analyses}
              onAdd={(name, mode) => {
                // When adding from RelationshipMap modal, create a NEW person
                setIsCreatingNewPerson(true);
                setPrefilledData({ name, mode });
                setView('input');
              }}
              onSelect={handleSelectAnalysis}
              onDelete={handleDeleteAnalysis}
              onBack={() => setView('landing')}
              embedded
              showBackButton={false}
            />
          </div>
        );
      case 'input':
        const title = prefilledData ? t('chatInputTitleFor', { name: prefilledData.name }) : t('chatInputTitle');
        return (
          <div className="h-full">
            <div className="itda-card p-5 md:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-gray-800 mb-1">{title}</h1>
                  <p className="text-gray-600">{t('chatInputSubtitle')}</p>
                </div>
                <button
                  onClick={() => { setView('map'); setPrefilledData(null); }}
                  className="itda-btn itda-btn-secondary px-4 py-2 text-sm smooth-transition"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                  {t('backToMap')}
                </button>
              </div>
            </div>

            <div className="mt-5">
              <ChatInputForm
                onAnalyze={handleNewAnalysis}
                isLoading={isLoading}
                isExtracting={isExtracting}
                handleImageUpload={handleImageUpload}
                prefilledData={prefilledData}
              />
              <p className="text-center text-sm text-gray-500 mt-5">{t('tip')}</p>
              {error && <div className="itda-alert itda-alert-error max-w-3xl w-full mx-auto mt-4 text-center fade-in">{error}</div>}
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
        return (
          <div className="h-full">
            <div className="itda-card p-5 md:p-7 mb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-gray-800 mb-1">{currentAnalysis.speaker2Name}</h1>
                  <p className="text-gray-600">{t('analysisResults')}</p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setView('map')}
                    className="itda-btn itda-btn-secondary px-4 py-2 text-sm smooth-transition"
                  >
                    {t('backToMap')}
                  </button>
                  <button
                    onClick={() => handleStartAdd(currentAnalysis.speaker2Name, currentAnalysis.mode)}
                    className="itda-btn itda-btn-primary px-4 py-2 text-sm smooth-transition"
                  >
                    <PlusIcon className="w-5 h-5" />
                    {t('addMoreConversation')}
                  </button>
                </div>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <button
                  onClick={() => setDashboardTab('analysis')}
                  className={`itda-btn itda-btn-secondary px-4 py-2 text-sm ${dashboardTab === 'analysis' ? 'ring-2 ring-violet-200/60' : ''}`}
                >
                  {t('analysisTab')}
                </button>
                <button
                  onClick={() => setDashboardTab('counsel')}
                  className={`itda-btn itda-btn-secondary px-4 py-2 text-sm ${dashboardTab === 'counsel' ? 'ring-2 ring-violet-200/60' : ''}`}
                >
                  {t('counselTab')}
                </button>
              </div>
            </div>

            {dashboardTab === 'analysis' ? (
              <AnalysisDashboard
                result={currentAnalysis.result}
                mode={currentAnalysis.mode}
                chatHistory={currentHistory}
              />
            ) : (
              <CounselChat
                history={currentHistory}
                mode={currentAnalysis.mode}
                speaker1Name={t('me')}
                speaker2Name={currentAnalysis.speaker2Name}
              />
            )}
          </div>
        );
      case 'selfAnalysis':
        return (
          <div className="h-full">
            <div className="itda-card p-5 md:p-7 mb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl md:text-3xl font-black text-gray-800 mb-1">{t('selfAnalysisTitle')}</h1>
                  <p className="text-gray-600">{t('selfAnalysisDescription')}</p>
                </div>
                <button
                  onClick={() => setView('map')}
                  className="itda-btn itda-btn-secondary px-4 py-2 text-sm smooth-transition"
                >
                  {t('backToMap')}
                </button>
              </div>
            </div>
            <SelfAnalysis />
          </div>
        );
      default:
        return <LandingPage onStart={() => setView('map')} />;
    }
  };

  // 로그인하지 않은 경우 LandingPage 표시 (LandingPage에서 Google 로그인 처리)
  if (!currentUser) {
    return (
      <>
        <LandingPage onStart={() => setView('map')} />
      </>
    );
  }

  return (
    <div className="itda-shell">
      <aside className="itda-sidebar itda-surface">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(197,139,215,0.22), rgba(126,162,200,0.18))',
                border: '1px solid rgba(43,36,51,0.10)',
                boxShadow: '0 18px 40px rgba(43,36,51,0.10)',
              }}
            >
              <HeartIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-extrabold uppercase tracking-widest text-gray-500">It-Da</div>
              <div className="text-2xl font-black text-gray-800 leading-tight truncate">Relationship Lab</div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 space-y-3">
          <button
            onClick={() => setView('map')}
            className={`itda-btn itda-btn-secondary w-full px-4 py-3 justify-start ${view === 'map' ? 'ring-2 ring-violet-200/60' : ''}`}
          >
            <MapIcon className="w-5 h-5" />
            {t('relationshipMapTitle')}
          </button>
          <button
            onClick={() => setView('selfAnalysis')}
            className={`itda-btn itda-btn-secondary w-full px-4 py-3 justify-start ${view === 'selfAnalysis' ? 'ring-2 ring-violet-200/60' : ''}`}
          >
            <UserIcon className="w-5 h-5" />
            {t('selfAnalysisButton')}
          </button>
          <button
            onClick={handleStartAddEmpty}
            className={`itda-btn itda-btn-primary w-full px-4 py-3 justify-start ${view === 'input' && isCreatingNewPerson ? 'ring-2 ring-violet-200/60' : ''}`}
          >
            <PlusIcon className="w-5 h-5" />
            {t('addPerson')}
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">Recent</div>
          <div className="space-y-2">
            {sortedAnalyses.length === 0 ? (
              <div className="text-sm text-gray-500">{t('tip')}</div>
            ) : (
              sortedAnalyses.slice(0, 12).map((a) => (
                <button
                  key={a.id}
                  onClick={() => handleSelectAnalysis(a)}
                  className={`itda-note-item ${currentAnalysis?.id === a.id ? 'is-active' : ''}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 pl-3">
                      <div className="font-extrabold text-gray-800 truncate">{a.speaker2Name}</div>
                      <div className="text-xs text-gray-500 truncate">{new Date(a.date).toLocaleString()}</div>
                    </div>
                    <div className="itda-pill">{a.result.intimacyScore}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <div className="itda-shell-main">
        <header className="itda-topbar itda-surface">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="itda-btn itda-btn-secondary px-4 py-2 text-sm smooth-transition"
            >
              {language === 'ko' ? 'EN' : '한국어'}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="itda-btn itda-btn-secondary px-4 py-2 text-sm">
              {currentUser?.email || currentUser?.displayName || t('user')}
            </div>
            <button
              onClick={logout}
              className="itda-btn itda-btn-danger px-4 py-2 text-sm smooth-transition"
            >
              {t('logout')}
            </button>
          </div>
        </header>

        <main className="itda-main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;