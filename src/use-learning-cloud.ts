import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  LEARNING_STORAGE_KEY,
  LEARNING_STORAGE_VERSION,
  createEmptyLearningState,
  isPersistableLearningPayload,
  parseLearningState,
  type LearningState,
} from './learning'
import {
  hasMeaningfulLearningState,
  isCurrentAuthOperation,
  mergeCustomSentences,
  parseCloudLearningState,
  reconcileLearningProfiles,
  rebaseLearningState,
  shouldReplaceCloudProfile,
  type LearningProfile,
  type LearningProfileRow,
} from './learning-cloud'
import { supabase } from './supabase'

const PRE_AUTH_STORAGE_KEY = `${LEARNING_STORAGE_KEY}.pre-auth`
const SYNC_META_STORAGE_KEY = `${LEARNING_STORAGE_KEY}.sync-meta`
const SYNC_DELAY_MS = 700

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error'
type SyncMeta = { userId: string; revision: number; updatedAt: string; baseState: LearningState }

function readSyncMeta(userId: string): SyncMeta | null {
  try {
    const value = JSON.parse(localStorage.getItem(SYNC_META_STORAGE_KEY) ?? 'null') as SyncMeta | null
    const baseState = value && parseCloudLearningState(value.baseState)
    return value?.userId === userId && Number.isInteger(value.revision) && !Number.isNaN(Date.parse(value.updatedAt)) && baseState ? { ...value, baseState } : null
  } catch {
    return null
  }
}

function writeSyncMeta(value: SyncMeta) {
  localStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(value))
}

export function useLearningCloud(state: LearningState, applyState: (next: LearningState) => void) {
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SyncStatus>('local')
  const [message, setMessage] = useState(supabase ? '로그인하면 기기 간 학습 기록을 동기화할 수 있어요.' : 'Supabase 설정이 없어 이 기기에만 저장됩니다.')
  const stateRef = useRef(state)
  const readyUserId = useRef<string | null>(null)
  const activeSyncUserId = useRef<string | null>(null)
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCloudHash = useRef('')
  const preAuthRestored = useRef(false)
  const authGeneration = useRef(0)
  const currentUserId = useRef<string | null>(null)
  const baseCloudState = useRef<LearningState>(createEmptyLearningState())
  const lastUploadSucceeded = useRef(false)
  stateRef.current = state

  const restorePreAuthState = useCallback(() => {
    if (preAuthRestored.current) return
    preAuthRestored.current = true
    const backup = localStorage.getItem(PRE_AUTH_STORAGE_KEY)
    const restored = isPersistableLearningPayload(backup) ? parseLearningState(backup) : createEmptyLearningState()
    localStorage.removeItem(PRE_AUTH_STORAGE_KEY)
    stateRef.current = restored
    applyState(restored)
  }, [applyState])

  const upload = useCallback(async (userId: string, next: LearningState, attempt = 0) => {
    if (!supabase || readyUserId.current !== userId) return
    lastUploadSucceeded.current = false
    const generation = authGeneration.current
    const isCurrent = () => isCurrentAuthOperation(generation, authGeneration.current, userId, currentUserId.current) && readyUserId.current === userId
    setStatus('syncing')
    setMessage('동기화 중…')
    const { data: current, error: readError } = await supabase
      .from('learning_profiles')
      .select('user_id,learning_state,revision,updated_at')
      .eq('user_id', userId)
      .maybeSingle<LearningProfileRow>()
    if (!isCurrent()) return
    if (readError) {
      setStatus('error')
      setMessage('동기화에 실패했습니다. 이 기기에는 저장됐습니다. 다시 시도해 주세요.')
      return
    }

    let written = next
    let revision = 1
    let updatedAt = new Date().toISOString()
    if (!current) {
      if (!hasMeaningfulLearningState(next)) { lastUploadSucceeded.current = true; setStatus('synced'); setMessage('동기화됨'); return }
      const { data: inserted, error } = await supabase.from('learning_profiles').upsert(
        { user_id: userId, learning_state: next },
        { onConflict: 'user_id', ignoreDuplicates: true },
      ).select('user_id,learning_state,revision,updated_at').maybeSingle<LearningProfileRow>()
      if (!isCurrent()) return
      if (error) {
        if (attempt < 1) { await upload(userId, next, attempt + 1); return }
        setStatus('error'); setMessage('동기화에 실패했습니다. 이 기기에는 저장됐습니다. 다시 시도해 주세요.'); return
      }
      if (!inserted) {
        if (attempt < 1) { await upload(userId, next, attempt + 1); return }
        setStatus('error'); setMessage('다른 기기의 변경과 충돌했습니다. 최신 기록을 다시 읽어 주세요.'); return
      }
      revision = inserted.revision
      updatedAt = inserted.updated_at
    } else {
      const cloudState = parseCloudLearningState(current.learning_state)
      if (!cloudState) { setStatus('error'); setMessage('클라우드 기록 형식이 올바르지 않아 덮어쓰지 않았습니다.'); return }
      written = rebaseLearningState(baseCloudState.current, next, cloudState)
      const { data: updated, error } = await supabase
        .from('learning_profiles')
        .update({ learning_state: written })
        .eq('user_id', userId)
        .eq('revision', current.revision)
        .select('user_id,learning_state,revision,updated_at')
        .maybeSingle<LearningProfileRow>()
      if (!isCurrent()) return
      if (error) { setStatus('error'); setMessage('동기화에 실패했습니다. 이 기기에는 저장됐습니다. 다시 시도해 주세요.'); return }
      if (!updated) {
        if (attempt < 1) { await upload(userId, next, attempt + 1); return }
        setStatus('error')
        setMessage('다른 기기의 변경과 충돌했습니다. 최신 기록을 다시 읽어 주세요.')
        return
      }
      revision = updated.revision
      updatedAt = updated.updated_at
    }
    writeSyncMeta({ userId, revision, updatedAt, baseState: written })
    baseCloudState.current = written
    lastCloudHash.current = JSON.stringify(written)
    const latest = stateRef.current
    const localAfterWrite = JSON.stringify(latest) === JSON.stringify(next) ? written : rebaseLearningState(next, latest, written)
    if (JSON.stringify(latest) !== JSON.stringify(localAfterWrite)) {
      stateRef.current = localAfterWrite
      applyState(localAfterWrite)
    }
    lastUploadSucceeded.current = true
    setStatus('synced')
    setMessage('동기화됨')
  }, [applyState])

  const synchronize = useCallback(async (nextUser: User) => {
    if (!supabase || activeSyncUserId.current === nextUser.id) return
    if (currentUserId.current && currentUserId.current !== nextUser.id) {
      authGeneration.current += 1
      readyUserId.current = null
      activeSyncUserId.current = null
      restorePreAuthState()
      preAuthRestored.current = false
    }
    const generation = authGeneration.current + 1
    authGeneration.current = generation
    currentUserId.current = nextUser.id
    activeSyncUserId.current = nextUser.id
    preAuthRestored.current = false
    readyUserId.current = null
    setUser(nextUser)
    setStatus('syncing')
    setMessage('동기화 중…')

    const localRaw = localStorage.getItem(LEARNING_STORAGE_KEY)
    if (localStorage.getItem(PRE_AUTH_STORAGE_KEY) === null && isPersistableLearningPayload(localRaw)) {
      localStorage.setItem(PRE_AUTH_STORAGE_KEY, localRaw ?? JSON.stringify({ version: LEARNING_STORAGE_VERSION, state: createEmptyLearningState() }))
    }

    const { data, error } = await supabase
      .from('learning_profiles')
      .select('user_id,learning_state,revision,updated_at')
      .eq('user_id', nextUser.id)
      .maybeSingle<LearningProfileRow>()
    if (authGeneration.current !== generation || currentUserId.current !== nextUser.id) return

    if (error) {
      activeSyncUserId.current = null
      setStatus('error')
      setMessage('클라우드 기록을 읽지 못했습니다. 이 기기의 기록은 유지됩니다. 다시 시도해 주세요.')
      return
    }

    const local = stateRef.current
    if (!data) {
      baseCloudState.current = createEmptyLearningState()
      readyUserId.current = nextUser.id
      activeSyncUserId.current = null
      if (hasMeaningfulLearningState(local)) await upload(nextUser.id, local)
      else { setStatus('synced'); setMessage('동기화됨') }
      return
    }

    const cloudState = parseCloudLearningState(data.learning_state)
    if (!cloudState) {
      activeSyncUserId.current = null
      setStatus('error')
      setMessage('클라우드 기록 형식이 올바르지 않아 덮어쓰지 않았습니다. 이 기기의 기록은 유지됩니다.')
      return
    }

    const meta = readSyncMeta(nextUser.id)
    const localProfile: LearningProfile = {
      learningState: local,
      revision: meta?.revision ?? 0,
      updatedAt: meta?.updatedAt ?? '1970-01-01T00:00:00.000Z',
    }
    const cloudProfile: LearningProfile = {
      learningState: cloudState,
      revision: data.revision,
      updatedAt: data.updated_at,
    }
    const merged = reconcileLearningProfiles(localProfile, cloudProfile)
    if (meta) merged.learningState = rebaseLearningState(meta.baseState, local, cloudState)
    else merged.learningState.customSentences = mergeCustomSentences([], local.customSentences, cloudState.customSentences)
    baseCloudState.current = cloudState
    lastCloudHash.current = JSON.stringify(merged.learningState)
    writeSyncMeta({ userId: nextUser.id, revision: data.revision, updatedAt: data.updated_at, baseState: cloudState })
    applyState(merged.learningState)
    readyUserId.current = nextUser.id
    activeSyncUserId.current = null
    if (shouldReplaceCloudProfile(merged.learningState, cloudState)) await upload(nextUser.id, merged.learningState)
    else { setStatus('synced'); setMessage('동기화됨') }
  }, [applyState, restorePreAuthState, upload])

  useEffect(() => {
    if (!supabase) return
    let disposed = false
    void supabase.auth.getSession().then(({ data }) => {
      if (!disposed && data.session?.user) void synchronize(data.session.user)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return
      if (session?.user) void synchronize(session.user)
      else if (currentUserId.current || readyUserId.current || activeSyncUserId.current) {
        authGeneration.current += 1
        currentUserId.current = null
        readyUserId.current = null
        activeSyncUserId.current = null
        setUser(null)
        restorePreAuthState()
        setStatus('local')
        setMessage('로그아웃했습니다. 로그인 전 이 기기의 기록으로 돌아왔습니다.')
      }
    })
    return () => { disposed = true; data.subscription.unsubscribe() }
  }, [restorePreAuthState, synchronize])

  useEffect(() => {
    const userId = readyUserId.current
    if (!userId || JSON.stringify(state) === lastCloudHash.current) return
    if (uploadTimer.current) clearTimeout(uploadTimer.current)
    setStatus('syncing')
    setMessage('동기화 중…')
    uploadTimer.current = setTimeout(() => { void upload(userId, state) }, SYNC_DELAY_MS)
    return () => { if (uploadTimer.current) clearTimeout(uploadTimer.current) }
  }, [state, upload])

  const signIn = useCallback(async (email: string) => {
    if (!supabase) return 'Supabase 설정이 없어 로그인할 수 없습니다.'
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (error) return '로그인 링크를 보내지 못했습니다. 이메일을 확인하고 다시 시도해 주세요.'
    return '로그인 링크를 보냈습니다. 이메일을 확인해 주세요.'
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    const logoutUserId = currentUserId.current
    if (uploadTimer.current) clearTimeout(uploadTimer.current)
    if (logoutUserId && readyUserId.current === logoutUserId && JSON.stringify(stateRef.current) !== lastCloudHash.current) {
      await upload(logoutUserId, stateRef.current)
      if (!lastUploadSucceeded.current) {
        setStatus('error')
        setMessage('마지막 변경을 동기화하지 못해 로그아웃을 취소했습니다. 다시 시도해 주세요.')
        return
      }
    }
    const generation = authGeneration.current + 1
    authGeneration.current = generation
    currentUserId.current = null
    readyUserId.current = null
    activeSyncUserId.current = null
    const { error } = await supabase.auth.signOut()
    if (!isCurrentAuthOperation(generation, authGeneration.current, null, currentUserId.current)) return
    if (error) {
      setStatus('error')
      setMessage('로그아웃하지 못했습니다. 다시 시도해 주세요.')
      if (user) { preAuthRestored.current = false; void synchronize(user) }
      return
    }
    setUser(null)
    restorePreAuthState()
    setStatus('local')
    setMessage('로그아웃했습니다. 로그인 전 이 기기의 기록으로 돌아왔습니다.')
  }, [restorePreAuthState, synchronize, upload, user])

  const retry = useCallback(() => {
    if (user) { activeSyncUserId.current = null; void synchronize(user) }
  }, [synchronize, user])

  return { user, status, message, configured: Boolean(supabase), signIn, signOut, retry }
}
