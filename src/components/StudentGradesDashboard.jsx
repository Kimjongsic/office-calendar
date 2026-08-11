// src/components/StudentGradesDashboard.jsx
import React, { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import {
  Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, BarChart, Bar
} from "recharts";
import { X } from "lucide-react";

const SUBJECTS = ["국어", "수학", "영어", "사회", "과학", "기타"];
const SUBJECT_COLORS = {
  "국어": "#2a78d6",
  "수학": "#eb6834",
  "영어": "#1baf7a",
  "사회": "#eda100",
  "과학": "#e87ba4",
  "기타": "#4a3aa7",
};
const MOCK_SESSIONS = ["25년 3월", "25년 6월", "25년 9월", "25년 10월", "26년 3월", "26년 6월"];
const STORAGE_KEY = "student_grades_uploaded"; // 🔑 이 PC에만 저장 (다른 선생님과 공유 안 됨)

function emptyStudent() {
  const s = { school: {}, mock: {} };
  SUBJECTS.forEach((subj) => {
    s.mock[subj] = MOCK_SESSIONS.map(() => null);
  });
  return s;
}

function pushSchoolEntry(student, subject, term, entry) {
  student.school[subject] = student.school[subject] || {};
  student.school[subject][term] = student.school[subject][term] || [];
  student.school[subject][term].push(entry);
}

function mapSubjectCategory(subjectGroup) {
  const g = String(subjectGroup || "").trim();
  if (g === "국어") return "국어";
  if (g === "수학") return "수학";
  if (g === "영어") return "영어";
  if (g.startsWith("사회")) return "사회";
  if (g === "과학") return "과학";
  return "기타";
}

function findNaeisSheet(workbook) {
  for (const name of workbook.SheetNames) {
    const sheet = workbook.Sheets[name];
    const arr = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
    if (!arr || arr.length < 2) continue;
    const row1 = arr[0] || [];
    const row2 = arr[1] || [];
    if (row1[0] === "계열코드" || (row2.includes && row2.includes("단위수"))) {
      return arr;
    }
  }
  return null;
}

function parseNaeisRows(rows, ensure) {
  rows.forEach((r) => {
    if (!r || r.length === 0) return;
    const cls = Number(r[1]);
    const num = Number(r[2]);
    const gradeYear = Number(r[3]);
    const subjectGroup = r[4];
    const courseName = r[5];
    if (!cls || !num || !gradeYear) return;
    const category = mapSubjectCategory(subjectGroup);
    if (!category) return;

    const blocks = [
      { termNo: 1, credit: r[6], rawScore: r[7], gradeVal: r[10], achievement: r[11] },
      { termNo: 2, credit: r[14], rawScore: r[15], gradeVal: r[18], achievement: r[19] },
    ];
    blocks.forEach((b) => {
      if (b.rawScore === null && b.gradeVal === null) return;
      const term = `${gradeYear}학년 ${b.termNo}학기`;
      const student = ensure(cls, num);
      pushSchoolEntry(student, category, term, {
        rawScore: Number(b.rawScore) || 0,
        achievement: String(b.achievement || "").trim() || "-",
        grade: Number(b.gradeVal) || 9,
        credit: Number(b.credit) || 1,
        courseName: String(courseName || "").trim(),
      });
    });
  });
}

function parseWorkbook(workbook) {
  const result = {};
  const ensure = (c, n) => {
    result[c] = result[c] || {};
    result[c][n] = result[c][n] || emptyStudent();
    return result[c][n];
  };

  const naeisRows = findNaeisSheet(workbook);
  if (naeisRows) {
    parseNaeisRows(naeisRows.slice(2), ensure);
  }

  const mockSheet = workbook.Sheets["모의고사"];
  if (mockSheet) {
    const rows = XLSX.utils.sheet_to_json(mockSheet, { defval: null });
    rows.forEach((row) => {
      const cls = Number(row["반"]);
      const num = Number(row["번호"]);
      const subjectRaw = String(row["과목"] || "").trim();
      const subject = SUBJECTS.includes(subjectRaw) ? subjectRaw : (subjectRaw === "통합사회" ? "사회" : subjectRaw === "통합과학" ? "과학" : null);
      const session = String(row["회차"] || "").trim();
      if (!cls || !num || !subject) return;
      const si = MOCK_SESSIONS.indexOf(session);
      if (si === -1) return;
      const student = ensure(cls, num);
      student.mock[subject][si] = {
        score: Number(row["표준점수"]) || 0,
        grade: Number(row["등급"]) || 9,
      };
    });
  }

  return result;
}

function termSortKey(term) {
  const m = /^(\d+)학년 (\d+)학기$/.exec(term);
  return m ? Number(m[1]) * 10 + Number(m[2]) : 999;
}

function collectTerms(uploaded) {
  const set = new Set();
  Object.values(uploaded).forEach((classMap) => {
    Object.values(classMap).forEach((student) => {
      SUBJECTS.forEach((subj) => {
        Object.keys(student.school[subj] || {}).forEach((t) => set.add(t));
      });
    });
  });
  return Array.from(set).sort((a, b) => termSortKey(a) - termSortKey(b));
}

function weightedAvg(entries) {
  if (!entries.length) return null;
  const creditSum = entries.reduce((a, e) => a + (e.credit || 1), 0);
  if (!creditSum) return null;
  return entries.reduce((a, e) => a + e.grade * (e.credit || 1), 0) / creditSum;
}
function allEntries(studentData) {
  const out = [];
  SUBJECTS.forEach((subj) => {
    Object.values(studentData.school[subj] || {}).forEach((arr) => out.push(...arr));
  });
  return out;
}
function schoolAvgGrade(studentData) {
  return weightedAvg(allEntries(studentData)) || 0;
}
function subjectAvgGrade(studentData, subject) {
  const entries = Object.values(studentData.school[subject] || {}).flat();
  return weightedAvg(entries);
}
function termAvgGrade(studentData, term) {
  const entries = [];
  SUBJECTS.forEach((subj) => {
    entries.push(...((studentData.school[subj] || {})[term] || []));
  });
  const avg = weightedAvg(entries);
  return avg === null ? 0 : Math.round(avg * 100) / 100;
}

const thStyle = {
  textAlign: "center", padding: "9px 10px", color: "#6B7280",
  fontWeight: 600, borderBottom: "2px solid #E2E5EA", whiteSpace: "nowrap",
};
const tdStyle = {
  textAlign: "center", padding: "9px 10px",
  borderBottom: "1px solid #EEF0F3", whiteSpace: "nowrap",
};
const selectStyle = {
  padding: "7px 10px", borderRadius: "8px", border: "1px solid #D8DBE1",
  fontSize: "13px", fontWeight: 600, color: "#1F3A5F", background: "#FAFBFC",
};
const btnStyle = {
  padding: "9px 14px", borderRadius: "8px", border: "1px solid #D8DBE1",
  fontSize: "13px", fontWeight: 600, color: "#1F3A5F", background: "#FFFFFF", cursor: "pointer",
};

function Card({ title, subtitle, right, children, style }) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "14px",
      padding: "20px 22px", marginBottom: "20px", ...style,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1F3A5F" }}>{title}</h2>
          {subtitle && <p style={{ margin: "3px 0 0", fontSize: "12px", color: "#9AA0A8" }}>{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{ background: accent ? `${accent}12` : "#F5F6F8", borderRadius: "10px", padding: "10px 14px", textAlign: "center", minWidth: "84px" }}>
      <div style={{ fontSize: "11px", color: "#9AA0A8", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "17px", fontWeight: 800, color: accent || "#1F3A5F" }}>{value}</div>
    </div>
  );
}

function UploadButton({ fileInputRef, handleFile }) {
  return (
    <div>
      <button
        onClick={() => fileInputRef.current && fileInputRef.current.click()}
        style={{ ...btnStyle, background: "#1F3A5F", color: "#fff", border: "1px solid #1F3A5F" }}
      >
        엑셀 업로드
      </button>
      <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFile} style={{ display: "none" }} />
    </div>
  );
}

export default function StudentGradesDashboard({ onClose }) {
  const [classNum, setClassNum] = useState(null);
  const [studentNum, setStudentNum] = useState(null);
  const [uploaded, setUploaded] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // 🔑 [수정] window.storage(아티팩트 전용 API) 대신 localStorage 사용 — 이 PC에만 저장
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setUploaded(parsed);
        const classes = Object.keys(parsed).map(Number).sort((a, b) => a - b);
        if (classes.length) {
          setClassNum(classes[0]);
          const nums = Object.keys(parsed[classes[0]]).map(Number).sort((a, b) => a - b);
          setStudentNum(nums[0]);
        }
      }
    } catch (e) {
      // 저장된 데이터가 없거나 손상된 경우 무시
    }
  }, []);

  const saveToStorage = (parsed) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch (e) {
      setUploadError("데이터 저장에 실패했어요. 용량이 너무 클 수 있습니다.");
    }
  };

  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUploaded(null);
    setClassNum(null);
    setStudentNum(null);
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const parsed = parseWorkbook(wb);
        const classes = Object.keys(parsed).map(Number).sort((a, b) => a - b);
        if (!classes.length) {
          setUploadError("인식할 수 있는 데이터가 없어요. 파일 형식을 확인해주세요.");
          return;
        }
        setUploaded(parsed);
        saveToStorage(parsed);
        setClassNum(classes[0]);
        const nums = Object.keys(parsed[classes[0]]).map(Number).sort((a, b) => a - b);
        setStudentNum(nums[0]);
      } catch (err) {
        setUploadError("파일을 읽는 중 문제가 발생했어요. xlsx 파일인지 확인해주세요.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const CloseButton = () => (
    <button
      onClick={onClose}
      className="absolute top-4 right-4 p-2 bg-white border border-[#E2E5EA] rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-50 transition z-10"
      title="닫기"
    >
      <X className="w-5 h-5" />
    </button>
  );

  if (!uploaded || classNum === null) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative bg-[#F5F6F8] rounded-xl shadow-2xl w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
          <CloseButton />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "19px", fontWeight: 800, color: "#1F3A5F", margin: "0 0 8px" }}>
              학생 성적 대시보드
            </h1>
            <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 20px" }}>
              아직 업로드된 데이터가 없어요. 나이스에서 다운로드한 엑셀 파일을 업로드해주세요.
            </p>
            <div style={{ display: "flex", justifyContent: "center" }}><UploadButton fileInputRef={fileInputRef} handleFile={handleFile} /></div>
            {uploadError && (
              <div style={{ background: "#FCEBEB", color: "#791F1F", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", marginTop: "16px" }}>
                {uploadError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const uploadedClassMap = uploaded[classNum] || {};
  const studentNumbers = Object.keys(uploadedClassMap).map(Number).sort((a, b) => a - b);
  const effectiveStudentNum = studentNumbers.includes(studentNum) ? studentNum : studentNumbers[0];
  const studentData = uploadedClassMap[effectiveStudentNum];
  const classDataArray = studentNumbers.map((n) => uploadedClassMap[n]);
  const size = studentNumbers.length;
  const classNumbers = Object.keys(uploaded).map(Number).sort((a, b) => a - b);
  const ALL_TERMS = collectTerms(uploaded);

  const overallAvg = schoolAvgGrade(studentData);
  const classAverages = classDataArray.map(schoolAvgGrade);
  const schoolRank = 1 + classAverages.filter((v) => v < overallAvg).length;
  const subjectAverages = SUBJECTS.map((subj) => ({ subject: subj, avg: subjectAvgGrade(studentData, subj) }));

  const termAvgTrend = ALL_TERMS.map((term) => ({ term, avg: termAvgGrade(studentData, term) }));

  const latestIdx = MOCK_SESSIONS.length - 1;
  const latest = {};
  SUBJECTS.forEach((s) => { latest[s] = studentData.mock[s][latestIdx] || { score: 0, grade: 9 }; });
  const coreAvgGrade = Math.round(((latest["국어"].grade + latest["수학"].grade + latest["영어"].grade + latest["사회"].grade) / 4) * 10) / 10;
  const scoreSum = latest["국어"].score + latest["수학"].score + latest["영어"].score + latest["사회"].score;
  const twoAreaSum = latest["국어"].grade + latest["영어"].grade;
  const bestTam = Math.min(latest["사회"].grade, latest["과학"].grade);
  const threeAreaSum = twoAreaSum + bestTam;

  const classScoreSums = classDataArray.map((s) => {
    const l = {}; SUBJECTS.forEach((subj) => (l[subj] = (s.mock[subj][latestIdx] || { score: 0 })));
    return l["국어"].score + l["수학"].score + l["영어"].score + l["사회"].score;
  });
  const mockRank = 1 + classScoreSums.filter((v) => v > scoreSum).length;
  const hasMockData = SUBJECTS.some((subj) => studentData.mock[subj].some((c) => c));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="relative bg-[#F5F6F8] rounded-xl shadow-2xl w-full max-w-6xl my-4"
        style={{ fontFamily: "-apple-system, 'Malgun Gothic', sans-serif", padding: "28px 24px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CloseButton />

        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "12px", paddingRight: "48px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#1F3A5F", letterSpacing: "-0.02em" }}>
              {classNum}반 {effectiveStudentNum}번 종합성적분석
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: "13px", color: "#6B7280" }}>
              업로드된 데이터 사용 중 · {classNum}반 {size}명
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            <UploadButton fileInputRef={fileInputRef} handleFile={handleFile} />
            <button onClick={() => { clearStorage(); setUploadError(""); }} style={btnStyle}>
              저장된 데이터 삭제
            </button>
          </div>
        </header>

        {uploadError && (
          <div style={{ background: "#FCEBEB", color: "#791F1F", borderRadius: "10px", padding: "10px 14px", fontSize: "13px", marginBottom: "16px" }}>
            {uploadError}
          </div>
        )}

        <div style={{ display: "flex", gap: "10px", background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "12px", padding: "10px 14px", alignItems: "center", marginBottom: "20px", width: "fit-content" }}>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#1F3A5F" }}>반</label>
          <select
            value={classNum}
            onChange={(e) => {
              const v = Number(e.target.value);
              setClassNum(v);
              const nums = Object.keys(uploaded[v] || {}).map(Number).sort((a, b) => a - b);
              setStudentNum(nums[0]);
            }}
            style={selectStyle}
          >
            {classNumbers.map((c) => <option key={c} value={c}>{c}반</option>)}
          </select>
          <label style={{ fontSize: "12px", fontWeight: 600, color: "#1F3A5F" }}>번호</label>
          <select value={effectiveStudentNum} onChange={(e) => setStudentNum(Number(e.target.value))} style={selectStyle}>
            {studentNumbers.map((n) => <option key={n} value={n}>{n}번</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
          <Card title="전교과 전학년 내신 등급" subtitle="과목별 평균 등급" style={{ flex: "1 1 380px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", marginBottom: "14px" }}>
              <thead><tr>{SUBJECTS.map((s) => <th key={s} style={thStyle}>{s}</th>)}</tr></thead>
              <tbody>
                <tr>
                  {subjectAverages.map(({ subject, avg }) => (
                    <td key={subject} style={{ ...tdStyle, fontWeight: 700, color: SUBJECT_COLORS[subject] }}>
                      {avg === null ? "-" : avg.toFixed(2)}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <div style={{ display: "flex", gap: "10px" }}>
              <StatBox label="전체내신등급평균" value={overallAvg.toFixed(2)} accent="#1F3A5F" />
              <StatBox label="반 석차" value={`${schoolRank} / ${size}`} accent="#4a3aa7" />
            </div>
          </Card>

          <Card title="학기별 내신 등급" subtitle="전 과목 평균 등급 추이 (막대, 낮을수록 좋음)" style={{ flex: "1 1 380px" }}>
            <div style={{ height: "200px" }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={termAvgTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF0F3" vertical={false} />
                  <XAxis dataKey="term" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#D8DBE1" }} tickLine={false} />
                  <YAxis domain={[0, 9]} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v}등급`, "평균 등급"]} contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #E2E5EA" }} />
                  <Bar dataKey="avg" fill="#1F3A5F" radius={[4, 4, 0, 0]}>
                    <LabelList dataKey="avg" position="top" style={{ fontSize: 11, fill: "#1F3A5F", fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px", marginBottom: "20px" }}>
          {SUBJECTS.map((subj) => {
            const rows = ALL_TERMS
              .map((term) => ({ term, entries: (studentData.school[subj] || {})[term] || [] }))
              .filter((r) => r.entries.length)
              .map((r) => {
                const avg = weightedAvg(r.entries);
                return { term: r.term, barVal: 10 - avg, grade: Math.round(avg * 10) / 10 };
              });
            return (
              <div key={subj} style={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: SUBJECT_COLORS[subj] }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1F3A5F" }}>{subj} 내신 등급</span>
                </div>
                {rows.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#9AA0A8", padding: "12px 0" }}>데이터 없음</p>
                ) : (
                  <div style={{ height: `${rows.length * 34 + 20}px` }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 4 }}>
                        <XAxis type="number" domain={[0, 9]} hide />
                        <YAxis type="category" dataKey="term" width={90} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <Bar dataKey="barVal" fill={SUBJECT_COLORS[subj]} radius={[0, 4, 4, 0]} barSize={14}>
                          <LabelList dataKey="grade" position="right" formatter={(v) => `${v}등급`} style={{ fontSize: 11, fill: "#1F3A5F", fontWeight: 700 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Card title="이수과목 성적" subtitle="과목명 (원점수 / 성취도 / 등급) · 같은 학기에 선택과목을 여러 개 들었으면 모두 표시">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "18px" }}>
            {ALL_TERMS.map((term) => {
              const lines = [];
              SUBJECTS.forEach((subj) => {
                const entries = (studentData.school[subj] || {})[term] || [];
                entries.forEach((entry) => lines.push({ subj, entry }));
              });
              return (
                <div key={term}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#1F3A5F", marginBottom: "8px", paddingBottom: "6px", borderBottom: "2px solid #E2E5EA" }}>
                    {term}
                  </div>
                  {lines.length === 0 && <p style={{ fontSize: "12px", color: "#9AA0A8" }}>데이터 없음</p>}
                  {lines.map(({ subj, entry }, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "4px 0", color: "#374151" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SUBJECT_COLORS[subj], flexShrink: 0 }} />
                        {entry.courseName}
                      </span>
                      <span style={{ color: "#9AA0A8", whiteSpace: "nowrap" }}>
                        ({entry.rawScore} / {entry.achievement} / {entry.grade})
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="최신 모의고사 성적" subtitle={`${MOCK_SESSIONS[latestIdx]} 기준`}>
          {!hasMockData ? (
            <p style={{ fontSize: "12px", color: "#9AA0A8" }}>모의고사 데이터가 없어요. ('모의고사' 시트를 함께 업로드하면 표시돼요)</p>
          ) : (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <StatBox label="국영수탐 평균" value={`${coreAvgGrade}등급`} accent="#1F3A5F" />
              <StatBox label="표점합" value={scoreSum} accent="#2a78d6" />
              <StatBox label="2개영역합" value={`${twoAreaSum}등급`} accent="#eda100" />
              <StatBox label="3개영역합" value={`${threeAreaSum}등급`} accent="#e87ba4" />
              <StatBox label="반 석차" value={`${mockRank} / ${size}`} accent="#4a3aa7" />
            </div>
          )}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {SUBJECTS.map((subj) => {
            const rows = MOCK_SESSIONS.map((session, si) => {
              const cell = studentData.mock[subj][si];
              return { session, score: cell ? cell.score : null, grade: cell ? cell.grade : null };
            });
            const hasAny = rows.some((r) => r.score !== null);
            return (
              <div key={subj} style={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "12px", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: SUBJECT_COLORS[subj] }} />
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1F3A5F" }}>{subj} 모의고사 등급</span>
                </div>
                {!hasAny ? (
                  <p style={{ fontSize: "12px", color: "#9AA0A8", padding: "12px 0" }}>데이터 없음</p>
                ) : (
                  <div style={{ height: "170px" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="session" tick={{ fontSize: 10, fill: "#9AA0A8" }} axisLine={{ stroke: "#E2E5EA" }} tickLine={false} />
                        <YAxis yAxisId="score" domain={[60, 150]} hide />
                        <YAxis yAxisId="grade" orientation="right" domain={[9, 1]} hide />
                        <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #E2E5EA" }} />
                        <Bar yAxisId="score" dataKey="score" fill={`${SUBJECT_COLORS[subj]}55`} radius={[3, 3, 0, 0]} barSize={16} name="표준점수">
                          <LabelList dataKey="score" position="top" style={{ fontSize: 10, fill: "#9AA0A8" }} />
                        </Bar>
                        <Line yAxisId="grade" type="monotone" dataKey="grade" stroke={SUBJECT_COLORS[subj]} strokeWidth={2} dot={{ r: 3, fill: SUBJECT_COLORS[subj] }} name="등급" connectNulls>
                          <LabelList dataKey="grade" position="bottom" formatter={(v) => (v ? `${v}등급` : "")} style={{ fontSize: 10, fill: SUBJECT_COLORS[subj], fontWeight: 700 }} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p style={{ textAlign: "center", fontSize: "12px", color: "#9AA0A8", margin: "16px 0 0" }}>
          이 데이터는 이 컴퓨터에만 저장되며 다른 선생님에게는 공유되지 않습니다.
        </p>
      </div>
    </div>
  );
}