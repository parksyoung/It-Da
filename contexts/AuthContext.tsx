import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import { 
  User, 
  signOut,
  onAuthStateChanged,
  signInWithPopup
} from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loginWithGoogle = async (): Promise<void> => {
    if (!auth) {
      throw new Error('Firebase Auth is not initialized. Please refresh the page.');
    }
    if (!googleProvider) {
      throw new Error('Google Auth Provider is not initialized. Please refresh the page.');
    }
    
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google 로그인 오류:', error);
      if (error.code === 'auth/invalid-api-key') {
        throw new Error('Firebase API 키가 유효하지 않습니다. .env.local 파일을 확인하세요.');
      }
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error('로그인 팝업이 닫혔습니다. 다시 시도해주세요.');
      }
      if (error.code === 'auth/popup-blocked') {
        throw new Error('팝업이 차단되었습니다. 브라우저 설정에서 팝업을 허용해주세요.');
      }
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    if (!auth) {
      console.warn('Firebase Auth is not initialized. Cannot logout.');
      return;
    }
    
    try {
      await signOut(auth);
    } catch (error) {
      console.error('로그아웃 오류:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (!auth) {
      console.error('Firebase Auth is not initialized');
      setLoading(false);
      return;
    }
    
    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          setCurrentUser(user);
          setLoading(false);
        },
        (error) => {
          console.error('인증 상태 변경 오류:', error);
          if (error.code === 'auth/invalid-api-key') {
            console.error('❌ Firebase API 키 오류: .env.local 파일을 확인하고 개발 서버를 재시작하세요.');
          }
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Firebase Auth 상태 감지 오류:', error);
      setLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    currentUser,
    loading,
    loginWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

