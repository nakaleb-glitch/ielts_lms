import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { TestModule } from '../types/assessment'

const MODULES: { key: TestModule; label: string }[] = [
  { key: 'reading', label: 'Reading' },
  { key: 'writing', label: 'Writing' },
  { key: 'listening', label: 'Listening' },
]

interface ModuleNavDropdownProps {
  label: 'Tests' | 'My Tests'
  basePath: '/tests' | '/my-tests'
}

export function ModuleNavDropdown({ label, basePath }: ModuleNavDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const activeModule = MODULES.find((m) => location.pathname.startsWith(`${basePath}/${m.key}`))?.key

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-slate-700 hover:text-royal-blue"
      >
        {label}
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 min-w-[140px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
          {MODULES.map((m) => (
            <Link
              key={m.key}
              to={`${basePath}/${m.key}`}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm hover:bg-slate-50 ${
                activeModule === m.key ? 'font-semibold text-royal-blue' : 'text-slate-700'
              }`}
            >
              {m.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
