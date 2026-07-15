import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase 콘솔 -> 프로젝트 설정 -> 웹앱 등록 후 발급된 키를 붙여넣으세요.
const firebaseConfig = {
  apiKey: "AIzaSyD-NiN8SBYWoM7DHMpsOq8BhdqkYpsNHl0",
  authDomain: "grade-calendar-89b7c.firebaseapp.com",
  projectId: "grade-calendar-89b7c",
  storageBucket: "grade-calendar-89b7c.firebasestorage.app",
  messagingSenderId: "567144806225",
  appId: "1:567144806225:web:7c9933f3454d4bb5a14570"
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