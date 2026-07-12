import type { Category } from './categories'

export type Rarity = 'minor' | 'major' | 'grand'

export interface CardInfo {
  id: number
  name: string
  reading: string
  image: string
  rarity: Rarity
}

type CardCopy = Pick<CardInfo, 'name' | 'reading'>
type Pool = Record<Rarity, CardCopy[]>

// The chain supplies rarity and seed. Category only chooses this client-side reading pool.
const POOLS: Record<Category, Pool> = {
  life: {
    minor: [
      { name: 'Open Window', reading: 'A small change of air clears a thought you have been carrying too long.' },
      { name: 'Second Bell', reading: 'The invitation returns. This time, answer it.' },
      { name: 'Loose Thread', reading: 'Pull gently. What unravels has already served its purpose.' },
    ],
    major: [
      { name: 'The Long Table', reading: 'Make room for the people who make ordinary days feel possible.' },
      { name: 'Northbound', reading: 'A decision made slowly becomes the direction you needed.' },
      { name: 'Clear Water', reading: 'The truth is simple once you stop asking it to be convenient.' },
    ],
    grand: [
      { name: 'The First Light', reading: 'A new chapter is already underway. Step into it before certainty arrives.' },
      { name: 'The Unbroken Path', reading: 'What felt scattered is arranging itself into a route only you can walk.' },
      { name: 'Golden Hour', reading: 'Say yes to the opening. It will not remain open forever.' },
    ],
  },
  relationship: {
    minor: [
      { name: 'Shared Silence', reading: 'Not every pause is distance. Let the moment breathe.' },
      { name: 'Open Hand', reading: 'Offer the honest version before you offer the polished one.' },
      { name: 'Returned Song', reading: 'A familiar feeling is asking for a new response.' },
    ],
    major: [
      { name: 'Two Lanterns', reading: 'Connection grows when both people can be seen without performing.' },
      { name: 'The Honest Mirror', reading: 'Say the difficult thing with care. It has waited long enough.' },
      { name: 'Tide Between Us', reading: 'Distance clarifies what closeness was trying to tell you.' },
    ],
    grand: [
      { name: 'The Joining Star', reading: 'A bond shifts from possibility to practice. Meet it with courage.' },
      { name: 'Heartline', reading: 'Choose the relationship that lets you become more yourself.' },
      { name: 'The Kept Promise', reading: 'What is meant to endure now asks for your full presence.' },
    ],
  },
  meme: {
    minor: [
      { name: 'Main Character Buffering', reading: 'The plot has not stalled; it is loading a more dramatic cutscene.' },
      { name: 'Group Chat Omen', reading: 'Read the room, then send the message you have been typing and deleting.' },
      { name: 'Touch Grass', reading: 'A brief log-off will reveal the answer your feed cannot provide.' },
    ],
    major: [
      { name: 'The Algorithm Knows', reading: 'The pattern keeps finding you. Notice what it is trying to make obvious.' },
      { name: 'Unexpected Lore', reading: 'A casual detail becomes important. Save it for the season finale.' },
      { name: 'Peak Cinema', reading: 'Commit to the bit. The timing is too perfect to waste.' },
    ],
    grand: [
      { name: 'Legendary Screenshot', reading: 'This moment will be referenced for years. Document it with care.' },
      { name: 'Timeline Reset', reading: 'The old arc is over. Enter the new era without an apology post.' },
      { name: 'Galaxy Brain', reading: 'Your strange connection is correct. Follow it before everyone else catches up.' },
    ],
  },
}

export const RARITY_MAP: Rarity[] = ['minor', 'major', 'grand']

// One illustrated card face per deck; rarity is conveyed by the badge/ring around it, not separate art.
export const CARD_IMAGE: Record<Category, string> = {
  life: '/cards/Card-Life.png',
  relationship: '/cards/Card-Relation.png',
  meme: '/cards/Card-Meme.png',
}

export function resolveCard(category: Category, rarityByte: number, cardSeed: number): CardInfo {
  const rarity = RARITY_MAP[rarityByte] ?? 'minor'
  const pool = POOLS[category][rarity]
  const item = pool[cardSeed % pool.length]
  return { ...item, id: rarityByte * 1000 + cardSeed, image: CARD_IMAGE[category], rarity }
}

export function getCollectionCards(): { category: Category; card: CardInfo }[] {
  return (Object.keys(POOLS) as Category[]).flatMap((category) =>
    RARITY_MAP.flatMap((rarity, rarityIndex) =>
      POOLS[category][rarity].map((item, index) => ({
        category,
        card: {
          ...item,
          id: rarityIndex * 100 + index,
          image: CARD_IMAGE[category],
          rarity,
        },
      }))
    )
  )
}
