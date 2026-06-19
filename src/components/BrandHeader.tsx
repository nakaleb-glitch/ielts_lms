interface RoyalLogoProps {
  showSubtitle?: boolean
  compact?: boolean
}

export function RoyalLogo({ showSubtitle = false, compact = false }: RoyalLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logos/royal-school.png"
        alt="Royal International School"
        className={compact ? 'h-10 w-auto' : 'h-12 w-auto'}
      />
      {showSubtitle && (
        <div className="hidden border-l border-slate-200 pl-3 sm:block">
          <p className="text-sm font-semibold text-slate-800">IELTS Assessment Hub</p>
        </div>
      )}
    </div>
  )
}
