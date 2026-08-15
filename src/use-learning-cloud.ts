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
  type LearningGroupMemberRow,
  type LearningGroupProfileRow,
  type LearningProfile,
} from './learning-cloud'
import { supabase } from './supabase'

const PRE_AUTH_STORAGE_KEY = `${LEARNING_STORAGE_KEY}.pre-auth`
const LEARNING_BACKUP_STORAGE_KEY = `${LEARNING_STORAGE_KEY}.backup`
const SYNC_META_STORAGE_KEY = `${LEARNING_STORAGE_KEY}.sync-meta`
const PENDING_STORAGE_PREFIX = `${LEARNING_STORAGE_KEY}.pending.`
const SYNC_DELAY_MS = 700

type SyncStatus = 'local' | 'syncing' | 'synced' | 'error'
type SyncMeta = { userId: string; revision: number; updatedAt: string; baseState: LearningState }
type PendingLearningState = { state: LearningState; baseState: LearningState }

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

function readSyncMetaOwner() {
  try {
    const value = JSON.parse(localStorage.getItem(SYNC_META_STORAGE_KEY) ?? 'null') as { userId?: unknown } | null
    return typeof value?.userId === 'string' ? value.userId : null
  } catch {
    return null
  }
}

function pendingStorageKey(userId: string) {
  return `${PENDING_STORAGE_PREFIX}${userId}`
}

function readPendingState(userId: string): PendingLearningState | null {
  try {
    const value = JSON.parse(localStorage.getItem(pendingStorageKey(userId)) ?? 'null') as { state?: unknown; baseState?: unknown } | null
    const state = value && parseCloudLearningState(value.state)
    const baseState = value && parseCloudLearningState(value.baseState)
    return state && baseState ? { state, baseState } : null
  } catch {
    return null
  }
}

function writePendingState(userId: string, state: LearningState, baseState: LearningState) {
  localStorage.setItem(pendingStorageKey(userId), JSON.stringify({ state, baseState }))
}

export function useLearningCloud(state: LearningState, applyState: (next: LearningState) => void) {
  const [initialized, setInitialized] = useState(!supabase)
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<SyncStatus>('local')
  const [message, setMessage] = useState(supabase ? '이 기기에만 저장됨—다른 기기와 공유되지 않음. 로그인하면 클라우드 동기화를 사용할 수 있어요.' : 'Supabase 설정이 없어 이 기기에만 저장됩니다.')
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<Date | null>(null)
  const stateRef = useRef(state)
  const readyUserId = useRef<string | null>(null)
  const activeSyncUserId = useRef<string | null>(null)
  const uploadTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastCloudHash = useRef('')
  const preAuthRestored = useRef(false)
  const authGeneration = useRef(0)
  const currentUserId = useRef<string | null>(null)
  const currentGroupId = useRef<string | null>(null)
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
    localStorage.removeItem(LEARNING_BACKUP_STORAGE_KEY)
  }, [applyState])

  const upload = useCallback(async (userId: string, next: LearningState, attempt = 0) => {
    const groupId = currentGroupId.current
    if (!supabase || !groupId || readyUserId.current !== userId) return
    lastUploadSucceeded.current = false
    const generation = authGeneration.current
    const isCurrent = () => isCurrentAuthOperation(generation, authGeneration.current, userId, currentUserId.current) && readyUserId.current === userId
    setStatus('syncing')
    setMessage('동기화 중…')
    const { data: current, error: readError } = await supabase
      .from('learning_group_profiles')
      .select('group_id,learning_state,revision,updated_at')
      .eq('group_id', groupId)
      .maybeSingle<LearningGroupProfileRow>()
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
      if (!hasMeaningfulLearningState(next)) { lastUploadSucceeded.current = true; setStatus('synced'); setMessage('클라우드 동기화됨'); setLastSuccessfulAt(new Date()); return }
      const { data: inserted, error } = await supabase.from('learning_group_profiles').upsert(
        { group_id: groupId, learning_state: next },
        { onConflict: 'group_id', ignoreDuplicates: true },
      ).select('group_id,learning_state,revision,updated_at').maybeSingle<LearningGroupProfileRow>()
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
      const { data: updatedRows, error } = await supabase
        .rpc('update_learning_group_profile', {
          target_group_id: groupId,
          expected_revision: current.revision,
          next_learning_state: written,
        })
        .returns<LearningGroupProfileRow[]>()
      const updated = Array.isArray(updatedRows) ? updatedRows[0] ?? null : null
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
    localStorage.removeItem(pendingStorageKey(userId))
    setStatus('synced')
    setMessage('클라우드 동기화됨')
    setLastSuccessfulAt(new Date())
  }, [applyState])

  const synchronize = useCallback(async (nextUser: User) => {
    if (!supabase || activeSyncUserId.current === nextUser.id) return
    const previousUserId = currentUserId.current ?? readSyncMetaOwner()
    if (previousUserId && previousUserId !== nextUser.id) {
      const previousMeta = readSyncMeta(previousUserId)
      const previousBase = previousMeta?.baseState ?? baseCloudState.current
      if (JSON.stringify(stateRef.current) !== JSON.stringify(previousBase)) {
        writePendingState(previousUserId, stateRef.current, previousBase)
      }
      authGeneration.current += 1
      readyUserId.current = null
      activeSyncUserId.current = null
      currentGroupId.current = null
      localStorage.removeItem(SYNC_META_STORAGE_KEY)
      lastCloudHash.current = ''
      baseCloudState.current = createEmptyLearningState()
      setLastSuccessfulAt(null)
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

    const { data: membership, error: membershipError } = await supabase
      .from('learning_group_members')
      .select('group_id,user_id')
      .eq('user_id', nextUser.id)
      .maybeSingle<LearningGroupMemberRow>()
    if (authGeneration.current !== generation || currentUserId.current !== nextUser.id) return
    if (membershipError) {
      activeSyncUserId.current = null
      setStatus('error')
      setMessage('공유 그룹 정보를 읽지 못했습니다. 네트워크 또는 접근 권한을 확인하고 다시 시도해 주세요.')
      return
    }
    if (!membership) {
      activeSyncUserId.current = null
      currentGroupId.current = null
      setStatus('error')
      setMessage('공유 그룹에 등록되지 않은 계정입니다. 이 기기의 기록은 유지되며 클라우드에는 접근하지 않았습니다.')
      return
    }
    currentGroupId.current = membership.group_id

    const { data, error } = await supabase
      .from('learning_group_profiles')
      .select('group_id,learning_state,revision,updated_at')
      .eq('group_id', membership.group_id)
      .maybeSingle<LearningGroupProfileRow>()
    if (authGeneration.current !== generation || currentUserId.current !== nextUser.id) return
    if (error) {
      activeSyncUserId.current = null
      setStatus('error')
      setMessage('클라우드 기록을 읽지 못했습니다. 네트워크 또는 그룹 접근 권한을 확인하고 다시 시도해 주세요.')
      return
    }

    const pending = readPendingState(nextUser.id)
    const local = pending?.state ?? stateRef.current
    if (!data) {
      baseCloudState.current = createEmptyLearningState()
      readyUserId.current = nextUser.id
      activeSyncUserId.current = null
      if (hasMeaningfulLearningState(local)) await upload(nextUser.id, local)
      else { localStorage.removeItem(pendingStorageKey(nextUser.id)); setStatus('synced'); setMessage('클라우드 동기화됨'); setLastSuccessfulAt(new Date()) }
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
    if (pending) merged.learningState = rebaseLearningState(pending.baseState, pending.state, cloudState)
    else if (meta) merged.learningState = rebaseLearningState(meta.baseState, local, cloudState)
    else merged.learningState.customSentences = mergeCustomSentences([], local.customSentences, cloudState.customSentences)
    baseCloudState.current = cloudState
    lastCloudHash.current = JSON.stringify(merged.learningState)
    writeSyncMeta({ userId: nextUser.id, revision: data.revision, updatedAt: data.updated_at, baseState: cloudState })
    applyState(merged.learningState)
    readyUserId.current = nextUser.id
    activeSyncUserId.current = null
    if (shouldReplaceCloudProfile(merged.learningState, cloudState)) await upload(nextUser.id, merged.learningState)
    else { localStorage.removeItem(pendingStorageKey(nextUser.id)); setStatus('synced'); setMessage('클라우드 동기화됨'); setLastSuccessfulAt(new Date()) }
  }, [applyState, restorePreAuthState, upload])

  useEffect(() => {
    if (!supabase) return
    let disposed = false
    void (async () => {
      try {
        const { data } = await supabase.auth.getSession()
        if (disposed) return
        if (data.session?.user) await synchronize(data.session.user)
        else if (localStorage.getItem(PRE_AUTH_STORAGE_KEY) !== null) restorePreAuthState()
      } finally {
        if (!disposed) setInitialized(true)
      }
    })()
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (disposed) return
      if (session?.user) void synchronize(session.user)
      else if (currentUserId.current || readyUserId.current || activeSyncUserId.current || localStorage.getItem(PRE_AUTH_STORAGE_KEY) !== null) {
        authGeneration.current += 1
        currentUserId.current = null
        currentGroupId.current = null
        readyUserId.current = null
        activeSyncUserId.current = null
        setUser(null)
        localStorage.removeItem(SYNC_META_STORAGE_KEY)
        lastCloudHash.current = ''
        baseCloudState.current = createEmptyLearningState()
        setLastSuccessfulAt(null)
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

  const synchronizeNow = useCallback(() => {
    if (!user) return
    activeSyncUserId.current = null
    void synchronize(user)
  }, [synchronize, user])

  useEffect(() => {
    if (!user) return
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') synchronizeNow()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [synchronizeNow, user])

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
    currentGroupId.current = null
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
    localStorage.removeItem(SYNC_META_STORAGE_KEY)
    lastCloudHash.current = ''
    baseCloudState.current = createEmptyLearningState()
    setLastSuccessfulAt(null)
    restorePreAuthState()
    setStatus('local')
    setMessage('로그아웃했습니다. 로그인 전 이 기기의 기록으로 돌아왔습니다.')
  }, [restorePreAuthState, synchronize, upload, user])

  const retry = useCallback(() => {
    if (user) { activeSyncUserId.current = null; void synchronize(user) }
  }, [synchronize, user])

  return { initialized, user, status, message, lastSuccessfulAt, configured: Boolean(supabase), signIn, signOut, retry, synchronizeNow }
}
