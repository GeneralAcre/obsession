import type { Category } from './categories'

export type Rarity = 'minor' | 'major' | 'grand'

export interface CardInfo {
  id: number
  name: string
  reading: string
  meaning: string
  image: string
  rarity: Rarity
  special?: boolean
}

type CardCopy = Pick<CardInfo, 'name' | 'reading' | 'meaning'>
type Pool = Record<Rarity, CardCopy[]>

// The chain supplies rarity and seed. Category only chooses this client-side reading pool.
const POOLS: Record<Category, Pool> = {
  life: {
    minor: [
      {
        name: 'Open Window',
        reading: 'A small change of air clears a thought you have been carrying too long',
        meaning: 'A new perspective helps you release an old worry and see the next step clearly',
      },
      {
        name: 'Second Bell',
        reading: 'The invitation returns. This time, answer it',
        meaning: 'A second chance is arriving. This is a good moment to act where you hesitated before',
      },
      {
        name: 'Loose Thread',
        reading: 'Pull gently. What unravels has already served its purpose',
        meaning: 'A small problem is a clue. Follow it carefully and it will reveal what needs to change',
      },
    ],
    major: [
      {
        name: 'The Long Table',
        reading: 'Make room for the people who make ordinary days feel possible',
        meaning: 'Supportive relationships and everyday connections matter more than grand gestures right now',
      },
      {
        name: 'Northbound',
        reading: 'A decision made slowly becomes the direction you needed',
        meaning: 'Deliberate choices may feel slow, but they are aligning you with the path you want',
      },
      {
        name: 'Clear Water',
        reading: 'The truth is simple once you stop asking it to be convenient',
        meaning: 'Clarity comes when you stop overthinking and let the simplest answer surface',
      },
    ],
    grand: [
      {
        name: 'The First Light',
        reading: 'A new chapter is already underway. Step into it before certainty arrives',
        meaning: 'A major beginning is here. Trust the momentum even if the future is not clear yet',
      },
      {
        name: 'The Unbroken Path',
        reading: 'What felt scattered is arranging itself into a route only you can walk',
        meaning: 'Your experience is converging into a single direction meant for you',
      },
      {
        name: 'Golden Hour',
        reading: 'Say yes to the opening. It will not remain open forever',
        meaning: 'A powerful opportunity is available now. Lean into it before it passes',
      },
    ],
  },
  relationship: {
    minor: [
      {
        name: 'Shared Silence',
        reading: 'Not every pause is distance. Let the moment breathe',
        meaning: 'Quiet moments can deepen connection; not every pause is a sign of trouble',
      },
      {
        name: 'Open Hand',
        reading: 'Offer the honest version before you offer the polished one',
        meaning: 'Vulnerability is more valuable than perfection in relationships right now',
      },
      {
        name: 'Returned Song',
        reading: 'A familiar feeling is asking for a new response',
        meaning: 'An old pattern needs a fresh reaction to move forward',
      },
    ],
    major: [
      {
        name: 'Two Lanterns',
        reading: 'Connection grows when both people can be seen without performing',
        meaning: 'True closeness depends on both people being honest and human, not impressive',
      },
      {
        name: 'The Honest Mirror',
        reading: 'Say the difficult thing with care. It has waited long enough',
        meaning: 'A necessary conversation will clear the way if you speak with empathy',
      },
      {
        name: 'Tide Between Us',
        reading: 'Distance clarifies what closeness was trying to tell you',
        meaning: 'A little space may reveal what kind of attention the relationship actually needs',
      },
    ],
    grand: [
      {
        name: 'The Joining Star',
        reading: 'A bond shifts from possibility to practice. Meet it with courage',
        meaning: 'A significant relationship is moving into a more committed, real stage',
      },
      {
        name: 'Heartline',
        reading: 'Choose the relationship that lets you become more yourself',
        meaning: 'The healthiest connection supports your identity rather than reshaping it',
      },
      {
        name: 'The Kept Promise',
        reading: 'What is meant to endure now asks for your full presence',
        meaning: 'Long-term commitments require your attention and consistency now',
      },
    ],
  },
  meme: {

    minor: [
      {
        name: 'Main Character Buffering',
        reading: 'The plot has not stalled; it is loading a more dramatic cutscene',
        meaning: 'The delay is part of the story. Better moments are on their way',
      },
      {
        name: 'Group Chat Omen',
        reading: 'Read the room, then send the message you have been typing and deleting',
        meaning: 'Notice the social energy around you before you speak. Timing matters',
      },
      {
        name: 'Touch Grass',
        reading: 'A brief log-off will reveal the answer your feed cannot provide',
        meaning: 'Stepping away from screens will clear your head and show you what matters',
      },
    ],
    major: [
      {
        name: 'The Algorithm Knows',
        reading: 'The pattern keeps finding you. Notice what it is trying to make obvious',
        meaning: 'Repeated signals are not random. Pay attention to what the system is highlighting',
      },
      {
        name: 'Unexpected Lore',
        reading: 'A casual detail becomes important. Save it for the season finale',
        meaning: 'What seems small today may become essential later. Keep it in mind',
      },
      {
        name: 'Peak Cinema',
        reading: 'Commit to the bit. The timing is too perfect to waste',
        meaning: 'This moment has dramatic energy. Lean into it and own the spotlight',
      },
    ],
    grand: [
      {
        name: 'Legendary Screenshot',
        reading: 'This moment will be referenced for years. Document it with care',
        meaning: 'This experience will last in memory. Capture it intentionally',
      },
      {
        name: 'Timeline Reset',
        reading: 'The old arc is over. Enter the new era without an apology post',
        meaning: 'A major reset is happening. Embrace the fresh start confidently',
      },
      {
        name: 'Galaxy Brain',
        reading: 'Your strange connection is correct. Follow it before everyone else catches up',
        meaning: 'Trust your unconventional insight; it is likely to lead to something bigger',
      },
    ],
  },
}

export const RARITY_MAP: Rarity[] = ['minor', 'major', 'grand']

// Display price per pack draw. On-chain draws are currently free on devnet; these are the
// advertised prices shown across the UI (waived until a base-layer payment design ships).
export const PACK_PRICE_SOL: Record<Category, number> = {
  life: 0.001,
  relationship: 0.002,
  meme: 0.001,
}

// One illustrated card face per deck; rarity is conveyed by the badge/ring around it, not separate art.
export const CARD_IMAGE: Record<Category, string> = {
  life: '/cards/Card-Life.png',
  relationship: '/cards/Card-Relation.png',
  meme: '/cards/Card-Meme.png',
}

// Bonus card layered onto a special pull. Teases the upcoming Teller feature — locked until it ships.
export const SPECIAL_CARD = {
  image: '/Card-Special.png',
  name: 'Teller',
  reading: 'Madame Obsession is waiting to speak with you directly. This channel is sealed until it opens',
}

export function resolveCard(
  category: Category,
  rarityByte: number,
  cardSeed: number,
  special = false,
): CardInfo {
  const rarity = RARITY_MAP[rarityByte] ?? 'minor'
  const pool = POOLS[category][rarity]
  const item = pool[cardSeed % pool.length]
  return {
    ...item,
    id: rarityByte * 1000 + cardSeed,
    image: CARD_IMAGE[category],
    rarity,
    special,
  }
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
