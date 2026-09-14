export type AuthAction = 'login' | 'signup' | 'reset' | 'password'
export type AuthResult = { ok: boolean; message: string }

type AuthErrorLike = { code?: unknown; message?: unknown; status?: unknown }

function readError(error: unknown): AuthErrorLike {
  return error && typeof error === 'object' ? error as AuthErrorLike : {}
}

export function validateNewPassword(password: string, confirmation: string) {
  if (password.length < 8) return '비밀번호는 8자 이상이어야 합니다.'
  if (password !== confirmation) return '비밀번호 확인이 일치하지 않습니다.'
  return null
}

export function isPasswordRecoveryEvent(event: string) {
  return event === 'PASSWORD_RECOVERY'
}

export function mapAuthError(error: unknown, action: AuthAction) {
  const value = readError(error)
  const code = typeof value.code === 'string' ? value.code.toLowerCase() : ''
  const message = typeof value.message === 'string' ? value.message.toLowerCase() : ''
  if (error instanceof TypeError || message.includes('failed to fetch') || message.includes('network')) {
    return '네트워크 연결을 확인하고 다시 시도해 주세요.'
  }
  if (value.status === 429 || code.includes('rate_limit') || message.includes('rate limit')) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
  }
  if (code === 'weak_password' || message.includes('at least') || message.includes('weak password')) {
    return '비밀번호는 8자 이상이어야 합니다.'
  }
  if (code === 'same_password' || message.includes('same password') || message.includes('different from the old')) {
    return '현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.'
  }
  if (code === 'email_not_confirmed' || message.includes('email not confirmed')) {
    return '로그인할 수 없습니다. 이메일 확인을 완료했는지 확인해 주세요.'
  }
  if (code === 'invalid_credentials' || message.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호를 확인해 주세요.'
  }
  if (action === 'reset') return '재설정 이메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'
  if (action === 'signup') return '가입 요청을 완료하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.'
  if (action === 'password') return '비밀번호를 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.'
  return '로그인하지 못했습니다. 입력 내용과 네트워크를 확인해 주세요.'
}
