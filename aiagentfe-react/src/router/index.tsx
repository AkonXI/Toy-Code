import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'

const TOKEN_KEY = 'auth_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const token = getToken()
  if (token) {
    return <Navigate to="/conversations" replace />
  }
  return <>{children}</>
}
