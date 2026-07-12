import { CATEGORIES, type Category } from './categories'

const PACK_DETAILS: Record<Category, { art: string; accent: string }> = {
  life: {
    art: '/cards/Card-Life.png',
    accent: 'bg-[#f8d15c]',
  },
  relationship: {
    art: '/cards/Card-Relation.png',
    accent: 'bg-[#f6aaa8]',
  },
  meme: {
    art: '/cards/Card-Meme.png',
    accent: 'bg-[#a9d7ff]',
  },
}

export function DrawScreen({ onSelect }: { onSelect: (category: Category) => void }) {
  return (
    <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
      <header className="relative border-b-4 border-ink pb-5 sm:flex sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-ink/65">Obsession gacha terminal · 03 decks live</p>
          <h1 className="mt-2 text-4xl font-black uppercase leading-[.86] text-ink sm:text-6xl">Pick your<br className="sm:hidden" /> next omen.</h1>
        </div>
        <p className="mt-4 max-w-xs text-sm font-bold leading-5 text-ink/70 sm:mt-0 sm:text-right">Each sealed card is resolved on-chain. The reveal is yours to keep.</p>
      </header>

      <section className="relative mx-auto mt-8 space-y-8">
        {CATEGORIES.map((category) => {
          const detail = PACK_DETAILS[category.id]
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelect(category.id)}
              aria-label={`Open the ${category.label} card pack`}
              className="group mx-auto w-full max-w-5xl overflow-hidden rounded-none border-4 border-ink bg-paper text-left shadow-[5px_5px_0_#18171b] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#18171b] sm:flex sm:items-stretch"
            >
              <div className="relative flex h-full min-h-[18rem] w-full items-center justify-center bg-ink sm:w-1/2">
                <img src={detail.art} alt={`${category.label} card pack`} className="h-full w-full object-cover" />
              </div>

              <div className="flex flex-1 flex-col gap-4 border-t-4 border-ink p-6 sm:border-t-0 sm:border-l-4 sm:px-8 sm:py-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[.22em] text-ink/60">{category.label} deck</p>
                    <h2 className="mt-2 text-3xl font-black uppercase leading-tight text-ink">{category.label}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[.18em] text-ink ${detail.accent}`}>
                    {category.symbol}
                  </span>
                </div>

                <p className="text-sm leading-6 text-ink/75">{category.description}</p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-sm border border-ink/30 bg-[#fff1d8] p-4 text-xs font-black uppercase tracking-[.18em] text-ink">
                    <div className="text-2xl font-bold">9 cards</div>
                    <div className="mt-1 text-ink/65">3 rarities · 3 per rarity</div>
                  </div>
                  <div className="rounded-sm border border-ink/30 bg-[#fff1d8] p-4 text-xs font-black uppercase tracking-[.18em] text-ink">
                    <div className="text-2xl font-bold">On-chain draw</div>
                    <div className="mt-1 text-ink/65">Instant reveal, zero gas</div>
                  </div>
                </div>

                <div className={`mt-auto border-2 border-ink px-4 py-3 text-sm font-black uppercase tracking-[.14em] text-ink transition-transform group-hover:-translate-y-1 group-focus-visible:-translate-y-1 ${detail.accent}`}>
                  Open {category.label} pack
                </div>
              </div>
            </button>
          )
        })}
      </section>
    </div>
  )
}
