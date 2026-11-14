import { type ReactNode } from 'react'
import { clsx } from 'clsx'

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'
type BadgeSize    = 'sm' | 'md'

interface BadgeProps {
  children:  ReactNode
  variant?:  BadgeVariant
  size?:     BadgeSize
  dot?:      boolean
  className?: string
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-700',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-yellow-100 text-yellow-700',
  danger:  'bg-red-100  text-red-700',
  info:    'bg-blue-100  text-blue-700',
  purple:  'bg-purple-100 text-purple-700',
}

const dotClasses: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  purple:  'bg-purple-500',
}

export function Badge({ children, variant = 'default', size = 'md', dot, className }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center gap-1.5 rounded-full font-medium',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
      variantClasses[variant],
      className
    )}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', dotClasses[variant])} />}
      {children}
    </span>
  )
}
