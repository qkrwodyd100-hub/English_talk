import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['listening.spec.ts', 'voice-dictation.spec.ts', 'mobile-viewport.spec.ts', 'day61-75.spec.ts'],
  use: { baseURL: 'https://english-talk-git-issue-7-day61-75-qkrwodyd100-9567s-projects.vercel.app', headless: true },
})
