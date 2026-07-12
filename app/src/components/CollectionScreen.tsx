import { useEffect, useMemo, useState } from 'react'
import { getCollectionCards, type Rarity, RARITY_MAP } from './cardRegistry'
import { CATEGORIES, getCategory } from './categories'

const RARITY_LABEL: Record<Rarity, string> = {
  minor: 'Minor Omen',
  major: 'Major Omen',
  grand: 'Grand Revelation',
}

// Rarity is shown as a ring/badge around the shared deck art, not as separate artwork.
const RARITY_RING: Record<Rarity, string> = {
  minor: 'border-ink',
  major: 'border-flare',
  grand: 'border-flare shadow-[0_0_24px_-4px_#FD1789]',
}

const allCards = getCollectionCards()

export function CollectionScreen() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const cards = useMemo(() => allCards, [])

  const groupedCards = useMemo(
    () =>
      CATEGORIES.map((category) => ({
        category,
        categoryInfo: getCategory(category.id),
        rarities: RARITY_MAP.map((rarity) => ({
          rarity,
          items: cards
            .map((item, index) => ({ ...item, index }))
            .filter((item) => item.category === category.id && item.card.rarity === rarity),
        })),
      })),
    [cards]
  )

  useEffect(() => {
    if (activeIndex === null) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActiveIndex(null)
      if (event.key === 'ArrowRight') setActiveIndex((index) => (index === null ? index : (index + 1) % cards.length))
      if (event.key === 'ArrowLeft') setActiveIndex((index) => (index === null ? index : (index - 1 + cards.length) % cards.length))
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeIndex, cards.length])

  const active = activeIndex === null ? null : cards[activeIndex]

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-ink/65">The complete set</p>
          <h1 className="mt-2 text-4xl font-black uppercase text-ink sm:text-5xl">Fortune card collection</h1>
        </div>
        <p className="max-w-xs text-sm text-ink/70">Every card that can emerge from Madame Obsession's sealed gacha decks.</p>
      </div>

      {groupedCards.map(({ categoryInfo, rarities }) => (
        <section key={categoryInfo.id} className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b-4 border-ink pb-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-ink/65">{categoryInfo.label} deck</p>
              <h2 className="mt-2 text-3xl font-black uppercase text-ink sm:text-4xl">{categoryInfo.description}</h2>
            </div>
            <span className="rounded-full border-2 border-ink bg-paper px-4 py-1 text-xs font-black uppercase tracking-[0.22em] text-ink shadow-[3px_3px_0_#18171b]">
              {categoryInfo.symbol}
            </span>
          </div>

          <div className="mt-6 space-y-8">
            {rarities.map(({ rarity, items }) => (
              <div key={rarity} className="space-y-4">
                <div className="flex items-center gap-3 text-sm font-black uppercase tracking-widest text-ink">
                  <span className={`inline-flex h-3 w-3 rounded-full ${
                    rarity === 'minor' ? 'bg-ink' : rarity === 'major' ? 'bg-flare' : 'bg-flare'
                  }`} />
                  <span>{RARITY_LABEL[rarity]}</span>
                  <span className="text-ink/55">({items.length} cards)</span>
                </div>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {items.map(({ category, card, index }) => (
                    <article
                      key={`${category}-${card.rarity}-${card.name}`}
                      onClick={() => setActiveIndex(index)}
                      className="flex cursor-pointer gap-4 border-4 border-ink bg-paper p-3 text-left shadow-[5px_5px_0_#18171b] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#18171b]"
                    >
                      <img
                        src={card.image}
                        alt={`${card.name} card art`}
                        className={`h-36 w-24 shrink-0 border-4 bg-ink object-cover ${RARITY_RING[card.rarity]}`}
                      />
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-widest text-flare">{RARITY_LABEL[card.rarity]}</p>
                        <h3 className="mt-2 text-lg font-black uppercase leading-tight text-ink">{card.name}</h3>
                        <p className="mt-2 text-xs italic leading-5 text-ink/70">"{card.reading}"</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {active && (
        <div
          className="fixed inset-0 z-50 flex overflow-y-auto bg-ink/80 p-3 sm:items-center sm:justify-center sm:p-4"
          onClick={() => setActiveIndex(null)}
        >
          <div
            className="relative my-auto flex w-full max-w-lg flex-col gap-4 border-4 border-ink bg-paper p-4 shadow-[8px_8px_0_#18171b] sm:flex-row sm:gap-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              aria-label="Close"
              className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center border-4 border-ink bg-flare text-lg font-black text-paper shadow-[3px_3px_0_#18171b]"
            >
              ×
            </button>

            <img
              src={active.card.image}
              alt={`${active.card.name} card art`}
              className={`mx-auto h-52 w-36 shrink-0 border-4 bg-ink object-cover sm:mx-0 sm:h-64 sm:w-44 ${RARITY_RING[active.card.rarity]}`}
              key={activeIndex}
            />

            <div className="flex min-w-0 flex-col">
              <p className="text-[10px] font-black uppercase tracking-widest text-flare">{RARITY_LABEL[active.card.rarity]}</p>
              <h2 className="mt-2 text-2xl font-black uppercase leading-tight text-ink">{active.card.name}</h2>
              <p className="mt-3 text-sm italic leading-6 text-ink/70">"{active.card.reading}"</p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-widest text-ink/55">{getCategory(active.category).label} deck</p>

              <div className="mt-5 flex items-center justify-between gap-2 sm:mt-auto sm:pt-5">
                <button
                  type="button"
                  onClick={() => setActiveIndex((index) => (index === null ? index : (index - 1 + cards.length) % cards.length))}
                  className="border-4 border-ink bg-ink px-2 py-2 text-[10px] font-black uppercase tracking-widest text-paper shadow-[3px_3px_0_#18171b] active:translate-y-0.5 active:shadow-none sm:px-3 sm:text-xs"
                >
                  ← Prev
                </button>
                <p className="text-[10px] font-black uppercase tracking-widest text-ink/55">
                  {activeIndex! + 1} / {cards.length}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveIndex((index) => (index === null ? index : (index + 1) % cards.length))}
                  className="border-4 border-ink bg-ink px-2 py-2 text-[10px] font-black uppercase tracking-widest text-paper shadow-[3px_3px_0_#18171b] active:translate-y-0.5 active:shadow-none sm:px-3 sm:text-xs"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
