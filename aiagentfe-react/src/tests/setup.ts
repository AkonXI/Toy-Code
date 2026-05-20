class LocalStorageMock {
  private store: Record<string, string> = {}
  getItem(key: string) {
    return this.store[key] ?? null
  }
  setItem(key: string, value: string) {
    this.store[key] = String(value)
  }
  removeItem(key: string) {
    delete this.store[key]
  }
  clear() {
    this.store = {}
  }
  get length() {
    return Object.keys(this.store).length
  }
  key(index: number) {
    return Object.keys(this.store)[index] ?? null
  }
}

if (!globalThis.localStorage) {
  ;(globalThis as any).localStorage = new LocalStorageMock()
}

import { beforeEach } from 'vitest'

beforeEach(() => {
  localStorage.clear()
})
