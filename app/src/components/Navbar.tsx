import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import type { Rarity } from './cardRegistry'

export interface NavbarStats {
  pullsDone: number
  pitySinceGrand: number
}

export interface NavbarLastDraw {
  name: string
  rarity: Rarity
}

const PITY_THRESHOLD = 50

const RARITY_DOT: Record<Rarity, string> = {
  minor: 'bg-paper/60',
  major: 'bg-flare',
  grand: 'bg-flare shadow-[0_0_8px_1px_#FD1789]',
}

export function Navbar({
  stats,
  lastDraw,
  onHome,
  onDraw,
  onCollection,
  onProfile,
}: {
  stats: NavbarStats | null
  lastDraw: NavbarLastDraw | null
  onHome: () => void
  onDraw: () => void
  onCollection: () => void
  onProfile: () => void
}) {
  const pityPct = stats ? Math.min(100, (stats.pitySinceGrand / PITY_THRESHOLD) * 100) : 0

  return (
    <>
      <header className="sticky top-0 z-20 border-b-4 border-ink bg-paper [padding-top:max(0.75rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-4 py-3 sm:hidden">
          <button onClick={onHome} className="flex items-center gap-1.5 text-left" aria-label="Return to Obsession home">
            <span className="text-flare leading-none">✦</span>
            <span className="text-base font-black uppercase tracking-tight text-ink">Obsession</span>
          </button>
          <div className="origin-right scale-[0.78]">
            <WalletMultiButton />
          </div>
        </div>

        <div className="hidden items-center justify-between gap-x-2 gap-y-2 px-4 py-3 sm:flex">
          <button onClick={onHome} className="flex min-w-0 items-center gap-1.5 text-left" aria-label="Return to Obsession home">
          <span className="text-flare leading-none">✦</span>
          <span className="truncate text-sm font-black uppercase tracking-tight text-ink sm:text-base">
            Obsession
          </span>
        </button>
          <div className="flex shrink-0 items-center gap-2">
          <button onClick={onDraw} className="h-10 border-[3px] border-ink bg-flare px-3 text-[10px] font-black uppercase tracking-widest text-ink">
            Draw
          </button>
          <button onClick={onCollection} className="h-10 border-[3px] border-ink px-3 text-[10px] font-black uppercase tracking-widest text-ink">
            Collection
          </button>
          <button onClick={onProfile} className="h-10 border-[3px] border-ink px-3 text-[10px] font-black uppercase tracking-widest text-ink">
            Profile
          </button>
          <div className="origin-right scale-90">
            <WalletMultiButton />
          </div>
          </div>
        </div>

      {(stats || lastDraw) && (
        <div className="hidden flex-wrap items-center gap-x-3 gap-y-1 border-t-2 border-ink/20 px-4 py-1.5 sm:flex">
          {stats && (
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap">
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink/60">
                Asked {stats.pullsDone}
              </span>
              <div className="order-last h-1.5 w-full border border-ink/30 bg-paper sm:order-none sm:min-w-[3rem]">
                <div className="h-full bg-flare transition-all" style={{ width: `${pityPct}%` }} />
              </div>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-ink/60">
                Pity {stats.pitySinceGrand}/{PITY_THRESHOLD}
              </span>
            </div>
          )}
          {lastDraw && (
            <div className="flex shrink-0 items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${RARITY_DOT[lastDraw.rarity]}`} />
              <span className="max-w-[9rem] truncate text-[10px] font-bold uppercase tracking-widest text-ink/60">
                Last: {lastDraw.name}
              </span>
            </div>
          )}
        </div>
      )}
      </header>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t-4 border-ink bg-ink [padding-bottom:max(0.5rem,env(safe-area-inset-bottom))] sm:hidden" aria-label="Mobile navigation">
        <MobileNavButton icon="✦" label="Journey" onClick={onHome} />
        <MobileNavButton icon="✧" label="Draw" onClick={onDraw} />
        <MobileNavButton icon="▤" label="Collection" onClick={onCollection} />
        <MobileNavButton icon="◉" label="Profile" onClick={onProfile} />
      </nav>
    </>
  )
}

function MobileNavButton({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-16 flex-1 flex-col items-center justify-center gap-1 text-paper transition-colors active:bg-flare active:text-ink"><span className="text-base leading-none">{icon}</span><span className="text-[9px] font-black uppercase tracking-wide">{label}</span></button>
}
