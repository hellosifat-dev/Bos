import { clsx, type ClassValue } from 'clsx'

/** Merge Tailwind class strings, resolving conflicts */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}
