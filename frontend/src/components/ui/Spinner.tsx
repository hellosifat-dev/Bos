import { clsx } from 'clsx'

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface SpinnerProps {
  size?:     SpinnerSize
  className?: string
  label?:    string   // sr-only accessible label
}

const sizeClasses: Record<SpinnerSize, string> = {
  xs: 'h-3 w-3 border',
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-2',
  lg: 'h-8 w-8 border-2',
  xl: 'h-12 w-12 border-4',
}

export function Spinner({ size = 'md', className, label = 'Loading...' }: SpinnerProps) {
  return (
    <div role="status" className={clsx('inline-block', className)}>
      <div
        className={clsx(
          'animate-spin rounded-full border-gray-300 border-t-primary-600',
          sizeClasses[size]
        )}
      />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="flex h-full min-h-[200px] items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
