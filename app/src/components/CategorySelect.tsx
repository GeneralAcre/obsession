import { useEffect, useRef, useState } from 'react'
import { CATEGORIES, type Category } from './categories'

const DECK_ART: Record<Category, string> = {
  life: '/cards/Card-Life.png',
  relationship: '/cards/Card-Relation.png',
  meme: '/cards/Card-Meme.png',
}

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: 'What is Obsession?',
    answer:
      "Obsession is a gacha-style fortune card app on Solana. Connect a wallet, choose a Life, Relationship, or Meme deck, and draw a sealed card for an instant reading.",
  },
  {
    question: 'How do card rarities work?',
    answer:
      'Every deck has three rarity tiers: Minor Omen, Major Omen, and Grand Revelation. A pity counter guarantees at least one Grand Revelation within 50 draws, so a long dry streak always resolves.',
  },
  {
    question: 'Is a draw provably fair?',
    answer:
      'Yes. Rarity and card seed are resolved on-chain from a verifiable random source, not chosen client-side. The app only picks which local reading text to display for the rarity the chain returned.',
  },
  {
    question: 'Do I need a wallet to draw?',
    answer:
      'Yes. Connect a Solana wallet (Phantom and other wallet-adapter compatible wallets are supported) to submit a draw. Network fees apply and are paid from your wallet.',
  },
  {
    question: 'Can I pull the same card more than once?',
    answer:
      "Yes. Each deck's reading pool is reshuffled on every draw within the rarity the chain returns, so repeats are expected over time — that is normal gacha behavior, not a bug.",
  },
  {
    question: 'Are the readings real advice?',
    answer:
      'No. Every card is entertainment only. Nothing in Obsession is financial, legal, medical, or relationship advice, and no outcome is guaranteed.',
  },
  {
    question: 'Where can I see every possible card?',
    answer: 'Open Collection from the navbar to browse the full set for every deck and tap any card for its full reading.',
  },
  {
    question: 'Where is my draw history?',
    answer: 'Your past draws live in Profile, tied to the connected wallet for the current session.',
  },
]

export function CategorySelect({
  onSelect,
  onBrowse,
  focusFaq = false,
  onFaqScrolled,
}: {
  onSelect: (category: Category, intention: string) => void
  onBrowse: () => void
  focusFaq?: boolean
  onFaqScrolled?: () => void
}) {
  const faqRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusFaq && faqRef.current) {
      faqRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      onFaqScrolled?.()
    }
  }, [focusFaq, onFaqScrolled])

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-0 sm:px-6 sm:pb-14 lg:px-8">
      <section className="relative isolate left-1/2 right-1/2 min-h-[calc(65svh-5rem)] w-screen -translate-x-1/2 overflow-hidden bg-ink text-paper sm:min-h-[calc(70svh-4.5rem)]">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <img src="/obsession-landing.png" alt="The fortune parlor at Obsession" className="h-full w-full object-cover object-[50%_57%]" />
          <div className="absolute inset-0 bg-gradient-to-b from-ink/95 via-ink/60 to-transparent" />
        </div>
        <div className="relative flex min-h-[calc(65svh-5rem)] items-center px-4 py-8 sm:min-h-[calc(70svh-4.5rem)] sm:px-10 sm:py-14 lg:px-14 lg:py-18">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-flare">The story</p>
            <h2 className="mt-3 text-4xl font-black uppercase leading-none sm:text-5xl lg:text-6xl">Every question becomes a keepsake.</h2>
            <p className="mt-6 max-w-4xl text-lg leading-9 text-paper/90 lg:text-xl">
              Madame Obsession gathers stray hopes, market hunches, and heart-shaped doubts into sealed capsule decks. Each pull reveals one original fortune card for your collection.
            </p>
            <p className="mt-6 text-sm font-black uppercase tracking-widest text-paper/75">Collect the signs. Return when the answer changes.</p>
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="grid gap-5 md:grid-cols-3">
          {CATEGORIES.map((category) => (
            <button
              key={category.id}
              onClick={() => onSelect(category.id, '')}
              className="group relative mx-auto aspect-[1054/1492] w-full max-w-[23rem] overflow-hidden border-4 border-ink bg-ink text-left shadow-[7px_7px_0_#18171b] transition-transform hover:-translate-y-1 active:translate-y-1 active:shadow-none"
            >
              <img src={DECK_ART[category.id]} alt={`${category.label} deck`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/95 via-ink/50 to-transparent px-5 pb-5 pt-16 text-paper">
                <p className="text-2xl font-black uppercase leading-none sm:text-3xl">{category.label}</p>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.18em] text-paper/80">Choose deck +</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      <button type="button" onClick={onBrowse} className="group relative isolate mt-6 h-36 w-full overflow-hidden border-4 border-ink bg-ink text-left shadow-[6px_6px_0_#18171b] outline-none sm:h-44">
        <img src="/Browse-deck.png" alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-85 transition-opacity group-hover:opacity-100" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/75 via-ink/25 to-transparent" />
        <div className="flex h-full items-end p-5 sm:p-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-flare">Madame Obsession</p>
            <h2 className="mt-1 text-3xl font-black uppercase leading-none text-paper sm:text-4xl">Browse the deck</h2>
          </div>
        </div>
      </button>

      <section ref={faqRef} className="mt-10">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-ink/70">Need to know</p>
        <h2 className="mt-2 text-3xl font-black uppercase text-ink sm:text-4xl">Frequently asked questions</h2>

        <div className="mt-5 flex flex-col gap-3">
          {FAQ_ITEMS.map((item) => (
            <FaqItem key={item.question} question={item.question} answer={item.answer} />
          ))}
        </div>
      </section>
    </div>
  )
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false)
  return (
    <div className="border-4 border-ink bg-paper shadow-[5px_5px_0_#18171b]">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 p-4 text-left"
      >
        <span className="text-sm font-black uppercase leading-tight text-ink sm:text-base">{question}</span>
        <span className="shrink-0 text-xl font-black text-flare">{isOpen ? '−' : '+'}</span>
      </button>
      {isOpen && <p className="border-t-2 border-ink/15 p-4 pt-3 text-sm leading-6 text-ink/75">{answer}</p>}
    </div>
  )
}
