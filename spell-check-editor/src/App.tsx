import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ErrorDictProvider } from './context/ErrorDictContext'
import EditorPage from './pages/EditorPage'
import DictPage from './pages/DictPage'

export default function App() {
  return (
    <ErrorDictProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EditorPage />} />
          <Route path="/dict" element={<DictPage />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ErrorDictProvider>
  )
}
