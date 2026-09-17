import { useEffect } from 'react'

/** Poll without overlapping requests; abort on dependency changes or unmount. */
export function usePolling(callback, delay) {
  useEffect(() => {
    if (delay === null) return
    const controller = new AbortController()
    let timer

    async function tick() {
      try {
        await callback(controller.signal)
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(tick, delay)
      }
    }

    timer = setTimeout(tick, 0)
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [callback, delay])
}
