import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'

const TOKEN_KEY = 'auth_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const token = getToken()
  const location = useLocation()
  if (!token) {
    return <Navigate to="/" state={{ from: location }} replace />
  }
  return <>{children}</>
}

export function PublicRoute({ children }: { children: ReactNode }) {
  const token = getToken()
  if (token) {
    return <Navigate to="/conversations" replace />
  }
  return <>{children}</>
}
