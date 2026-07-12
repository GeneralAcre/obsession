export type Category = 'life' | 'relationship' | 'meme'

export interface CategoryInfo {
  id: Category
  label: string
  description: string
  symbol: string
  accent: string
  accentSoft: string
}

export const CATEGORIES: CategoryInfo[] = [
  {
    id: 'life',
    label: 'Life',
    description: 'Everyday guidance for the path directly ahead',
    symbol: 'SUN',
    accent: 'border-ink bg-paper text-ink',
    accentSoft: 'border-ink bg-paper text-ink',
  },
  {
    id: 'relationship',
    label: 'Relationship',
    description: 'Guidance for bonds, longing, and honest connection',
    symbol: 'TWO',
    accent: 'border-ink bg-[#f6aaa8] text-ink',
    accentSoft: 'border-ink bg-[#f6aaa8] text-ink',
  },
  {
    id: 'meme',
    label: 'Meme',
    description: 'Chaotic clarity for the internet-brained and chronically online',
    symbol: 'LOL',
    accent: 'border-ink bg-[#a9d7ff] text-ink',
    accentSoft: 'border-ink bg-[#a9d7ff] text-ink',
  },
]

export function getCategory(category: Category): CategoryInfo {
  return CATEGORIES.find((item) => item.id === category) ?? CATEGORIES[0]
}

// The on-chain CardRecord stores which deck a mint came from as a plain byte
// (the program never picks a deck itself) — index into CATEGORIES is the encoding.
export function categoryToByte(category: Category): number {
  return CATEGORIES.findIndex((item) => item.id === category)
}

export function categoryFromByte(byte: number): Category {
  return CATEGORIES[byte]?.id ?? CATEGORIES[0].id
}
