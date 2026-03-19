// src/hooks/index.js
import { useState, useEffect, useRef, useCallback } from 'react'

/** Generic data fetcher with loading/error state */
export const useFetch = (fetchFn, deps = [], options = {}) => {
  const [data, setData] = useState(options.initialData ?? null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const mountedRef = useRef(true)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchFn()
      if (mountedRef.current) setData(res.data ?? res)
    } catch (err) {
      if (mountedRef.current) setError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, deps)

  useEffect(() => {
    fetch()
    return () => { mountedRef.current = false }
  }, [fetch])

  return { data, loading, error, refetch: fetch, setData }
}

/** Debounce a value */
export const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])
  return debouncedValue
}

/** Handle modal open/close */
export const useModal = (initial = false) => {
  const [isOpen, setIsOpen] = useState(initial)
  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(p => !p),
  }
}

/** Pagination state */
export const usePagination = (initialPage = 1, initialLimit = 20) => {
  const [page, setPage] = useState(initialPage)
  const [limit] = useState(initialLimit)
  return {
    page, limit,
    nextPage: () => setPage(p => p + 1),
    prevPage: () => setPage(p => Math.max(1, p - 1)),
    setPage,
    reset: () => setPage(1),
  }
}
