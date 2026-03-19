// src/hooks/useApi.js
import { useState, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'

export const useApi = (apiFunction, options = {}) => {
  const {
    showSuccess = false,
    successMessage = 'Operation completed successfully',
    showError = true,
    onSuccess,
    onError,
    debounceMs = 300,
    retryCount = 0
  } = options

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  
  const timeoutRef = useRef(null)
  const retryRef = useRef(0)

  const execute = useCallback(async (...args) => {
    // Debounce
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    return new Promise((resolve, reject) => {
      timeoutRef.current = setTimeout(async () => {
        setLoading(true)
        setError(null)

        try {
          const result = await apiFunction(...args)
          setData(result)
          
          if (showSuccess) {
            toast.success(successMessage)
          }
          
          onSuccess?.(result)
          resolve(result)
          
          // Reset retry counter on success
          retryRef.current = 0
          
        } catch (err) {
          // Handle rate limiting with retry
          if (err.response?.status === 429 && retryRef.current < retryCount) {
            retryRef.current++
            
            const retryAfter = err.response.data?.error?.retryAfter || 2
            toast.loading(`Rate limited. Retrying in ${retryAfter}s...`, { duration: retryAfter * 1000 })
            
            setTimeout(() => {
              execute(...args).then(resolve).catch(reject)
            }, retryAfter * 1000)
            
            return
          }
          
          setError(err)
          
          if (showError && err.response?.status !== 429) {
            toast.error(err.response?.data?.error?.message || 'An error occurred')
          }
          
          onError?.(err)
          reject(err)
        } finally {
          setLoading(false)
        }
      }, debounceMs)
    })
  }, [apiFunction, showSuccess, successMessage, showError, onSuccess, onError, debounceMs, retryCount])

  return { data, loading, error, execute }
}