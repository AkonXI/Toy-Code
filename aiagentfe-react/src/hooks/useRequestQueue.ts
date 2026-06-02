import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { getLabel } from '@/lib/editor-utils'

export interface QueuedRequest {
  id: string
  type: 'search' | 'apply' | 'accept'
  label: string
  execute: () => void
  canceled: boolean
  timestamp: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  disabledKey?: string
  wasSupplement?: boolean
}

interface UseRequestQueueDeps {
  loadReferenceFilesRef: React.MutableRefObject<() => void>
}

export function useRequestQueue({ loadReferenceFilesRef }: UseRequestQueueDeps) {
  const [requestQueue, setRequestQueue] = useState<QueuedRequest[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSearchProcessing, setIsSearchProcessing] = useState(false)
  const requestQueueRef = useRef(requestQueue)
  useEffect(() => {
    requestQueueRef.current = requestQueue
  }, [requestQueue])

  const pendingQueueCount = useMemo(
    () => requestQueue.filter((r) => r.status === 'pending').length,
    [requestQueue]
  )

  const processQueue = useCallback(() => {
    setRequestQueue((prev) => {
      const trimmed = prev.filter((r) => !r.canceled)
      if (trimmed.length === 0) {
        setIsProcessing(false)
        setIsSearchProcessing(false)
        return trimmed
      }
      if (trimmed[0].status !== 'pending') return trimmed
      setIsProcessing(true)
      setIsSearchProcessing(trimmed[0].type === 'search')
      const execute = trimmed[0].execute
      const updated = trimmed.map((r) =>
        r.id === trimmed[0].id ? { ...r, status: 'processing' as const } : r
      )
      try {
        execute()
      } catch (err) {
        console.error('Queue execute error:', err)
        processQueue()
      }
      return updated
    })
  }, [])

  const enqueueRequest = useCallback(
    (
      req: Omit<QueuedRequest, 'id' | 'timestamp' | 'status' | 'label' | 'canceled'>,
      payload?: any
    ) => {
      setRequestQueue((prev) => {
        if (payload?.field) {
          const dupIdx = prev.findIndex(
            (r) => r.status === 'pending' && r.type === req.type && r.label.includes(payload.field)
          )
          if (dupIdx !== -1) {
            const filtered = [...prev]
            filtered.splice(dupIdx, 1)
            return filtered
          }
        }
        return prev
      })
      const newReq: QueuedRequest = {
        ...req,
        id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        label: getLabel(req.type, payload),
        status: 'pending',
        canceled: false,
        timestamp: Date.now()
      }
      setRequestQueue((prev) => [...prev, newReq])
      setTimeout(() => processQueue(), 0)
    },
    [processQueue]
  )

  const dequeue = useCallback(() => {
    loadReferenceFilesRef.current()
    setRequestQueue((prev) => {
      if (prev.length > 0) {
        const updated = prev.map((r, i) => (i === 0 ? { ...r, status: 'completed' as const } : r))
        const [, ...rest] = updated
        setTimeout(() => processQueue(), 0)
        return rest
      }
      setTimeout(() => processQueue(), 0)
      return prev
    })
  }, [processQueue, loadReferenceFilesRef])

  const cancelRequest = useCallback((id: string) => {
    const req = requestQueueRef.current.find((r) => r.id === id)
    setRequestQueue((prev) =>
      prev.map((r) => (r.id === id ? { ...r, canceled: true, status: 'failed' as const } : r))
    )
    return { disabledKey: req?.disabledKey, wasSupplement: req?.wasSupplement }
  }, [])

  const cancelAllPending = useCallback(() => {
    const keys: string[] = []
    let drops = 0
    setRequestQueue((prev) => {
      const reqs = prev.filter((r) => r.status === 'pending')
      keys.push(...(reqs.map((r) => r.disabledKey).filter(Boolean) as string[]))
      drops = reqs.filter((r) => r.wasSupplement).length
      return prev.map((r) =>
        r.status === 'pending' ? { ...r, canceled: true, status: 'failed' as const } : r
      )
    })
    return { keys, drops }
  }, [])

  const onReorderQueue = useCallback((newQueue: QueuedRequest[]) => {
    setRequestQueue(newQueue)
  }, [])

  return {
    requestQueue,
    requestQueueRef,
    setRequestQueue,
    isProcessing,
    setIsProcessing,
    isSearchProcessing,
    setIsSearchProcessing,
    pendingQueueCount,
    enqueueRequest,
    cancelRequest,
    cancelAllPending,
    dequeue,
    onReorderQueue,
    processQueue
  }
}
