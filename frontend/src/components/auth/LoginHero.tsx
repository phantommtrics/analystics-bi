export function LoginHero() {
  return (
    <div className="relative flex h-full min-h-[320px] flex-col justify-between overflow-hidden bg-brand-navy p-8 text-white sm:p-10 lg:min-h-0">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="login-orb login-orb-1 absolute -left-16 top-10 h-56 w-56 rounded-full bg-brand-blue/30 blur-3xl" />
        <div className="login-orb login-orb-2 absolute bottom-0 right-0 h-72 w-72 rounded-full bg-brand-gold/20 blur-3xl" />
        <div className="login-orb login-orb-3 absolute left-1/2 top-1/3 h-40 w-40 -translate-x-1/2 rounded-full bg-semantic-green/15 blur-2xl" />
      </div>

      {/* Grid overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10">
        <div className="login-fade-up flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-gold text-xl font-bold text-brand-navy shadow-lg shadow-brand-gold/30">
            A
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">APS Wallet BI</p>
            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
              Intelligence Platform
            </p>
          </div>
        </div>

        <h1 className="login-fade-up login-delay-1 mt-8 max-w-sm text-3xl font-semibold leading-tight sm:text-4xl">
          Turn transaction data into{' '}
          <span className="bg-gradient-to-r from-brand-gold via-[#f0c040] to-brand-gold bg-clip-text text-transparent">
            decisive insight
          </span>
        </h1>
        <p className="login-fade-up login-delay-2 mt-4 max-w-sm text-sm leading-relaxed text-white/70">
          Real-time dashboards, compliance reports, and agency analytics — all
          secured behind role-based access.
        </p>
      </div>

      {/* Animated dashboard illustration */}
      <div className="relative z-10 mt-8 flex flex-1 items-end justify-center lg:mt-0">
        <svg
          viewBox="0 0 420 280"
          className="login-float w-full max-w-md"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="chartGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#2E6DB4" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#2E6DB4" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#C8960C" />
              <stop offset="100%" stopColor="#1D9E75" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Main panel */}
          <rect
            x="20"
            y="30"
            width="380"
            height="230"
            rx="16"
            fill="rgba(255,255,255,0.06)"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
          />

          {/* Header bar */}
          <rect x="36" y="46" width="80" height="8" rx="4" fill="rgba(255,255,255,0.25)" />
          <rect x="36" y="62" width="48" height="6" rx="3" fill="rgba(255,255,255,0.12)" />
          <circle cx="370" cy="54" r="5" fill="#1D9E75" className="login-pulse-dot" />
          <text x="348" y="58" fill="rgba(255,255,255,0.5)" fontSize="8" fontFamily="Inter,sans-serif">
            Live
          </text>

          {/* KPI cards */}
          <g className="login-card-pop login-delay-1">
            <rect x="36" y="82" width="96" height="56" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
            <rect x="48" y="94" width="40" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
            <text x="48" y="122" fill="#C8960C" fontSize="14" fontWeight="600" fontFamily="JetBrains Mono,monospace">
              45.2M
            </text>
          </g>
          <g className="login-card-pop login-delay-2">
            <rect x="144" y="82" width="96" height="56" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
            <rect x="156" y="94" width="52" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
            <text x="156" y="122" fill="#2E6DB4" fontSize="14" fontWeight="600" fontFamily="JetBrains Mono,monospace">
              12,450
            </text>
          </g>
          <g className="login-card-pop login-delay-3">
            <rect x="252" y="82" width="96" height="56" rx="10" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.12)" />
            <rect x="264" y="94" width="44" height="6" rx="3" fill="rgba(255,255,255,0.2)" />
            <text x="264" y="122" fill="#1D9E75" fontSize="14" fontWeight="600" fontFamily="JetBrains Mono,monospace">
              +5.2%
            </text>
          </g>

          {/* Bar chart */}
          <g transform="translate(36, 158)">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => {
              const heights = [42, 58, 48, 72, 65, 80, 74]
              const h = heights[i]
              return (
                <rect
                  key={i}
                  x={i * 46}
                  y={90 - h}
                  width="28"
                  height={h}
                  rx="4"
                  fill="url(#chartGrad)"
                  className="login-bar-grow"
                  style={{ animationDelay: `${0.4 + i * 0.08}s` }}
                />
              )
            })}
            <line x1="0" y1="90" x2="322" y2="90" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
          </g>

          {/* Trend line */}
          <polyline
            points="56,210 100,195 145,200 190,175 235,180 280,160 325,165 370,145"
            fill="none"
            stroke="url(#lineGrad)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            className="login-line-draw"
          />

          {/* Floating nodes */}
          <circle cx="370" cy="145" r="5" fill="#C8960C" className="login-orbit-dot" />
          <circle cx="56" cy="210" r="4" fill="#2E6DB4" className="login-orbit-dot login-delay-2" />
        </svg>
      </div>

      {/* Feature pills */}
      <div className="relative z-10 mt-6 flex flex-wrap gap-2">
        {['Float Monitor', 'AML Alerts', 'Agency Network'].map((label, i) => (
          <span
            key={label}
            className={`login-fade-up rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/75 backdrop-blur-sm login-delay-${i + 3}`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
