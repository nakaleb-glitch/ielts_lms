import { useEffect } from 'react'

export function useExamLock(active: boolean) {
  useEffect(() => {
    if (!active) return

    const trapBack = () => {
      window.history.pushState(null, '', window.location.href)
    }

    const onPopState = () => {
      trapBack()
    }

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }

    trapBack()
    window.addEventListener('popstate', onPopState)
    window.addEventListener('beforeunload', onBeforeUnload)

    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])
}
