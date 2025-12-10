import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Firebase 설정
// 환경 변수에서 Firebase 설정을 가져옵니다
// 개발 환경에서 .env.local 파일이 없을 경우를 위한 기본값
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCbWNluU4Vh4e7Fn7hk-VFSVzttGc3no0Q',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'it-da-23307.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'it-da-23307',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'it-da-23307.firebasestorage.app',
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

// Firebase 초기화 (에러 핸들링 포함)
let app;
let auth;
let googleProvider;

try {
  // Firebase 앱 초기화
  app = initializeApp(firebaseConfig);

  // Auth 인스턴스 생성
  auth = getAuth(app);

  // Google Auth Provider 생성
  googleProvider = new GoogleAuthProvider();
  
  // 개발 모드에서 초기화 확인
  if (import.meta.env.DEV) {
    console.log('✅ Firebase 초기화 완료:', {
      projectId: firebaseConfig.projectId,
      authDomain: firebaseConfig.authDomain,
      apiKey: firebaseConfig.apiKey ? `${firebaseConfig.apiKey.substring(0, 15)}...` : '없음',
    });
  }
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

export { auth, googleProvider };
export default app;

