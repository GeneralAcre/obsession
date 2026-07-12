import { lazy, Suspense, useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { WalletContextProvider } from './components/WalletContextProvider'
import { AppShell } from './components/AppShell'
import type { NavbarStats } from './components/Navbar'
import { LandingPage } from './components/LandingPage'
import { CategorySelect } from './components/CategorySelect'
import { DrawScreen } from './components/DrawScreen'
import { ProfileScreen, type JournalEntry } from './components/ProfileScreen'
import { CollectionScreen } from './components/CollectionScreen'
import { PrivacyPolicyScreen, TermsOfUseScreen } from './components/PolicyScreen'
import type { CardInfo } from './components/cardRegistry'
import type { Category } from './components/categories'

type Screen = 'landing' | 'categories' | 'draw' | 'pull' | 'collection' | 'profile' | 'privacy' | 'terms'

// Anchor and web3 are only needed once a connected player begins a reading.
const PullScreen = lazy(() => import('./components/PullScreen').then(({ PullScreen }) => ({ default: PullScreen })))

function ObsessionApp() {
  const wallet = useWallet()
  const [screen, setScreen] = useState<Screen>('landing')
  const [category, setCategory] = useState<Category | null>(null)
  const [intention, setIntention] = useState('')
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [stats, setStats] = useState<NavbarStats | null>(null)
  const [focusFaq, setFocusFaq] = useState(false)

  useEffect(() => {
    if (!wallet.publicKey) setStats(null)
  }, [wallet.publicKey])

  const handleReveal = (card: CardInfo, drawnCategory: Category) => {
    setEntries((prev) => [{ card, category: drawnCategory, intention, at: Date.now() }, ...prev])
  }
  const lastDraw = entries[0] ? { name: entries[0].card.name, rarity: entries[0].card.rarity } : null

  const content = screen === 'landing'
    ? <LandingPage onStart={() => setScreen('categories')} />
    : screen === 'categories'
      ? (
        <CategorySelect
          onSelect={(next, nextIntention) => { setCategory(next); setIntention(nextIntention); setScreen('draw') }}
          onBrowse={() => setScreen('draw')}
          focusFaq={focusFaq}
          onFaqScrolled={() => setFocusFaq(false)}
        />
      )
      : screen === 'draw'
        ? <DrawScreen onSelect={(next) => { setCategory(next); setIntention(''); setScreen('pull') }} />
        : screen === 'collection'
        ? <CollectionScreen />
        : screen === 'profile'
          ? <ProfileScreen entries={entries} walletAddress={wallet.publicKey?.toBase58() ?? null} />
        : screen === 'privacy'
          ? <PrivacyPolicyScreen />
        : screen === 'terms'
          ? <TermsOfUseScreen />
        : category
          ? (
            <Suspense fallback={<LoadingReading />}>
              <PullScreen category={category} onChangeCategory={() => setScreen('draw')} onReveal={handleReveal} onStatsChange={setStats} />
            </Suspense>
          )
          : <DrawScreen onSelect={(next) => { setCategory(next); setIntention(''); setScreen('pull') }} />

  return (
    <AppShell
      stats={stats}
      lastDraw={lastDraw}
      onHome={() => setScreen('categories')}
      onDraw={() => setScreen('draw')}
      onCollection={() => setScreen('collection')}
      onProfile={() => setScreen('profile')}
      onFaq={() => { setScreen('categories'); setFocusFaq(true) }}
      onPrivacy={() => setScreen('privacy')}
      onTerms={() => setScreen('terms')}
      showNavbar={screen !== 'landing'}
      showFooter={screen !== 'landing'}
    >
      {content}
    </AppShell>
  )
}

function LoadingReading() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center">
      <p className="text-xs font-black uppercase tracking-widest text-paper/60">Opening Obsession...</p>
    </div>
  )
}

function App() {
  return <WalletContextProvider><ObsessionApp /></WalletContextProvider>
}

export default App
