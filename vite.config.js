import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' // <-- 최신 v4 전용 플러그인 로드

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // <-- 빌드 파이프라인에 주입
  ],
  base: './',
})