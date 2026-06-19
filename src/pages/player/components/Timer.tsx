import { useEffect, useState } from 'react'

interface TimerProps {
  startedAt: string
  durationMinutes: number
  onExpire: () => void
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function useTimer({ startedAt, durationMinutes, onExpire }: TimerProps) {
  const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000

  const calcRemaining = () => Math.max(0, Math.floor((endTime - Date.now()) / 1000))

  const [remaining, setRemaining] = useState(calcRemaining)

  useEffect(() => {
    const interval = setInterval(() => {
      const next = calcRemaining()
      setRemaining(next)
      if (next <= 0) {
        clearInterval(interval)
        onExpire()
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [startedAt, durationMinutes])

  return formatTime(remaining)
}
