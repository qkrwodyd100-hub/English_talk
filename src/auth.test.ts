import { describe, expect, it } from 'vitest'
import { isPasswordRecoveryEvent, mapAuthError, validateNewPassword } from './auth'

describe('password authentication contract', () => {
  it('requires an eight-character password and a matching confirmation', () => {
    expect(validateNewPassword('short', 'short')).toBe('비밀번호는 8자 이상이어야 합니다.')
    expect(validateNewPassword('long-enough', 'different')).toBe('비밀번호 확인이 일치하지 않습니다.')
    expect(validateNewPassword('long-enough', 'long-enough')).toBeNull()
  })

  it('maps provider failures to useful Korean messages without identifying an account', () => {
    expect(mapAuthError({ code: 'invalid_credentials', message: 'Invalid login credentials' }, 'login')).toBe('이메일 또는 비밀번호를 확인해 주세요.')
    expect(mapAuthError({ code: 'email_not_confirmed', message: 'Email not confirmed' }, 'login')).toBe('로그인할 수 없습니다. 이메일 확인을 완료했는지 확인해 주세요.')
    expect(mapAuthError({ code: 'weak_password', message: 'Password should be at least 8 characters' }, 'password')).toBe('비밀번호는 8자 이상이어야 합니다.')
    expect(mapAuthError({ code: 'same_password', message: 'New password should be different' }, 'password')).toBe('현재 비밀번호와 다른 새 비밀번호를 입력해 주세요.')
    expect(mapAuthError({ status: 429, code: 'over_email_send_rate_limit', message: 'rate limit' }, 'reset')).toContain('잠시 후')
    expect(mapAuthError(new TypeError('Failed to fetch'), 'login')).toContain('네트워크')
    expect(mapAuthError({ message: 'User not found' }, 'reset')).not.toContain('계정')
  })

  it('recognizes only the provider password-recovery event', () => {
    expect(isPasswordRecoveryEvent('PASSWORD_RECOVERY')).toBe(true)
    expect(isPasswordRecoveryEvent('SIGNED_IN')).toBe(false)
  })
})
