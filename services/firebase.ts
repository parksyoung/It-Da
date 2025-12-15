import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, Firestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { AnalysisResult, PersonData, StoredAnalysis, RelationshipMode } from '../types';

// Firebase 설정
// 환경 변수에서 Firebase 설정을 가져옵니다
// 개발 환경에서 .env.local 파일이 없을 경우를 위한 기본값
const errorWithCode = (message: string, code?: string) => {
  const err: any = new Error(message);
  if (code) err.code = code;
  return err;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbWNluU4Vh4e7Fn7hk-VFSVzttGc3no0Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'it-da-23307.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'it-da-23307',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'it-da-23307.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '608180937800',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:608180937800:web:f7e425ad3db01cf294928d',
};

// 환경 변수 검증 (개발 모드에서만)
if (import.meta.env.DEV) {
  const requiredEnvVars = [
    'VITE_FIREBASE_API_KEY',
    'VITE_FIREBASE_AUTH_DOMAIN',
    'VITE_FIREBASE_PROJECT_ID',
  ];
  
  const missingVars = requiredEnvVars.filter(
    (varName) => !import.meta.env[varName]
  );
  
  if (missingVars.length > 0) {
    console.warn(
      '⚠️ Firebase environment variables are not set. Please check your .env.local file.',
      'Missing vars:', missingVars
    );
    console.info('Current Firebase config:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : 'none',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
  }
}

// Firebase 초기화 (중복 초기화 방지)
let app: FirebaseApp;
let auth: Auth;
let googleProvider: GoogleAuthProvider;
let db: Firestore;

try {
  // 중복 초기화 방지: 이미 초기화된 앱이 있으면 재사용
  const hasExistingApp = getApps().length > 0;

  if (!hasExistingApp) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Auth instance
  auth = getAuth(app);
  if (!auth) {
    throw new Error('Failed to initialize Firebase Auth: could not create auth instance.');
  }

  // Google Auth Provider
  googleProvider = new GoogleAuthProvider();
  
  // Firestore instance
  db = hasExistingApp
    ? getFirestore(app)
    : initializeFirestore(app, {
        experimentalForceLongPolling: true,
        useFetchStreams: false,
      });
  if (!db) {
    throw new Error('Failed to initialize Firestore: could not create db instance.');
  }
  
  // 초기화 완료 로그 (단 1번만 출력)
  console.log('🔥 Firebase initialized', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
    });
} catch (error: any) {
  console.error('❌ Firebase initialization failed:', error);
  if (error.code === 'auth/invalid-api-key' || error.code === 'app/invalid-app-options') {
    console.error('Firebase configuration is invalid.');
    console.error('Current config:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 15)}...` : 'none',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
    console.error('How to fix:');
    console.error('1. Create a .env.local file at the project root');
    console.error('2. Set VITE_FIREBASE_API_KEY and other env vars');
    console.error('3. Restart the dev server (npm run dev)');
  }
  throw error;
}

/**
 * Firestore 데이터 구조:
 * users/{userId}/persons/{personName}
 *   - history: string[] (누적된 모든 대화)
 *   - analysis: AnalysisResult (최신 AI 분석 결과)
 *   - mode: RelationshipMode (관계 모드)
 */

/**
 * Get the current authenticated user's UID
 * @returns string - The user's UID
 * @throws Error if user is not authenticated or auth is not initialized
 */
const getCurrentUserId = (): string => {
  if (!auth) {
    throw new Error('Firebase Auth is not initialized');
  }
  const userId = auth.currentUser?.uid;
  if (!userId) {
    throw new Error('User is not authenticated');
  }
  return userId;
};

/**
 * Get person data from Firestore
 * @param personName - The person's name
 * @returns Promise<PersonData | null> - The person data or null if not found
 */
export const getPersonData = async (personName: string): Promise<PersonData | null> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personRef = doc(db, 'users', userId, 'persons', personName);
    const personSnap = await getDoc(personRef);
    
    if (personSnap.exists()) {
      const data = personSnap.data();
      return {
        name: data.name || personName, // Use stored name, fallback to document ID
        history: data.history || [],
        analysis: data.analysis as AnalysisResult,
        updatedAt: data.updatedAt,
      };
    }
    return null;
  } catch (error: any) {
    // 인증 오류는 그대로 전파
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }
    
    // Firestore 오류 상세 로깅
    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to get person data', {
      userId,
      personName,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });
    
    // Firestore 미설정(데이터베이스 생성 전)에서 자주 발생
    if (error?.code === 'failed-precondition') {
      throw errorWithCode('Firestore Database is not created/enabled yet. Create Firestore Database in Firebase Console and try again.', error?.code);
    }

    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw errorWithCode('Firestore is offline. Please check your internet connection.', error?.code);
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw errorWithCode('Permission denied. Please check Firestore security rules.', error?.code);
    }
    
    // 인증 오류인 경우 특별 처리
    if (error?.code === 'unauthenticated') {
      throw errorWithCode('User is not authenticated. Please sign in and try again.', error?.code);
    }
    
    throw new Error(`Failed to retrieve person data from Firestore: ${error?.message || 'Unknown error'}`);
  }
};

export type CounselMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

export const getCounselMessages = async (personName: string): Promise<CounselMessage[]> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personRef = doc(db, 'users', userId, 'persons', personName);
    const personSnap = await getDoc(personRef);
    if (!personSnap.exists()) return [];
    const data = personSnap.data();
    const raw = (data as any)?.counselMessages;
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((m: any) => m && typeof m.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({ id: m.id, role: m.role, content: m.content }));
  } catch (error: any) {
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }

    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to get counsel messages', {
      userId,
      personName,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });

    if (error?.code === 'failed-precondition') {
      throw errorWithCode('Firestore Database is not created/enabled yet. Create Firestore Database in Firebase Console and try again.', error?.code);
    }

    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw errorWithCode('Firestore is offline. Please check your internet connection.', error?.code);
    }

    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw errorWithCode('Permission denied. Please check Firestore security rules.', error?.code);
    }

    if (error?.code === 'unauthenticated') {
      throw errorWithCode('User is not authenticated. Please sign in and try again.', error?.code);
    }

    throw new Error(`Failed to retrieve counsel messages from Firestore: ${error?.message || 'Unknown error'}`);
  }
};

export const saveCounselMessages = async (personName: string, messages: CounselMessage[]): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personRef = doc(db, 'users', userId, 'persons', personName);
    await setDoc(personRef, {
      counselMessages: messages,
      counselUpdatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (error: any) {
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }

    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to save counsel messages', {
      userId,
      personName,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });

    if (error?.code === 'failed-precondition') {
      throw errorWithCode('Firestore Database is not created/enabled yet. Create Firestore Database in Firebase Console and try again.', error?.code);
    }

    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw errorWithCode('Firestore is offline. Please check your internet connection.', error?.code);
    }

    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw errorWithCode('Permission denied. Please check Firestore security rules.', error?.code);
    }

    if (error?.code === 'unauthenticated') {
      throw errorWithCode('User is not authenticated. Please sign in and try again.', error?.code);
    }

    throw new Error(`Failed to save counsel messages to Firestore: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Extended PersonData that includes mode for Firestore storage
 */
interface PersonDataWithMode extends PersonData {
  mode: RelationshipMode;
}

/**
 * Save person data to Firestore
 * @param personName - The person's name
 * @param data - The person data including history, analysis, and mode
 */
export const savePersonData = async (
  personName: string,
  data: PersonDataWithMode
): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personRef = doc(db, 'users', userId, 'persons', personName);
    // Store person name explicitly - this is the source of truth, independent of analysis results
    // Use merge: true to preserve existing name field if document already exists
    await setDoc(personRef, {
      name: personName, // Store name explicitly to avoid dependency on analysis
      history: data.history,
      analysis: data.analysis,
      mode: data.mode,
      updatedAt: data.updatedAt || new Date().toISOString(),
    }, { merge: true }); // Use merge: true to preserve name field when updating existing person
  } catch (error: any) {
    // 인증 오류는 그대로 전파
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }
    
    // Firestore 오류 상세 로깅
    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to save person data', {
      userId,
      personName,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });
    
    // Common when Firestore Database is not created yet
    if (error?.code === 'failed-precondition') {
      throw errorWithCode('Firestore Database is not created/enabled yet. Create Firestore Database in Firebase Console and try again.', error?.code);
    }

    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw errorWithCode('Firestore is offline. Please check your internet connection.', error?.code);
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw errorWithCode('Permission denied. Please check Firestore security rules.', error?.code);
    }
    
    // 인증 오류인 경우 특별 처리
    if (error?.code === 'unauthenticated') {
      throw errorWithCode('User is not authenticated. Please sign in and try again.', error?.code);
    }
    
    throw new Error(`Failed to save person data to Firestore: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Delete a person document from Firestore
 * @param personName - The person's name
 */
export const deletePerson = async (personName: string): Promise<void> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personRef = doc(db, 'users', userId, 'persons', personName);
    await deleteDoc(personRef);
  } catch (error: any) {
    // 인증 오류는 그대로 전파
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }
    
    // Firestore 오류 상세 로깅
    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to delete person', {
      userId,
      personName,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });
    
    // Firestore 미설정(데이터베이스 생성 전)에서 자주 발생
    if (error?.code === 'failed-precondition') {
      throw errorWithCode('Firestore Database is not created/enabled yet. Create Firestore Database in Firebase Console and try again.', error?.code);
    }

    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw errorWithCode('Firestore is offline. Please check your internet connection.', error?.code);
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw errorWithCode('Permission denied. Please check Firestore security rules.', error?.code);
    }
    
    // 인증 오류인 경우 특별 처리
    if (error?.code === 'unauthenticated') {
      throw errorWithCode('User is not authenticated. Please sign in and try again.', error?.code);
    }
    
    throw new Error(`Failed to delete person from Firestore: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Get all persons data for the current user and convert to StoredAnalysis array
 * @returns Promise<StoredAnalysis[]> - Array of stored analyses
 */
export const getAllPersonsAsAnalyses = async (): Promise<StoredAnalysis[]> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personsRef = collection(db, 'users', userId, 'persons');
    const personsSnap = await getDocs(personsRef);
    
    const analyses: StoredAnalysis[] = [];
    
    personsSnap.forEach((docSnap) => {
      const personName = docSnap.id;
      const data = docSnap.data();
      
      if (data.analysis) {
        // CRITICAL: Use stored name field (or document ID as fallback), NEVER use analysis result names
        // Analysis results can extract different names, but the person's name is what the user entered
        const storedPersonName = data.name || personName; // Use stored name field, fallback to document ID
        const speaker1Name = 'Me'; // Always 'Me' for the user
        const speaker2Name = storedPersonName; // Use stored person name, NOT analysis result
        
        const mode = (data.mode as RelationshipMode) || RelationshipMode.FRIEND;
        
        const storedAnalysis: StoredAnalysis = {
          id: `${userId}-${personName}`,
          date: data.updatedAt || new Date().toISOString(),
          mode,
          speaker1Name,
          speaker2Name,
          result: data.analysis as AnalysisResult,
        };
        
        analyses.push(storedAnalysis);
      }
    });
    
    return analyses;
  } catch (error: any) {
    // 인증 오류는 그대로 전파
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }
    
    // Firestore 오류 상세 로깅
    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to get all persons', {
      userId,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });
    
    // Firestore 미설정(데이터베이스 생성 전)에서 자주 발생
    if (error?.code === 'failed-precondition') {
      throw errorWithCode('Firestore Database is not created/enabled yet. Create Firestore Database in Firebase Console and try again.', error?.code);
    }

    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw errorWithCode('Firestore is offline. Please check your internet connection.', error?.code);
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw errorWithCode('Permission denied. Please check Firestore security rules.', error?.code);
    }
    
    throw new Error(`Failed to retrieve persons data from Firestore: ${error?.message || 'Unknown error'}`);
  }
};

/**
 * Get all conversation histories from all persons
 * @returns Promise<string[]> - Array of conversation history strings
 */
export const getAllPersonsHistory = async (): Promise<string[]> => {
  if (!db) {
    throw new Error('Firestore is not initialized');
  }

  try {
    const userId = getCurrentUserId();
    const personsRef = collection(db, 'users', userId, 'persons');
    const personsSnap = await getDocs(personsRef);
    
    const histories: string[] = [];
    
    personsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.history && Array.isArray(data.history) && data.history.length > 0) {
        // Combine all conversation sessions for this person
        const personHistory = data.history.join('\n\n---\n\n');
        histories.push(personHistory);
      }
    });
    
    return histories;
  } catch (error: any) {
    // 인증 오류는 그대로 전파
    if (error instanceof Error && (
      error.message === 'User is not authenticated' ||
      error.message === 'Firebase Auth is not initialized'
    )) {
      throw error;
    }
    
    // Firestore 오류 상세 로깅
    const userId = auth?.currentUser?.uid || 'unknown';
    console.error('[Firestore] Failed to get all persons history', {
      userId,
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack,
    });
    
    throw new Error(`Failed to retrieve conversation histories: ${error?.message || 'Unknown error'}`);
  }
};

export { auth, googleProvider, db };
export default app;

/**
 * ============================================
 * Firestore Security Rules (테스트용)
 * ============================================
 * 
 * 아래 규칙을 Firebase Console > Firestore Database > Rules에 적용하세요.
 * 
 * // 프로덕션 권장 규칙 - 사용자는 자신의 데이터만 접근 가능
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     match /users/{userId}/persons/{personName} {
 *       // 사용자는 자신의 데이터만 읽고 쓸 수 있음
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 * 
 * // 테스트용 (임시) - 개발 중에만 사용, 프로덕션에서는 절대 사용하지 마세요
 * // rules_version = '2';
 * // service cloud.firestore {
 * //   match /databases/{database}/documents {
 * //     match /{document=**} {
 * //       allow read, write: if true;
 * //     }
 * //   }
 * // }
 * ============================================
 */

