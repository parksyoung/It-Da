import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../contexts/AuthContext';
import { AnalyzeIcon, HeartIcon, SparklesIcon, RelationshipNodesIcon } from './icons';

interface LandingPageProps {
  onStart: () => void;
}

const FeatureCard: React.FC<{ icon: React.ReactNode; title: string; description: string; }> = ({ icon, title, description }) => (
    <div className="itda-card-soft p-6 text-center flex flex-col items-center smooth-transition hover:-translate-y-2 hover:shadow-xl">
        <div className="mb-4 text-purple-500">{icon}</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
    </div>
);

const ProblemCard: React.FC<{ title: string; description: string; color: string; }> = ({ title, description, color }) => (
    <div className="text-center">
        <h4 className={`text-lg font-bold ${color}`}>{title}</h4>
        <p className="text-gray-600 mt-2 max-w-xs mx-auto">{description}</p>
    </div>
);

const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
    const { t } = useLanguage();
    const { currentUser, loginWithGoogle, logout } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await loginWithGoogle();
            onStart();
        } catch (err: any) {
            let errorMessage = 'Google 로그인에 실패했습니다.';

            const code = err?.code;
            const message = err instanceof Error ? err.message : err?.message;

            if (code === 'auth/popup-closed-by-user') {
                errorMessage = '로그인 팝업이 닫혔습니다.';
            } else if (code === 'auth/popup-blocked') {
                errorMessage = '팝업이 차단되었습니다. 브라우저 설정을 확인해주세요.';
            } else if (code === 'auth/unauthorized-domain') {
                errorMessage = '허용되지 않은 도메인에서 로그인 시도했습니다. Firebase Authorized domains에 localhost를 추가해야 합니다.';
            } else if (code === 'auth/operation-not-allowed') {
                errorMessage = 'Firebase에서 Google 로그인이 비활성화되어 있습니다. Authentication > Sign-in method에서 Google을 활성화하세요.';
            } else if (message) {
                errorMessage = message;
            }

            const details = code ? ` (code: ${code})` : '';
            setError(errorMessage + details);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full">
            <div className="itda-container py-12 md:py-20 text-center fade-in">
                <div className="mx-auto w-20 h-20 rounded-[28px] flex items-center justify-center relative"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255,79,179,0.35), rgba(124,92,255,0.22))',
                        border: '1px solid rgba(31,22,53,0.10)',
                        boxShadow: '0 22px 60px rgba(255,79,179,0.18)',
                    }}
                >
                    <HeartIcon className="w-10 h-10" />
                    <div className="absolute -right-3 -top-3 w-8 h-8 rounded-2xl flex items-center justify-center"
                        style={{
                            background: 'rgba(255,255,255,0.75)',
                            border: '1px solid rgba(31,22,53,0.10)',
                            boxShadow: '0 18px 40px rgba(124,92,255,0.14)',
                        }}
                    >
                        <SparklesIcon className="w-5 h-5 text-pink-500" />
                    </div>
                </div>

                <h1 className="mt-6 text-5xl md:text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-fuchsia-500 to-violet-600 pb-2">It-Da</h1>
                <p className="text-xl md:text-2xl font-semibold text-gray-700 mt-2">관계를 더 다정하게, 더 똑똑하게</p>
                <p className="mt-6 text-lg text-gray-700 max-w-2xl mx-auto">{t('landingTitle')}</p>
                
                {!currentUser ? (
                    <div className="mt-10 flex flex-col items-center gap-4">
                        <button
                            onClick={handleGoogleLogin}
                            disabled={isLoading}
                            className="itda-btn itda-btn-secondary px-8 py-4 text-lg smooth-transition hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path
                                    fill="#4285F4"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="#34A853"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="#FBBC05"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                />
                                <path
                                    fill="#EA4335"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            {isLoading ? '로그인 중...' : 'Google로 시작하기'}
                        </button>
                        {error && (
                            <div className="itda-alert itda-alert-error max-w-md w-full text-sm">
                                {error}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="mt-10 flex flex-col items-center gap-4">
                        <button
                            onClick={onStart}
                            className="itda-btn itda-btn-primary px-8 py-4 text-lg smooth-transition hover:scale-[1.02]"
                        >
                            <SparklesIcon className="w-6 h-6 inline-block mr-2" />
                            {t('landingCTA')}
                        </button>
                        <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-600">
                                {currentUser.displayName || currentUser.email}으로 로그인됨
                            </span>
                            <button
                                onClick={logout}
                                className="text-sm text-red-500 hover:text-red-700 font-medium"
                            >
                                로그아웃
                            </button>
                        </div>
                    </div>
                )}

                <div className="mt-20 md:mt-28 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <FeatureCard icon={<AnalyzeIcon className="w-10 h-10"/>} title={t('feature1Title')} description={t('feature1Desc')} />
                    <FeatureCard icon={<HeartIcon className="w-10 h-10"/>} title={t('feature2Title')} description={t('feature2Desc')} />
                    <FeatureCard icon={<SparklesIcon className="w-10 h-10"/>} title={t('feature3Title')} description={t('feature3Desc')} />
                    <FeatureCard icon={<RelationshipNodesIcon className="w-10 h-10"/>} title={t('feature4Title')} description={t('feature4Desc')} />
                </div>
                
                <div className="itda-card-soft mt-20 md:mt-28 p-8">
                    <h2 className="text-3xl font-bold text-gray-800">{t('whyTitle')}</h2>
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-10">
                        <ProblemCard title={t('problem1Title')} description={t('problem1Desc')} color="text-pink-500" />
                        <ProblemCard title={t('problem2Title')} description={t('problem2Desc')} color="text-violet-500" />
                        <ProblemCard title={t('problem3Title')} description={t('problem3Desc')} color="text-sky-500" />
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LandingPage;