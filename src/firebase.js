// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 🔑 [수정] 하드코딩된 값 대신 .env의 환경변수를 사용
// .env 파일은 .gitignore에 포함되어 있어 GitHub에는 올라가지 않음
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 1. Firebase 커넥션 시작
const app = initializeApp(firebaseConfig);

// 2. 외부 컴포넌트에서 활용할 인증 및 DB 변수 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);

// 3. 브라우저 로드 즉시 비밀번호 없이 익명 세션을 맺는 시그널 함수
export const initAnonymousAuth = async () => {
  try {
    const userCredential = await signInAnonymously(auth);
    console.log("교무실 보안 연결 성공 (익명 계정 ID):", userCredential.user.uid);
    return userCredential.user;
  } catch (error) {
    console.error("교무실 네트워크 보안 인증에 실패했습니다:", error);
    throw error;
  }
};