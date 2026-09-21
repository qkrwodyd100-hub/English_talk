import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['mobile-viewport.spec.ts'],
  use: { baseURL: 'http://127.0.0.1:4175', headless: true },
  webServer: {
    command: 'npx cross-env VITE_SUPABASE_URL=https://fixture.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture npm run dev -- --host 127.0.0.1 --port 4175',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    cwd: '.',
  },
})
