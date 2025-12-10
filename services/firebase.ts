import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore, doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { AnalysisResult, PersonData, StoredAnalysis, RelationshipMode } from '../types';

// Firebase 설정
// 환경 변수에서 Firebase 설정을 가져옵니다
// 개발 환경에서 .env.local 파일이 없을 경우를 위한 기본값
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
      '⚠️ Firebase 환경 변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.',
      '누락된 변수:', missingVars
    );
    console.info('현재 사용 중인 Firebase 설정:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 10)}...` : '없음',
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
  if (!getApps().length) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }

  // Auth 인스턴스 생성 (동일한 app 인스턴스 재사용)
  auth = getAuth(app);
  if (!auth) {
    throw new Error('Firebase Auth 초기화 실패: auth 인스턴스를 생성할 수 없습니다.');
  }

  // Google Auth Provider 생성
  googleProvider = new GoogleAuthProvider();
  
  // Firestore 인스턴스 생성 (동일한 app 인스턴스 재사용)
  db = getFirestore(app);
  if (!db) {
    throw new Error('Firestore 초기화 실패: db 인스턴스를 생성할 수 없습니다.');
  }
  
  // 초기화 완료 로그 (단 1번만 출력)
  console.log('🔥 Firebase initialized', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
    });
} catch (error: any) {
  console.error('❌ Firebase 초기화 실패:', error);
  if (error.code === 'auth/invalid-api-key' || error.code === 'app/invalid-app-options') {
    console.error('Firebase 설정이 유효하지 않습니다.');
    console.error('현재 설정:', {
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 15)}...` : '없음',
      authDomain: firebaseConfig.authDomain,
      projectId: firebaseConfig.projectId,
    });
    console.error('해결 방법:');
    console.error('1. 프로젝트 루트에 .env.local 파일 생성');
    console.error('2. VITE_FIREBASE_API_KEY 등 환경 변수 설정');
    console.error('3. 개발 서버 재시작 (npm run dev)');
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
    
    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw new Error('Firestore is offline. Please check your internet connection.');
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('Permission denied. Please check Firestore security rules.');
    }
    
    throw new Error(`Failed to retrieve person data from Firestore: ${error?.message || 'Unknown error'}`);
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
    await setDoc(personRef, {
      history: data.history,
      analysis: data.analysis,
      mode: data.mode,
      updatedAt: data.updatedAt || new Date().toISOString(),
    }, { merge: false });
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
    
    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw new Error('Firestore is offline. Please check your internet connection.');
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('Permission denied. Please check Firestore security rules.');
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
    
    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw new Error('Firestore is offline. Please check your internet connection.');
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('Permission denied. Please check Firestore security rules.');
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
        // analysis에서 speaker1, speaker2 이름 추출
        const speaker1Name = data.analysis.balanceRatio?.speaker1?.name || 'Me';
        const speaker2Name = data.analysis.balanceRatio?.speaker2?.name || personName;
        
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
    
    // 오프라인 오류인 경우 특별 처리
    if (error?.code === 'unavailable' || error?.message?.includes('offline')) {
      throw new Error('Firestore is offline. Please check your internet connection.');
    }
    
    // 권한 오류인 경우 특별 처리
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      throw new Error('Permission denied. Please check Firestore security rules.');
    }
    
    throw new Error(`Failed to retrieve persons data from Firestore: ${error?.message || 'Unknown error'}`);
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

