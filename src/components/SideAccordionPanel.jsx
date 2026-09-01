// src/components/SideAccordionPanel.jsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Utensils, Sparkles, Bookmark, X, Plus, Users, User, Calendar, Download, Upload, Info, ChevronDown, ChevronUp, RefreshCw, Clock, MapPin, CalendarIcon, Edit2, Wallet, Settings2, Trash2, Link2, Calculator, StickyNote, Menu } from 'lucide-react';

// 🔑 2026년 유치원·초등학교·중학교·고등학교 교원 봉급표 (월지급액, 단위: 원)
// 출처: 인사혁신처 고시. 매년 갱신되니 새 봉급표 발표 시 이 배열만 교체하면 됩니다.
const TEACHER_SALARY_TABLE = {
  1: 2041500,  2: 2103300,  3: 2166000,  4: 2228500,  5: 2291500,
  6: 2354400,  7: 2416600,  8: 2478600,  9: 2495600, 10: 2516700,
  11: 2538300, 12: 2585900, 13: 2657500, 14: 2773700, 15: 2889700,
  16: 3006200, 17: 3121000, 18: 3241500, 19: 3361200, 20: 3481000,
  21: 3600700, 22: 3733600, 23: 3865300, 24: 3997500, 25: 4129400,
  26: 4261900, 27: 4400100, 28: 4538000, 29: 4682100, 30: 4826800,
  31: 4971100, 32: 5115200, 33: 5261600, 34: 5407500, 35: 5553600,
  36: 5699100, 37: 5825700, 38: 5952500, 39: 6079500, 40: 6205700,
};
// 엑셀 양식 생성 및 업로드 파싱을 위한 SheetJS 임포트
import * as XLSX from 'xlsx';

const DAYS_SHORT = ['월', '화', '수', '목', '금'];
const PERIODS = ['1교시', '2교시', '3교시', '4교시', '5교시', '6교시', '7교시'];

// 🔑 [수정] Firestore는 배열 안에 배열(nested array)을 지원하지 않으므로,
// 요일(0~4)을 키로 하는 객체(맵) 안에 7칸짜리 1차원 배열을 넣는 구조로 변경.
// grid[dayIdx][periodIdx] 접근 문법은 배열/객체 동일하게 동작하므로 읽는 쪽 코드는 그대로 둠.
const createEmptyGrid = () => ({
  0: Array(7).fill(''),
  1: Array(7).fill(''),
  2: Array(7).fill(''),
  3: Array(7).fill(''),
  4: Array(7).fill('')
});

// 🔑 5등급제 → 9등급제 환산 계산기용 데이터/로직
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

// 🔑 [신규] 역변환: 9등급제 → 5등급제 (같은 표를 g9 기준으로 선형보간)
// 🔑 [신규] 공유 메모장 — 포스트잇 색상 팔레트
const POST_IT_COLORS = {
  yellow: { bg: 'bg-yellow-100', border: 'border-yellow-300' },
  pink: { bg: 'bg-pink-100', border: 'border-pink-300' },
  blue: { bg: 'bg-blue-100', border: 'border-blue-300' },
  green: { bg: 'bg-green-100', border: 'border-green-300' },
  purple: { bg: 'bg-purple-100', border: 'border-purple-300' },
};

function convertGrade9to5(g9) {
  const a = GRADE_CONV_TABLE;
  if (g9 <= a[0].g9) return { g5: a[0].g5, pct: a[0].pct };
  if (g9 >= a[a.length - 1].g9) return { g5: a[a.length - 1].g5, pct: a[a.length - 1].pct };
  for (let i = 1; i < a.length; i++) {
    if (g9 <= a[i].g9) {
      const lo = a[i - 1], hi = a[i];
      const t = (g9 - lo.g9) / ((hi.g9 - lo.g9) || 1); // 🔑 구간 폭이 0(평평한 구간)이면 하한값으로 고정
      return { g5: lo.g5 + (hi.g5 - lo.g5) * t, pct: lo.pct + (hi.pct - lo.pct) * t };
    }
  }
  return null;
}

export default React.memo(function SideAccordionPanel({
  activeSidePanel, setActiveSidePanel, closeSidePanel, selectedDate, activeDayMeal,
  messengerInput, setMessengerInput, handleAnalyzeMessengerText, isAnalyzing, parsedProposals,
  setParsedProposals, categories, categoryOrder, NOTION_PALETTES, activeProposalCatDropdownId,
  setActiveProposalCatDropdownId, handleUpdateProposalCategory, handleAddSingleProposalCard, handleEditProposal,
  bookmarks, handleOpenBookmarkUrl, handleDeleteBookmark, newBookmarkTitle,
  setNewBookmarkTitle, newBookmarkUrl, setNewBookmarkUrl, handleAddBookmarkSubmit,
  customTimetables, onUpdateGlobalTimetables, onDeleteGlobalTimetable, myClassNum, myTeacherName,
  usefulLinks, isLinkFormOpen, setIsLinkFormOpen,
  linkFormTitle, setLinkFormTitle, linkFormDesc, setLinkFormDesc, linkFormUrl, setLinkFormUrl,
  editingLinkId, handleSaveUsefulLink, handleDeleteUsefulLink, handleStartEditLink, handleStartNewLink,
  sharedMemos, isMemoFormOpen, setIsMemoFormOpen,
  memoFormTitle, setMemoFormTitle, memoFormContent, setMemoFormContent, memoFormColor, setMemoFormColor,
  editingMemoId, handleSaveMemo, handleDeleteMemo, handleStartEditMemo, handleStartNewMemo, handleReorderMemos
}) {

  // 시간표 제어 전용 상태 그룹
  const [timetableTab, setTimetableTab] = useState('class'); // 'class' 또는 'teacher'
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');

  // 현재 몇 교시인지 실시간 계산하여 보관하는 상태 (0: 해당없음, 1~7교시)
  const [currentPeriod, setCurrentPeriod] = useState(0);
  // 하이라이트를 표시할 '요일 인덱스' 상태 추적 (0: 월 ~ 4: 금)
  const [highlightDayIdx, setHighlightDayIdx] = useState(-1);

  // 현재 편집 중인 셀의 좌표(dayIdx, periodIdx) 추적 상태
  const [editingCell, setEditingCell] = useState(null); 
  const [cellInputValue, setCellInputValue] = useState('');
  const [isManageListOpen, setIsManageListOpen] = useState(false); // 🔑 등록된 시간표 관리 목록 펼침 상태
  const prevMemoIdsRef = useRef(new Set()); // 🔑 [신규] 새로 추가된 메모를 감지해서 자동으로 펼치기 위한 참조
  const [expandedMemoIds, setExpandedMemoIds] = useState(new Set()); // 🔑 펼쳐진 메모 id 목록
  const [draggedMemoId, setDraggedMemoId] = useState(null); // 🔑 드래그 중인 메모 id
  const [titleHoverMemoId, setTitleHoverMemoId] = useState(null); // 🔑 [신규] 제목을 클릭/포커스했을 때 수정 아이콘 표시
  const toggleMemoExpand = (id) => {
    setExpandedMemoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  // 🔑 [신규] sharedMemos에 새 메모가 추가되면 자동으로 펼침 상태로 등록
  useEffect(() => {
    const currentIds = new Set(sharedMemos.map((m) => m.id));
    const newIds = [...currentIds].filter((id) => !prevMemoIdsRef.current.has(id));
    if (newIds.length > 0) {
      setExpandedMemoIds((prev) => new Set([...prev, ...newIds]));
    }
    prevMemoIdsRef.current = currentIds;
  }, [sharedMemos]);

  const handleMemoDrop = (targetId) => {
    if (!draggedMemoId || draggedMemoId === targetId) return;
    const fromIdx = sharedMemos.findIndex((m) => m.id === draggedMemoId);
    const toIdx = sharedMemos.findIndex((m) => m.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const reordered = [...sharedMemos];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    handleReorderMemos(reordered);
    setDraggedMemoId(null);
  };
  const [isUploadGuideOpen, setIsUploadGuideOpen] = useState(false); // 🔑 양식 다운로드/엑셀 등록/안내 모달
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false); // 🔑 [신규] 학급 커스텀 드롭다운
  const [isTeacherDropdownOpen, setIsTeacherDropdownOpen] = useState(false); // 🔑 [신규] 교사 커스텀 드롭다운
  const [gradeConvInput, setGradeConvInput] = useState('3.00'); // 🔑 등급 환산 계산기 입력값
  const [gradeConvMode, setGradeConvMode] = useState('5to9'); // 🔑 [신규] '5to9' 또는 '9to5'

  useEffect(() => {
    const classes = Object.keys(customTimetables.classes || {});
    if (classes.length > 0) {
      // 🔑 저장해둔 담임반(myClassNum)과 이름이 일치하는 반이 있으면 그 반을 우선 선택 (마지막 숫자 기준 비교)
      const myClassMatch = myClassNum
        ? classes.find(c => (c.match(/(\d+)(?!.*\d)/)?.[0]) === String(myClassNum).trim())
        : null;
      setSelectedClass(prev => {
        if (prev && classes.includes(prev)) return prev; // 선택된 반이 삭제되어 없으면 첫 반으로 자동 전환
        return myClassMatch || classes[0];
      });
    } else {
      setSelectedClass('');
    }

    const teachers = Object.keys(customTimetables.teachers || {});
    if (teachers.length > 0) {
      // 🔑 저장해둔 본인 이름(myTeacherName)과 일치하는 교사가 있으면 우선 선택
      const myTeacherMatch = myTeacherName ? teachers.find(t => t === myTeacherName.trim()) : null;
      setSelectedTeacher(prev => {
        if (prev && teachers.includes(prev)) return prev;
        return myTeacherMatch || teachers[0];
      });
    } else {
      setSelectedTeacher('');
    }
  }, [customTimetables, myClassNum, myTeacherName]);

  useEffect(() => {
    if (!activeSidePanel.includes('timetable')) return;

    const checkCurrentPeriodAndDay = () => {
      const now = new Date();
      const day = now.getDay();
      const minutes = now.getHours() * 60 + now.getMinutes(); 

      if (day === 0 || day === 6) {
        setHighlightDayIdx(-1); 
        setCurrentPeriod(0);   
        return;
      }

      setHighlightDayIdx(day - 1);

      // 🔑 쉬는시간/점심시간까지 포함해서 다음 교시 시작 전까지 해당 교시로 인식
      if (minutes >= 510 && minutes < 570) setCurrentPeriod(1);       // 1교시 8:30~9:30
      else if (minutes >= 570 && minutes < 630) setCurrentPeriod(2);  // 2교시 9:30~10:30
      else if (minutes >= 630 && minutes < 690) setCurrentPeriod(3);  // 3교시 10:30~11:30
      else if (minutes >= 690 && minutes < 805) setCurrentPeriod(4);  // 4교시 11:30~13:25 (점심시간 포함)
      else if (minutes >= 805 && minutes < 865) setCurrentPeriod(5);  // 5교시 13:25~14:25
      else if (minutes >= 865 && minutes < 925) setCurrentPeriod(6);  // 6교시 14:25~15:25
      else if (minutes >= 925 && minutes < 985) setCurrentPeriod(7);  // 7교시 15:25~16:25
      else {
        setCurrentPeriod(0);
      }
    };

    checkCurrentPeriodAndDay();
    const timer = setInterval(checkCurrentPeriodAndDay, 60000); 
    return () => clearInterval(timer);
  }, [activeSidePanel]);

  // 🔑 [신규] 급여 실시간 누적 — 개인 정보라 localStorage(이 PC)에만 저장, 공유 안 함
  const [teacherGrade, setTeacherGrade] = useState(() => localStorage.getItem('teacher_grade') || '');
  const [tempGradeInput, setTempGradeInput] = useState('');
  const [nowTick, setNowTick] = useState(() => new Date());

  useEffect(() => {
    if (teacherGrade) localStorage.setItem('teacher_grade', teacherGrade);
    else localStorage.removeItem('teacher_grade');
  }, [teacherGrade]);

  // 급여 탭이 열려있을 때만 1초마다 갱신 (다른 탭 볼 땐 불필요한 타이머 안 돌림)
  useEffect(() => {
    if (!activeSidePanel.includes('salary')) return;
    const timer = setInterval(() => setNowTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, [activeSidePanel]);

  const handleSaveGrade = () => {
    const cleaned = tempGradeInput.replace(/[^0-9]/g, '');
    const gradeNum = parseInt(cleaned, 10);
    if (!gradeNum || gradeNum < 1 || gradeNum > 40) return;
    setTeacherGrade(String(gradeNum));
  };

  const handleClearGrade = () => {
    setTeacherGrade('');
    setTempGradeInput('');
  };

  // 🔑 주5일(월~금), 08:30~16:30(8시간) 근무 기준으로 시급/누적액 계산
  // 급여기간: 매달 17일 ~ 다음달 16일. 17일이 지나면 자동으로 새 주기 시작(자연 초기화)
  const salaryStats = useMemo(() => {
    const gradeNum = parseInt(teacherGrade, 10);
    const salaryNum = TEACHER_SALARY_TABLE[gradeNum];
    if (!salaryNum) return null;

    const now = nowTick;
    const year = now.getFullYear();
    const month = now.getMonth();
    const day = now.getDate();

    let periodStart, periodEnd;
    if (day >= 17) {
      periodStart = new Date(year, month, 17, 0, 0, 0, 0);
      periodEnd = new Date(year, month + 1, 17, 0, 0, 0, 0);
    } else {
      periodStart = new Date(year, month - 1, 17, 0, 0, 0, 0);
      periodEnd = new Date(year, month, 17, 0, 0, 0, 0);
    }

    let workdayCount = 0;
    const dayCursor = new Date(periodStart);
    while (dayCursor < periodEnd) {
      const dow = dayCursor.getDay();
      if (dow >= 1 && dow <= 5) workdayCount += 1;
      dayCursor.setDate(dayCursor.getDate() + 1);
    }
    if (workdayCount === 0) return null;

    const totalWorkHours = workdayCount * 8;
    const hourlyRate = salaryNum / totalWorkHours;

    let elapsedWorkHours = 0;
    const cursor = new Date(periodStart);
    while (cursor < periodEnd && cursor <= now) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        const workStart = new Date(cursor); workStart.setHours(8, 30, 0, 0);
        const workEnd = new Date(cursor); workEnd.setHours(16, 30, 0, 0);
        if (now >= workEnd) {
          elapsedWorkHours += 8;
        } else if (now > workStart) {
          elapsedWorkHours += (now - workStart) / (1000 * 60 * 60);
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    // 🔑 누적 금액은 30분 정시(=근무 1시간 완료 시점)마다만 갱신되도록 완료된 시간 단위로 계산
    // (게이지는 계속 부드럽게 채워지지만, 숫자는 정시에만 "차르륵" 바뀜)
    const earned = hourlyRate * Math.floor(elapsedWorkHours);

    // 🔑 오늘 게이지용: 08:30~16:30 기준 오늘 하루 진행도 (0~8시간)
    const dow = now.getDay();
    let todayElapsed = 0;
    if (dow >= 1 && dow <= 5) {
      const workStart = new Date(now); workStart.setHours(8, 30, 0, 0);
      const workEnd = new Date(now); workEnd.setHours(16, 30, 0, 0);
      if (now >= workEnd) todayElapsed = 8;
      else if (now > workStart) todayElapsed = (now - workStart) / (1000 * 60 * 60);
    }

    return { hourlyRate, earned, salaryNum, workdayCount, elapsedWorkHours, todayElapsed };
  }, [teacherGrade, nowTick]);

  // 🔑 누적 금액이 바뀔 때마다 이전 값에서 새 값까지 숫자가 빠르게 굴러가며(차르륵) 올라가는 카운트업 애니메이션
  const [displayedEarned, setDisplayedEarned] = useState(0);
  const displayedEarnedRef = useRef(0);
  const rollAnimRef = useRef(null);

  useEffect(() => {
    if (!salaryStats) return;
    const target = Math.floor(salaryStats.earned);
    const start = displayedEarnedRef.current;
    if (target === start) return;

    if (rollAnimRef.current) cancelAnimationFrame(rollAnimRef.current);
    const startTime = performance.now();
    const duration = 650;

    const step = (now) => {
      const t = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out
      const value = Math.round(start + (target - start) * eased);
      displayedEarnedRef.current = value;
      setDisplayedEarned(value);
      if (t < 1) rollAnimRef.current = requestAnimationFrame(step);
    };
    rollAnimRef.current = requestAnimationFrame(step);
    return () => { if (rollAnimRef.current) cancelAnimationFrame(rollAnimRef.current); };
  }, [salaryStats?.earned]);

  if (!activeSidePanel || activeSidePanel.length === 0) return null;

  /**
   * 특정 셀의 텍스트가 수정 완료되었을 때 상위 App.jsx를 거쳐 파이어베이스 원격 문서로 일괄 업데이트 진행
   * 🔑 [수정] nested array 대신 맵 구조로 불변 업데이트
   */
  const handleCellSave = (dayIdx, periodIdx) => {
    const value = cellInputValue.trim();
    const bucketKey = timetableTab === 'class' ? 'classes' : 'teachers';
    const targetKey = timetableTab === 'class' ? selectedClass : selectedTeacher.trim();
    if (!targetKey) return;

    const existingGrid = (customTimetables[bucketKey] && customTimetables[bucketKey][targetKey]) || createEmptyGrid();
    const existingRow = existingGrid[dayIdx] || Array(7).fill('');
    const updatedRow = [...existingRow];
    updatedRow[periodIdx] = value;
    const updatedGrid = { ...existingGrid, [dayIdx]: updatedRow };

    onUpdateGlobalTimetables(bucketKey, targetKey, updatedGrid); // 🔑 바뀐 반/교사 한 명의 데이터만 전달
    setEditingCell(null);
  };

  /**
   * 엑셀 파일 생성 시 셀 서식을 명시적으로 '텍스트(String)'로 지정하는 엔진
   */
  const downloadExcelTemplate = () => {
    const wb = XLSX.utils.book_new();

    if (timetableTab === 'class') {
      // 🔑 [신규] 전체 반 일괄 업로드용 양식: 1행 요일(병합), 2행 교시, 3행부터 반별 데이터
      const DAY_PERIOD_COUNTS = [
        { day: '월', count: 6 },
        { day: '화', count: 7 },
        { day: '수', count: 6 },
        { day: '목', count: 7 },
        { day: '금', count: 7 },
      ];

      const row1 = ['반'];
      const row2 = [''];
      DAY_PERIOD_COUNTS.forEach(({ day, count }) => {
        for (let p = 1; p <= count; p++) {
          row1.push(p === 1 ? day : ''); // 요일은 각 구간 첫 칸에만 표기 (나머지는 빈칸 → 파싱 시 같은 요일로 인식)
          row2.push(String(p));
        }
      });

      // 🔑 반 번호를 미리 채우지 않고, 빈 행 몇 개만 제공 — 필요한 반만큼 직접 입력하도록
      const EMPTY_ROW_COUNT = 5;
      const dataRows = Array.from({ length: EMPTY_ROW_COUNT }, () => {
        const row = [''];
        for (let c = 1; c < row1.length; c++) row.push('');
        return row;
      });

      const aoa = [row1, row2, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      // 요일 헤더 시각적으로 병합
      let colCursor = 1;
      ws['!merges'] = DAY_PERIOD_COUNTS.map(({ count }) => {
        const merge = { s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + count - 1 } };
        colCursor += count;
        return merge;
      });

      Object.keys(ws).forEach((cellRef) => {
        if (cellRef[0] === '!') return;
        if (ws[cellRef]) ws[cellRef].t = 's';
      });

      XLSX.utils.book_append_sheet(wb, ws, '전체 반 시간표');
      XLSX.writeFile(wb, '전체_반_시간표_양식.xlsx');
    } else {
      // 🔑 [신규] 전체 교사 일괄 업로드용 양식: 1행 요일(병합), 2행 교시, 3행부터 교사별 데이터
      const DAY_PERIOD_COUNTS = [
        { day: '월', count: 6 },
        { day: '화', count: 7 },
        { day: '수', count: 6 },
        { day: '목', count: 7 },
        { day: '금', count: 7 },
      ];

      const row1 = ['교사명'];
      const row2 = [''];
      DAY_PERIOD_COUNTS.forEach(({ day, count }) => {
        for (let p = 1; p <= count; p++) {
          row1.push(p === 1 ? day : '');
          row2.push(String(p));
        }
      });

      const EMPTY_ROW_COUNT = 5;
      const dataRows = Array.from({ length: EMPTY_ROW_COUNT }, () => {
        const row = [''];
        for (let c = 1; c < row1.length; c++) row.push('');
        return row;
      });

      const aoa = [row1, row2, ...dataRows];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      let colCursor = 1;
      ws['!merges'] = DAY_PERIOD_COUNTS.map(({ count }) => {
        const merge = { s: { r: 0, c: colCursor }, e: { r: 0, c: colCursor + count - 1 } };
        colCursor += count;
        return merge;
      });

      Object.keys(ws).forEach((cellRef) => {
        if (cellRef[0] === '!') return;
        if (ws[cellRef]) ws[cellRef].t = 's';
      });

      XLSX.utils.book_append_sheet(wb, ws, '전체 교사 시간표');
      XLSX.writeFile(wb, '전체_교사_시간표_양식.xlsx');
    }
  };

  /**
   * 업로드된 엑셀 데이터를 파싱하여 상위 App.jsx를 통해 파이어베이스 클라우드로 동기화 스트리밍
   * 🔑 [수정] parsedGrid를 nested array 대신 맵 구조로 생성
   */
  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const parsedTargetName = file.name
      .replace(/\.[^/.]+$/, "") 
      .replace(/_양식|교사별|반별|시간표|양식/g, "") 
      .replace(/[^a-zA-Zㄱ-ㅎ가-힣0-9-]/g, "") 
      .trim();

    const targetKey = parsedTargetName || (timetableTab === 'class' ? '새로운반' : '새로운교사');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target.result;
        const workbook = XLSX.read(data, { type: 'binary', raw: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // 🔑 [신규] A1 셀이 "반"이면 "전체 반 일괄 업로드" 양식으로 인식하여, 시트 안의 모든 반을 한 번에 등록
        if (timetableTab === 'class' && rows[0] && String(rows[0][0] || '').trim() === '반') {
          const dayHeaderRow = rows[0] || [];
          const periodHeaderRow = rows[1] || [];
          const DAY_NAME_TO_IDX = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };

          // 요일 헤더가 병합되어 있으므로, 값이 있는 열부터 다음 요일이 나오기 전까지를 그 요일의 열 범위로 인식
          const dayColumns = [];
          let currentDay = null;
          let currentCols = [];
          for (let col = 1; col < dayHeaderRow.length; col++) {
            const label = String(dayHeaderRow[col] || '').trim();
            if (label && DAY_NAME_TO_IDX[label] !== undefined) {
              if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });
              currentDay = label;
              currentCols = [col];
            } else if (currentDay) {
              currentCols.push(col);
            }
          }
          if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });

          // 각 열이 몇 교시에 해당하는지 매핑 (2행의 숫자 기준)
          const colToPeriodIdx = {};
          dayColumns.forEach(({ cols }) => {
            cols.forEach((col, i) => {
              const periodNum = parseInt(periodHeaderRow[col], 10);
              colToPeriodIdx[col] = (periodNum || i + 1) - 1; // 0-based (0~6)
            });
          });

          // 3행부터 각 행(반)마다 시간표 그리드 생성
          const parsedClasses = {};
          for (let r = 2; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const classNumRaw = String(row[0] || '').trim();
            if (!classNumRaw || !/^\d+$/.test(classNumRaw)) continue; // 🔑 "반" 열이 숫자가 아니면(빈 칸, 텍스트 등) 건너뜀
            const classLabel = `2-${classNumRaw}`; // 🔑 "2-1" 형식으로 등록 (2학년 고정), "시간표" 접미사는 화면 표시할 때만 붙임

            const grid = createEmptyGrid();
            dayColumns.forEach(({ day, cols }) => {
              const dayIdx = DAY_NAME_TO_IDX[day];
              cols.forEach((col) => {
                const periodIdx = colToPeriodIdx[col];
                if (periodIdx === undefined || periodIdx < 0 || periodIdx > 6) return;
                grid[dayIdx][periodIdx] = String(row[col] || '').trim();
              });
            });
            parsedClasses[classLabel] = grid; // 🔑 이미 같은 이름의 반이 있으면 이 값으로 자동 덮어씀
          }

          const classNames = Object.keys(parsedClasses);
          classNames.forEach((className) => {
            onUpdateGlobalTimetables('classes', className, parsedClasses[className]); // 🔑 반마다 개별 필드로 저장 (동시 편집 충돌 방지)
          });

          if (classNames.length > 0) setSelectedClass(classNames[0]);
          e.target.value = '';
          return; // 🔑 일괄 업로드 처리 끝났으니 아래의 기존(단일 반) 파싱 로직은 건너뜀
        }

        // 🔑 [신규] A1 셀이 "교사명"이면 "전체 교사 일괄 업로드" 양식으로 인식하여, 시트 안의 모든 교사를 한 번에 등록
        if (timetableTab === 'teacher' && rows[0] && String(rows[0][0] || '').trim() === '교사명') {
          const dayHeaderRow = rows[0] || [];
          const periodHeaderRow = rows[1] || [];
          const DAY_NAME_TO_IDX = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };

          const dayColumns = [];
          let currentDay = null;
          let currentCols = [];
          for (let col = 1; col < dayHeaderRow.length; col++) {
            const label = String(dayHeaderRow[col] || '').trim();
            if (label && DAY_NAME_TO_IDX[label] !== undefined) {
              if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });
              currentDay = label;
              currentCols = [col];
            } else if (currentDay) {
              currentCols.push(col);
            }
          }
          if (currentDay) dayColumns.push({ day: currentDay, cols: currentCols });

          const colToPeriodIdx = {};
          dayColumns.forEach(({ cols }) => {
            cols.forEach((col, i) => {
              const periodNum = parseInt(periodHeaderRow[col], 10);
              colToPeriodIdx[col] = (periodNum || i + 1) - 1;
            });
          });

          // 🔑 "3. 김길동(16)" 형식에서 순번/단위수를 떼고 순수 이름만 추출
          const extractTeacherName = (raw) => {
            const label = String(raw || '').trim();
            const m = /^\d+\.\s*(.+?)\(\d+\)$/.exec(label);
            return m ? m[1].trim() : label;
          };

          const parsedTeachers = {};
          for (let r = 2; r < rows.length; r++) {
            const row = rows[r];
            if (!row || row.length === 0) continue;
            const rawLabel = String(row[0] || '').trim();
            if (!rawLabel) continue;
            const teacherName = extractTeacherName(rawLabel);
            if (!teacherName) continue;

            const grid = createEmptyGrid();
            dayColumns.forEach(({ day, cols }) => {
              const dayIdx = DAY_NAME_TO_IDX[day];
              cols.forEach((col) => {
                const periodIdx = colToPeriodIdx[col];
                if (periodIdx === undefined || periodIdx < 0 || periodIdx > 6) return;
                // 🔑 셀 안에 이미 "반\n과목" 형태로 줄바꿈이 들어있으므로 그대로 사용 (기존 렌더링 로직과 호환)
                grid[dayIdx][periodIdx] = String(row[col] || '').trim();
              });
            });
            parsedTeachers[teacherName] = grid;
          }

          const teacherNames = Object.keys(parsedTeachers);
          teacherNames.forEach((name) => {
            onUpdateGlobalTimetables('teachers', name, parsedTeachers[name]); // 🔑 교사마다 개별 필드로 저장 (동시 편집 충돌 방지)
          });

          if (teacherNames.length > 0) setSelectedTeacher(teacherNames[0]);
          e.target.value = '';
          return; // 🔑 일괄 업로드 처리 끝났으니 아래의 기존(단일 교사) 파싱 로직은 건너뜀
        }

        const parsedGrid = createEmptyGrid(); // 🔑 배열의 배열 대신 맵 구조로 생성
        
        if (timetableTab === 'class') {
          for (let pIdx = 0; pIdx < 7; pIdx++) {
            const rowData = rows[pIdx + 1] || [];
            for (let dIdx = 0; dIdx < 5; dIdx++) {
              parsedGrid[dIdx][pIdx] = String(rowData[dIdx + 1] || '').trim();
            }
          }
        } else {
          for (let pIdx = 0; pIdx < 7; pIdx++) {
            const subjectRowData = rows[pIdx * 2 + 1] || [];
            const classRowData = rows[pIdx * 2 + 2] || [];
            
            for (let dIdx = 0; dIdx < 5; dIdx++) {
              const subjectVal = String(subjectRowData[dIdx + 1] || '').trim();
              const classVal = String(classRowData[dIdx + 1] || '').trim();
              
              if (subjectVal && classVal) {
                parsedGrid[dIdx][pIdx] = `${subjectVal}\n${classVal}`;
              } else {
                parsedGrid[dIdx][pIdx] = subjectVal || classVal || '';
              }
            }
          }
        }

        const bucketKey = timetableTab === 'class' ? 'classes' : 'teachers';
        onUpdateGlobalTimetables(bucketKey, targetKey, parsedGrid); // 🔑 업로드된 반/교사 데이터만 전달

        if (timetableTab === 'class') {
          setSelectedClass(targetKey);
        } else {
          setSelectedTeacher(targetKey);
        }

        e.target.value = ''; 
      } catch (err) {
        console.error("엑셀 파일 파싱 오류 발생: ", err);
      }
    };
    reader.readAsBinaryString(file);
  };

  // 🔑 "2-1", "2-10", "2-2" 같은 반 이름을 뒤쪽 숫자 기준으로 자연스럽게 정렬 (2-1, 2-2, ..., 2-10 순)
  const classList = Object.keys(customTimetables.classes || {}).sort((a, b) => {
    const numA = parseInt(a.match(/(\d+)(?!.*\d)/)?.[0] ?? '0', 10);
    const numB = parseInt(b.match(/(\d+)(?!.*\d)/)?.[0] ?? '0', 10);
    return numA - numB;
  });
  const teacherList = Object.keys(customTimetables.teachers || {}).sort((a, b) => a.localeCompare(b, 'ko')); // 🔑 가나다순 정렬
  // 🔑 [신규] 각 패널 카드마다 쓰이는 공통 닫기 버튼
  const PanelCloseButton = ({ panelName }) => (
    <button 
      onClick={() => closeSidePanel(panelName)} 
      className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-all z-10"
    >
      <X className="w-4 h-4" />
    </button>
  );

  const hasClasses = classList.length > 0;
  const hasTeachers = teacherList.length > 0;

  return (
    <div className="xl:col-span-1 w-full min-w-0 flex flex-col gap-3">

        {activeSidePanel.includes('timetable') && (
          <aside style={{ order: activeSidePanel.indexOf('timetable') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 max-h-220 animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="timetable" />
          <div className="space-y-4 font-sans flex flex-col flex-1 justify-between">
            <div className="space-y-3 flex-1">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
                <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg"><Calendar className="w-4 h-4" /></div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">시간표 대시보드</h3>
                </div>
              </div>

              {/* 🔑 X 버튼과 동일한 absolute top-3 기준으로 위치를 맞춤 (X 버튼 왼쪽으로 나란히) */}
              <button
                type="button"
                onClick={() => setIsUploadGuideOpen(true)}
                className="absolute top-3 right-17 p-1 rounded-md transition-all z-10 text-gray-400 hover:text-gray-800 hover:bg-gray-100"
                title="시간표 등록 방법 / 엑셀 업로드"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsManageListOpen(!isManageListOpen)}
                className={`absolute top-3 right-10 p-1 rounded-md transition-all z-10 ${isManageListOpen ? 'bg-blue-50 text-blue-700' : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100'}`}
                title="등록된 시간표 관리"
              >
                <Settings2 className="w-4 h-4" />
              </button>

              {/* 🔑 관리 버튼을 누르면 펼쳐지는 등록된 시간표 삭제 목록 — 현재 탭(반별/교사별)에 해당하는 것만 표시 */}
              {isManageListOpen && (
                <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg p-2.5 space-y-1 max-h-40 overflow-y-auto">
                  {timetableTab === 'class' ? (
                    classList.length > 0 ? (
                      classList.map((cls) => (
                        <div key={cls} className="flex items-center justify-between bg-white border border-[#E9E9E6] rounded-md px-2.5 py-1.5">
                          <span className="text-xs font-semibold text-gray-700 truncate">{cls} 시간표</span>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm(`'${cls} 시간표'를 삭제할까요?`)) onDeleteGlobalTimetable('classes', cls); }}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-400 text-center py-2">등록된 반별 시간표가 없습니다.</p>
                    )
                  ) : (
                    teacherList.length > 0 ? (
                      teacherList.map((teacher) => (
                        <div key={teacher} className="flex items-center justify-between bg-white border border-[#E9E9E6] rounded-md px-2.5 py-1.5">
                          <span className="text-xs font-semibold text-gray-700 truncate">{teacher} 선생님 시간표</span>
                          <button
                            type="button"
                            onClick={() => { if (window.confirm(`'${teacher} 선생님' 시간표를 삭제할까요?`)) onDeleteGlobalTimetable('teachers', teacher); }}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-[11px] text-gray-400 text-center py-2">등록된 교사별 시간표가 없습니다.</p>
                    )
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 p-0.5 bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg shrink-0">
                <button 
                  onClick={() => { setTimetableTab('class'); setEditingCell(null); setIsClassDropdownOpen(false); setIsTeacherDropdownOpen(false); }} 
                  className={`py-1.5 text-center font-bold rounded-md flex items-center justify-center gap-1 transition-colors duration-150 ${timetableTab === 'class' ? 'bg-white text-[#37352F] shadow-xs border border-[#E9E9E6]' : 'border border-transparent text-gray-400 hover:text-gray-700'}`}
                >
                  <Users className="w-3.5 h-3.5" /> 반별 시간표
                </button>
                <button 
                  onClick={() => { setTimetableTab('teacher'); setEditingCell(null); setIsClassDropdownOpen(false); setIsTeacherDropdownOpen(false); }} 
                  className={`py-1.5 text-center font-bold rounded-md flex items-center justify-center gap-1 transition-colors duration-150 ${timetableTab === 'teacher' ? 'bg-white text-[#37352F] shadow-xs border border-[#E9E9E6]' : 'border border-transparent text-gray-400 hover:text-gray-700'}`}
                >
                  <User className="w-3.5 h-3.5" /> 교사별 시간표
                </button>
              </div>

              {timetableTab === 'class' ? (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">등록/선택된 학급</label>
                  {hasClasses ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsClassDropdownOpen(!isClassDropdownOpen)}
                        className="w-full flex items-center justify-between p-2 border border-[#E9E9E6] bg-[#F7F7F5] hover:bg-gray-100 rounded-md font-bold text-gray-700 text-xs focus:outline-none transition-colors"
                      >
                        <span>{selectedClass || '반 선택'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isClassDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isClassDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E9E9E6] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {classList.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setSelectedClass(c); setEditingCell(null); setIsClassDropdownOpen(false); }}
                              className={`w-full px-3 py-2 text-left text-xs font-semibold border-b border-gray-50 last:border-0 transition-colors ${
                                selectedClass === c ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-[#F7F7F5]'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2.5 px-3 border border-dashed border-gray-200 rounded-lg text-gray-400 font-medium bg-[#F7F7F5]/30 text-[11px]">
                      하단 <Info className="w-3 h-3 inline -mt-0.5" /> 안내를 참고해 시간표를 등록해주세요.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">등록/선택된 교사</label>
                  {hasTeachers ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setIsTeacherDropdownOpen(!isTeacherDropdownOpen)}
                        className="w-full flex items-center justify-between p-2 border border-[#E9E9E6] bg-[#F7F7F5] hover:bg-gray-100 rounded-md font-bold text-gray-700 text-xs focus:outline-none transition-colors"
                      >
                        <span>{selectedTeacher || '교사 선택'}</span>
                        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isTeacherDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {isTeacherDropdownOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-[#E9E9E6] rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                          {teacherList.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => { setSelectedTeacher(t); setEditingCell(null); setIsTeacherDropdownOpen(false); }}
                              className={`w-full px-3 py-2 text-left text-xs font-semibold border-b border-gray-50 last:border-0 transition-colors ${
                                selectedTeacher === t ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-[#F7F7F5]'
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-2.5 px-3 border border-dashed border-gray-200 rounded-lg text-gray-400 font-medium bg-[#F7F7F5]/30 text-[11px]">
                      하단 <Info className="w-3 h-3 inline -mt-0.5" /> 안내를 참고해 시간표를 등록해주세요.
                    </div>
                  )}
                </div>
              )}

              <p className="text-[10px] text-gray-400 font-medium leading-tight">
                💡 시간표 등록 완료 후 <span className="text-blue-600 font-bold">셀을 클릭하면 개별 수정</span>도 가능합니다.
              </p>

              <div className="border border-[#E9E9E6] rounded-xl overflow-hidden bg-white shadow-xs">
                <div className="grid grid-cols-6 bg-[#F7F7F5] border-b border-[#E9E9E6] text-center font-bold text-gray-500 py-1.5">
                  <div className="border-r border-gray-200/60 text-[10px] flex items-center justify-center">교시</div>
                  {DAYS_SHORT.map(d => <div key={d} className="text-xs">{d}</div>)}
                </div>

                {PERIODS.map((periodLabel, periodIdx) => {
                  const isCurrentRowPeriod = (periodIdx + 1) === currentPeriod;

                  return (
                    <div 
                      key={periodLabel} 
                      className="grid grid-cols-6 text-center items-center border-b border-gray-100 last:border-none min-h-9.5 transition-all rounded-xs relative"
                    >
                      <div className={`bg-[#F7F7F5]/60 font-bold text-[10px] py-2 border-r border-gray-100 h-full flex flex-col items-center justify-center select-none ${isCurrentRowPeriod && highlightDayIdx !== -1 ? 'text-amber-600 bg-amber-50/40' : 'text-gray-400'}`}>
                        <span>{periodIdx + 1}</span>
                      </div>
                      
                      {DAYS_SHORT.map((_, dayIdx) => {
                        let cellText = '';
                        if (timetableTab === 'class') {
                          cellText = selectedClass ? (customTimetables.classes?.[selectedClass]?.[dayIdx]?.[periodIdx] || '') : '';
                        } else {
                          cellText = selectedTeacher ? (customTimetables.teachers?.[selectedTeacher]?.[dayIdx]?.[periodIdx] || '') : '';
                        }

                        const isEditingThis = editingCell && editingCell.day === dayIdx && editingCell.period === periodIdx;
                        const isHighlightedCell = isCurrentRowPeriod && (dayIdx === highlightDayIdx);

                        let displaySubject = cellText;
                        let displayClassInfo = '';
                        
                        if (timetableTab === 'teacher' && cellText.includes('\n')) {
                          const splitPieces = cellText.split('\n');
                          displaySubject = splitPieces[0] || '';
                          displayClassInfo = splitPieces[1] || '';
                        }

                        return (
                          <div 
                            key={dayIdx} 
                            className="h-full border-r border-gray-50 last:border-none flex items-center justify-center p-0.5 min-w-0"
                          >
                            {isEditingThis ? (
                              <div className="w-full h-full flex items-center relative">
                                <textarea 
                                  autoFocus
                                  value={cellInputValue}
                                  onChange={(e) => setCellInputValue(e.target.value)}
                                  onBlur={() => handleCellSave(dayIdx, periodIdx)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleCellSave(dayIdx, periodIdx);
                                    }
                                    if (e.key === 'Escape') setEditingCell(null);
                                  }}
                                  className="w-full h-full p-1 bg-blue-50 border border-blue-300 text-blue-800 text-[10px] font-bold rounded focus:outline-none text-center resize-none leading-tight"
                                />
                              </div>
                            ) : (
                              <div 
                                onClick={() => {
                                  if (timetableTab === 'class' && !selectedClass) return;
                                  if (timetableTab === 'teacher' && !selectedTeacher) return;
                                  setEditingCell({ day: dayIdx, period: periodIdx });
                                  setCellInputValue(cellText);
                                }}
                                className={`w-full h-full flex flex-col items-center justify-center text-[10px] font-bold rounded cursor-pointer transition-colors px-0.5 py-1 min-h-9 text-center leading-tight whitespace-pre-line
                                  ${timetableTab === 'class' ? 'break-keep' : 'break-all'}
                                  ${isHighlightedCell ? 'ring-2 ring-amber-400 ring-inset bg-amber-50/10 z-10 shadow-xs' : ''}
                                  ${cellText ? 'text-blue-700 bg-blue-50/30 hover:bg-blue-50/60 font-black' : 'text-gray-300 hover:bg-slate-50 font-normal'}`}
                              >
                                {cellText ? (
                                  timetableTab === 'teacher' ? (
                                    <div className="flex flex-col w-full truncate">
                                      <span className="block truncate font-black text-blue-800">{(displaySubject || '-').split('_').pop()}</span>
                                      <span className="block truncate text-[9px] font-bold text-gray-400 mt-0.5">{(displayClassInfo || '-').split('_').pop()}</span>
                                    </div>
                                  ) : (
                                    cellText.split('_').join('\n')
                                  )
                                ) : (
                                  (timetableTab === 'class' ? (selectedClass ? '+' : '-') : (selectedTeacher ? '+' : '-'))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 🔑 [신규] 양식 다운로드 / 엑셀 등록 / 안내를 모달로 이동 */}
            {isUploadGuideOpen && (
              <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setIsUploadGuideOpen(false)}>
                <div className="relative bg-white border border-[#E9E9E6] rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-3">
                    <h3 className="text-sm font-bold text-[#37352F] flex items-center gap-2"><Info className="w-4 h-4 text-blue-500" /> 시간표 등록 방법</h3>
                    <button onClick={() => setIsUploadGuideOpen(false)} className="p-1 hover:bg-gray-100 rounded" style={{ WebkitAppRegion: 'no-drag' }}><X className="w-4 h-4" /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={downloadExcelTemplate}
                      className="py-2 px-3 border border-[#E9E9E6] bg-white text-gray-700 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[11px] shadow-2xs transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-600" /> 양식 다운로드
                    </button>

                    <label className="py-2 px-3 border border-blue-200 bg-blue-50/20 text-blue-700 hover:bg-blue-50/50 rounded-lg flex items-center justify-center gap-1.5 font-bold text-[11px] shadow-2xs cursor-pointer text-center transition-colors">
                      <Upload className="w-3.5 h-3.5" /> 엑셀 파일 등록
                      <input
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={(e) => { handleExcelUpload(e); setIsUploadGuideOpen(false); }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-xl p-3 space-y-1.5 text-gray-600 leading-normal">
                    <p className="font-extrabold text-gray-800 text-[11px]">등록 방법 안내</p>
                    <ol className="list-decimal list-inside space-y-0.5 text-[10px] font-medium text-gray-500">
                      <li><span className="font-bold text-gray-700">'양식 다운로드'</span>로 템플릿 파일을 다운로드합니다.</li>
                      <li>엑셀 파일명을 <span className="font-bold text-blue-600">등록될 이름(예: 2-3, 홍길동)</span>으로 변경합니다.</li>
                      <li>양식 규격(반별은 과목명 단일행, 교사별은 과목/반 2줄행)에 맞게 기입 후 저장합니다.</li>
                      <li><span className="font-bold text-gray-700">'엑셀 파일 등록'</span> 버튼으로 업로드하면 목록에 동적 추가됩니다!</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}
          </div>
          </aside>
        )}

        {activeSidePanel.includes('meal') && (
          <aside style={{ order: activeSidePanel.indexOf('meal') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="meal" />
            <div className="space-y-3">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg"><Utensils className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">오늘의 급식 {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일</h3>
              </div>
            </div>

            {activeDayMeal && (activeDayMeal.lunch || activeDayMeal.dinner) ? (
              <div className="grid grid-cols-2 gap-2 animate-in fade-in duration-200">
                {activeDayMeal.lunch ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-black text-emerald-800 bg-emerald-50 px-2 py-0.5 inline-block rounded border border-emerald-100">☀️ 중식 구성</div>
                    <div className="bg-[#F7F7F5] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700 font-semibold whitespace-pre-wrap leading-relaxed">{activeDayMeal.lunch.diet}</div>
                    <p className="text-[9px] text-right text-gray-400 font-bold">열량: {activeDayMeal.lunch.calories}</p>
                  </div>
                ) : ( <p className="text-[10px] text-gray-400 italic bg-gray-50/60 p-2 rounded text-center border border-dashed self-start">중식 미운영 일자</p> )}

                {activeDayMeal.dinner ? (
                  <div className="space-y-1">
                    <div className="text-[11px] font-black text-amber-800 bg-amber-50 px-2 py-0.5 inline-block rounded border border-amber-100">🌙 석식 구성</div>
                    <div className="bg-[#F7F7F5] p-2.5 rounded-lg border border-gray-100 text-xs text-gray-700 font-semibold whitespace-pre-wrap leading-relaxed">{activeDayMeal.dinner.diet}</div>
                    <p className="text-[9px] text-right text-gray-400 font-bold">열량: {activeDayMeal.dinner.calories}</p>
                  </div>
                ) : ( <p className="text-[10px] text-gray-400 italic bg-gray-50/60 p-2 rounded text-center border border-dashed self-start">석식 미운영 일자</p> )}
              </div>
            ) : ( <p className="text-xs text-gray-400 italic text-center py-5 bg-[#F7F7F5]/40 rounded-lg border border-dashed border-gray-200">지정된 급식 정보가 존재하지 않습니다.</p> )}

            {/* 🔑 선택된 날짜의 요일 4교시 기준으로 교사를 두 그룹으로 분류 (날짜 선택에 따라 함께 갱신) */}
            {(() => {
              const DAY_NAME_TO_IDX = { '월': 0, '화': 1, '수': 2, '목': 3, '금': 4 };
              const selectedDayIdx = DAY_NAME_TO_IDX[['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]];

              if (selectedDayIdx === undefined) return null; // 🔑 토/일요일은 시간표 대상 아님

              const teacherEntries = Object.entries(customTimetables.teachers || {});
              if (teacherEntries.length === 0) return null;

              const with4th = [];
              const without4th = [];
              teacherEntries.forEach(([name, grid]) => {
                const cell = grid?.[selectedDayIdx]?.[3]; // 🔑 4교시 = index 3
                if (cell && String(cell).trim()) with4th.push(name);
                else without4th.push(name);
              });
              with4th.sort((a, b) => a.localeCompare(b, 'ko'));
              without4th.sort((a, b) => a.localeCompare(b, 'ko'));

              return (
                <div className="space-y-2 pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-sky-50 text-sky-700 rounded-lg"><Users className="w-4 h-4" /></div>
                    <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">{selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 급식 메이트</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#F7F7F5] border border-gray-100 rounded-lg p-2 space-y-1">
                      <p className="text-xs font-black text-gray-500">4교시 없음 😊 ({without4th.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {without4th.length > 0 ? without4th.map(name => (
                          <span key={name} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5">{name}</span>
                        )) : <span className="text-xs text-gray-300 italic">없음</span>}
                      </div>
                    </div>
                    <div className="bg-[#F7F7F5] border border-gray-100 rounded-lg p-2 space-y-1">
                      <p className="text-xs font-black text-gray-500">4교시 있음 😢 ({with4th.length})</p>
                      <div className="flex flex-wrap gap-1">
                        {with4th.length > 0 ? with4th.map(name => (
                          <span key={name} className="text-xs font-bold text-gray-700 bg-white border border-gray-200 rounded px-1.5 py-0.5">{name}</span>
                        )) : <span className="text-xs text-gray-300 italic">없음</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
          </aside>
        )}

        {activeSidePanel.includes('ai') && (
          <aside style={{ order: activeSidePanel.indexOf('ai') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="ai" />
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-purple-50 text-purple-700 rounded-lg animate-pulse"><Sparkles className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">Gemini AI 분석기</h3>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">메신저 원문 붙여넣기</p>
                {messengerInput && (
                  <button type="button" onClick={() => setMessengerInput('')} className="text-[10px] text-gray-400 hover:text-rose-600 underline">전체 삭제</button>
                )}
              </div>
              <textarea 
                rows={8} 
                placeholder="메신저 본문 전체를 복사하여 붙여넣으세요!" 
                value={messengerInput} 
                onChange={(e) => setMessengerInput(e.target.value)} 
                className="w-full p-2.5 border border-[#E9E9E6] rounded-lg bg-[#F7F7F5]/50 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400 placeholder:text-gray-400 leading-relaxed" 
              />
              <button 
                type="button" 
                onClick={handleAnalyzeMessengerText} 
                disabled={isAnalyzing}
                className="w-full py-2 bg-purple-700 hover:bg-purple-800 disabled:bg-purple-400 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                {isAnalyzing ? ( <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> <span>분석 가동중...</span></> ) : ( <><Sparkles className="w-3.5 h-3.5" /> <span>AI 메신저 분석</span></> )}
              </button>
            </div>
            
            {parsedProposals.length > 0 && (
              <div className="space-y-3.5 mt-2 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-[#E9E9E6] pb-1.5">
                  <p className="text-[10px] font-bold text-purple-700 uppercase">분석 일정 ({parsedProposals.length}건)</p>
                  <button onClick={() => setParsedProposals([])} className="text-[10px] text-gray-400 hover:text-gray-600 underline">비우기</button>
                </div>
                
                <div className="space-y-3 max-h-100 overflow-y-auto pr-1 scrollbar-none">
                  {parsedProposals.map((proposal) => {
                    const theme = categories[proposal.category] || NOTION_PALETTES.gray;
                    const hasSelectedCategory = !!proposal.category;
                    return (
                      <div key={proposal.id} className="bg-white border border-[#E9E9E6] rounded-lg p-3 shadow-xs space-y-2.5 hover:border-purple-300 transition-all relative">
                        <div className="space-y-1.5">
                          <div className="relative inline-block">
                            <button 
                              type="button" 
                              onClick={() => setActiveProposalCatDropdownId(activeProposalCatDropdownId === proposal.id ? null : proposal.id)} 
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border whitespace-nowrap ${hasSelectedCategory ? `${theme.bg} ${theme.text} ${theme.border}` : 'bg-amber-50 text-amber-800 border-amber-200 animate-pulse'}`}
                            >
                              <span>{proposal.category || '⚠️ 카테고리 선택'}</span>
                              <ChevronDown className="w-2.5 h-2.5 shrink-0" />
                            </button>
                            
                            {activeProposalCatDropdownId === proposal.id && (
                              <div className="absolute left-0 mt-1 w-36 bg-white border border-[#E9E9E6] rounded-md shadow-xl z-50 max-h-40 overflow-y-auto">
                                {categoryOrder.map((catName) => {
                                  const styling = categories[catName];
                                  if (!styling) return null;
                                  return (
                                    <button key={catName} type="button" onClick={() => handleUpdateProposalCategory(proposal.id, catName)} className="w-full px-2 py-1.5 text-left hover:bg-[#F7F7F5] flex items-center gap-1.5 border-b border-gray-50 last:border-0">
                                      <span className={`w-2 h-2 rounded-full ${styling.bg} border ${styling.border} shrink-0`}></span>
                                      <span className="text-[9px] font-semibold text-gray-700">{catName}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span 
                              className="text-[10px] text-gray-500 font-bold flex items-center gap-1 min-w-0"
                              title={proposal.endDate && proposal.endDate !== proposal.startDate ? `${proposal.startDate} ~ ${proposal.endDate}` : proposal.startDate}
                            >
                              <CalendarIcon className="w-3 h-3 text-gray-400 shrink-0" /> 
                              <span className="truncate">
                                {proposal.endDate && proposal.endDate !== proposal.startDate 
                                  ? `${proposal.startDate} ~ ${proposal.endDate}` 
                                  : proposal.startDate}
                              </span>
                            </span>
                            <button 
                              type="button" 
                              onClick={() => handleEditProposal(proposal)} 
                              className="shrink-0 flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-md transition-colors"
                              title="수정"
                            >
                              <Edit2 className="w-3 h-3" /> 수정
                            </button>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-[#37352F] break-all">{proposal.title}</h4>
                          <div className="grid grid-cols-1 gap-0.5 text-[10px] text-gray-500">
                            {proposal.startTime && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5 text-gray-400" /> {proposal.startTime}</span>}
                            {proposal.location && <span className="flex items-center gap-1 text-purple-700 font-medium"><MapPin className="w-2.5 h-2.5 text-purple-400" /> {proposal.location}</span>}
                          </div>
                        </div>
                        
                        <button 
                          type="button" 
                          onClick={() => handleAddSingleProposalCard(proposal.id)} 
                          className={`w-full py-1.5 rounded text-[10px] font-bold transition flex items-center justify-center gap-1 ${hasSelectedCategory ? 'bg-[#37352F] text-white hover:bg-black' : 'bg-gray-100 text-amber-800 border border-amber-200'}`}
                        >
                          <Plus className="w-3 h-3" /> <span>{hasSelectedCategory ? '캘린더에 바로 등록' : '카테고리 지정 필수'}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
          </aside>
        )}

        {activeSidePanel.includes('bookmark') && (
          <aside style={{ order: activeSidePanel.indexOf('bookmark') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="bookmark" />
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-blue-50 text-blue-700 rounded-lg"><Bookmark className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">자주 사용하는 URL</h3>
              </div>
            </div>
            
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1 scrollbar-none">
              {bookmarks.length > 0 ? (
                bookmarks.map(bookmark => {
                  let domain = ''; try { domain = new URL(bookmark.url).hostname; } catch (e) { domain = 'globe'; }
                  return (
                    <div key={bookmark.id} className="group/btn flex items-center justify-between bg-[#F7F7F5] border border-gray-100 rounded-lg p-2 hover:bg-white hover:border-blue-300 hover:shadow-2xs transition-all">
                      <a 
                        href={bookmark.url} 
                        onClick={(e) => handleOpenBookmarkUrl(e, bookmark.url)} 
                        className="text-xs font-bold text-gray-700 hover:text-blue-700 truncate flex-1 flex items-center gap-2 pr-2" 
                        title={bookmark.url}
                      >
                        <img 
                          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
                          alt="" 
                          onError={(e) => { e.target.style.display = 'none'; }} 
                          className="w-4 h-4 rounded-sm bg-white shrink-0 object-contain shadow-3xs" 
                        />
                        <span className="truncate">{bookmark.title}</span>
                      </a>
                      <button 
                        type="button" 
                        onClick={() => handleDeleteBookmark(bookmark.id)} 
                        className="opacity-0 group-hover/btn:opacity-100 p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-all shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              ) : ( 
                <p className="text-[11px] text-gray-400 italic text-center py-6 bg-gray-50/50 rounded-lg border border-dashed">등록된 사이트 링크가 없습니다.</p> 
              )}
            </div>
            
            <form onSubmit={handleAddBookmarkSubmit} className="pt-2 border-t border-gray-100 border-dashed space-y-2">
              <p className="text-[10px] font-black text-blue-800 bg-blue-50 px-2 py-0.5 inline-block rounded">🔗 링크 등록</p>
              <input type="text" placeholder="사이트 이름" value={newBookmarkTitle} onChange={(e) => setNewBookmarkTitle(e.target.value)} className="w-full py-2 px-2.5 border border-[#E9E9E6] rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <input type="text" placeholder="URL 주소" value={newBookmarkUrl} onChange={(e) => setNewBookmarkUrl(e.target.value)} className="w-full py-2 px-2.5 border border-[#E9E9E6] rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
              <button type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm">북마크 추가</button>
            </form>
          </div>
          </aside>
        )}

        {activeSidePanel.includes('salary') && (
          <aside style={{ order: activeSidePanel.indexOf('salary') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="salary" />
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-amber-50 text-amber-700 rounded-lg"><Wallet className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">오늘도 적립 중 💰</h3>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">내 호봉</label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="예: 15"
                  value={tempGradeInput || teacherGrade}
                  onChange={(e) => setTempGradeInput(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGrade(); }}
                  className="flex-1 p-2 border border-[#E9E9E6] rounded-md bg-[#F7F7F5] text-xs font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button onClick={handleSaveGrade} className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold">저장</button>
                {teacherGrade && (
                  <button onClick={handleClearGrade} className="px-3 py-2 border border-gray-200 text-gray-500 rounded-md text-xs font-bold hover:bg-gray-50">삭제</button>
                )}
              </div>
              <p className="text-[10px] text-gray-400 leading-snug">1~40호봉 사이로 입력하세요. 이 값은 이 컴퓨터에만 저장되고 다른 선생님과 공유되지 않습니다.</p>
            </div>

            <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
              {salaryStats ? (
                <div className="flex items-center gap-3" style={{ gap: '1.5rem' }}>
                  {/* 🔑 왼쪽: 급여기간 전체 근무일 게이지 (1일 = 1칸) */}
                  <svg width="28" height="120" viewBox="0 0 28 120" className="shrink-0">
                    <rect x="1" y="1" width="26" height="118" rx="6" fill="#FFFFFF" stroke="#FCD34D" strokeWidth="2" />
                    {Array.from({ length: salaryStats.workdayCount }).map((_, idx) => {
                      const segH = 110 / salaryStats.workdayCount;
                      const gap = Math.min(1.2, segH * 0.15);
                      const y = 114 - (idx + 1) * segH + gap / 2;
                      const fillLevel = Math.min(1, Math.max(0, (salaryStats.elapsedWorkHours - idx * 8) / 8));

                      if (fillLevel <= 0) {
                        return <rect key={idx} x="4" y={y} width="20" height={segH - gap} rx="1.2" fill="#FEF3C7" />;
                      }
                      if (fillLevel >= 1) {
                        return <rect key={idx} x="4" y={y} width="20" height={segH - gap} rx="1.2" fill="#F59E0B" />;
                      }
                      const partialH = (segH - gap) * fillLevel;
                      return (
                        <g key={idx}>
                          <rect x="4" y={y} width="20" height={segH - gap} rx="1.2" fill="#FEF3C7" />
                          <rect x="4" y={y + (segH - gap) - partialH} width="20" height={partialH} rx="1.2" fill="#FBBF24" />
                        </g>
                      );
                    })}
                  </svg>

                  {/* 🔑 오른쪽: 오늘 근무시간 게이지 (08:30~16:30, 1시간 = 1칸) */}
                  <svg width="16" height="120" viewBox="0 0 16 120" className="shrink-0">
                    <rect x="1" y="1" width="14" height="118" rx="5" fill="#FFFFFF" stroke="#FCD34D" strokeWidth="2" />
                    {Array.from({ length: 8 }).map((_, idx) => {
                      const segH = 110 / 8;
                      const gap = 1.3;
                      const y = 114 - (idx + 1) * segH + gap / 2;
                      const fillLevel = Math.min(1, Math.max(0, salaryStats.todayElapsed - idx));

                      if (fillLevel <= 0) {
                        return <rect key={idx} x="3" y={y} width="10" height={segH - gap} rx="1.3" fill="#FEF3C7" />;
                      }
                      if (fillLevel >= 1) {
                        return <rect key={idx} x="3" y={y} width="10" height={segH - gap} rx="1.3" fill="#F59E0B" />;
                      }
                      const partialH = (segH - gap) * fillLevel;
                      return (
                        <g key={idx}>
                          <rect x="3" y={y} width="10" height={segH - gap} rx="1.3" fill="#FEF3C7" />
                          <rect x="3" y={y + (segH - gap) - partialH} width="10" height={partialH} rx="1.3" fill="#FBBF24" />
                        </g>
                      );
                    })}
                  </svg>

                  <div className="min-w-0 flex-1 flex flex-col items-center justify-center text-center">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">이번 급여기간 누적</p>
                    <p className="text-2xl font-black text-amber-700 tabular-nums truncate">
                      {displayedEarned.toLocaleString()}원
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 py-4 text-center">호봉을 입력하면 실시간 누적 금액이 표시됩니다.</p>
              )}
            </div>

            <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-xl p-3 space-y-1 text-[10px] text-gray-500 leading-relaxed">
              <p className="font-bold text-gray-600 flex items-center gap-1"><Info className="w-3 h-3 text-amber-500 shrink-0" /> 계산 기준</p>
              <p>· 평일(월~금) 08:30~16:30 근무시간에만 누적됩니다.</p>
              <p>· 매달 17일에 급여기간이 자동으로 새로 시작됩니다.</p>
              <p>· 본봉(세전, 수당 제외) 기준의 재미용 참고 수치입니다.</p>
            </div>
          </div>
          </aside>
        )}

        {activeSidePanel.includes('gradeConv') && (
          <aside style={{ order: activeSidePanel.indexOf('gradeConv') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="gradeConv" />
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-rose-50 text-rose-700 rounded-lg"><Calculator className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">등급 환산 계산기</h3>
              </div>
            </div>

            {/* 🔑 5등급제 ↔ 9등급제 환산 계산기 (정방향/역방향 전환 가능) */}
            {(() => {
              const isForward = gradeConvMode === '5to9';
              const inputVal = parseFloat(gradeConvInput);
              const range = isForward ? [1, 5] : [1, 9];
              const isValid = !isNaN(inputVal) && inputVal >= range[0] && inputVal <= range[1];
              const result = isValid ? (isForward ? convertGrade5to9(inputVal) : convertGrade9to5(inputVal)) : null;

              const switchMode = (mode) => {
                setGradeConvMode(mode);
                setGradeConvInput(mode === '5to9' ? '3.00' : '5.00'); // 🔑 전환 시 기본값도 그 범위에 맞게 초기화
              };

              return (
                <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button" onClick={() => switchMode('5to9')}
                      className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors border ${isForward ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-gray-500 border-[#E9E9E6] hover:bg-gray-50'}`}
                    >
                      5등급제 → 9등급제
                    </button>
                    <button
                      type="button" onClick={() => switchMode('9to5')}
                      className={`flex-1 py-1.5 rounded-md text-xs font-bold transition-colors border ${!isForward ? 'bg-rose-700 text-white border-rose-700' : 'bg-white text-gray-500 border-[#E9E9E6] hover:bg-gray-50'}`}
                    >
                      9등급제 → 5등급제
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="number" step="0.01" min={range[0]} max={range[1]}
                      value={gradeConvInput}
                      onChange={(e) => setGradeConvInput(e.target.value)}
                      placeholder={`${range[0].toFixed(2)} ~ ${range[1].toFixed(2)}`}
                      className="w-24 p-2 border border-[#E9E9E6] rounded-md bg-white text-sm font-bold text-center focus:outline-none focus:ring-1 focus:ring-rose-400"
                    />
                    <span className="text-xs text-gray-400">등급 ({isForward ? '5등급제' : '9등급제'})</span>
                  </div>

                  {result ? (
                    <div className="flex items-center gap-2 bg-white border border-[#E9E9E6] rounded-md px-3 py-2">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">환산 등급 ({isForward ? '9등급제' : '5등급제'})</p>
                        <p className="text-lg font-black text-rose-700">{(isForward ? result.g9 : result.g5).toFixed(2)}</p>
                      </div>
                      <div className="w-px h-8 bg-[#E9E9E6]"></div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">누적 백분위</p>
                        <p className="text-lg font-black text-gray-700">{result.pct.toFixed(2)}%</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[11px] text-gray-400 text-center py-1.5">{range[0].toFixed(2)} ~ {range[1].toFixed(2)} 사이 값을 입력해주세요.</p>
                  )}
                </div>
              );
            })()}
          </div>
          </aside>
        )}

        {activeSidePanel.includes('tools') && (
          <aside style={{ order: activeSidePanel.indexOf('tools') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="tools" />
          <div className="space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
              <div className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg"><Link2 className="w-4 h-4" /></div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700">공유 도구함</h3>
              </div>
            </div>

            <div className="space-y-2">
              {usefulLinks.length === 0 && !isLinkFormOpen && (
                <p className="text-xs text-gray-400 text-center py-6 bg-gray-50/50 rounded-lg border border-dashed">등록된 링크가 없습니다.</p>
              )}
              {usefulLinks.map((link) => (
                <div key={link.id} className="group flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => window.electronAPI?.openExternal ? window.electronAPI.openExternal(link.url) : window.open(link.url, '_blank')}
                    className="flex-1 min-w-0 flex items-center justify-between p-2.5 bg-[#F7F7F5] hover:bg-gray-100 rounded-lg border border-[#E9E9E6] text-left transition"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-700 truncate">{link.title}</p>
                      {link.description && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{link.description}</p>}
                    </div>
                    <span className="text-gray-300 text-[10px] shrink-0 ml-2">열기 ↗</span>
                  </button>
                  <button type="button" onClick={() => handleStartEditLink(link)} className="p-1.5 text-gray-300 hover:text-gray-700 hover:bg-gray-100 rounded shrink-0" title="수정"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button type="button" onClick={() => handleDeleteUsefulLink(link.id)} className="p-1.5 text-gray-300 hover:text-rose-600 hover:bg-rose-50 rounded shrink-0" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>

            {isLinkFormOpen ? (
              <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg p-3 space-y-2">
                <input type="text" placeholder="제목 (예: 선택교과 좌석표 만들기)" value={linkFormTitle} onChange={(e) => setLinkFormTitle(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none" />
                <input type="text" placeholder="설명 (선택)" value={linkFormDesc} onChange={(e) => setLinkFormDesc(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none" />
                <input type="text" placeholder="링크 주소 (https://...)" value={linkFormUrl} onChange={(e) => setLinkFormUrl(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none" />
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setIsLinkFormOpen(false)} className="flex-1 py-1.5 border border-[#E9E9E6] text-gray-600 rounded text-xs font-bold">취소</button>
                  <button type="button" onClick={handleSaveUsefulLink} className="flex-1 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded text-xs font-bold">{editingLinkId ? '수정 완료' : '등록'}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={handleStartNewLink} className="w-full py-2 border border-dashed border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded-lg text-xs font-bold flex items-center justify-center gap-1">
                <Plus className="w-3.5 h-3.5" /> 새 링크 추가
              </button>
            )}
          </div>
          </aside>
        )}

        {/* ==================== 공유 메모장 패널 ==================== */}
        {activeSidePanel.includes('memo') && (
          <aside style={{ order: activeSidePanel.indexOf('memo') }} className="w-full bg-white border border-[#E9E9E6] rounded-xl shadow-sm p-4 relative min-w-0 h-fit animate-in fade-in slide-in-from-top-2 duration-200 text-xs">
            <PanelCloseButton panelName="memo" />
            <div className="space-y-4">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-2 pr-6">
                <div className="p-1.5 bg-yellow-50 text-yellow-700 rounded-lg shrink-0"><StickyNote className="w-4 h-4" /></div>
                <h3 className="text-xs font-black uppercase tracking-wider text-gray-700 flex-1">공유 메모장</h3>
              </div>

              {isMemoFormOpen && (
                <div className="bg-[#F7F7F5] border border-[#E9E9E6] rounded-lg p-3 space-y-2">
                  <input type="text" placeholder="제목" value={memoFormTitle} onChange={(e) => setMemoFormTitle(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none" />
                  <textarea placeholder="내용 (선택)" rows={3} value={memoFormContent} onChange={(e) => setMemoFormContent(e.target.value)} className="w-full p-2 border border-[#E9E9E6] rounded text-xs bg-white focus:outline-none resize-none" />
                  <div className="flex items-center gap-1.5">
                    {Object.entries(POST_IT_COLORS).map(([key, c]) => (
                      <button
                        key={key} type="button" onClick={() => setMemoFormColor(key)}
                        className={`w-5 h-5 rounded-full border-2 ${c.bg} ${memoFormColor === key ? 'border-gray-700' : 'border-white'}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setIsMemoFormOpen(false)} className="flex-1 py-1.5 border border-[#E9E9E6] text-gray-600 rounded text-xs font-bold">취소</button>
                    <button type="button" onClick={handleSaveMemo} className="flex-1 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs font-bold">{editingMemoId ? '수정 완료' : '등록'}</button>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                {sharedMemos.length === 0 && !isMemoFormOpen && (
                  <div
                    onClick={handleStartNewMemo}
                    className="flex items-center justify-center gap-1.5 py-6 bg-yellow-50/40 border border-dashed border-yellow-300 rounded-md cursor-pointer hover:bg-yellow-50 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-yellow-600" />
                    <p className="text-xs font-bold text-yellow-700">첫 메모를 추가해 보세요</p>
                  </div>
                )}
                {sharedMemos.map((memo) => {
                  const isExpanded = expandedMemoIds.has(memo.id);
                  const colorSet = POST_IT_COLORS[memo.color] || POST_IT_COLORS.yellow;
                  const showEditIcon = titleHoverMemoId === memo.id;
                  return (
                    <div
                      key={memo.id}
                      draggable
                      onDragStart={() => setDraggedMemoId(memo.id)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleMemoDrop(memo.id)}
                      onDragEnd={() => setDraggedMemoId(null)}
                      className={`relative ${colorSet.bg} border ${colorSet.border} rounded-md p-2.5 shadow-sm cursor-grab active:cursor-grabbing transition-all ${draggedMemoId === memo.id ? 'opacity-40' : 'opacity-100'}`}
                    >
                      <div className="flex items-center gap-1.5">
                        {/* 🔑 왼쪽: 새 메모 추가 */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleStartNewMemo(); }}
                          className="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-white/60 rounded shrink-0"
                          title="새 메모 추가"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>

                        {/* 🔑 가운데: 제목 (클릭하면 연필 아이콘 노출) */}
                        <div
                          className="flex-1 min-w-0 flex items-center gap-1 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setTitleHoverMemoId(titleHoverMemoId === memo.id ? null : memo.id); }}
                        >
                          <p className="text-xs font-bold text-gray-800 leading-snug wrap-break-word flex-1">{memo.title}</p>
                          {showEditIcon && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleStartEditMemo(memo); setTitleHoverMemoId(null); }}
                              className="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-white/60 rounded shrink-0"
                              title="수정"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* 🔑 오른쪽: 펼치기/접기 화살표 → X 삭제 */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); toggleMemoExpand(memo.id); }}
                          className="p-0.5 text-gray-500 hover:text-gray-800 hover:bg-white/60 rounded shrink-0"
                          title={isExpanded ? "접기" : "펼치기"}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteMemo(memo.id); }}
                          className="p-0.5 text-gray-500 hover:text-rose-600 hover:bg-white/60 rounded shrink-0"
                          title="삭제"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {isExpanded && memo.content && (
                        <p className="text-[11px] text-gray-700 mt-1.5 pl-6 whitespace-pre-wrap leading-relaxed wrap-break-word">{memo.content}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

    </div>
  );
});