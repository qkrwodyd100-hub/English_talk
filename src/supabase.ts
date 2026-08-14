import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export type SupabaseConfig = { url: string; publishableKey: string }

export function readSupabaseConfig(env: Record<string, unknown>): SupabaseConfig | null {
  const rawUrl = typeof env.VITE_SUPABASE_URL === 'string' ? env.VITE_SUPABASE_URL.trim() : ''
  const publishableKey = typeof env.VITE_SUPABASE_PUBLISHABLE_KEY === 'string' ? env.VITE_SUPABASE_PUBLISHABLE_KEY.trim() : ''
  if (!rawUrl || !publishableKey.startsWith('sb_publishable_')) return null
  try {
    const url = new URL(rawUrl)
    if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') || url.pathname !== '/') return null
    return { url: url.origin, publishableKey }
  } catch {
    return null
  }
}

export const supabaseConfig = readSupabaseConfig(import.meta.env)
export const supabase: SupabaseClient | null = supabaseConfig
  ? createClient(supabaseConfig.url, supabaseConfig.publishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
