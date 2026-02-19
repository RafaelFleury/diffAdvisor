import { useState, useCallback } from 'react'

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : defaultValue
    } catch {
      return defaultValue
    }
  })

  const setValue = useCallback(
    (value: T) => {
      setStored(value)
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        // localStorage not available
      }
    },
    [key]
  )

  return [stored, setValue]
}
