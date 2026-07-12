import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { AnchorProvider, Program, web3 } from '@coral-xyz/anchor'
import idl from '../idl/gacha_er.json'
import { resolveCard, type CardInfo, type Rarity } from './cardRegistry'
import { categoryFromByte, getCategory, type Category } from './categories'

type AnchorWallet = ConstructorParameters<typeof AnchorProvider>[1]

const PROGRAM_ID = new web3.PublicKey('4re47fFt4ty2BkNS9NuhBUqDSbGZYhydkt42f4c9E7zv')
const ER_ENDPOINT = 'https://devnet-as.magicblock.app'
const ER_WS_ENDPOINT = 'wss://devnet-as.magicblock.app'
// How far back to look for minted cards. Caps RPC batching (getMultipleAccountsInfo
// tops out around 100 pubkeys per call) — shows the most recent pulls, not the oldest.
const MAX_PULLS_SCANNED = 100

const RARITY_LABEL: Record<Rarity, string> = {
  minor: 'MINOR OMEN',
  major: 'MAJOR OMEN',
  grand: 'GRAND REVELATION',
}

interface MintedCard {
  mint: string
  card: CardInfo
  category: Category
  pullIndex: number
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export function ProfileScreen() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const [cards, setCards] = useState<MintedCard[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!wallet.publicKey) {
      setCards([])
      setError(null)
      return
    }
    const walletPublicKey = wallet.publicKey
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const baseProvider = new AnchorProvider(connection, wallet as unknown as AnchorWallet, { preflightCommitment: 'processed' })
        const baseProgram = new Program(idl, baseProvider)
        const erConnection = new web3.Connection(ER_ENDPOINT, { wsEndpoint: ER_WS_ENDPOINT, commitment: 'confirmed' })
        const erProvider = new AnchorProvider(erConnection, wallet as unknown as AnchorWallet, { preflightCommitment: 'processed' })
        const erProgram = new Program(idl, erProvider)

        const [playerPda] = web3.PublicKey.findProgramAddressSync(
          [Buffer.from('player_v2'), walletPublicKey.toBuffer()],
          PROGRAM_ID
        )

        let pullsDone = 0
        try {
          const playerAccounts = erProgram.account as unknown as Record<string, { fetch: (pda: web3.PublicKey) => Promise<{ pullsDone: number }> }>
          const player = await playerAccounts.player.fetch(playerPda)
          pullsDone = player.pullsDone
        } catch {
          pullsDone = 0
        }

        if (pullsDone === 0) {
          if (!cancelled) setCards([])
          return
        }

        const from = Math.max(1, pullsDone - MAX_PULLS_SCANNED + 1)
        const pullIndexes: number[] = []
        for (let i = pullsDone; i >= from; i--) pullIndexes.push(i)

        const mintPdas = pullIndexes.map((pullIndex) => {
          const pullIndexBytes = Buffer.alloc(4)
          pullIndexBytes.writeUInt32LE(pullIndex)
          return web3.PublicKey.findProgramAddressSync(
            [Buffer.from('card_mint_v2'), walletPublicKey.toBuffer(), pullIndexBytes],
            PROGRAM_ID
          )[0]
        })
        const cardRecordPdas = mintPdas.map(
          (mintPda) => web3.PublicKey.findProgramAddressSync([Buffer.from('card_record'), mintPda.toBuffer()], PROGRAM_ID)[0]
        )

        const found: MintedCard[] = []
        for (const batch of chunk(
          cardRecordPdas.map((pda, i) => ({ pda, pullIndex: pullIndexes[i], mint: mintPdas[i] })),
          100
        )) {
          const infos = await connection.getMultipleAccountsInfo(batch.map((b) => b.pda))
          infos.forEach((info, i) => {
            if (!info) return
            try {
              const record = baseProgram.coder.accounts.decode<{
                rarity: number
                cardSeed: number
                category: number
                special: number
              }>('cardRecord', info.data)
              const category = categoryFromByte(record.category)
              const card = resolveCard(category, record.rarity, record.cardSeed, record.special === 1)
              found.push({ mint: batch[i].mint.toBase58(), card, category, pullIndex: batch[i].pullIndex })
            } catch {
              /* not a CardRecord — skip */
            }
          })
        }

        found.sort((a, b) => b.pullIndex - a.pullIndex)
        if (!cancelled) setCards(found)
      } catch (e) {
        console.error(e)
        if (!cancelled) setError('Could not load your collection right now — try again in a moment.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [connection, wallet, wallet.publicKey])

  const walletAddress = wallet.publicKey?.toBase58() ?? null

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-7 px-6 py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ink/65">Player profile</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-ink text-5xl">My fortune cards</h1>
          {walletAddress ? (
            <p className="mt-2 font-mono text-xs text-ink/65">
              Connected · {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
            </p>
          ) : (
            <p className="mt-2 text-xs font-bold text-ink/65">Connect a wallet to see your minted cards.</p>
          )}
        </div>
        <div className="border-4 border-ink bg-paper px-5 py-3 text-center shadow-[4px_4px_0_#18171b]">
          <p className="text-2xl font-black text-ink">{cards.length}</p>
          <p className="text-[10px] font-black uppercase tracking-widest text-ink/65">NFTs minted</p>
        </div>
      </div>

      {!walletAddress ? null : loading ? (
        <div className="mt-10 border-4 border-ink bg-paper p-8 text-center shadow-[5px_5px_0_#18171b]">
          <p className="text-sm font-black uppercase tracking-widest text-ink/65">Reading the chain...</p>
        </div>
      ) : error ? (
        <div className="mt-10 border-4 border-red-500 bg-red-950/40 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-widest text-red-300">{error}</p>
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-10 border-4 border-ink bg-paper p-8 text-center shadow-[5px_5px_0_#18171b]">
          <p className="text-2xl font-black uppercase text-ink">Your cabinet is waiting.</p>
          <p className="mt-2 text-sm text-ink/65">Draw a fortune and claim it as an NFT to begin your collection.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 grid-cols-2 lg:grid-cols-3">
          {cards.map((entry) => (
            <a
              key={entry.mint}
              href={`https://explorer.solana.com/address/${entry.mint}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="flex gap-4 border-4 border-ink bg-paper p-3 shadow-[5px_5px_0_#18171b] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#18171b]"
            >
              <img src={entry.card.image} alt={`${entry.card.name} card art`} className="h-36 w-24 shrink-0 border-2 border-ink bg-ink object-cover" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-flare">
                    {RARITY_LABEL[entry.card.rarity]} · {getCategory(entry.category).label}
                  </span>
                </div>
                <div className="mt-2 font-black uppercase text-ink">{entry.card.name}</div>
                <p className="mt-1 text-xs italic text-ink/70">"{entry.card.reading}"</p>
                <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-ink/45">View on Explorer ↗</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
