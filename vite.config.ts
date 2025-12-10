import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  // 개발 모드에서 환경 변수 확인
  if (mode === 'development') {
    const firebaseVars = [
      'VITE_FIREBASE_API_KEY',
      'VITE_FIREBASE_AUTH_DOMAIN',
      'VITE_FIREBASE_PROJECT_ID',
      'VITE_FIREBASE_STORAGE_BUCKET',
      'VITE_FIREBASE_MESSAGING_SENDER_ID',
      'VITE_FIREBASE_APP_ID',
    ];
    
    const missingFirebaseVars = firebaseVars.filter(varName => !env[varName]);
    
    if (missingFirebaseVars.length > 0) {
      console.warn('⚠️ Firebase 환경 변수가 .env.local에 없습니다. 기본값을 사용합니다.');
      console.info('누락된 변수:', missingFirebaseVars);
    }

    // Gemini API Key 확인
    if (!env.VITE_GEMINI_API_KEY) {
      console.warn('⚠️ VITE_GEMINI_API_KEY 환경 변수가 .env.local에 없습니다.');
    }
  }
  
  return {
    base: './',
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      // Vite는 VITE_ 접두사가 있는 환경 변수를 자동으로 import.meta.env에 로드하므로 별도 define 불필요
      // Firebase 및 Gemini 환경 변수는 모두 VITE_ 접두사를 사용하므로 자동 로드됨
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
