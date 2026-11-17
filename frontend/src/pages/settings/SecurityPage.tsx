import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { authApi } from '@/api/auth'
import { useAuthStore } from '@/stores/authStore'
import { getErrorMessage } from '@/utils/format'

/** Two-factor authentication (TOTP) management. */
export function SecurityPage() {
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const [setup, setSetup] = useState<{ secret: string; qr_url: string } | null>(null)
  const [code, setCode] = useState('')

  const enable = useMutation({
    mutationFn: () => authApi.enable2FA(),
    onSuccess: (res) => setSetup(res.data.data),
    onError: (e: unknown) => toast.error(getErrorMessage(e)),
  })

  const confirm = useMutation({
    mutationFn: () => authApi.verify2FA({ code }),
    onSuccess: () => {
      updateUser({ two_factor_enabled: true })
      setSetup(null); setCode('')
      toast.success('Two-factor authentication enabled.')
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Invalid code.')),
  })

  const disable = useMutation({
    mutationFn: () => authApi.disable2FA(code),
    onSuccess: () => {
      updateUser({ two_factor_enabled: false })
      setCode('')
      toast.success('Two-factor authentication disabled.')
    },
    onError: (e: unknown) => toast.error(getErrorMessage(e, 'Invalid code.')),
  })

  const enabled = !!user?.two_factor_enabled

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Security</h1>
      <Card>
        <CardHeader
          title="Two-factor authentication"
          subtitle="Protect your account with a time-based code from an authenticator app."
        />
        <CardBody className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Status:</span>
            <Badge variant={enabled ? 'success' : 'default'}>{enabled ? 'Enabled' : 'Disabled'}</Badge>
          </div>

          {!enabled && !setup && (
            <Button onClick={() => enable.mutate()} loading={enable.isPending}>Set up two-factor</Button>
          )}

          {!enabled && setup && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Add this key to your authenticator app, then enter the 6-digit code to confirm.
              </p>
              <code className="block break-all rounded-lg bg-gray-50 p-3 text-sm">{setup.secret}</code>
              <a href={setup.qr_url} className="text-xs text-primary-600 hover:underline break-all">{setup.qr_url}</a>
              <Input label="Authentication code" value={code} maxLength={6} inputMode="numeric"
                     onChange={(e) => setCode(e.target.value)} />
              <Button onClick={() => confirm.mutate()} loading={confirm.isPending} disabled={code.length !== 6}>
                Confirm &amp; enable
              </Button>
            </div>
          )}

          {enabled && (
            <div className="space-y-3">
              <Input label="Authentication code" value={code} maxLength={6} inputMode="numeric"
                     onChange={(e) => setCode(e.target.value)} />
              <Button variant="danger" onClick={() => disable.mutate()} loading={disable.isPending} disabled={code.length !== 6}>
                Disable two-factor
              </Button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
