import { useRef, useState, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Alert  } from '@/components/ui/Alert'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import toast from 'react-hot-toast'

const OTP_LENGTH = 6

export function OtpVerifyPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { type, email } = (location.state as { type?: string; email?: string }) ?? {}

  const setAuth = useAuthStore((s) => s.setAuth)
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''))
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [error, setError] = useState<string | null>(null)

  // auto-focus first input
  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const verify = useMutation({
    mutationFn: (code: string) =>
      authApi.verifyOtp({ type: type ?? 'login', code }),
    onSuccess: (res) => {
      const d = res.data as { user?: Parameters<typeof setAuth>[0]; token?: string }
      if (d?.token && d?.user) {
        setAuth(d.user, d.token)
        navigate('/app/dashboard', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    },
    onError: (err: Error) => setError(err.message || 'Invalid OTP. Please try again.'),
  })

  const resend = useMutation({
    mutationFn: () => authApi.sendOtp({ type: type ?? 'login', email }),
    onSuccess: () => { toast.success('A new code was sent.'); setDigits(Array(OTP_LENGTH).fill('')) },
    onError:   (err: Error) => toast.error(err.message || 'Could not resend OTP.'),
  })

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...digits]
    next[index] = value.slice(-1)
    setDigits(next)
    setError(null)
    if (value && index < OTP_LENGTH - 1) inputRefs.current[index + 1]?.focus()
    if (next.every((d) => d !== '') && next.join('').length === OTP_LENGTH) {
      verify.mutate(next.join(''))
    }
  }

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH)
    if (!text) return
    const next = Array(OTP_LENGTH).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    if (text.length === OTP_LENGTH) verify.mutate(text)
    else inputRefs.current[text.length]?.focus()
  }

  return (
    <>
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-gray-900">Enter verification code</h2>
        <p className="mt-2 text-sm text-gray-500">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-gray-700">{email ?? 'your email'}</span>.
        </p>
      </div>

      {error && <Alert variant="error" className="mb-5">{error}</Alert>}

      <div className="flex justify-center gap-2 mb-6">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKey(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            className="h-12 w-11 rounded-lg border border-gray-300 text-center text-lg font-semibold shadow-sm
                       focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500
                       disabled:bg-gray-50 disabled:opacity-60"
            disabled={verify.isPending}
          />
        ))}
      </div>

      <Button
        className="w-full"
        size="lg"
        loading={verify.isPending}
        disabled={digits.some((d) => !d)}
        onClick={() => verify.mutate(digits.join(''))}
      >
        Verify code
      </Button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Didn't receive a code?{' '}
        <button
          type="button"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
        >
          {resend.isPending ? 'Resending…' : 'Resend'}
        </button>
      </p>
    </>
  )
}
