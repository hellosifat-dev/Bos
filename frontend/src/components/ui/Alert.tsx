import { type ReactNode } from 'react'
import { clsx } from 'clsx'
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react'

type AlertVariant = 'success' | 'warning' | 'error' | 'info'

interface AlertProps {
  variant?:   AlertVariant
  title?:     string
  children?:  ReactNode
  onClose?:   () => void
  className?: string
}

const variants: Record<AlertVariant, { container: string; icon: ReactNode }> = {
  success: {
    container: 'bg-green-50 border-green-200 text-green-800',
    icon: <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />,
  },
  warning: {
    container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    icon: <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0" />,
  },
  error: {
    container: 'bg-red-50 border-red-200 text-red-800',
    icon: <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />,
  },
  info: {
    container: 'bg-blue-50 border-blue-200 text-blue-800',
    icon: <Info className="h-5 w-5 text-blue-500 flex-shrink-0" />,
  },
}

export function Alert({ variant = 'info', title, children, onClose, className }: AlertProps) {
  const { container, icon } = variants[variant]
  return (
    <div className={clsx('flex gap-3 rounded-lg border p-4', container, className)} role="alert">
      {icon}
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={clsx(title && 'mt-1')}>{children}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 opacity-70 hover:opacity-100">
          <X className="h-4 w-4" />
          <span className="sr-only">Dismiss</span>
        </button>
      )}
    </div>
  )
}
