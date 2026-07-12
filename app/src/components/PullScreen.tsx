import { useState, useCallback, useMemo, useEffect } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor'
import idl from '../idl/gacha_er.json'
import { resolveCard, CARD_IMAGE, SPECIAL_CARD, PACK_PRICE_SOL, type CardInfo, type Rarity } from './cardRegistry'
import { getCategory, categoryToByte, type Category } from './categories'
import { OracleCardArt } from './OracleCardArt'

type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1]

interface PlayerAccount {
  pullsDone: number
  pullsSinceLegendary: number
  lastRarity: number
  lastCardSeed: number
  lastSpecial: number
}

const PROGRAM_ID = new web3.PublicKey('4re47fFt4ty2BkNS9NuhBUqDSbGZYhydkt42f4c9E7zv')
const TOKEN_PROGRAM_ID = new web3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL')
const DELEGATION_PROGRAM_ID = new web3.PublicKey('DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh')

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
  if (/user rejected|rejected the request|declined|approval denied/i.test(message)) {
    return 'The signature was declined in your wallet. Tap the button again and press Confirm in the Phantom popup. If Phantom warns the transaction "may fail", that is because this game runs on devnet — in Phantom go to Settings → Developer Settings → turn on Testnet Mode and pick Solana Devnet, then draw again.'
  }
  if (/insufficient|debit an account|0x1\b/i.test(message)) {
    return 'This wallet needs a trace of devnet SOL to cover this step. Get some free devnet SOL, then try again.'
  }
  return message
}

export function PullScreen({
  category,
  intention,
  onChangeCategory,
  onReveal,
}: {
  category: Category
  intention?: string
  onChangeCategory: () => void
  onReveal: (card: CardInfo, category: Category) => void
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
  const [lastPull, setLastPull] = useState<{ rarity: number; cardSeed: number; pullIndex: number; special: number } | null>(null)
  const [minting, setMinting] = useState(false)
  const [mintedPullIndex, setMintedPullIndex] = useState<number | null>(null)
  const [mintedAddress, setMintedAddress] = useState<string | null>(null)
  const [mintError, setMintError] = useState<string | null>(null)

  const pityDue = pitySinceGrand !== null && pitySinceGrand >= PITY_WARNING_AT
  const rarityStyle = result ? RARITY_STYLE[result.rarity] : null
  const walletConnected = Boolean(wallet.publicKey)
  const needsFunding = walletConnected && setupLamports !== null && setupLamports < MIN_SETUP_LAMPORTS

  const withWalletTimeout = useCallback(<T,>(promise: Promise<T>, fallbackMessage: string, timeoutMs = 25000) => {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(() => {
        setError(fallbackMessage)
        setPulling(false)
        setDelegating(false)
        reject(new Error(fallbackMessage))
      }, timeoutMs)

      promise.then((value) => {
        window.clearTimeout(timer)
        resolve(value)
      }).catch((error) => {
        window.clearTimeout(timer)
        reject(error)
      })
    })
  }, [])

  useEffect(() => {
    if (wallet.publicKey) return
    setDelegated(false)
    setResult(null)
    setResultCategory(null)
    setError(null)
    setPullsDone(null)
    setPitySinceGrand(null)
    setLatencyMs(null)
    setSetupLamports(null)
    setLastPull(null)
    setMinting(false)
    setMintedPullIndex(null)
    setMintedAddress(null)
    setMintError(null)
    setPulling(false)
    setDelegating(false)
  }, [wallet.publicKey])

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
      [Buffer.from('player_v2'), wallet.publicKey.toBuffer()],
      PROGRAM_ID
    )[0]
  }, [wallet.publicKey])

  const playerAccountNamespace = useCallback(
    (program: Program) =>
      program.account as unknown as Record<string, { fetch: (pda: web3.PublicKey) => Promise<PlayerAccount> }>,
    []
  )

  // Returning players are already initialized + delegated on-chain; detect that and
  // skip the "Start drawing" setup step (and its wallet popups) entirely.
  useEffect(() => {
    if (!wallet.publicKey || !playerPda || !erProgram || delegated) return
    let cancelled = false
    connection
      .getAccountInfo(playerPda)
      .then(async (info) => {
        if (cancelled || !info || !info.owner.equals(DELEGATION_PROGRAM_ID)) return
        setDelegated(true)
        try {
          const account = await playerAccountNamespace(erProgram).player.fetch(playerPda)
          if (!cancelled) {
            setPullsDone(account.pullsDone)
            setPitySinceGrand(account.pullsSinceLegendary)
          }
        } catch {
          if (!cancelled) {
            setPullsDone(0)
            setPitySinceGrand(0)
          }
        }
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [connection, wallet.publicKey, playerPda, erProgram, delegated, playerAccountNamespace])

  const handleSetup = useCallback(async () => {
    if (!baseProgram || !erProgram || !wallet.publicKey || !playerPda) return
    setDelegating(true)
    setError(null)
    try {
      await withWalletTimeout(
        baseProgram.methods
          .initialize()
          .accounts({
            payer: wallet.publicKey,
            player: playerPda,
            treasury: web3.PublicKey.findProgramAddressSync([Buffer.from('treasury')], PROGRAM_ID)[0],
            systemProgram: web3.SystemProgram.programId,
          })
          .rpc()
          .catch(() => {
            /* already initialized — fine */
          }),
        'Wallet action timed out or was cancelled. Try again.'
      )

      // Only delegate if it isn't already — re-delegating an account the delegation
      // program already owns fails with "instruction modified data of an account it
      // does not own" (a confusing, unrecoverable-looking error for something that's
      // actually just "you're already set up").
      const playerAccountInfo = await connection.getAccountInfo(playerPda)
      const alreadyDelegated = playerAccountInfo?.owner.equals(DELEGATION_PROGRAM_ID) ?? false

      if (!alreadyDelegated) {
        await withWalletTimeout(
          baseProgram.methods
            .delegatePlayer()
            .accounts({
              payer: wallet.publicKey,
              pda: playerPda,
            })
            .rpc(),
          'Wallet action timed out or was cancelled. Try again.'
        )
      }

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

      await withWalletTimeout(
        erProgram.methods
          .pullGacha(clientSeed)
          .accounts({
            payer: wallet.publicKey,
            player: playerPda,
          })
          .rpc(),
        'Wallet action timed out or was cancelled. Try again.'
      )

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
        const card = resolveCard(category, updated.lastRarity, updated.lastCardSeed, updated.lastSpecial === 1)
        setResult(card)
        setResultCategory(category)
        setLastPull({
          rarity: updated.lastRarity,
          cardSeed: updated.lastCardSeed,
          pullIndex: updated.pullsDone,
          special: updated.lastSpecial,
        })
        onReveal(card, category)
      } else {
        setError('Pull sent, still resolving — check back in a moment.')
      }
    } catch (e: unknown) {
      console.error(e)
      setError(friendlyRpcError(e))
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
        [Buffer.from('card_mint_v2'), wallet.publicKey.toBuffer(), pullIndexBytes],
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
        .mintCardNft(
          lastPull.rarity,
          lastPull.cardSeed,
          lastPull.pullIndex,
          categoryToByte(category),
          lastPull.special,
        )
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
  }, [baseProgram, wallet.publicKey, lastPull, category])

  if (!walletConnected) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="text-3xl text-flare">✦</span>
        <div className="rounded-none border-4 border-ink bg-[#f5e3cb] px-8 py-6 text-center shadow-[4px_4px_0_#18171b]">
          <p className="text-lg font-black uppercase tracking-[0.24em] text-ink">Wallet disconnected</p>
          <p className="mt-2 text-sm text-ink/75">Reopen Phantom and reconnect to continue drawing.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-0 px-4 py-6 md:py-8">
      <div className="flex w-full flex-col gap-2 border-b-2 border-ink/30 pb-1 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/60">Active channel</p>
          <p className="text-lg font-black uppercase text-ink">{getCategory(category).label}</p>
        </div>
        <button onClick={onChangeCategory} className="rounded-none border-2 border-ink px-3 py-2 text-[10px] font-black uppercase tracking-widest text-ink">
          Change
        </button>
      </div>

      {!delegated && (
        <div className="w-full max-w-md">
          <div className="flex flex-col items-center gap-3 rounded-none border-4 border-ink bg-[#f5e3cb] p-4 text-center shadow-[4px_4px_0_#18171b] sm:flex-row sm:text-left">
            <img
              src={CARD_IMAGE[category]}
              alt={`${getCategory(category).label} card art`}
              className="h-28 w-28 shrink-0 rounded-none object-contain"
            />
            <div>
              <h2 className="text-xl font-black uppercase text-ink">Ready to draw</h2>
              <p className="mt-1 text-sm text-ink/75">Draws are free while Obsession runs on devnet.</p>
              <p className="mt-3 text-xs uppercase tracking-[0.28em] text-ink/60 sm:mt-2">
                Sealed on-chain card draw with a compact oracle reading.
              </p>
            </div>
          </div>

          {needsFunding && (
            <div className="mt-4 rounded-none border-4 border-red-500 bg-red-950/40 p-4 text-sm text-red-200">
              <p className="font-black uppercase tracking-widest text-red-300">No devnet SOL</p>
              <p className="mt-2 leading-6">You need a little devnet SOL in your wallet to start.</p>
              <a
                href={DEVNET_FAUCET_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block rounded-none border border-red-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-red-100"
              >
                Get devnet SOL
              </a>
            </div>
          )}

          <button
            onClick={handleSetup}
            disabled={delegating}
            className="mt-4 w-full rounded-none border-4 border-ink bg-flare px-6 py-4 text-base font-black uppercase tracking-widest text-paper active:translate-y-1 disabled:opacity-50"
          >
            {delegating ? 'Opening...' : 'Start drawing'}
          </button>
        </div>
      )}

      {delegated && (
        <div className="flex w-full flex-col items-center gap-3">
          {!result && (
            <div className="w-full border-4 border-flare bg-flare/10 p-2 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-flare">
                Draw price {PACK_PRICE_SOL[category].toFixed(3)} SOL — waived while Obsession runs on devnet.
              </p>
            </div>
          )}
          {pityDue && !result && (
            <div className="w-full border-4 border-paper bg-paper/10 p-2 text-center">
              <p className="text-xs font-black uppercase tracking-widest text-paper">
                The ledger tips in your favor — {pitySinceGrand}/{PITY_THRESHOLD}. A Grand Revelation is due.
              </p>
            </div>
          )}

          <div
            className={`w-full border-4 bg-paper p-3 text-center shadow-[6px_6px_0_#18171b] ${
              result && rarityStyle ? rarityStyle.ring : 'border-ink'
            }`}
          >
            {result && rarityStyle ? (
              <div className="flex flex-col items-center gap-4 pb-1 text-center md:flex-row md:items-start md:gap-5 md:text-left">
                <div className="mx-0 shrink-0 [perspective:1200px]">
                  <div className="relative h-48 w-36 animate-[card-flip_950ms_cubic-bezier(.3,.9,.35,1.08)_both] [transform-style:preserve-3d]">
                    <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <OracleCardArt
                        category={resultCategory ?? category}
                        rarity={result.rarity}
                        className="h-full w-full"
                      />
                    </div>
                    <div className="absolute inset-0 animate-[card-glow_2.4s_ease-in-out_1s_infinite] [backface-visibility:hidden]">
                      <img
                        src={CARD_IMAGE[resultCategory ?? category]}
                        alt={result.name}
                        className="h-full w-full rounded-none border-2 border-ink object-cover drop-shadow-[6px_6px_0_#fd1789]"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:items-start animate-[rise-in_500ms_ease-out_450ms_both]">
                  {resultCategory && (
                    <span className="text-[10px] font-black uppercase tracking-widest text-ink/60">
                      Your draw · {getCategory(resultCategory).label}
                    </span>
                  )}
                  <span className={`inline-block px-2 py-1 text-xs font-black uppercase tracking-widest ${rarityStyle.badge}`}>
                    {rarityStyle.label}
                  </span>
                  <div className="text-2xl font-black uppercase text-ink">{result.name}</div>
                  <p className="text-sm italic text-ink/70">"{result.reading}"</p>
                  {result.special && (
                    <div className="mt-1 flex w-full items-center gap-3 rounded-none border-2 border-flare/60 bg-ink/5 p-3 text-left">
                      <img
                        src={SPECIAL_CARD.image}
                        alt={`${SPECIAL_CARD.name} — locked`}
                        className="h-16 w-12 shrink-0 rounded-none border-2 border-flare/60 object-cover grayscale"
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-flare">🔒 Special occasion draw</p>
                        <p className="mt-1 text-xs font-black uppercase text-ink">{SPECIAL_CARD.name} · Coming soon</p>
                        <p className="mt-1 text-[11px] leading-4 text-ink/70">{SPECIAL_CARD.reading}</p>
                      </div>
                    </div>
                  )}
                  {intention && (
                    <p className="border-l-2 border-flare pl-2 text-left text-[11px] font-bold text-ink/70">Wish: {intention}</p>
                  )}
                  {latencyMs !== null && (
                    <p className="text-[11px] font-bold uppercase tracking-widest text-ink/60">
                      Sealed by MagicBlock VRF · resolved in {latencyMs}ms
                    </p>
                  )}
                  {lastPull && (
                    <div className="mt-4 w-full">
                      {mintedPullIndex === lastPull.pullIndex ? (
                        <a
                          href={`https://explorer.solana.com/address/${mintedAddress}?cluster=devnet`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex w-full items-center justify-center gap-2 rounded-none border-4 border-flare bg-flare/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-flare active:translate-y-1"
                        >
                          ✦ Minted — View on Explorer ↗
                        </a>
                      ) : (
                        <button
                          onClick={handleMint}
                          disabled={minting}
                          className="w-full rounded-none border-4 border-ink bg-ink px-4 py-3 text-xs font-black uppercase tracking-widest text-paper active:translate-y-1 disabled:opacity-50"
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
              </div>
            ) : (
              <div className={`mx-auto w-40 transition-transform duration-700 ${pulling ? 'animate-pulse scale-95' : 'hover:-translate-y-1'}`}>
                <img
                  src={CARD_IMAGE[category]}
                  alt={`${getCategory(category).label} card pack`}
                  className="w-full rounded-none border-2 border-ink object-contain drop-shadow-[5px_5px_0_#fd1789]"
                />
              </div>
            )}

            <button
              onClick={handlePull}
              disabled={pulling}
              className="mt-4 mx-auto w-[min(90%,18rem)] rounded-none border-4 border-ink bg-flare px-6 py-3 text-lg font-black uppercase text-paper active:translate-y-1 disabled:opacity-50 md:px-8 md:py-5 md:text-xl"
            >
              {pulling ? 'Consulting Obsession...' : result ? 'Draw Again' : 'Draw'}
            </button>
          </div>
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
