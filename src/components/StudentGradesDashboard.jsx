// src/components/StudentGradesDashboard.jsx
import React, { useEffect, useRef, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Line, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList, BarChart, Bar
} from "recharts";
import { X, Download, Calculator, Upload, Trash2 } from "lucide-react";

const SUBJECTS = ["국어", "수학", "영어", "사회", "과학", "기타"]; // 🔑 내신 카드 순서 (한국사는 사회에 통합되어 제거됨)
const MOCK_SUBJECTS = ["국어", "수학", "영어", "사회", "과학", "한국사"]; // 🔑 모의고사 카드 순서 (한국사를 별도로 표시)
const SUBJECT_COLORS = {
  "국어": "#2a78d6",
  "수학": "#eb6834",
  "영어": "#1baf7a",
  "사회": "#eda100",
  "한국사": "#9c5de0",
  "과학": "#e87ba4",
  "기타": "#4a3aa7",
};
// 🔑 업로드된 엑셀에 실제 존재하는 시트(회차)만 사용. 이 배열은 정렬 기준으로만 참고.
const MOCK_SESSION_ORDER = ["25년 3월", "25년 6월", "25년 9월", "25년 10월", "26년 3월", "26년 6월", "26년 9월", "26년 10월"];

// 🔑 [신규] "성적 설계기" — 이수 예정 과목 목록 (학교 교육과정 기준, 성적반영 여부 포함)
const PLANNED_CURRICULUM = {
  "2학년 2학기": {
    "공통": [
      { name: "화법과 언어", credit: 4, subject: "국어", counted: true },
      { name: "미적분Ⅰ", credit: 4, subject: "수학", counted: true },
      { name: "영어Ⅱ", credit: 4, subject: "영어", counted: true },
      { name: "체육2", credit: 2, subject: "체육", counted: false },
    ],
    "택1 (국영수예사)": [
      { name: "주제탐구독서", credit: 4, subject: "국어", counted: true },
      { name: "기하", credit: 4, subject: "수학", counted: true },
      { name: "미디어영어", credit: 4, subject: "영어", counted: true },
      { name: "미술창작", credit: 4, subject: "예술", counted: false },
      { name: "기후변화와 지속가능한 세계", credit: 4, subject: "사회", counted: false },
    ],
    "택3 (사회/과학)": [
      { name: "한국지리 탐구", credit: 3, subject: "사회", counted: true },
      { name: "법과 사회", credit: 3, subject: "사회", counted: true },
      { name: "동아시아 역사 기행", credit: 3, subject: "사회", counted: true },
      { name: "윤리와 사상", credit: 3, subject: "사회", counted: true },
      { name: "역학과 에너지", credit: 3, subject: "과학", counted: true },
      { name: "물질과 에너지", credit: 3, subject: "과학", counted: true },
      { name: "세포와 물질대사", credit: 3, subject: "과학", counted: true },
      { name: "지구시스템과학", credit: 3, subject: "과학", counted: true },
      { name: "지구과학", credit: 3, subject: "과학", counted: true },
    ],
    "택1 (제2외국어/한문)": [
      { name: "언어생활과 한자", credit: 3, subject: "제2외국어/한문", counted: true },
      { name: "일본어 회화", credit: 3, subject: "제2외국어/한문", counted: true },
      { name: "중국문화", credit: 3, subject: "제2외국어/한문", counted: true },
    ],
  },
  "3학년 1학기": {
    "공통": [
      { name: "독서와 작문", credit: 4, subject: "국어", counted: true },
      { name: "영어 독해와 작문", credit: 4, subject: "영어", counted: true },
      { name: "실용통계", credit: 3, subject: "수학", counted: true },
      { name: "스포츠생활", credit: 2, subject: "체육", counted: false },
    ],
    "택1 (국수영/외국어)": [
      { name: "문학과 영상", credit: 3, subject: "국어", counted: true },
      { name: "미적분Ⅱ", credit: 3, subject: "수학", counted: true },
      { name: "경제수학", credit: 3, subject: "수학", counted: true },
      { name: "인공지능수학", credit: 3, subject: "수학", counted: true },
      { name: "세계문화와 영어", credit: 3, subject: "영어", counted: true },
      { name: "일본문화", credit: 3, subject: "제2외국어/한문", counted: true },
      { name: "한문 고전 읽기", credit: 3, subject: "제2외국어/한문", counted: true },
    ],
    "택3 (사회/과학)": [
      { name: "도시의미래탐구", credit: 3, subject: "사회", counted: true },
      { name: "정치", credit: 3, subject: "사회", counted: true },
      { name: "역사로 탐구하는 현대세계", credit: 3, subject: "사회", counted: false },
      { name: "인문학과 윤리", credit: 3, subject: "사회", counted: true },
      { name: "전자기와 양자", credit: 3, subject: "과학", counted: true },
      { name: "화학반응의 세계", credit: 3, subject: "과학", counted: true },
      { name: "생물의 유전", credit: 3, subject: "과학", counted: true },
      { name: "행성우주과학", credit: 3, subject: "과학", counted: true },
      { name: "역학과 에너지", credit: 3, subject: "과학", counted: true },
      { name: "물질과 에너지", credit: 3, subject: "과학", counted: true },
      { name: "세포와 물질대사", credit: 3, subject: "과학", counted: true },
      { name: "지구시스템과학", credit: 3, subject: "과학", counted: true },
      { name: "융합과학탐구", credit: 3, subject: "과학", counted: false },
    ],
    "택1 (교양/예술)": [
      { name: "논술", credit: 2, subject: "교양", counted: false },
      { name: "지역과 시민", credit: 2, subject: "교양", counted: false },
      { name: "보건", credit: 2, subject: "교양", counted: false },
      { name: "심리학", credit: 2, subject: "교양", counted: false },
      { name: "미술감상과 비평", credit: 2, subject: "예술", counted: false },
    ],
  },
};
const STORAGE_KEY = "student_grades_uploaded"; // 🔑 이 PC에만 저장 (다른 선생님과 공유 안 됨)

// 🔑 [신규] 5등급제 → 9등급제 환산 (등급 환산 계산기와 동일한 336개 실측 기준점 + 선형보간 로직)
const GRADE_CONV_TABLE = [{"pct":0.2,"g9":1.05,"g5":1},{"pct":0.32,"g9":1.09,"g5":1.01},{"pct":0.43,"g9":1.12,"g5":1.02},{"pct":0.55,"g9":1.16,"g5":1.03},{"pct":0.66,"g9":1.21,"g5":1.04},{"pct":0.77,"g9":1.26,"g5":1.05},{"pct":0.84,"g9":1.31,"g5":1.06},{"pct":0.92,"g9":1.36,"g5":1.07},{"pct":0.99,"g9":1.39,"g5":1.08},{"pct":1.06,"g9":1.42,"g5":1.09},{"pct":1.16,"g9":1.43,"g5":1.1},{"pct":1.27,"g9":1.45,"g5":1.11},{"pct":1.37,"g9":1.5,"g5":1.12},{"pct":1.52,"g9":1.58,"g5":1.13},{"pct":2.02,"g9":1.65,"g5":1.14},{"pct":2.35,"g9":1.72,"g5":1.15},{"pct":2.66,"g9":1.74,"g5":1.16},{"pct":2.76,"g9":1.76,"g5":1.17},{"pct":2.87,"g9":1.78,"g5":1.18},{"pct":2.98,"g9":1.8,"g5":1.19},{"pct":3.09,"g9":1.82,"g5":1.2},{"pct":3.2,"g9":1.84,"g5":1.21},{"pct":3.3,"g9":1.85,"g5":1.22},{"pct":3.41,"g9":1.89,"g5":1.23},{"pct":3.5,"g9":1.91,"g5":1.24},{"pct":3.58,"g9":1.93,"g5":1.25},{"pct":3.99,"g9":1.96,"g5":1.26},{"pct":4.3,"g9":2.01,"g5":1.27},{"pct":4.46,"g9":2.03,"g5":1.28},{"pct":4.62,"g9":2.04,"g5":1.29},{"pct":4.72,"g9":2.04,"g5":1.3},{"pct":4.81,"g9":2.04,"g5":1.31},{"pct":4.9,"g9":2.05,"g5":1.32},{"pct":5.11,"g9":2.06,"g5":1.33},{"pct":5.19,"g9":2.1,"g5":1.34},{"pct":5.24,"g9":2.13,"g5":1.35},{"pct":5.29,"g9":2.14,"g5":1.36},{"pct":5.34,"g9":2.14,"g5":1.37},{"pct":5.39,"g9":2.15,"g5":1.38},{"pct":5.43,"g9":2.16,"g5":1.39},{"pct":5.57,"g9":2.18,"g5":1.4},{"pct":5.84,"g9":2.2,"g5":1.41},{"pct":5.9,"g9":2.2,"g5":1.42},{"pct":5.97,"g9":2.21,"g5":1.43},{"pct":6.19,"g9":2.26,"g5":1.44},{"pct":6.32,"g9":2.26,"g5":1.45},{"pct":6.44,"g9":2.27,"g5":1.46},{"pct":6.56,"g9":2.28,"g5":1.47},{"pct":6.66,"g9":2.28,"g5":1.48},{"pct":6.77,"g9":2.3,"g5":1.49},{"pct":7.05,"g9":2.32,"g5":1.5},{"pct":7.23,"g9":2.35,"g5":1.51},{"pct":7.36,"g9":2.36,"g5":1.52},{"pct":7.5,"g9":2.36,"g5":1.53},{"pct":7.61,"g9":2.37,"g5":1.54},{"pct":7.68,"g9":2.37,"g5":1.55},{"pct":7.75,"g9":2.38,"g5":1.56},{"pct":7.93,"g9":2.39,"g5":1.57},{"pct":8.11,"g9":2.4,"g5":1.58},{"pct":8.3,"g9":2.43,"g5":1.59},{"pct":8.48,"g9":2.47,"g5":1.6},{"pct":8.7,"g9":2.51,"g5":1.61},{"pct":8.96,"g9":2.53,"g5":1.62},{"pct":9.22,"g9":2.56,"g5":1.63},{"pct":9.48,"g9":2.58,"g5":1.64},{"pct":9.69,"g9":2.59,"g5":1.65},{"pct":9.9,"g9":2.63,"g5":1.66},{"pct":10.06,"g9":2.65,"g5":1.67},{"pct":10.24,"g9":2.67,"g5":1.68},{"pct":10.55,"g9":2.68,"g5":1.69},{"pct":10.82,"g9":2.69,"g5":1.7},{"pct":10.95,"g9":2.7,"g5":1.71},{"pct":11.08,"g9":2.72,"g5":1.72},{"pct":11.22,"g9":2.73,"g5":1.73},{"pct":11.65,"g9":2.76,"g5":1.74},{"pct":11.79,"g9":2.77,"g5":1.75},{"pct":11.94,"g9":2.79,"g5":1.76},{"pct":12.08,"g9":2.8,"g5":1.77},{"pct":12.17,"g9":2.82,"g5":1.78},{"pct":12.27,"g9":2.84,"g5":1.79},{"pct":12.53,"g9":2.85,"g5":1.8},{"pct":12.61,"g9":2.86,"g5":1.81},{"pct":12.82,"g9":2.87,"g5":1.82},{"pct":12.95,"g9":2.9,"g5":1.83},{"pct":13.14,"g9":2.94,"g5":1.84},{"pct":13.44,"g9":2.97,"g5":1.85},{"pct":13.75,"g9":2.99,"g5":1.86},{"pct":14.03,"g9":3.01,"g5":1.87},{"pct":14.36,"g9":3.05,"g5":1.88},{"pct":14.74,"g9":3.06,"g5":1.89},{"pct":15.22,"g9":3.07,"g5":1.9},{"pct":15.46,"g9":3.09,"g5":1.91},{"pct":15.54,"g9":3.1,"g5":1.92},{"pct":15.62,"g9":3.11,"g5":1.93},{"pct":15.74,"g9":3.12,"g5":1.94},{"pct":15.93,"g9":3.13,"g5":1.95},{"pct":16.21,"g9":3.16,"g5":1.96},{"pct":16.79,"g9":3.2,"g5":1.97},{"pct":17.03,"g9":3.21,"g5":1.98},{"pct":17.22,"g9":3.22,"g5":1.99},{"pct":17.5,"g9":3.25,"g5":2},{"pct":17.66,"g9":3.27,"g5":2.01},{"pct":17.88,"g9":3.29,"g5":2.02},{"pct":18.12,"g9":3.34,"g5":2.03},{"pct":18.55,"g9":3.38,"g5":2.04},{"pct":18.77,"g9":3.4,"g5":2.05},{"pct":18.93,"g9":3.41,"g5":2.06},{"pct":19.23,"g9":3.43,"g5":2.07},{"pct":19.52,"g9":3.45,"g5":2.08},{"pct":19.9,"g9":3.48,"g5":2.09},{"pct":20.19,"g9":3.48,"g5":2.1},{"pct":20.66,"g9":3.49,"g5":2.11},{"pct":20.8,"g9":3.5,"g5":2.12},{"pct":21.34,"g9":3.56,"g5":2.13},{"pct":21.69,"g9":3.57,"g5":2.14},{"pct":21.87,"g9":3.57,"g5":2.15},{"pct":22.04,"g9":3.59,"g5":2.16},{"pct":22.31,"g9":3.64,"g5":2.17},{"pct":22.58,"g9":3.65,"g5":2.18},{"pct":22.85,"g9":3.68,"g5":2.19},{"pct":23.17,"g9":3.69,"g5":2.2},{"pct":23.5,"g9":3.71,"g5":2.21},{"pct":23.78,"g9":3.71,"g5":2.22},{"pct":23.96,"g9":3.72,"g5":2.23},{"pct":24.1,"g9":3.73,"g5":2.24},{"pct":24.27,"g9":3.78,"g5":2.25},{"pct":24.43,"g9":3.85,"g5":2.26},{"pct":24.79,"g9":3.86,"g5":2.27},{"pct":25.15,"g9":3.86,"g5":2.28},{"pct":25.51,"g9":3.89,"g5":2.29},{"pct":25.72,"g9":3.9,"g5":2.3},{"pct":25.93,"g9":3.92,"g5":2.31},{"pct":26.14,"g9":3.92,"g5":2.32},{"pct":26.6,"g9":3.93,"g5":2.33},{"pct":26.84,"g9":3.97,"g5":2.34},{"pct":27.01,"g9":3.99,"g5":2.35},{"pct":27.18,"g9":4,"g5":2.36},{"pct":27.58,"g9":4.01,"g5":2.37},{"pct":27.84,"g9":4.04,"g5":2.38},{"pct":28.09,"g9":4.05,"g5":2.39},{"pct":28.22,"g9":4.05,"g5":2.4},{"pct":28.35,"g9":4.06,"g5":2.41},{"pct":28.89,"g9":4.08,"g5":2.42},{"pct":29.38,"g9":4.09,"g5":2.43},{"pct":29.66,"g9":4.1,"g5":2.44},{"pct":30.12,"g9":4.12,"g5":2.45},{"pct":30.4,"g9":4.12,"g5":2.46},{"pct":30.54,"g9":4.13,"g5":2.47},{"pct":30.75,"g9":4.14,"g5":2.48},{"pct":30.92,"g9":4.15,"g5":2.49},{"pct":31.44,"g9":4.17,"g5":2.5},{"pct":31.94,"g9":4.19,"g5":2.51},{"pct":32.44,"g9":4.21,"g5":2.52},{"pct":32.92,"g9":4.23,"g5":2.53},{"pct":33.25,"g9":4.24,"g5":2.54},{"pct":33.38,"g9":4.27,"g5":2.55},{"pct":34.06,"g9":4.29,"g5":2.56},{"pct":34.25,"g9":4.3,"g5":2.57},{"pct":34.68,"g9":4.33,"g5":2.58},{"pct":35.05,"g9":4.34,"g5":2.59},{"pct":35.31,"g9":4.34,"g5":2.6},{"pct":35.75,"g9":4.35,"g5":2.61},{"pct":36.25,"g9":4.36,"g5":2.62},{"pct":36.79,"g9":4.39,"g5":2.63},{"pct":37.21,"g9":4.41,"g5":2.64},{"pct":37.43,"g9":4.43,"g5":2.65},{"pct":37.77,"g9":4.43,"g5":2.66},{"pct":38.02,"g9":4.45,"g5":2.67},{"pct":38.28,"g9":4.46,"g5":2.68},{"pct":38.48,"g9":4.48,"g5":2.69},{"pct":38.84,"g9":4.49,"g5":2.7},{"pct":39.58,"g9":4.51,"g5":2.71},{"pct":39.97,"g9":4.52,"g5":2.72},{"pct":40.19,"g9":4.53,"g5":2.73},{"pct":40.54,"g9":4.55,"g5":2.74},{"pct":40.76,"g9":4.56,"g5":2.75},{"pct":40.97,"g9":4.6,"g5":2.76},{"pct":41.45,"g9":4.62,"g5":2.77},{"pct":41.67,"g9":4.63,"g5":2.78},{"pct":42.22,"g9":4.65,"g5":2.79},{"pct":42.97,"g9":4.68,"g5":2.8},{"pct":43.36,"g9":4.69,"g5":2.81},{"pct":44.01,"g9":4.71,"g5":2.82},{"pct":44.55,"g9":4.76,"g5":2.83},{"pct":45.05,"g9":4.79,"g5":2.84},{"pct":45.28,"g9":4.82,"g5":2.85},{"pct":45.5,"g9":4.83,"g5":2.86},{"pct":45.85,"g9":4.84,"g5":2.87},{"pct":46.49,"g9":4.86,"g5":2.88},{"pct":46.73,"g9":4.87,"g5":2.89},{"pct":46.97,"g9":4.89,"g5":2.9},{"pct":47.53,"g9":4.91,"g5":2.91},{"pct":47.87,"g9":4.93,"g5":2.92},{"pct":48.18,"g9":4.95,"g5":2.93},{"pct":48.6,"g9":4.96,"g5":2.94},{"pct":48.91,"g9":4.97,"g5":2.95},{"pct":49.17,"g9":4.98,"g5":2.96},{"pct":49.34,"g9":4.99,"g5":2.97},{"pct":49.46,"g9":5.01,"g5":2.98},{"pct":49.6,"g9":5.03,"g5":2.99},{"pct":50.01,"g9":5.04,"g5":3},{"pct":50.13,"g9":5.05,"g5":3.01},{"pct":50.44,"g9":5.05,"g5":3.02},{"pct":50.98,"g9":5.05,"g5":3.03},{"pct":51.56,"g9":5.06,"g5":3.04},{"pct":51.95,"g9":5.07,"g5":3.05},{"pct":52.88,"g9":5.13,"g5":3.06},{"pct":53.15,"g9":5.18,"g5":3.07},{"pct":53.61,"g9":5.19,"g5":3.08},{"pct":54.09,"g9":5.19,"g5":3.09},{"pct":54.43,"g9":5.2,"g5":3.1},{"pct":54.76,"g9":5.22,"g5":3.11},{"pct":55.2,"g9":5.23,"g5":3.12},{"pct":55.58,"g9":5.26,"g5":3.13},{"pct":55.82,"g9":5.31,"g5":3.14},{"pct":56,"g9":5.32,"g5":3.15},{"pct":56.72,"g9":5.32,"g5":3.16},{"pct":57.41,"g9":5.35,"g5":3.17},{"pct":57.82,"g9":5.38,"g5":3.18},{"pct":58.24,"g9":5.4,"g5":3.19},{"pct":58.59,"g9":5.42,"g5":3.2},{"pct":58.93,"g9":5.44,"g5":3.21},{"pct":59.15,"g9":5.46,"g5":3.22},{"pct":59.74,"g9":5.51,"g5":3.23},{"pct":60.19,"g9":5.53,"g5":3.24},{"pct":60.81,"g9":5.55,"g5":3.25},{"pct":61.35,"g9":5.56,"g5":3.26},{"pct":61.55,"g9":5.57,"g5":3.27},{"pct":61.75,"g9":5.57,"g5":3.28},{"pct":61.95,"g9":5.57,"g5":3.29},{"pct":62.49,"g9":5.58,"g5":3.3},{"pct":62.85,"g9":5.59,"g5":3.31},{"pct":63,"g9":5.59,"g5":3.32},{"pct":63.12,"g9":5.6,"g5":3.33},{"pct":63.5,"g9":5.63,"g5":3.34},{"pct":63.87,"g9":5.66,"g5":3.35},{"pct":64.1,"g9":5.69,"g5":3.36},{"pct":64.62,"g9":5.7,"g5":3.37},{"pct":65.02,"g9":5.73,"g5":3.38},{"pct":65.19,"g9":5.75,"g5":3.39},{"pct":65.54,"g9":5.76,"g5":3.4},{"pct":65.88,"g9":5.77,"g5":3.41},{"pct":66.32,"g9":5.79,"g5":3.42},{"pct":66.77,"g9":5.8,"g5":3.43},{"pct":66.97,"g9":5.81,"g5":3.44},{"pct":67.17,"g9":5.82,"g5":3.45},{"pct":67.38,"g9":5.85,"g5":3.46},{"pct":67.61,"g9":5.86,"g5":3.47},{"pct":67.81,"g9":5.86,"g5":3.48},{"pct":68.18,"g9":5.87,"g5":3.49},{"pct":68.59,"g9":5.88,"g5":3.5},{"pct":69.1,"g9":5.9,"g5":3.51},{"pct":69.35,"g9":5.92,"g5":3.52},{"pct":69.65,"g9":5.92,"g5":3.53},{"pct":69.93,"g9":5.93,"g5":3.54},{"pct":70.17,"g9":5.94,"g5":3.55},{"pct":70.55,"g9":5.96,"g5":3.56},{"pct":70.9,"g9":5.98,"g5":3.57},{"pct":71.3,"g9":5.99,"g5":3.58},{"pct":71.99,"g9":6,"g5":3.59},{"pct":72.26,"g9":6.01,"g5":3.6},{"pct":72.41,"g9":6.02,"g5":3.61},{"pct":72.68,"g9":6.03,"g5":3.62},{"pct":72.87,"g9":6.04,"g5":3.63},{"pct":73.06,"g9":6.05,"g5":3.64},{"pct":73.56,"g9":6.06,"g5":3.65},{"pct":73.87,"g9":6.07,"g5":3.66},{"pct":74.13,"g9":6.07,"g5":3.67},{"pct":74.39,"g9":6.08,"g5":3.68},{"pct":74.68,"g9":6.12,"g5":3.69},{"pct":75.17,"g9":6.16,"g5":3.7},{"pct":75.47,"g9":6.17,"g5":3.71},{"pct":75.69,"g9":6.19,"g5":3.72},{"pct":75.91,"g9":6.2,"g5":3.73},{"pct":76.13,"g9":6.21,"g5":3.74},{"pct":76.29,"g9":6.22,"g5":3.75},{"pct":76.46,"g9":6.23,"g5":3.76},{"pct":76.59,"g9":6.24,"g5":3.77},{"pct":76.8,"g9":6.24,"g5":3.78},{"pct":77.01,"g9":6.25,"g5":3.79},{"pct":77.28,"g9":6.27,"g5":3.8},{"pct":77.57,"g9":6.29,"g5":3.81},{"pct":77.93,"g9":6.31,"g5":3.82},{"pct":78.15,"g9":6.33,"g5":3.83},{"pct":78.77,"g9":6.36,"g5":3.84},{"pct":78.94,"g9":6.38,"g5":3.85},{"pct":79.11,"g9":6.39,"g5":3.86},{"pct":79.45,"g9":6.41,"g5":3.87},{"pct":79.75,"g9":6.41,"g5":3.88},{"pct":80.05,"g9":6.42,"g5":3.89},{"pct":80.47,"g9":6.45,"g5":3.9},{"pct":80.55,"g9":6.46,"g5":3.91},{"pct":80.73,"g9":6.46,"g5":3.92},{"pct":80.87,"g9":6.47,"g5":3.93},{"pct":81.11,"g9":6.49,"g5":3.94},{"pct":81.64,"g9":6.51,"g5":3.95},{"pct":82.06,"g9":6.52,"g5":3.96},{"pct":82.54,"g9":6.54,"g5":3.97},{"pct":82.68,"g9":6.55,"g5":3.98},{"pct":82.82,"g9":6.56,"g5":3.99},{"pct":83.22,"g9":6.62,"g5":4},{"pct":83.39,"g9":6.63,"g5":4.01},{"pct":83.59,"g9":6.64,"g5":4.02},{"pct":83.79,"g9":6.64,"g5":4.03},{"pct":84.19,"g9":6.68,"g5":4.04},{"pct":84.53,"g9":6.7,"g5":4.05},{"pct":84.76,"g9":6.72,"g5":4.06},{"pct":85.1,"g9":6.74,"g5":4.07},{"pct":85.73,"g9":6.74,"g5":4.08},{"pct":85.97,"g9":6.77,"g5":4.09},{"pct":86.38,"g9":6.8,"g5":4.1},{"pct":86.57,"g9":6.81,"g5":4.11},{"pct":86.68,"g9":6.81,"g5":4.12},{"pct":86.78,"g9":6.82,"g5":4.13},{"pct":87.19,"g9":6.86,"g5":4.14},{"pct":87.58,"g9":6.9,"g5":4.15},{"pct":87.84,"g9":6.92,"g5":4.16},{"pct":88.09,"g9":6.96,"g5":4.17},{"pct":88.34,"g9":6.97,"g5":4.18},{"pct":88.62,"g9":6.98,"g5":4.19},{"pct":88.8,"g9":7,"g5":4.2},{"pct":88.98,"g9":7.01,"g5":4.21},{"pct":89.22,"g9":7.02,"g5":4.22},{"pct":89.34,"g9":7.02,"g5":4.23},{"pct":89.41,"g9":7.03,"g5":4.24},{"pct":89.48,"g9":7.04,"g5":4.25},{"pct":89.58,"g9":7.1,"g5":4.26},{"pct":89.86,"g9":7.1,"g5":4.27},{"pct":89.99,"g9":7.12,"g5":4.28},{"pct":90.06,"g9":7.13,"g5":4.29},{"pct":90.28,"g9":7.17,"g5":4.3},{"pct":90.42,"g9":7.19,"g5":4.31},{"pct":90.56,"g9":7.2,"g5":4.32},{"pct":90.71,"g9":7.22,"g5":4.33},{"pct":90.8,"g9":7.23,"g5":4.34},{"pct":90.91,"g9":7.23,"g5":4.35},{"pct":91.02,"g9":7.25,"g5":4.36},{"pct":91.12,"g9":7.26,"g5":4.37},{"pct":91.27,"g9":7.28,"g5":4.38},{"pct":91.41,"g9":7.28,"g5":4.39},{"pct":91.57,"g9":7.29,"g5":4.4},{"pct":91.74,"g9":7.29,"g5":4.41},{"pct":91.92,"g9":7.3,"g5":4.42},{"pct":92.26,"g9":7.31,"g5":4.43},{"pct":92.47,"g9":7.33,"g5":4.44},{"pct":92.68,"g9":7.34,"g5":4.45},{"pct":92.81,"g9":7.36,"g5":4.46},{"pct":92.94,"g9":7.38,"g5":4.47},{"pct":93.19,"g9":7.4,"g5":4.48},{"pct":93.3,"g9":7.41,"g5":4.49},{"pct":93.42,"g9":7.43,"g5":4.5},{"pct":93.75,"g9":7.47,"g5":4.51},{"pct":93.89,"g9":7.48,"g5":4.52},{"pct":93.96,"g9":7.49,"g5":4.53},{"pct":94.06,"g9":7.51,"g5":4.54},{"pct":94.21,"g9":7.53,"g5":4.55},{"pct":94.69,"g9":7.55,"g5":4.56},{"pct":94.82,"g9":7.57,"g5":4.57},{"pct":94.92,"g9":7.59,"g5":4.58},{"pct":95.16,"g9":7.61,"g5":4.59},{"pct":95.24,"g9":7.64,"g5":4.6},{"pct":95.38,"g9":7.66,"g5":4.61},{"pct":95.53,"g9":7.69,"g5":4.62},{"pct":95.9,"g9":7.71,"g5":4.63},{"pct":96.04,"g9":7.74,"g5":4.64},{"pct":96.23,"g9":7.75,"g5":4.65},{"pct":96.46,"g9":7.75,"g5":4.66},{"pct":96.66,"g9":7.76,"g5":4.67},{"pct":96.75,"g9":7.79,"g5":4.68},{"pct":96.85,"g9":7.82,"g5":4.69},{"pct":97.08,"g9":7.86,"g5":4.7},{"pct":97.26,"g9":7.92,"g5":4.71},{"pct":97.33,"g9":7.92,"g5":4.72},{"pct":97.5,"g9":7.95,"g5":4.73},{"pct":97.77,"g9":7.98,"g5":4.74},{"pct":98.01,"g9":8,"g5":4.75},{"pct":98.15,"g9":8.03,"g5":4.76},{"pct":98.25,"g9":8.07,"g5":4.77},{"pct":98.35,"g9":8.11,"g5":4.78},{"pct":98.41,"g9":8.13,"g5":4.79},{"pct":98.61,"g9":8.25,"g5":4.8},{"pct":98.7,"g9":8.27,"g5":4.81},{"pct":98.8,"g9":8.34,"g5":4.82},{"pct":98.93,"g9":8.36,"g5":4.83},{"pct":99.07,"g9":8.37,"g5":4.84},{"pct":99.33,"g9":8.39,"g5":4.85},{"pct":99.4,"g9":8.4,"g5":4.86},{"pct":99.47,"g9":8.44,"g5":4.87},{"pct":99.52,"g9":8.47,"g5":4.88},{"pct":99.55,"g9":8.52,"g5":4.89},{"pct":99.6,"g9":8.56,"g5":4.9},{"pct":99.71,"g9":8.59,"g5":4.91},{"pct":99.76,"g9":8.79,"g5":4.92},{"pct":99.81,"g9":8.8,"g5":4.93},{"pct":99.85,"g9":8.81,"g5":4.94},{"pct":99.9,"g9":8.91,"g5":4.95},{"pct":99.92,"g9":8.91,"g5":4.96},{"pct":99.94,"g9":8.92,"g5":4.97},{"pct":99.96,"g9":8.92,"g5":4.98},{"pct":99.98,"g9":8.95,"g5":4.99},{"pct":100,"g9":9,"g5":5}];

function convertGrade5to9(g5) {
  const a = GRADE_CONV_TABLE;
  if (g5 <= a[0].g5) return a[0];
  if (g5 >= a[a.length - 1].g5) return a[a.length - 1];
  for (let i = 1; i < a.length; i++) {
    if (g5 <= a[i].g5) {
      const lo = a[i - 1], hi = a[i];
      const t = (g5 - lo.g5) / ((hi.g5 - lo.g5) || 1);
      return { g9: lo.g9 + (hi.g9 - lo.g9) * t, pct: lo.pct + (hi.pct - lo.pct) * t };
    }
  }
  return null;
}

function emptyStudent(sessions) {
  const s = { school: {}, mock: {}, name: "" }; // 🔑 모의고사 시트의 "이름" 열에서 채워짐
  MOCK_SUBJECTS.forEach((subj) => {
    s.mock[subj] = sessions.map(() => null);
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
  if (g.startsWith("사회")) return "사회"; // 🔑 한국사도 사회로 통합 (내신은 원래대로)
  if (g === "과학") return "과학";
  return "기타";
}

// 🔑 [신규] 과목명 비교 시 띄어쓰기 무시
const normalizeName = (s) => String(s || "").replace(/\s+/g, "");

// 🔑 [신규] "2학년 2학기 수강신청" 엑셀 파싱 — G열(줄바꿈 5줄, "과목명(반코드)" 형식)에서 과목명만 추출
function parseElectiveRoster(workbook) {
  const sheetName = workbook.SheetNames[0];
  const ws = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });

  let headerRowIdx = -1, colBan = -1, colBun = -1, colTarget = -1;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || [];
    const idxTarget = row.findIndex((v) => String(v || "").includes("2학년 2학기 수강 내역"));
    if (idxTarget !== -1) {
      headerRowIdx = r;
      colTarget = idxTarget;
      colBan = row.findIndex((v) => String(v || "").trim() === "반");
      colBun = row.findIndex((v) => String(v || "").trim() === "번호");
      break;
    }
  }
  if (headerRowIdx === -1 || colBan === -1 || colBun === -1) {
    throw new Error('"반", "번호", "2학년 2학기 수강 내역" 열을 찾을 수 없습니다.');
  }

  const result = {}; // { 반: { 번호: [정규화된과목명, ...] } }
  for (let r = headerRowIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const cls = parseInt(row[colBan], 10);
    const num = parseInt(row[colBun], 10);
    const cell = row[colTarget];
    if (!cls || !num || !cell) continue;

    const names = String(cell)
      .split(/\r?\n/)
      .map((line) => normalizeName(line.replace(/\([^)]*\)\s*$/, ""))) // 🔑 끝의 (반코드) 제거 후 정규화
      .filter(Boolean);

    result[cls] = result[cls] || {};
    result[cls][num] = names;
  }
  return result;
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
      const hasRawScore = b.rawScore !== null && b.rawScore !== undefined && b.rawScore !== '';
      const hasAchievement = b.achievement !== null && b.achievement !== undefined && String(b.achievement).trim() !== '';
      const hasGrade = b.gradeVal !== null && b.gradeVal !== undefined && b.gradeVal !== '';
      // 🔑 원점수/성취도/등급 중 아무것도 없으면(이수 자체를 안 한 경우) 목록에도 안 보이게 완전히 건너뜀
      if (!hasRawScore && !hasAchievement && !hasGrade) return;

      const term = `${gradeYear}학년 ${b.termNo}학기`;
      const student = ensure(cls, num);
      pushSchoolEntry(student, category, term, {
        rawScore: hasRawScore ? Number(b.rawScore) : null,
        achievement: hasAchievement ? String(b.achievement).trim() : null,
        grade: hasGrade ? Number(b.gradeVal) : null,
        hasGrade, // 🔑 등급 평균 계산에 포함시킬지 여부
        credit: Number(b.credit) || 1,
        courseName: String(courseName || "").trim(),
      });
    });
  });
}

// 🔑 localStorage에서 불러온 데이터가 지금 코드 형식과 맞는지 검사
// (구버전 데이터는 mock 배열 길이가 sessions 길이와 다르거나, mock에 필요한 과목 키가 없을 수 있음)
function isCompatibleStoredData(dataObj, sessions) {
  if (!dataObj || typeof dataObj !== "object") return false;
  const classKeys = Object.keys(dataObj);
  if (!classKeys.length) return false;

  for (const cls of classKeys) {
    const studentKeys = Object.keys(dataObj[cls] || {});
    for (const num of studentKeys) {
      const student = dataObj[cls][num];
      if (!student || !student.mock) return false;
      for (const subj of MOCK_SUBJECTS) {
        const arr = student.mock[subj];
        if (!Array.isArray(arr) || arr.length !== sessions.length) return false;
      }
      return true; // 학생 1명만 확인해도 형식 판단에 충분
    }
  }
  return true; // 학생 데이터가 아예 없으면(내신만 있는 경우 등) 호환으로 간주
}

function parseWorkbook(workbook) {
  // 🔑 1단계: 워크북 안에서 실제로 존재하는 모의고사 회차 시트 이름을 먼저 전부 수집하고 정렬
  const MOCK_SHEET_PATTERN = /^(\d{2})년\s*(\d{1,2})월$/;
  const foundSessions = [];
  workbook.SheetNames.forEach((sheetName) => {
    const m = MOCK_SHEET_PATTERN.exec(sheetName.trim());
    if (!m) return;
    const sessionLabel = `${m[1]}년 ${m[2]}월`;
    if (!foundSessions.includes(sessionLabel)) foundSessions.push(sessionLabel);
  });
  foundSessions.sort((a, b) => {
    const ia = MOCK_SESSION_ORDER.indexOf(a);
    const ib = MOCK_SESSION_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    return a.localeCompare(b); // 정의된 순서에 없는 회차는 문자열 비교로 뒤에 정렬
  });

  const result = {};
  const ensure = (c, n) => {
    result[c] = result[c] || {};
    result[c][n] = result[c][n] || emptyStudent(foundSessions);
    return result[c][n];
  };

  const naeisRows = findNaeisSheet(workbook);
  if (naeisRows) {
    parseNaeisRows(naeisRows.slice(2), ensure);
  }

  // 🔑 2단계: 실제 회차 시트만 파싱 (헤더는 1행, 학번/반/이름 + {과목}_표점/등급 구조)
  const MOCK_SUBJECT_HEADER_MAP = {
    "국어": "국어", "수학": "수학", "영어": "영어",
    "통합사회": "사회", "통합과학": "과학", // 🔑 통합사회→사회, 통합과학→과학
    "한국사": "한국사", // 🔑 한국사는 사회와 별도의 독립 과목
  };

  workbook.SheetNames.forEach((sheetName) => {
    const m = MOCK_SHEET_PATTERN.exec(sheetName.trim());
    if (!m) return; // 이름 패턴이 안 맞으면 모의고사 시트가 아님

    const sessionLabel = `${m[1]}년 ${m[2]}월`;
    const si = foundSessions.indexOf(sessionLabel);
    if (si === -1) return;

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null }); // 1행이 헤더로 자동 사용됨

    rows.forEach((row) => {
      // 🔑 "1반"처럼 텍스트가 섞인 값도 숫자만 추출 (내신 파일의 "반" 값과 형식을 맞춤)
      const cls = parseInt(String(row["반"] ?? "").replace(/[^0-9]/g, ""), 10);
      const rawNum = row["학번"];
      if (!cls || rawNum === null || rawNum === undefined) return;
      const num = Number(String(rawNum).slice(-2)) || Number(rawNum);
      if (!num) return;

      const student = ensure(cls, num);
      // 🔑 모의고사 시트의 "이름" 열을 학생 이름으로 사용
      if (row["이름"] !== null && row["이름"] !== undefined && String(row["이름"]).trim()) {
        student.name = String(row["이름"]).trim();
      }

      Object.entries(MOCK_SUBJECT_HEADER_MAP).forEach(([headerSubj, category]) => {
        const gradeVal = row[`${headerSubj}_등급`];
        // 🔑 등급 칸이 비어있거나(null/undefined) 값이 0이면 "데이터 없음"으로 처리 (저장 자체를 건너뜀)
        if (gradeVal === null || gradeVal === undefined || Number(gradeVal) === 0) return;
        const scoreVal = row[`${headerSubj}_표점`]; // 🔑 영어/한국사는 이 열 자체가 없어서 undefined → 0으로 처리됨
        student.mock[category][si] = {
          score: Number(scoreVal) || 0,
          grade: Number(gradeVal),
        };
      });
    });
  });

  return { data: result, sessions: foundSessions };
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
  const gradedEntries = entries.filter((e) => e.hasGrade); // 🔑 등급이 있는 기록만 평균 계산에 포함
  if (!gradedEntries.length) return null;
  const creditSum = gradedEntries.reduce((a, e) => a + (e.credit || 1), 0);
  if (!creditSum) return null;
  return gradedEntries.reduce((a, e) => a + e.grade * (e.credit || 1), 0) / creditSum;
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

// 🔑 [신규] 영역합 카드: 왼쪽 칸은 제목(1):합계(3) 세로 비율, 오른쪽은 과목별 목록 (행 간격 균등)
function AreaSumCard({ title, total, items, accent }) {
  return (
    <div style={{ display: "flex", border: "1px solid #E2E5EA", borderRadius: "10px", overflow: "hidden", minWidth: "210px", height: "132px", flex: "1 1 210px" }}>
      <div style={{
        background: `${accent}18`, color: accent,
        display: "flex", flexDirection: "column",
        minWidth: "84px", textAlign: "center",
      }}>
        <div style={{ flex: "1", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "12.5px", padding: "4px 10px" }}>
          {title}
        </div>
        <div style={{ flex: "3", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "20px" }}>
          {total}
        </div>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {items.map((it, i) => (
          <div key={i} style={{
            flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 12px",
            fontSize: "12px", color: "#374151", background: i % 2 === 0 ? "#F5F6F8" : "#FFFFFF",
          }}>
            <span>{it.label}</span>
            <span style={{ fontWeight: 700 }}>{it.value}</span>
          </div>
        ))}
      </div>
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

function StudentGradesDashboardInner({ onClose, myClassNum }) {
  const [classNum, setClassNum] = useState(null);
  const [studentNum, setStudentNum] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // 🔑 [신규] 학생 이름 검색
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [uploaded, setUploaded] = useState(null);
  const [mockSessions, setMockSessions] = useState([]); // 🔑 실제 업로드된 엑셀에 존재하는 모의고사 회차만 보관
  const [simIdx, setSimIdx] = useState(Infinity); // 🔑 선택된 모의고사 회차 인덱스 (기본값: 항상 최신 회차로 클램프됨)
  const [uploadError, setUploadError] = useState("");
  const [isIncompatible, setIsIncompatible] = useState(false); // 🔑 저장된 데이터가 예전 버전 형식이라 못 불러올 때
  const [chartsReady, setChartsReady] = useState(false); // 🔑 모달이 완전히 자리잡은 뒤에만 차트를 그려서 깜빡임 방지
  const [isStudentChosen, setIsStudentChosen] = useState(false); // 🔑 [신규] 모달을 열 때마다 초기화 — 명시적으로 학생을 선택해야만 정보가 보임
  const fileInputRef = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setChartsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // 🔑 [신규] 저장된 2학년 2학기 선택과목 명단 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem("student_elective_2_2");
      if (saved) setElectiveRoster(JSON.parse(saved));
    } catch (e) {
      // 저장된 데이터 없음/손상 시 무시
    }
  }, []);

  const handleElectiveUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setElectiveUploadError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const parsed = parseElectiveRoster(wb);
        setElectiveRoster(parsed);
        localStorage.setItem("student_elective_2_2", JSON.stringify(parsed));
      } catch (err) {
        setElectiveUploadError(err.message || "파일을 읽는 중 문제가 발생했어요.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  // 🔑 [수정] window.storage(아티팩트 전용 API) 대신 localStorage 사용 — 이 PC에만 저장
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const dataObj = parsed.data || parsed;
        const sessions = parsed.sessions || [];

        // 🔑 예전 버전 형식이면 화면에 반영하지 않고, "삭제 필요" 상태로만 표시
        if (!isCompatibleStoredData(dataObj, sessions)) {
          setIsIncompatible(true);
          return;
        }

        setUploaded(dataObj);
        setMockSessions(sessions);
        const classes = Object.keys(dataObj).map(Number).sort((a, b) => a - b);
        if (classes.length) {
          // 🔑 저장해둔 담임반이 있으면 그 반을 우선 선택, 없으면 첫 번째 반
          const myClass = myClassNum && classes.includes(Number(myClassNum)) ? Number(myClassNum) : classes[0];
          setClassNum(myClass);
          const nums = Object.keys(dataObj[myClass]).map(Number).sort((a, b) => a - b);
          setStudentNum(nums[0]);
        }
      }
    } catch (e) {
      setIsIncompatible(true); // 🔑 파싱 자체가 깨진 경우도 동일하게 처리
    }
  }, []);

  const saveToStorage = (parsed, sessions) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ data: parsed, sessions }));
    } catch (e) {
      setUploadError("데이터 저장에 실패했어요. 용량이 너무 클 수 있습니다.");
    }
  };

  const clearStorage = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUploaded(null);
    setMockSessions([]);
    setClassNum(null);
    setStudentNum(null);
    setIsIncompatible(false);
  };

  // 🔑 [신규] Electron의 실제 렌더러로 인쇄 → PDF 생성 (oklch 등 최신 CSS도 100% 정상 처리됨)
  // 모달 외 나머지 화면(캘린더 등)을 전부 잠깐 숨겨서, 결과적으로 모달만 캡처된 것과 동일한 효과를 냄
  const [isSavingPdf, setIsSavingPdf] = useState(false); // 🔑 PDF 저장 진행 상태
  const [isDesignerOpen, setIsDesignerOpen] = useState(false); // 🔑 [신규] 성적 설계기 모달
  const [selectedPastCourses, setSelectedPastCourses] = useState(new Set()); // 🔑 이수과목 중 선택된 것 (key: term|courseName)
  const [selectedPlannedCourses, setSelectedPlannedCourses] = useState({}); // 🔑 예정과목 선택 { courseName: {credit, subject} }
  const [plannedGrades, setPlannedGrades] = useState({}); // 🔑 예정과목별 입력한 예상 등급 { courseName: '3' }
  const [electiveRoster, setElectiveRoster] = useState({}); // 🔑 [신규] 2학년 2학기 선택과목 명단 { 반: { 번호: [과목명,...] } }
  const [electiveUploadError, setElectiveUploadError] = useState("");

  // 🔑 [수정] 훅은 early return보다 반드시 위에 있어야 하므로, uploaded/classNum/studentNum만으로 안전하게 계산
  const ALL_TERMS = useMemo(() => {
    if (!uploaded) return [];
    return collectTerms(uploaded);
  }, [uploaded]);

  const designerResult = useMemo(() => {
    if (!uploaded || classNum === null) return null;
    const classMap = uploaded[classNum] || {};
    const nums = Object.keys(classMap).map(Number).sort((a, b) => a - b);
    const effectiveNum = nums.includes(studentNum) ? studentNum : nums[0];
    const sData = classMap[effectiveNum];
    if (!sData) return null;

    const entries = [];
    ALL_TERMS.forEach((term) => {
      SUBJECTS.forEach((subj) => {
        ((sData.school[subj] || {})[term] || []).forEach((e) => {
          if (e.hasGrade && selectedPastCourses.has(`${term}|${e.courseName}`)) {
            entries.push({ grade: e.grade, credit: e.credit });
          }
        });
      });
    });
    Object.entries(selectedPlannedCourses).forEach(([name, info]) => {
      const g = parseFloat(plannedGrades[name]);
      if (!isNaN(g) && g >= 1 && g <= 5) entries.push({ grade: g, credit: info.credit });
    });
    if (entries.length === 0) return null;
    const creditSum = entries.reduce((a, e) => a + e.credit, 0);
    if (!creditSum) return null;
    const avg = entries.reduce((a, e) => a + e.grade * e.credit, 0) / creditSum;
    return { avg, creditSum, count: entries.length };
  }, [uploaded, classNum, studentNum, ALL_TERMS, selectedPastCourses, selectedPlannedCourses, plannedGrades]);

  const handlePrintPdf = async () => {
    console.log('PDF 저장 시작 - 코드 버전 확인용 로그'); // 🔑 [임시 디버깅용]
    if (!window.electronAPI?.savePageAsPdf) {
      setUploadError("이 버전에서는 PDF 저장을 사용할 수 없어요. 앱을 최신 버전으로 업데이트해주세요.");
      return;
    }
    const overlay = document.getElementById('grades-modal-overlay');
    if (!overlay) return;

    setIsSavingPdf(true);

    // 🔑 배경(반투명 검은 오버레이)을 인쇄용으로 흰 배경으로 임시 교체
    const prevBg = overlay.style.background;
    const prevBackdrop = overlay.style.backdropFilter;
    overlay.style.background = '#F5F6F8';
    overlay.style.backdropFilter = 'none';

    // 🔑 캡처에서 제외할 요소들(검색창, PDF저장/삭제 버튼, X 버튼) 전부 임시로 숨김
    const noCaptureEls = overlay.querySelectorAll('.no-capture');
    const prevNoCaptureDisplays = Array.from(noCaptureEls).map((el) => el.style.display);
    noCaptureEls.forEach((el) => { el.style.display = 'none'; });

    // 🔑 모달을 제외한 나머지 화면(캘린더, 헤더 등)을 전부 숨김
    const hidden = [];
    let node = overlay;
    while (node && node !== document.body) {
      const parent = node.parentElement;
      if (parent) {
        Array.from(parent.children).forEach((sibling) => {
          if (sibling !== node && sibling.style.display !== 'none') {
            hidden.push({ el: sibling, prev: sibling.style.display });
            sibling.style.display = 'none';
          }
        });
      }
      node = parent;
    }

    // 🔑 측정 시점과 실제 인쇄 시점의 레이아웃이 달라 높이가 부정확했던 문제 해결:
    // @media print가 적용할 것과 동일한 스타일을 미리 JS로 직접 적용한 뒤, 그 상태에서 정확히 측정
    const printArea = document.getElementById('grades-print-area');
    const prevOverlayStyle = { position: overlay.style.position, display: overlay.style.display, overflow: overlay.style.overflow, height: overlay.style.height, padding: overlay.style.padding };
    const prevAreaStyle = printArea ? { margin: printArea.style.margin, boxShadow: printArea.style.boxShadow } : null;

    overlay.style.position = 'static';
    overlay.style.display = 'block';
    overlay.style.overflow = 'visible';
    overlay.style.height = 'auto';
    overlay.style.padding = '0';
    if (printArea) {
      printArea.style.margin = '0 auto';
      printArea.style.boxShadow = 'none';
      void printArea.offsetHeight; // 🔑 강제로 리플로우시켜 아래 측정값이 최신 레이아웃을 반영하도록 함
    }

    try {
      // 🔑 인쇄 때와 동일한 레이아웃 상태에서 측정한 실제 전체 너비/높이
      // + 폰트 로딩/렌더링 타이밍 차이로 인한 미세한 오차에 대비해 여유분을 더함
      const PDF_HEIGHT_BUFFER_PX = 120;
      const contentSizePx = printArea
        ? { width: printArea.offsetWidth, height: printArea.scrollHeight + PDF_HEIGHT_BUFFER_PX }
        : null;
      console.log('측정된 contentSizePx:', contentSizePx); // 🔑 [임시 디버깅용]

      const namePart = studentData?.name ? `_${studentData.name}` : '';
      const fileName = `${classNum}반_${effectiveStudentNum}번${namePart}_성적분석.pdf`;
      const result = await window.electronAPI.savePageAsPdf(fileName, contentSizePx);
      if (result && !result.success && result.error) {
        setUploadError("PDF 저장 중 문제가 발생했어요.");
      }
    } catch (err) {
      setUploadError("PDF 저장 중 문제가 발생했어요.");
    } finally {
      hidden.forEach(({ el, prev }) => { el.style.display = prev; });
      noCaptureEls.forEach((el, i) => { el.style.display = prevNoCaptureDisplays[i]; });
      overlay.style.background = prevBg;
      overlay.style.backdropFilter = prevBackdrop;
      // 🔑 측정을 위해 임시로 바꿨던 레이아웃 스타일 복원
      overlay.style.position = prevOverlayStyle.position;
      overlay.style.display = prevOverlayStyle.display;
      overlay.style.overflow = prevOverlayStyle.overflow;
      overlay.style.height = prevOverlayStyle.height;
      overlay.style.padding = prevOverlayStyle.padding;
      if (printArea && prevAreaStyle) {
        printArea.style.margin = prevAreaStyle.margin;
        printArea.style.boxShadow = prevAreaStyle.boxShadow;
      }
      setIsSavingPdf(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const wb = XLSX.read(evt.target.result, { type: "array" });
        const { data: parsed, sessions } = parseWorkbook(wb);
        const classes = Object.keys(parsed).map(Number).sort((a, b) => a - b);
        if (!classes.length) {
          setUploadError("인식할 수 있는 데이터가 없어요. 파일 형식을 확인해주세요.");
          return;
        }
        setUploaded(parsed);
        setMockSessions(sessions);
        setSimIdx(Infinity); // 🔑 새로 업로드하면 다시 최신 회차로 초기화
        saveToStorage(parsed, sessions);
        // 🔑 저장해둔 담임반이 있으면 그 반을 우선 선택, 없으면 첫 번째 반
        const myClass = myClassNum && classes.includes(Number(myClassNum)) ? Number(myClassNum) : classes[0];
        setClassNum(myClass);
        const nums = Object.keys(parsed[myClass]).map(Number).sort((a, b) => a - b);
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

  if (isIncompatible) {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative bg-[#F5F6F8] rounded-xl shadow-2xl w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
          <CloseButton />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "19px", fontWeight: 800, color: "#1F3A5F", margin: "0 0 8px" }}>
              데이터 형식이 맞지 않아요
            </h1>
            <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 20px" }}>
              이 컴퓨터에 저장된 성적 데이터가 예전 버전 형식이라 불러올 수 없어요.<br />아래 버튼으로 초기화한 뒤 엑셀 파일을 다시 업로드해주세요.
            </p>
            <button onClick={clearStorage} style={{ ...btnStyle, background: "#791F1F", color: "#fff", border: "1px solid #791F1F" }}>
              저장된 데이터 삭제
            </button>
          </div>
        </div>
      </div>
    );
  }

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

  // 🔑 [신규] 학생을 명시적으로 선택하기 전까지는, 특정 학생 정보를 바로 보여주지 않고 선택 화면을 먼저 표시
  if (!isStudentChosen) {
    const classNumbersForPicker = Object.keys(uploaded).map(Number).sort((a, b) => a - b);
    const classMapForPicker = uploaded[classNum] || {};
    const studentNumbersForPicker = Object.keys(classMapForPicker).map(Number).sort((a, b) => a - b);
    const effectiveStudentNumForPicker = studentNumbersForPicker.includes(studentNum) ? studentNum : studentNumbersForPicker[0];

    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
        <div className="relative bg-[#F5F6F8] rounded-xl shadow-2xl w-full max-w-sm p-8" onClick={(e) => e.stopPropagation()}>
          <CloseButton />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: "19px", fontWeight: 800, color: "#1F3A5F", margin: "0 0 8px" }}>
              학생을 선택해주세요
            </h1>
            <p style={{ fontSize: "13px", color: "#6B7280", margin: "0 0 24px" }}>
              개인정보 보호를 위해, 학생을 직접 선택해야 성적 정보가 표시됩니다.
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "16px" }}>
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
                {classNumbersForPicker.map((c) => <option key={c} value={c}>{c}반</option>)}
              </select>
              <select value={effectiveStudentNumForPicker} onChange={(e) => setStudentNum(Number(e.target.value))} style={selectStyle}>
                {studentNumbersForPicker.map((n) => {
                  const nm = classMapForPicker[n]?.name;
                  return <option key={n} value={n}>{n}번{nm ? ` ${nm}` : ''}</option>;
                })}
              </select>
            </div>

            <button
              onClick={() => setIsStudentChosen(true)}
              style={{ ...btnStyle, width: "100%", background: "#1F3A5F", color: "#fff", border: "1px solid #1F3A5F", padding: "10px" }}
            >
              선택한 학생 정보 보기
            </button>
          </div>
        </div>
      </div>
    );
  }

  const uploadedClassMap = uploaded[classNum] || {};
  const studentNumbers = Object.keys(uploadedClassMap).map(Number).sort((a, b) => a - b);
  const effectiveStudentNum = studentNumbers.includes(studentNum) ? studentNum : studentNumbers[0];
  const studentData = uploadedClassMap[effectiveStudentNum];
  const size = studentNumbers.length;
  const classNumbers = Object.keys(uploaded).map(Number).sort((a, b) => a - b);
  // 🔑 전체 데이터(모든 반/학생)를 훑는 무거운 계산이라, uploaded가 바뀔 때만 다시 계산하도록 캐싱
  // (입력창에 글자를 칠 때마다 매번 다시 도는 걸 방지 — 체감 지연의 주요 원인이었음)
  // 🔑 [신규] 이름으로 전체 반을 대상으로 검색 (반 2자리 + 관계없이 전체)
  const searchResults = searchQuery.trim()
    ? classNumbers.flatMap((cls) => {
        const classMap = uploaded[cls] || {};
        return Object.keys(classMap)
          .map(Number)
          .filter((num) => (classMap[num]?.name || "").includes(searchQuery.trim()))
          .sort((a, b) => a - b)
          .map((num) => ({ cls, num, name: classMap[num].name }));
      })
    : [];

  const overallAvg = schoolAvgGrade(studentData);
  const subjectAverages = SUBJECTS.map((subj) => ({ subject: subj, avg: subjectAvgGrade(studentData, subj) }));

  const termAvgTrend = ALL_TERMS.map((term) => ({ term, avg: termAvgGrade(studentData, term) }));

  const hasMockData = mockSessions.length > 0 && MOCK_SUBJECTS.some((subj) => studentData.mock[subj].some((c) => c));

  // 🔑 선택된 모의고사 회차 인덱스 (범위를 벗어나면 자동으로 최신 회차로 클램프)
  const effectiveSimIdx = mockSessions.length ? Math.min(simIdx, mockSessions.length - 1) : 0;
  const mockCell = (subj) => (mockSessions.length && studentData.mock[subj][effectiveSimIdx]) || { score: 0, grade: 9 };
  const sessionHasData = mockSessions.length > 0 && MOCK_SUBJECTS.some((subj) => studentData.mock[subj][effectiveSimIdx]);

  const korCell = mockCell("국어");
  const mathCell = mockCell("수학");
  const engCell = mockCell("영어");
  const socCell = mockCell("사회");
  const sciCell = mockCell("과학");

  // 🔑 표점합: 국어, 수학, 사회, 과학 표점의 합계
  const scoreSum = korCell.score + mathCell.score + socCell.score + sciCell.score;
  const scoreItems = [
    { label: "국어", value: korCell.score },
    { label: "수학", value: mathCell.score },
    { label: "사회", value: socCell.score },
    { label: "과학", value: sciCell.score },
  ];

  // 🔑 사회/과학 중 등급이 더 높은(숫자가 작은) 과목 하나를 대표로 선택
  const tamLabel = socCell.grade <= sciCell.grade ? "사회" : "과학";
  const tamGrade = Math.min(socCell.grade, sciCell.grade);
  const candidates = [
    { label: "국어", grade: korCell.grade },
    { label: "영어", grade: engCell.grade },
    { label: "수학", grade: mathCell.grade },
    { label: tamLabel, grade: tamGrade },
  ];
  const sortedCandidates = [...candidates].sort((a, b) => a.grade - b.grade);
  const top2 = sortedCandidates.slice(0, 2);
  const top3 = sortedCandidates.slice(0, 3);
  const twoAreaSum = top2.reduce((a, c) => a + c.grade, 0);
  const threeAreaSum = top3.reduce((a, c) => a + c.grade, 0);
  const fourAreaSum = candidates.reduce((a, c) => a + c.grade, 0);

  const top2Items = top2.map((c) => ({ label: c.label, value: c.grade }));
  const top3Items = top3.map((c) => ({ label: c.label, value: c.grade }));
  const fourItems = candidates.map((c) => ({ label: c.label, value: c.grade }));

  // 🔑 성적 설계기 — 이수과목 목록 전체를 대상으로 열기
  const handleOpenDesigner = () => {
    const initialSet = new Set();
    ALL_TERMS.forEach((term) => {
      SUBJECTS.forEach((subj) => {
        ((studentData.school[subj] || {})[term] || []).forEach((entry) => {
          if (entry.hasGrade) initialSet.add(`${term}|${entry.courseName}`);
        });
      });
    });
    setSelectedPastCourses(initialSet);

    // 🔑 [신규] 이수 예정 과목 자동 선택
    // - "공통" 그룹: 학기(2학년 2학기, 3학년 1학기) 관계없이 항상 자동 체크 (전교생이 듣는 과목이므로)
    // - 그 외 택N 그룹: 2학년 2학기 선택과목 명단에서 이 학생이 실제 신청한 과목만 자동 체크
    const studentElectiveSet = new Set(((electiveRoster[classNum] || {})[effectiveStudentNum]) || []);
    const initialPlannedCourses = {};
    Object.entries(PLANNED_CURRICULUM).forEach(([termLabel, groups]) => {
      Object.entries(groups).forEach(([groupLabel, courses]) => {
        if (groupLabel === "공통") {
          courses.forEach((course) => {
            initialPlannedCourses[course.name] = { credit: course.credit, subject: course.subject };
          });
          return;
        }
        if (termLabel !== "2학년 2학기" || studentElectiveSet.size === 0) return; // 🔑 명단 매칭은 2학년 2학기만 지원
        courses.forEach((course) => {
          if (studentElectiveSet.has(normalizeName(course.name))) {
            initialPlannedCourses[course.name] = { credit: course.credit, subject: course.subject };
          }
        });
      });
    });
    setSelectedPlannedCourses(initialPlannedCourses);
    setPlannedGrades({});
    setIsDesignerOpen(true);
  };

  // 🔑 이수과목 선택/해제 토글
  const togglePastCourse = (term, courseName) => {
    const key = `${term}|${courseName}`;
    setSelectedPastCourses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // 🔑 예정과목 선택/해제 토글 — 같은 그룹(택N) 안에서는 최대 N개까지만 선택 가능
  const togglePlannedCourse = (course, groupLabel, groupCourseNames, maxPick) => {
    setSelectedPlannedCourses((prev) => {
      const next = { ...prev };
      if (next[course.name]) {
        delete next[course.name];
        setPlannedGrades((g) => { const ng = { ...g }; delete ng[course.name]; return ng; });
        return next;
      }

      const currentPickedInGroup = groupCourseNames.filter((n) => next[n]).length;
      if (maxPick && currentPickedInGroup >= maxPick) {
        return prev; // 🔑 제한 초과 시 변경 없이 그대로 유지 (체크박스가 disabled 처리되어 있어 보통 여기 도달하지 않음)
      }

      next[course.name] = { credit: course.credit, subject: course.subject };
      return next;
    });
  };

  // 🔑 그룹 라벨(예: "택1 (국영수예사)")에서 선택 가능 개수를 추출 ("택1"→1, "택3"→3, 없으면 무제한)
  const extractMaxPick = (groupLabel) => {
    const m = /택(\d+)/.exec(groupLabel);
    return m ? parseInt(m[1], 10) : null;
  };

  // 🔑 [신규] 선택된 예정 과목(성적반영O만) 등급을 한 번에 지정한 값으로 채움
  const fillAllPlannedGrades = (gradeValue) => {
    setPlannedGrades((prev) => {
      const next = { ...prev };
      Object.keys(selectedPlannedCourses).forEach((courseName) => {
        next[courseName] = String(gradeValue);
      });
      return next;
    });
  };

  return (
    <div id="grades-modal-overlay" className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      {/* 🔑 인쇄(PDF 저장) 시에만 적용: 모달의 fixed+overflow-auto(뷰포트처럼 동작)를 일반 문서 흐름으로 바꿔서
          스크롤해야 보이던 아래쪽 내용까지 전부 여러 페이지에 걸쳐 정상적으로 인쇄되도록 함 */}
      <style>{`
        @media print {
          html, body { height: auto !important; overflow: visible !important; }
          #grades-modal-overlay {
            position: static !important;
            inset: auto !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            padding: 0 !important;
            background: #F5F6F8 !important;
            backdrop-filter: none !important;
          }
          #grades-print-area {
            margin: 0 auto !important;
            box-shadow: none !important;
          }
          * { break-inside: avoid-page !important; } /* 🔑 페이지 크기를 콘텐츠에 맞추므로 페이지 분할 자체가 없음 */
        }
      `}</style>
      <div
        id="grades-print-area"
        className="relative bg-[#F5F6F8] rounded-xl shadow-2xl w-full max-w-6xl my-4"
        style={{ fontFamily: "-apple-system, 'Malgun Gothic', sans-serif", padding: "28px 24px" }}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "22px", fontWeight: 800, color: "#1F3A5F", letterSpacing: "-0.02em" }}>
              {classNum}반 {effectiveStudentNum}번{studentData.name ? ` ${studentData.name}` : ""} 종합성적분석
            </h1>
            <p style={{ margin: "5px 0 0", fontSize: "13px", color: "#6B7280" }}>
              업로드된 데이터 사용 중 · {classNum}반 {size}명
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
            {/* 🔑 [이동] 학생 이름 검색 (전체 반 대상) — PDF로 저장 버튼 왼쪽 */}
            <div className="no-capture" style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="학생 이름 검색"
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setIsSearchOpen(true); }}
                onFocus={() => setIsSearchOpen(true)}
                onBlur={() => setTimeout(() => setIsSearchOpen(false), 150)}
                style={{ ...selectStyle, ...btnStyle, height: "36px", boxSizing: "border-box", width: "160px", cursor: "text" }}
              />
              {isSearchOpen && searchQuery.trim() && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", right: 0, width: "220px",
                  background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "10px",
                  boxShadow: "0 8px 24px rgba(0,0,0,0.12)", zIndex: 20, maxHeight: "260px", overflowY: "auto",
                }}>
                  {searchResults.length === 0 ? (
                    <p style={{ fontSize: "12px", color: "#9AA0A8", padding: "12px" }}>일치하는 학생이 없어요.</p>
                  ) : (
                    searchResults.map(({ cls, num, name }) => (
                      <button
                        key={`${cls}-${num}`}
                        type="button"
                        onMouseDown={() => {
                          setClassNum(cls);
                          setStudentNum(num);
                          setSearchQuery("");
                          setIsSearchOpen(false);
                        }}
                        style={{
                          display: "block", width: "100%", textAlign: "left", padding: "8px 12px",
                          fontSize: "13px", color: "#1F3A5F", background: "transparent", border: "none", cursor: "pointer",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F6F8")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        {cls}반 {num}번 {name}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="no-capture" style={{ display: "flex", gap: "8px" }}>
              <button onClick={handleOpenDesigner} title="예상 등급 계산" style={{ ...btnStyle, padding: "9px", background: "#7c3aed", color: "#fff", border: "1px solid #7c3aed" }}>
                <Calculator size={16} />
              </button>

              <label title={Object.keys(electiveRoster).length > 0 ? "선택과목 명단 업로드됨 (다시 클릭해 교체)" : "선택과목 명단 업로드 (아직 없음)"} style={{ ...btnStyle, padding: "9px", cursor: "pointer", position: "relative" }}>
                <Upload size={16} />
                <span style={{
                  position: "absolute", top: "3px", right: "3px", width: "7px", height: "7px", borderRadius: "50%",
                  background: Object.keys(electiveRoster).length > 0 ? "#22C55E" : "#D1D5DB",
                  border: "1.5px solid #fff",
                }} />
                <input type="file" accept=".xlsx,.xls" onChange={handleElectiveUpload} style={{ display: "none" }} />
              </label>

              <button onClick={handlePrintPdf} disabled={isSavingPdf} title="PDF로 저장" style={{ ...btnStyle, padding: "9px", background: "#2a78d6", color: "#fff", border: "1px solid #2a78d6" }}>
                <Download size={16} />
              </button>

              <button onClick={() => { clearStorage(); setUploadError(""); }} title="저장된 데이터 삭제" style={{ ...btnStyle, padding: "9px" }}>
                <Trash2 size={16} />
              </button>
            </div>

            <button
              onClick={onClose}
              className="no-capture"
              style={{ ...btnStyle, height: "36px", width: "36px", boxSizing: "border-box", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
              title="닫기"
            >
              <X className="w-4 h-4" />
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
            {studentNumbers.map((n) => {
              const studentName = uploadedClassMap[n]?.name;
              return <option key={n} value={n}>{n}번{studentName ? ` ${studentName}` : ''}</option>;
            })}
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
              <div style={{ background: "#1F3A5F12", borderRadius: "10px", padding: "10px 14px", minWidth: "84px" }}>
                <div style={{ fontSize: "11px", color: "#9AA0A8", marginBottom: "4px" }}>전체내신등급평균</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "17px", fontWeight: 800, color: "#1F3A5F" }}>{overallAvg.toFixed(2)}</span>
                  <span style={{ fontSize: "10px", color: "#9AA0A8" }}>5등급제</span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "17px", fontWeight: 800, color: "#7c3aed" }}>{convertGrade5to9(overallAvg).g9.toFixed(2)}</span>
                  <span style={{ fontSize: "10px", color: "#9AA0A8" }}>9등급제</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="학기별 내신 등급" subtitle="전 과목 평균 등급 추이 (막대, 낮을수록 좋음)" style={{ flex: "1 1 380px" }}>
            <div style={{ height: "200px" }}>
              {chartsReady && (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={termAvgTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#EEF0F3" vertical={false} />
                  <XAxis dataKey="term" tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={{ stroke: "#D8DBE1" }} tickLine={false} />
                  <YAxis domain={[0, 9]} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v) => [`${v}등급`, "평균 등급"]} contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #E2E5EA" }} />
                  <Bar dataKey="avg" fill="#1F3A5F" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                    <LabelList dataKey="avg" position="top" style={{ fontSize: 11, fill: "#1F3A5F", fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              )}
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
                    {chartsReady && (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 44, left: 0, bottom: 4 }}>
                        <XAxis type="number" domain={[0, 9]} hide />
                        <YAxis type="category" dataKey="term" width={90} tick={{ fontSize: 11, fill: "#6B7280" }} axisLine={false} tickLine={false} />
                        <Bar dataKey="barVal" fill={SUBJECT_COLORS[subj]} radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false}>
                          <LabelList dataKey="grade" position="right" formatter={(v) => `${v}등급`} style={{ fontSize: 11, fill: "#1F3A5F", fontWeight: 700 }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    )}
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
                  {lines.map(({ subj, entry }, i) => {
                    // 🔑 원점수/성취도/등급 중 실제로 있는 정보만 "/"로 이어붙여 표시
                    const parts = [];
                    if (entry.rawScore !== null && entry.rawScore !== undefined) parts.push(entry.rawScore);
                    if (entry.achievement) parts.push(entry.achievement);
                    if (entry.grade !== null && entry.grade !== undefined) parts.push(entry.grade);
                    return (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "4px 0", color: "#374151" }}>
                        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SUBJECT_COLORS[subj], flexShrink: 0 }} />
                          {entry.courseName}
                        </span>
                        {parts.length > 0 && (
                          <span style={{ color: "#9AA0A8", whiteSpace: "nowrap" }}>
                            ({parts.join(' / ')})
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </Card>

        <Card
          title="모의고사 성적 요약"
          subtitle={mockSessions.length ? "회차를 선택해 성적을 확인하세요" : ""}
          right={
            mockSessions.length > 0 && (
              <select value={effectiveSimIdx} onChange={(e) => setSimIdx(Number(e.target.value))} style={selectStyle}>
                {mockSessions.map((s, i) => (
                  <option key={s} value={i}>{s}</option>
                ))}
              </select>
            )
          }
        >
          {!hasMockData ? (
            <p style={{ fontSize: "12px", color: "#9AA0A8" }}>모의고사 데이터가 없어요. (시트 이름을 "26년 3월"처럼 지어서 함께 업로드하면 표시돼요)</p>
          ) : !sessionHasData ? (
            <p style={{ fontSize: "12px", color: "#9AA0A8" }}>선택한 회차({mockSessions[effectiveSimIdx]})의 성적 데이터가 없어요.</p>
          ) : (
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <AreaSumCard title="표점합" total={scoreSum} items={scoreItems} accent="#2a78d6" />
              <AreaSumCard title="2개 영역합" total={twoAreaSum} items={top2Items} accent="#1baf7a" />
              <AreaSumCard title="3개 영역합" total={threeAreaSum} items={top3Items} accent="#8b5cf6" />
              <AreaSumCard title="4개 영역합" total={fourAreaSum} items={fourItems} accent="#eb6834" />
            </div>
          )}
        </Card>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {MOCK_SUBJECTS.map((subj) => {
            const rows = mockSessions.map((session, si) => {
              const cell = studentData.mock[subj][si];
              return { session, score: cell ? cell.score : null, grade: cell ? cell.grade : null };
            });
            const hasAny = rows.some((r) => r.score !== null);
            const maxScore = (subj === "국어" || subj === "수학") ? 150 : (subj === "사회" || subj === "과학") ? 80 : 150; // 🔑 과목별 표점 최고점 (국/수: 150, 사/과: 80)
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
                    {chartsReady && (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={rows} margin={{ top: 12, right: 8, left: 0, bottom: 0 }}>
                        <XAxis dataKey="session" tick={{ fontSize: 10, fill: "#9AA0A8" }} axisLine={{ stroke: "#E2E5EA" }} tickLine={false} />
                        <YAxis yAxisId="score" domain={[0, maxScore]} hide />
                        <YAxis yAxisId="grade" orientation="right" domain={[1, 9]} reversed hide />
                        <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #E2E5EA" }} />
                        <Bar yAxisId="score" dataKey="score" fill={`${SUBJECT_COLORS[subj]}55`} radius={[3, 3, 0, 0]} barSize={16} name="표준점수" isAnimationActive={false}>
                          <LabelList dataKey="score" position="top" style={{ fontSize: 10, fill: "#9AA0A8" }} />
                        </Bar>
                        <Line yAxisId="grade" type="monotone" dataKey="grade" stroke={SUBJECT_COLORS[subj]} strokeWidth={2} dot={{ r: 3, fill: SUBJECT_COLORS[subj] }} name="등급" connectNulls isAnimationActive={false}>
                          <LabelList dataKey="grade" position="bottom" formatter={(v) => (v ? `${v}등급` : "")} style={{ fontSize: 10, fill: SUBJECT_COLORS[subj], fontWeight: 700 }} />
                        </Line>
                      </ComposedChart>
                    </ResponsiveContainer>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "16px" }}>
          <p style={{ fontSize: "12px", color: "#9AA0A8", margin: 0 }}>
            이 데이터는 이 컴퓨터에만 저장되며 다른 선생님에게는 공유되지 않습니다.
          </p>
          {/* 🔑 스크롤을 끝까지 내렸을 때도 어떤 학생인지 알 수 있도록 하단에 다시 표시 */}
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#1F3A5F", margin: 0 }}>
            {classNum}반 {effectiveStudentNum}번{studentData.name ? ` ${studentData.name}` : ""}
          </p>
        </div>
      </div>

      {/* 🔑 [신규] 성적 설계기 모달 */}
      {isDesignerOpen && (() => {
        const result = designerResult;
        return (
          <div className="fixed inset-0 z-60 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsDesignerOpen(false)}>
            <div
              className="relative bg-[#F5F6F8] rounded-xl shadow-2xl w-full max-w-3xl my-4 p-6 max-h-[90vh] overflow-y-auto"
              style={{ fontFamily: "-apple-system, 'Malgun Gothic', sans-serif" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 800, color: "#1F3A5F", margin: 0 }}>예상 등급 계산</h2>
                <button onClick={() => setIsDesignerOpen(false)} style={{ ...btnStyle, padding: "6px 10px" }}>닫기</button>
              </div>
              <p style={{ fontSize: "12px", color: "#6B7280", margin: "0 0 16px" }}>
                과목을 선택하고, 이수 예정 과목은 예상 등급을 입력해 원하는 조합의 평균 등급을 계산해보세요. 이 계산 결과는 저장되지 않습니다.
              </p>
              {electiveUploadError && (
                <div style={{ background: "#FCEBEB", color: "#791F1F", borderRadius: "8px", padding: "8px 12px", fontSize: "12px", marginBottom: "14px" }}>
                  {electiveUploadError}
                </div>
              )}

              {/* 이수한 과목 (기존 성적, 등급 있는 것만) */}
              <div style={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
                <p style={{ fontSize: "14px", fontWeight: 700, color: "#1F3A5F", margin: "0 0 10px" }}>이수한 과목 (1학년 1학기 ~ 2학년 1학기)</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
                  {ALL_TERMS.map((term) => {
                    const lines = [];
                    SUBJECTS.forEach((subj) => {
                      ((studentData.school[subj] || {})[term] || []).forEach((entry) => {
                        if (entry.hasGrade) lines.push({ subj, entry });
                      });
                    });
                    if (lines.length === 0) return null;
                    return (
                      <div key={term}>
                        <div style={{ fontSize: "12px", fontWeight: 700, color: "#1F3A5F", marginBottom: "6px" }}>{term}</div>
                        {lines.map(({ subj, entry }, i) => {
                          const key = `${term}|${entry.courseName}`;
                          const checked = selectedPastCourses.has(key);
                          return (
                            <label key={i} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#374151", padding: "3px 0", cursor: "pointer" }}>
                              <input type="checkbox" checked={checked} onChange={() => togglePastCourse(term, entry.courseName)} />
                              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: SUBJECT_COLORS[subj], flexShrink: 0 }} />
                              <span style={{ flex: 1 }}>{entry.courseName}</span>
                              <span style={{ color: "#9AA0A8" }}>{entry.grade}등급 · {entry.credit}단위</span>
                            </label>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 🔑 [신규] 모두 채우기 — 선택된 예정 과목의 등급을 한 번에 지정 */}
              {Object.keys(selectedPlannedCourses).length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "10px", padding: "10px 14px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#1F3A5F" }}>선택한 과목 모두 채우기</span>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {[1, 2, 3, 4, 5].map((g) => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => fillAllPlannedGrades(g)}
                        style={{
                          width: "28px", height: "28px", borderRadius: "6px", border: "1px solid #E2E5EA",
                          background: "#F5F6F8", color: "#374151", fontSize: "13px", fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 이수 예정 과목 */}
              {Object.entries(PLANNED_CURRICULUM).map(([termLabel, groups]) => (
                <div key={termLabel} style={{ background: "#FFFFFF", border: "1px solid #E2E5EA", borderRadius: "12px", padding: "16px", marginBottom: "14px" }}>
                  <p style={{ fontSize: "14px", fontWeight: 700, color: "#1F3A5F", margin: "0 0 10px" }}>{termLabel} (이수 예정)</p>
                  {Object.entries(groups).map(([groupLabel, courses]) => {
                    // 🔑 [수정] 필터링 대신, 학생이 실제 신청한 과목을 표시만 다르게(테두리 강조) 함
                    const studentElectiveSet = new Set(
                      ((electiveRoster[classNum] || {})[effectiveStudentNum]) || []
                    );
                    const isElectiveTerm = termLabel === "2학년 2학기" && groupLabel !== "공통";
                    const displayCourses = courses;

                    const maxPick = extractMaxPick(groupLabel);
                    const groupCourseNames = displayCourses.map((c) => c.name);
                    const pickedCount = groupCourseNames.filter((n) => selectedPlannedCourses[n]).length;
                    return (
                      <div key={groupLabel} style={{ marginBottom: "10px" }}>
                        <p style={{ fontSize: "11px", fontWeight: 700, color: "#9AA0A8", margin: "0 0 4px" }}>
                          {groupLabel}
                          {maxPick && <span style={{ marginLeft: "6px", color: pickedCount >= maxPick ? "#7c3aed" : "#B0B5BD" }}>({pickedCount}/{maxPick} 선택됨)</span>}
                        </p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                          {displayCourses.map((course) => {
                            const isSelected = !!selectedPlannedCourses[course.name];
                            const isDisabled = !isSelected && maxPick && pickedCount >= maxPick;
                            const isStudentEnrolled = isElectiveTerm && studentElectiveSet.has(normalizeName(course.name)); // 🔑 학생이 실제 신청한 과목
                            const borderColor = isSelected ? "#7c3aed" : isStudentEnrolled ? "#16A34A" : "#E2E5EA";
                            return (
                              <div key={course.name} style={{
                                display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "8px",
                                border: `1.5px solid ${borderColor}`,
                                background: isSelected ? "#F5F0FF" : isStudentEnrolled ? "#F0FDF4" : isDisabled ? "#F3F4F6" : "#FAFBFC",
                                opacity: isDisabled ? 0.5 : 1,
                              }}>
                                <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", fontWeight: 600, color: "#374151", cursor: isDisabled ? "not-allowed" : "pointer" }}>
                                  <input
                                    type="checkbox" checked={isSelected} disabled={isDisabled}
                                    onChange={() => togglePlannedCourse(course, groupLabel, groupCourseNames, maxPick)}
                                  />
                                  {course.name} ({course.credit}단위){!course.counted && " · 미반영"}
                                </label>
                                {isSelected && course.counted && (
                                  <input
                                    type="number" min="1" max="5" step="1" placeholder="등급"
                                    value={plannedGrades[course.name] || ""}
                                    onChange={(e) => setPlannedGrades((prev) => ({ ...prev, [course.name]: e.target.value }))}
                                    style={{ width: "44px", padding: "2px 4px", border: "1px solid #E2E5EA", borderRadius: "4px", fontSize: "11px", textAlign: "center" }}
                                  />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* 결과 */}
              <div style={{ background: "#1F3A5F", borderRadius: "12px", padding: "18px", textAlign: "center", position: "sticky", bottom: 0 }}>
                {result ? (
                  <>
                    <p style={{ fontSize: "11px", color: "#A9C0DE", margin: "0 0 4px", fontWeight: 700 }}>선택된 {result.count}과목 · 총 {result.creditSum}단위 기준 평균</p>
                    <div style={{ display: "flex", justifyContent: "center", alignItems: "baseline", gap: "16px" }}>
                      <div>
                        <span style={{ fontSize: "32px", fontWeight: 800, color: "#FFFFFF" }}>{result.avg.toFixed(2)}</span>
                        <span style={{ fontSize: "12px", color: "#A9C0DE", marginLeft: "4px" }}>5등급제</span>
                      </div>
                      <div>
                        <span style={{ fontSize: "32px", fontWeight: 800, color: "#C4B5FD" }}>{convertGrade5to9(result.avg).g9.toFixed(2)}</span>
                        <span style={{ fontSize: "12px", color: "#A9C0DE", marginLeft: "4px" }}>9등급제</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <p style={{ fontSize: "13px", color: "#A9C0DE", margin: 0 }}>과목을 선택하고 예상 등급을 입력해주세요.</p>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

export default React.memo(StudentGradesDashboardInner);