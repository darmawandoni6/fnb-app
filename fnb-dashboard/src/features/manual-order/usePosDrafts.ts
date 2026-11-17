import { useCallback, useEffect, useState } from 'react'

import type { DiningOption } from '@/types'

const STORAGE_KEY = 'fnb_pos_draft_orders'

export type PosDraftOrder = {
  id: string
  created_at: string
  dining_option: DiningOption
  customer_name: string
  table_id: string | null
  table_number: string | null
  items: Record<string, { qty: number; note: string }>
  item_count: number
  total_estimate: number
}

function readStorage(): PosDraftOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PosDraftOrder[]
  } catch {
    return []
  }
}

function writeStorage(drafts: PosDraftOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts))
  } catch {
    // quota exceeded or storage unavailable
  }
}

export function usePosDrafts() {
  const [drafts, setDrafts] = useState<PosDraftOrder[]>(() => readStorage())

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setDrafts(readStorage())
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const saveDraft = useCallback(
    (draft: Omit<PosDraftOrder, 'id' | 'created_at'>): PosDraftOrder => {
      const newDraft: PosDraftOrder = {
        ...draft,
        id: `draft-${Date.now()}`,
        created_at: new Date().toISOString(),
      }
      setDrafts((prev) => {
        const next = [newDraft, ...prev]
        writeStorage(next)
        return next
      })
      return newDraft
    },
    [],
  )

  const deleteDraft = useCallback((id: string) => {
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== id)
      writeStorage(next)
      return next
    })
  }, [])

  return {
    drafts,
    saveDraft,
    deleteDraft,
  }
}
