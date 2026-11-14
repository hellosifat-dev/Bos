import { type ReactNode } from 'react'
import { clsx } from 'clsx'

interface CardProps {
  children:   ReactNode
  className?: string
  padding?:   'none' | 'sm' | 'md' | 'lg'
}

interface CardHeaderProps {
  title:       string
  subtitle?:   string
  action?:     ReactNode
  className?:  string
}

interface CardBodyProps {
  children:   ReactNode
  className?: string
}

interface CardFooterProps {
  children:   ReactNode
  className?: string
}

const paddingClasses = {
  none: '',
  sm:   'p-4',
  md:   'p-6',
  lg:   'p-8',
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={clsx(
      'bg-white rounded-xl border border-gray-200 shadow-sm',
      paddingClasses[padding],
      className
    )}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action, className }: CardHeaderProps) {
  return (
    <div className={clsx('flex items-start justify-between', className)}>
      <div>
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {action && <div className="ml-4 flex-shrink-0">{action}</div>}
    </div>
  )
}

export function CardBody({ children, className }: CardBodyProps) {
  return <div className={clsx('mt-4', className)}>{children}</div>
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={clsx('mt-4 border-t border-gray-100 pt-4', className)}>
      {children}
    </div>
  )
}
