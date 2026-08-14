import { describe, expect, it } from 'vitest'
import { readSupabaseConfig } from './supabase'

describe('Supabase environment configuration', () => {
  it('accepts only an https Supabase base URL and a publishable key', () => {
    expect(readSupabaseConfig({
      VITE_SUPABASE_URL: 'https://fixture.supabase.co/',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_fixture',
    })).toEqual({ url: 'https://fixture.supabase.co', publishableKey: 'sb_publishable_fixture' })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://fixture.supabase.co' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://example.com', VITE_SUPABASE_PUBLISHABLE_KEY: 'fixture' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_fixture' })).toBeNull()
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'https://fixture.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'service-role-jwt' })).toBeNull()
  })
})
