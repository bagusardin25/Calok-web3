export const SITE = {
  name: 'Colok',
  tagline: 'Public outlets, Wi-Fi and water, kept true by the people who pass by',
  /** The project's X profile. Leave empty until the account exists; links to it stay hidden. */
  xUrl: '',
  botchainUrl: 'https://botchain.ai',
  botchainScanUrl: 'https://scan.botchain.ai',
} as const

/**
 * Map tiles. OpenFreeMap needs no account or key and allows commercial use; its style carries
 * the OpenMapTiles and OpenStreetMap credits, which the map always shows uncollapsed.
 * Terms: https://openfreemap.org/tos/
 */
export const TILES = {
  style: 'https://tiles.openfreemap.org/styles/positron',
  provider: 'OpenFreeMap',
  providerUrl: 'https://openfreemap.org',
} as const

export type Amenity = { bit: number; key: 'power' | 'wifi' | 'water' | 'seating'; label: string; short: string }

/** Bit order matches Colok.sol: bit 0 Power, 1 Wi-Fi, 2 Water, 3 Seating. */
export const AMENITIES: readonly Amenity[] = [
  { bit: 1, key: 'power', label: 'Power outlet', short: 'Power' },
  { bit: 2, key: 'wifi', label: 'Free Wi-Fi', short: 'Wi-Fi' },
  { bit: 4, key: 'water', label: 'Water refill', short: 'Water' },
  { bit: 8, key: 'seating', label: 'Seating', short: 'Seating' },
]

export const amenitiesOf = (mask: number): Amenity[] => AMENITIES.filter((a) => (mask & a.bit) !== 0)

export const PLACES = ['Transit', 'Library', 'Park', 'Campus', 'Mall', 'Place of worship', 'Café', 'Other'] as const

export const REASONS = [
  { label: 'Gone', hint: 'It is not there any more.' },
  { label: 'Broken', hint: 'It is there but does not work.' },
  { label: 'No longer free', hint: 'It now costs money or is locked.' },
  { label: 'Wrong place', hint: 'The pin is not where the spot is.' },
] as const

/** Values of Colok.Status. */
export const STATUS = { New: 0, Verified: 1, Stale: 2, ReportedGone: 3, Closed: 4, Hidden: 5 } as const
export type StatusCode = (typeof STATUS)[keyof typeof STATUS]

export type StatusMeta = { label: string; shape: 'outline' | 'solid' | 'faded' | 'struck' | 'none'; explain: string }

export const STATUS_META: Record<number, StatusMeta> = {
  [STATUS.New]: {
    label: 'New',
    shape: 'outline',
    explain: 'It becomes Verified once two other people confirm it.',
  },
  [STATUS.Verified]: {
    label: 'Verified',
    shape: 'solid',
    explain: 'Confirmed by at least two other people, most recently within 90 days.',
  },
  [STATUS.Stale]: {
    label: 'Stale',
    shape: 'faded',
    explain: 'Nobody has confirmed it for more than 90 days. It may have changed.',
  },
  [STATUS.ReportedGone]: {
    label: 'Reported gone',
    shape: 'struck',
    explain: 'More people reported a problem than confirmed it.',
  },
  [STATUS.Closed]: {
    label: 'Closed',
    shape: 'none',
    explain: 'The person who added it took it off the map.',
  },
  [STATUS.Hidden]: {
    label: 'Hidden',
    shape: 'none',
    explain: 'Hidden by the moderator for breaking the rules.',
  },
}

/** Rules enforced by Colok.sol, repeated here so forms can explain them before sending. */
export const RULES = {
  nameMin: 3,
  nameMax: 48,
  noteMax: 160,
  cooldownDays: 30,
  staleDays: 90,
  scoreMax: 3,
  scoreMin: -3,
  /** Spots fetched per cell for the map and the nearby list. */
  perCell: 30,
} as const
