import { useState, useCallback, useMemo, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor'
import idl from '../idl/gacha_er.json'
import { resolveCard, type CardInfo, type Rarity } from './cardRegistry'
import { getCategory, type Category } from './categories'
import type { NavbarStats } from './Navbar'
import { OracleCardArt } from './OracleCardArt'

type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1]

interface PlayerAccount {
  pullsDone: number
  pullsSinceLegendary: number
  lastRarity: number
  lastCardSeed: number
}

const PROGRAM_ID = new web3.PublicKey('4re47fFt4ty2BkNS9NuhBUqDSbGZYhydkt42f4c9E7zv')
const TOKEN_PROGRAM_ID = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')

// MagicBlock devnet ER endpoint (Asia region — swap for eu/us if you prefer)
const ER_ENDPOINT = 'https://devnet-as.magicblock.app'
const ER_WS_ENDPOINT = 'wss://devnet-as.magicblock.app'
// No validator pin on delegation: the shared VRF oracle queue is itself delegated
// without a pinned validator, and pinning one here causes the router to reject
// pull transactions with "accounts that were delegated to different ER nodes."

const RARITY_STYLE: Record<Rarity, { badge: string; ring: string; label: string }> = {
  minor: { badge: 'bg-paper text-ink', ring: 'border-paper/40', label: 'MINOR OMEN' },
  major: { badge: 'bg-flare text-ink', ring: 'border-flare', label: 'MAJOR OMEN' },
  grand: {
    badge: 'bg-flare text-ink',
    ring: 'border-flare shadow-[0_0_40px_-6px_#FD1789]',
    label: 'GRAND REVELATION',
  },
}

const PITY_THRESHOLD = 50
const PITY_WARNING_AT = 40
const MIN_SETUP_LAMPORTS = 0.02 * web3.LAMPORTS_PER_SOL
const DEVNET_FAUCET_URL = 'https://faucet.solana.com'

function friendlyRpcError(e: unknown): string {
  const message = e instanceof Error ? e.message : String(e)
  if (/insufficient|debit an account|0x1\b/i.test(message)) {
    return 'This wallet needs a trace of devnet SOL to cover this step. Get some free devnet SOL, then try again.'
  }
  return message
}

export function PullScreen({
  category,
  onChangeCategory,
  onReveal,
  onStatsChange,
}: {
  category: Category
  onChangeCategory: () => void
  onReveal: (card: CardInfo, category: Category) => void
  onStatsChange: (stats: NavbarStats | null) => void
}) {
  const { connection } = useConnection() // base-layer devnet connection
  const wallet = useWallet()

  const [delegated, setDelegated] = useState(false)
  const [delegating, setDelegating] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [result, setResult] = useState<CardInfo | null>(null)
  const [resultCategory, setResultCategory] = useState<Category | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pullsDone, setPullsDone] = useState<number | null>(null)
  const [pitySinceGrand, setPitySinceGrand] = useState<number | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [setupLamports, setSetupLamports] = useState<number | null>(null)
  const [lastPull, setLastPull] = useState<{ rarity: number; cardSeed: number; pullIndex: number } | null>(null)
  const [minting, setMinting] = useState(false)
  const [mintedPullIndex, setMintedPullIndex] = useState<number | null>(null)
  const [mintedAddress, setMintedAddress] = useState<string | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  const isFirstPull = pullsDone === 0
  const pityDue = pitySinceGrand !== null && pitySinceGrand >= PITY_WARNING_AT
  const pityPct = pitySinceGrand !== null ? Math.min(100, (pitySinceGrand / PITY_THRESHOLD) * 100) : 0
  const rarityStyle = result ? RARITY_STYLE[result.rarity] : null
  const needsFunding = setupLamports !== null && setupLamports < MIN_SETUP_LAMPORTS

  useEffect(() => {
    if (pullsDone === null || pitySinceGrand === null) return
    onStatsChange({ pullsDone, pitySinceGrand })
  }, [pullsDone, pitySinceGrand, onStatsChange])

  useEffect(() => {
    if (wallet.publicKey) return
    setDelegated(false)
    setPullsDone(null)
    setPitySinceGrand(null)
    onStatsChange(null)
  }, [wallet.publicKey, onStatsChange])

  useEffect(() => {
    if (!wallet.publicKey || delegated) return
    let cancelled = false
    connection.getBalance(wallet.publicKey).then((lamports) => {
      if (!cancelled) setSetupLamports(lamports)
    })
    return () => {
      cancelled = true
    }
  }, [connection, wallet.publicKey, delegated])

  const baseProvider = useMemo(() => {
    if (!wallet.publicKey) return null
    return new AnchorProvider(connection, wallet as unknown as AnchorWallet, { preflightCommitment: 'processed' })
  }, [connection, wallet])

  const baseProgram = useMemo(() => {
    if (!baseProvider) return null
    return new Program(idl, baseProvider)
  }, [baseProvider])

  const erConnection = useMemo(
    () => new web3.Connection(ER_ENDPOINT, { wsEndpoint: ER_WS_ENDPOINT, commitment: 'confirmed' }),
    []
  )

  const erProvider = useMemo(() => {
    if (!wallet.publicKey) return null
    return new AnchorProvider(erConnection, wallet as unknown as AnchorWallet, { preflightCommitment: 'processed' })
  }, [erConnection, wallet])

  const erProgram = useMemo(() => {
    if (!erProvider) return null
    return new Program(idl, erProvider)
  }, [erProvider])

  const playerPda = useMemo(() => {
    if (!wallet.publicKey) return null
    return web3.PublicKey.findProgramAddressSync(
      [Buffer.from('player'), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    )[0]
  }, [wallet.publicKey])

  const playerAccountNamespace = useCallback(
    (program: Program) =>
      program.account as unknown as Record<string, { fetch: (pda: web3.PublicKey) => Promise<PlayerAccount> }>,
    []
  )

  const handleSetup = useCallback(async () => {
    if (!baseProgram || !erProgram || !wallet.publicKey || !playerPda) return
    setDelegating(true)
    setError(null)
    try {
      await baseProgram.methods
        .initialize()
        .accounts({
          payer: wallet.publicKey,
          player: playerPda,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()
        .catch(() => {
          /* already initialized — fine */
        })

      await baseProgram.methods
        .delegatePlayer()
        .accounts({
          payer: wallet.publicKey,
          pda: playerPda,
        })
        .rpc()

      setDelegated(true)

      try {
        const account = await playerAccountNamespace(erProgram).player.fetch(playerPda)
        setPullsDone(account.pullsDone)
        setPitySinceGrand(account.pullsSinceLegendary)
      } catch {
        setPullsDone(0)
        setPitySinceGrand(0)
      }
    } catch (e: unknown) {
      console.error(e)
      setError(friendlyRpcError(e))
      connection.getBalance(wallet.publicKey).then(setSetupLamports).catch(() => {})
    } finally {
      setDelegating(false)
    }
  }, [baseProgram, erProgram, wallet.publicKey, playerPda, playerAccountNamespace, connection])

  const handlePull = useCallback(async () => {
    if (!erProgram || !wallet.publicKey || !playerPda || !category) return
    setPulling(true)
    setError(null)
    setResult(null)
    setLatencyMs(null)
    setLastPull(null)
    setMintedPullIndex(null)
    setMintedAddress(null)
    setMintError(null)

    const startedAt = performance.now()

    try {
      const clientSeed = Math.floor(Math.random() * 255)

      await erProgram.methods
        .pullGacha(clientSeed)
        .accounts({
          payer: wallet.publicKey,
          player: playerPda,
        })
        .rpc()

      const accountNamespace = playerAccountNamespace(erProgram)

      let attempts = 0
      let updated: PlayerAccount | null = null
      const priorPulls = pullsDone ?? 0
      while (attempts < 15 && !updated) {
        await new Promise((r) => setTimeout(r, 200))
        const account = await accountNamespace.player.fetch(playerPda)
        if (account.pullsDone > priorPulls) updated = account
        attempts++
      }

      if (updated) {
        setLatencyMs(Math.round(performance.now() - startedAt))
        setPullsDone(updated.pullsDone)
        setPitySinceGrand(updated.pullsSinceLegendary)
        const card = resolveCard(category, updated.lastRarity, updated.lastCardSeed)
        setResult(card)
        setResultCategory(category)
        setLastPull({ rarity: updated.lastRarity, cardSeed: updated.lastCardSeed, pullIndex: updated.pullsDone })
        onReveal(card, category)
      } else {
        setError('Pull sent, still resolving — check back in a moment.')
      }
    } catch (e: unknown) {
      console.error(e)
      setError(e instanceof Error ? e.message : 'Pull failed')
    } finally {
      setPulling(false)
    }
  }, [erProgram, wallet.publicKey, playerPda, playerAccountNamespace, pullsDone, onReveal, category])

  const handleMint = useCallback(async () => {
    if (!baseProgram || !wallet.publicKey || !lastPull) return
    setMinting(true)
    setMintError(null)
    try {
      // Mints on the base layer (not the ER) so the card is a real, durable SPL token
      // any wallet — including Seeker — can see. A 0-decimal mint with mint authority
      // revoked right after minting 1 token is the simplest form of an NFT.
      const pullIndexBytes = Buffer.alloc(4)
      pullIndexBytes.writeUInt32LE(lastPull.pullIndex)

      const [mintPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('card_mint'), wallet.publicKey.toBuffer(), pullIndexBytes],
        PROGRAM_ID
      )
      const [cardRecordPda] = web3.PublicKey.findProgramAddressSync(
        [Buffer.from('card_record'), mintPda.toBuffer()],
        PROGRAM_ID
      )
      const [tokenAccountPda] = web3.PublicKey.findProgramAddressSync(
        [wallet.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintPda.toBuffer()],
        ASSOCIATED_TOKEN_PROGRAM_ID
      )

      await baseProgram.methods
        .mintCardNft(lastPull.rarity, lastPull.cardSeed, lastPull.pullIndex)
        .accounts({
          payer: wallet.publicKey,
          mint: mintPda,
          cardRecord: cardRecordPda,
          tokenAccount: tokenAccountPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc()
      setMintedPullIndex(lastPull.pullIndex)
      setMintedAddress(mintPda.toBase58())
    } catch (e: unknown) {
      console.error(e)
      setMintError(friendlyRpcError(e))
    } finally {
      setMinting(false)
    }
  }, [baseProgram, wallet.publicKey, lastPull])

  if (!wallet.publicKey) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
        <span className="text-2xl text-flare">✦</span>
        <p className="text-sm font-bold uppercase tracking-widest text-ink/70">
          Connect a wallet above to begin
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 px-4 py-7 sm:py-10">
      <div className="flex w-full items-center justify-between border-b-2 border-ink/30 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/60">Active channel</p>
          <p className="text-lg font-black uppercase text-ink">{getCategory(category).label}</p>
        </div>
        <button onClick={onChangeCategory} className="border-2 border-ink px-3 py-2 text-[10px] font-black uppercase tracking-widest text-ink">
          Change
        </button>
      </div>

      {!delegated && (
        <div className="flex w-full flex-col items-center gap-3">
          <div className="w-full border-4 border-ink bg-paper p-3 text-center shadow-[5px_5px_0_#18171b]">
            <p className="text-sm font-bold uppercase tracking-wide text-flare">First truth's free</p>
            <p className="mt-1 text-xs text-ink/70">
              Zero gas, only possible because MagicBlock's Ephemeral Rollup makes every draw instant.
            </p>
          </div>
          {needsFunding && (
            <div className="w-full border-4 border-red-500 bg-red-950/40 p-3 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-red-300">
                This wallet has no devnet SOL
              </p>
              <p className="mt-1 text-xs text-red-200">
                The one-time setup step runs on Solana devnet and needs a trace of SOL for fees — pulls
                themselves are still free, that's the Ephemeral Rollup's job.
              </p>
              <a
                href={DEVNET_FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-xs font-black uppercase tracking-widest text-red-100 underline"
              >
                Get free devnet SOL →
              </a>
            </div>
          )}
          <button
            onClick={handleSetup}
            disabled={delegating}
            className={`w-full border-4 px-8 py-4 font-black uppercase text-ink active:translate-y-1 disabled:opacity-50 ${getCategory(category).accent}`}
          >
            {delegating ? 'Attuning...' : 'Attune to Obsession'}
          </button>
        </div>
      )}

      {delegated && (
        <div className="flex w-full flex-col items-center gap-3">
          {pullsDone !== null && (
            <div className="w-full">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-ink/70">
                <span>Truths asked: {pullsDone}</span>
                <span>Pity {pitySinceGrand ?? 0}/{PITY_THRESHOLD}</span>
              </div>
              <div className="mt-1 h-2 w-full border-2 border-ink bg-paper">
                <div className="h-full bg-flare transition-all" style={{ width: `${pityPct}%` }} />
              </div>
            </div>
          )}
          {isFirstPull && (
            <div className="w-full border-4 border-flare bg-flare/10 p-2 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-flare">
                First truth's free — no payment required
              </p>
            </div>
          )}
          {pityDue && (
            <div className="w-full border-4 border-paper bg-paper/10 p-2 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-paper">
                The ledger tips in your favor — {pitySinceGrand}/{PITY_THRESHOLD}. A Grand Revelation is due.
              </p>
            </div>
          )}
          <div className="w-full border-4 border-ink bg-paper p-3 shadow-[6px_6px_0_#18171b]">
            <div className={`mx-auto w-40 transition-transform duration-700 ${pulling ? 'animate-pulse scale-95' : 'hover:-translate-y-1'}`}>
              <OracleCardArt category={category} rarity="minor" className="w-full drop-shadow-[5px_5px_0_#fd1789]" />
            </div>
            <button
              onClick={handlePull}
              disabled={pulling}
              className={`mt-4 w-full border-4 px-8 py-4 text-xl font-black uppercase active:translate-y-1 disabled:opacity-50 ${getCategory(category).accent}`}
            >
              {pulling ? 'Consulting Obsession...' : isFirstPull ? 'Draw Revelation - Free' : 'Reveal Your Fortune'}
            </button>
          </div>
        </div>
      )}

      {result && rarityStyle && (
        <div className={`animate-[reveal_500ms_ease-out] flex w-full flex-col items-center gap-2 border-4 ${rarityStyle.ring} bg-paper p-4 text-center shadow-[6px_6px_0_#18171b]`}>
          {resultCategory && (
            <span className="text-[10px] font-black uppercase tracking-widest text-ink/60">
              Your draw · {getCategory(resultCategory).label}
            </span>
          )}
          <span className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-widest ${rarityStyle.badge}`}>
            {rarityStyle.label}
          </span>
          <OracleCardArt category={resultCategory ?? category} rarity={result.rarity} className="h-48 w-36 bg-ink shadow-[6px_6px_0_0_#fd1789]" />
          <div className="text-2xl font-black uppercase text-ink">{result.name}</div>
          <p className="text-sm italic text-ink/70">"{result.reading}"</p>
          {latencyMs !== null && (
            <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-ink/60">
              Sealed by MagicBlock VRF · resolved in {latencyMs}ms
            </p>
          )}
          {lastPull && (
            <div className="mt-2 w-full">
              {mintedPullIndex === lastPull.pullIndex ? (
                <a
                  href={`https://explorer.solana.com/address/${mintedAddress}?cluster=devnet`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 border-4 border-flare bg-flare/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-flare active:translate-y-1"
                >
                  ✦ Minted — View on Explorer ↗
                </a>
              ) : (
                <button
                  onClick={handleMint}
                  disabled={minting}
                  className="w-full border-4 border-ink bg-ink px-4 py-3 text-xs font-black uppercase tracking-widest text-paper active:translate-y-1 disabled:opacity-50"
                >
                  {minting ? 'Minting...' : 'Claim as NFT'}
                </button>
              )}
              {mintError && (
                <p className="mt-2 w-full [overflow-wrap:anywhere] text-[11px] font-bold text-red-500">{mintError}</p>
              )}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="w-full [overflow-wrap:anywhere] border-4 border-red-500 bg-red-950/40 p-2 text-center text-sm text-red-300">
          {error}
        </div>
      )}
    </div>
  )
}
