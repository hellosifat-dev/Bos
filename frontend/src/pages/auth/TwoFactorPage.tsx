import { useRef, useState, useEffect, type KeyboardEvent, type ClipboardEvent } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Alert  } from '@/components/ui/Alert'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'

const CODE_LENGTH = 6

export function TwoFactorPage() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { userId } = (location.state as { userId?: string }) ?? {}

  const setAuth = useAuthStore((s) => s.setAuth)
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const inputRefs = useRef<Array<HTMLInputElement | null>>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { inputRefs.current[0]?.focus() }, [])

  const verify = useMutation({
    mutationFn: (code: string) => authApi.verify2FA({ code }),
    onSuccess: (res) => {
      const d = res.data as { user?: Parameters<typeof setAuth>[0]; token?: string }
      if (d?.user && d?.token) setAuth(d.user, d.token)
      navigate('/app/dashboard', { replace: true })
    },
    onError: (err: Error) => setError(err.message || 'Invalid code. Please try again.'),
  })

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const next = [...digits]
    next[index] = value.slice(-1)
    setDigits(next)
    setError(null)
    if (value && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus()
    if (next.every((d) => d !== '')) verify.mutate(next.join(''))
  }

  const handleKey = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (!text) return
    const next = Array(CODE_LENGTH).fill('')
    text.split('').forEach((c, i) => { next[i] = c })
    setDigits(next)
    if (text.length === CODE_LENGTH) verify.mutate(text)
    else inputRefs.current[text.length]?.focus()
  }

  return (
    <>
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50">
          <ShieldCheck className="h-7 w-7 text-primary-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Two-factor authentication</h2>
        <p className="mt-2 text-sm text-gray-500">
          Open your authenticator app and enter the 6-digit code.
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
        Verify
      </Button>

      <p className="mt-4 text-center text-sm text-gray-500">
        Lost access to your authenticator?{' '}
        <a href="mailto:support@bos.app" className="text-primary-600 hover:text-primary-700 font-medium">
          Contact support
        </a>
      </p>
    </>
  )
}
