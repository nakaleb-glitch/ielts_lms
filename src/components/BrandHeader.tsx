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
          <p className="text-sm font-semibold text-slate-800">IELTS LMS</p>
        </div>
      )}
    </div>
  )
}

export function CambridgeLogo({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/logos/cambridge.png"
      alt="Cambridge Assessment International Education"
      className={compact ? 'h-8 w-auto' : 'h-10 w-auto'}
    />
  )
}

/** @deprecated Use RoyalLogo / CambridgeLogo separately */
export function BrandHeader({ showSubtitle = true, compact = false }: RoyalLogoProps) {
  return (
    <div className="flex items-center gap-3">
      <RoyalLogo showSubtitle={showSubtitle} compact={compact} />
      <CambridgeLogo compact={compact} />
    </div>
  )
}
