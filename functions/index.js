const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

exports.analyzeMessengerText = onCall(
  { secrets: [GEMINI_API_KEY], region: "asia-northeast3" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "인증되지 않은 요청입니다.");
    }

    const text = request.data?.text;
    if (!text || !text.trim()) {
      throw new HttpsError("invalid-argument", "분석할 텍스트가 없습니다.");
    }

    const promptPieces = [
      "너는 학교 교무실 업무를 지원하는 완벽한 AI 비서이다.",
      "제공되는 텍스트 하나에는 서로 다른 공지가 1건만 있을 수도 있고, 여러 건이 섞여 있을 수도 있다. 올해는 2026년이다.",
      "1단계: 먼저 텍스트가 몇 개의 서로 다른 '공지 단위'로 구성되어 있는지 파악하라. 번호(1. 2. 3.), 구분선, 빈 줄, 서로 다른 제목 블록으로 나뉘어 있다면 각각 별개의 공지로 간주한다.",
      "2단계: 각 공지 단위 안에서, 성격이 서로 다른 날짜(또는 날짜 범위)가 몇 개나 언급되는지 파악하라. '이 날짜가 가리키는 행동이나 사건이 서로 다른가?'를 기준으로 판단한다. 예를 들어 '신청/접수/제출의 마감일'과 '실제 행사/교육/활동이 열리는 날'은 서로 다른 사건이므로 별개의 날짜로 센다. 같은 공지 안에 심사일, 발표일처럼 제3, 제4의 날짜가 더 있다면 그것도 각각 별개의 날짜로 센다.",
      "3단계: 한 공지 안에 서로 다른 날짜가 N개 있다면, 그 공지에서 N개의 일정 항목을 만든다. 각 항목의 title은 원래 제목에 그 날짜가 가리키는 행동을 짧게 괄호로 덧붙인다(예: '(신청마감)', '(접수기간)', '(심사)', '(발표)' 등 텍스트의 표현을 그대로 살려서 짓는다). 날짜가 실제 행사/활동 자체를 가리키는 항목이라면 원래 제목을 그대로 쓰고 괄호를 붙이지 않는다.",
      "4단계: 장소, 담당자, 신청방법, 신청인원 등 날짜와 무관하게 공통되는 정보는 그 공지에서 만들어진 모든 일정 항목에 동일하게 채운다.",
      "한 공지 안에 날짜가 1개뿐이면 항목도 1개만 만든다. 날짜 종류를 억지로 쪼개지 말고, 실제로 서로 다른 사건을 가리킬 때만 나눈다.",
      "모든 공지에서 만들어진 일정 항목 전체를 하나의 JSON 배열로 응답하라.",
      "오직 아래 명세(배열 형태)만 텍스트로 응답하고, 마크다운 기호(```json)나 설명은 일절 배제하라:",
      "[ { \"title\": \"일정명\", \"startDate\": \"YYYY-MM-DD\", \"endDate\": \"YYYY-MM-DD\", \"startTime\": \"HH:MM\", \"endTime\": \"HH:MM\", \"manager\": \"\", \"location\": \"\", \"applyMethod\": \"\", \"applyCount\": \"\", \"memo\": \"\" } ]"
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY.value()}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptPieces.join("\n") }, { text: `[원문]\n${text}` }] }]
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API 오류:", response.status, errText);
      throw new HttpsError("internal", `Gemini API 호출 실패 (${response.status}): ${errText}`);
    }

    const resData = await response.json();
    if (!resData.candidates || !resData.candidates[0]) {
      console.error("Gemini 응답에 candidates 없음:", JSON.stringify(resData));
      throw new HttpsError("internal", "Gemini 응답 형식 오류 (안전 필터에 걸렸거나 빈 응답)");
    }
    return { result: resData.candidates[0].content.parts[0].text };
  }
);