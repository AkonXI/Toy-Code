import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { ErrorDict } from '../utils/errorMatcher'

interface DictEntry {
  id: number
  word: string
  suggestions: string[]
  level: number
}

interface ErrorDictContextValue {
  dict: DictEntry[]
  addEntry: (entry: Omit<DictEntry, 'id'>) => void
  updateEntry: (id: number, updates: Partial<DictEntry>) => void
  removeEntry: (id: number) => void
  getErrorMap: () => ErrorDict
}

const initialDict: DictEntry[] = [
  { id: 1, word: '登陆', suggestions: ['登录', '登入'], level: 1 },
  { id: 2, word: '需要', suggestions: ['须要'], level: 1 },
  { id: 3, word: '必须', suggestions: ['必需'], level: 1 },
  { id: 4, word: '方案包含', suggestions: ['方案包括'], level: 1 },
  { id: 5, word: '账户', suggestions: ['帐户'], level: 1 },
  { id: 6, word: '😀账户', suggestions: ['😀帐户'], level: 1 }
]

const ErrorDictContext = createContext<ErrorDictContextValue | null>(null)

export function ErrorDictProvider({ children }: { children: ReactNode }) {
  const [dict, setDict] = useState<DictEntry[]>(() => {
    const saved = localStorage.getItem('spellCheckDict')
    return saved ? JSON.parse(saved) : initialDict
  })

  const saveDict = useCallback((newDict: DictEntry[]) => {
    setDict(newDict)
    localStorage.setItem('spellCheckDict', JSON.stringify(newDict))
  }, [])

  const addEntry = useCallback(
    (entry: Omit<DictEntry, 'id'>) => {
      const newEntry: DictEntry = { ...entry, id: Date.now() }
      saveDict([...dict, newEntry])
    },
    [dict, saveDict]
  )

  const updateEntry = useCallback(
    (id: number, updates: Partial<DictEntry>) => {
      saveDict(dict.map((e) => (e.id === id ? { ...e, ...updates } : e)))
    },
    [dict, saveDict]
  )

  const removeEntry = useCallback(
    (id: number) => {
      saveDict(dict.filter((e) => e.id !== id))
    },
    [dict, saveDict]
  )

  const getErrorMap = useCallback((): ErrorDict => {
    const map: ErrorDict = {}
    dict.forEach((e) => {
      map[e.word] = e.suggestions
    })
    return map
  }, [dict])

  return (
    <ErrorDictContext.Provider value={{ dict, addEntry, updateEntry, removeEntry, getErrorMap }}>
      {children}
    </ErrorDictContext.Provider>
  )
}

export function useErrorDict(): ErrorDictContextValue {
  const ctx = useContext(ErrorDictContext)
  if (!ctx) throw new Error('useErrorDict must be used within ErrorDictProvider')
  return ctx
}
