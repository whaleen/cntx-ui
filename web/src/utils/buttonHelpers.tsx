// utils/buttonHelpers.tsx
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import type { ButtonState } from '../hooks/useButtonFeedback'

export function getButtonIcon(state: ButtonState, defaultIcon: React.ReactNode) {
  switch (state) {
    case 'loading':
      return <Loader2 className="w-4 h-4 animate-spin" />
    case 'success':
      return <CheckCircle className="w-4 h-4 text-[color:var(--color-success)]" />
    case 'error':
      return <AlertCircle className="w-4 h-4 text-destructive" />
    default:
      return defaultIcon
  }
}

export function getButtonClassName(state: ButtonState, baseClassName = '') {
  const stateClasses = {
    loading: 'opacity-75',
    success: 'border-[color:var(--color-success)]/50 bg-[color:var(--color-success)]/5 text-[color:var(--color-success)]',
    error: 'border-destructive/50 bg-destructive/5 text-destructive',
    idle: ''
  }

  return `transition-all duration-200 ${baseClassName} ${stateClasses[state]}`
}
