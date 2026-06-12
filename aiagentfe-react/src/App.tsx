import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { PublicRoute } from '@/router'
import LoginPage from '@/pages/LoginPage'
import ConversationsPage from '@/pages/ConversationsPage'
import EditorPage from '@/pages/EditorPage'
import DocumentLibraryPage from '@/pages/DocumentLibraryPage'
import AppHeader from '@/components/AppHeader'

function AuthenticatedLayout() {
  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="pt-[50px]">
        <Routes>
          <Route path="/" element={<Navigate to="/conversations" replace />} />
          <Route path="/conversations" element={<ConversationsPage />} />
          <Route path="/editor/:id" element={<EditorPage />} />
          <Route path="/editor" element={<EditorPage />} />
          <Route path="/documents" element={<DocumentLibraryPage />} />
          <Route
            path="*"
            element={
              <div className="flex justify-center items-center h-[calc(100vh-50px)] text-[#999]">
                页面不存在
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('auth_token'))

  useEffect(() => {
    const checkAuth = () => setIsAuthenticated(!!localStorage.getItem('auth_token'))
    window.addEventListener('storage', checkAuth)
    window.addEventListener('auth-change', checkAuth)
    return () => {
      window.removeEventListener('storage', checkAuth)
      window.removeEventListener('auth-change', checkAuth)
    }
  }, [])

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route
          path="/*"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
      </Routes>
    )
  }

  return (
    <Routes>
      <Route path="/*" element={<AuthenticatedLayout />} />
    </Routes>
  )
}
