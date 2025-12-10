# Firebase 인증 설정 가이드

이 프로젝트는 Firebase Authentication을 사용하여 사용자 인증을 처리합니다.

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/)에 접속합니다.
2. "프로젝트 추가"를 클릭하여 새 프로젝트를 생성합니다.
3. 프로젝트 이름을 입력하고 Google Analytics 설정을 선택합니다.

## 2. 웹 앱 등록

1. Firebase 프로젝트 대시보드에서 웹 아이콘(</>)을 클릭합니다.
2. 앱 닉네임을 입력하고 "앱 등록"을 클릭합니다.
3. Firebase SDK 설정 정보를 복사합니다.

## 3. 인증 방법 활성화

1. Firebase Console에서 "인증" 메뉴로 이동합니다.
2. "시작하기"를 클릭합니다.
3. "Sign-in method" 탭에서 다음 인증 방법을 활성화합니다:
   - **이메일/비밀번호**: 활성화
   - **Google**: 활성화 (Google 로그인 사용 시)

## 4. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가합니다:

```env
# Gemini API Key
GEMINI_API_KEY=your_gemini_api_key_here

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

Firebase SDK 설정 정보에서 각 값을 복사하여 입력합니다.

## 5. Google 로그인 설정 (선택사항)

Google 로그인을 사용하려면:

1. Firebase Console > 인증 > Sign-in method > Google에서:
   - 프로젝트 지원 이메일을 설정합니다.
   - 승인된 도메인에 앱 도메인을 추가합니다.

2. [Google Cloud Console](https://console.cloud.google.com/)에서:
   - OAuth 2.0 클라이언트 ID를 생성합니다.
   - 승인된 JavaScript 원본과 리디렉션 URI를 설정합니다.

## 6. 실행

환경 변수를 설정한 후 앱을 실행합니다:

```bash
npm run dev
```

## 주요 기능

- **이메일/비밀번호 로그인**: 이메일과 비밀번호로 회원가입 및 로그인
- **Google 로그인**: Google 계정으로 간편 로그인
- **자동 인증 상태 관리**: 로그인 상태 유지
- **보호된 라우트**: 로그인하지 않은 사용자는 로그인 페이지로 리디렉션

## 문제 해결

### 환경 변수가 로드되지 않는 경우
- Vite는 `VITE_` 접두사가 있는 환경 변수만 클라이언트에서 사용할 수 있습니다.
- `.env.local` 파일이 프로젝트 루트에 있는지 확인하세요.
- 개발 서버를 재시작하세요.

### Google 로그인 팝업이 차단되는 경우
- 브라우저의 팝업 차단 설정을 확인하세요.
- Firebase Console에서 승인된 도메인이 올바르게 설정되었는지 확인하세요.

