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
      console.error('Google login error:', error);
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
      console.error('Logout error:', error);
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
          console.error('Auth state change error:', error);
          if (error.code === 'auth/invalid-api-key') {
            console.error('❌ Firebase API key error: Check .env.local and restart the dev server.');
          }
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Firebase Auth listener error:', error);
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

