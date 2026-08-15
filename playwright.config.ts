import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: ['learning.spec.ts', 'sequence-learning.spec.ts', 'cloud-sync.spec.ts', 'group-cloud-sync.spec.ts', 'voice-dictation.spec.ts'],
  use: { baseURL: 'http://127.0.0.1:4174', headless: true },
  webServer: {
    command: 'npx cross-env VITE_SUPABASE_URL=https://fixture.supabase.co VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_fixture npm run dev -- --host 127.0.0.1 --port 4174',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
  },
})
