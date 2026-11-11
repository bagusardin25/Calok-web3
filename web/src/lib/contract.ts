import type { Address } from 'viem'
import { colokAbi } from '../config/abi'
import { CONTRACT_ADDRESS, chain } from '../config/chains'
import { RULES } from '../config/site'
import { MAX_CELLS } from '../geo/cells'
import { publicClient } from './client'

export type Spot = {
  id: number
  adder: Address
  lat: number
  lng: number
  cell: number
  amenities: number
  place: number
  score: number
  status: number
  closed: boolean
  hidden: boolean
  createdAt: number
  lastConfirmedAt: number
  lastConfirmer: Address
  confirmations: number
  reports: number
  name: string
  note: string
}

/** The lighter shape the contract returns for map and list queries. */
export type Pin = {
  id: number
  lat: number
  lng: number
  amenities: number
  place: number
  score: number
  status: number
  lastSeenAt: number
  confirmations: number
  reports: number
  name: string
}

export type Stats = { spots: number; verified: number; confirmations: number; reports: number; mappers: number }

export type Mapper = { wallet: Address; added: number; confirms: number; reports: number; firstAt: number }

export type MyVote = { votedAt: number; kind: number; reason: number; nextAt: number }

/** Values of Colok.VoteBlock. */
export const VOTE_BLOCK = { Ok: 0, NotFound: 1, Hidden: 2, Closed: 3, OwnSpot: 4, CoolingDown: 5 } as const

export class NotDeployedError extends Error {
  constructor() {
    super(`Colok has not been deployed on ${chain.name} yet.`)
    this.name = 'NotDeployedError'
  }
}

export class SpotMissingError extends Error {
  constructor() {
    super('There is no spot with that number.')
    this.name = 'SpotMissingError'
  }
}

function contract() {
  if (!CONTRACT_ADDRESS) throw new NotDeployedError()
  return { address: CONTRACT_ADDRESS, abi: colokAbi } as const
}

// ───────────────────────────── Reads ─────────────────────────────

export async function fetchStats(): Promise<Stats> {
  const [spots, verified, confirmations, reports, mappers] = await publicClient.readContract({
    ...contract(),
    functionName: 'stats',
  })
  return { spots, verified, confirmations, reports, mappers }
}

export async function fetchSpot(id: number): Promise<Spot> {
  const c = contract()
  const count = await publicClient.readContract({ ...c, functionName: 'spotCount' })
  if (id < 1 || BigInt(id) > count) throw new SpotMissingError()
  return publicClient.readContract({ ...c, functionName: 'getSpot', args: [BigInt(id)] })
}

export type CellResult = { pins: Pin[]; truncated: boolean }

/** Open spots in the given cells. `truncated` is true when some cell holds more than we asked for. */
export async function fetchPinsInCells(cells: number[]): Promise<CellResult> {
  if (cells.length === 0) return { pins: [], truncated: false }
  const c = contract()
  const unique = [...new Set(cells)].slice(0, MAX_CELLS)
  const [pins, counts] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'getSpotsInCells', args: [unique, BigInt(RULES.perCell)] }),
    publicClient.readContract({ ...c, functionName: 'cellCounts', args: [unique] }),
  ])
  return { pins: [...pins], truncated: counts.some((n) => n > RULES.perCell) }
}

/** The newest spots anywhere, open ones only, as pins. Used when the map is zoomed out too far. */
export async function fetchRecentPins(limit = 20): Promise<Pin[]> {
  const [page] = await publicClient.readContract({ ...contract(), functionName: 'getSpots', args: [0n, BigInt(limit)] })
  return page
    .filter((s) => !s.closed && !s.hidden)
    .map((s) => ({
      id: s.id,
      lat: s.lat,
      lng: s.lng,
      amenities: s.amenities,
      place: s.place,
      score: s.score,
      status: s.status,
      lastSeenAt: s.lastConfirmedAt || s.createdAt,
      confirmations: s.confirmations,
      reports: s.reports,
      name: s.name,
    }))
}

/** Where the newest open spot is, for opening the map somewhere useful. */
export async function fetchNewestSpotLocation(): Promise<{ lat: number; lng: number } | null> {
  const [recent] = await fetchRecentPins(10)
  return recent ? { lat: recent.lat / 1e6, lng: recent.lng / 1e6 } : null
}

export async function fetchSpotsByIds(ids: readonly number[]): Promise<Spot[]> {
  const c = contract()
  const out: Spot[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100).map(BigInt)
    const page = await publicClient.readContract({ ...c, functionName: 'getSpotsByIds', args: [chunk] })
    out.push(...page.filter((s) => s.id !== 0))
  }
  return out
}

export async function fetchVote(id: number, wallet: Address): Promise<{ vote: MyVote; block: number; nextAt: number }> {
  const c = contract()
  const [vote, [block, nextAt]] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'voteOf', args: [BigInt(id), wallet] }),
    publicClient.readContract({ ...c, functionName: 'canVote', args: [BigInt(id), wallet] }),
  ])
  return { vote, block, nextAt }
}

export type MySpots = { added: Spot[]; voted: { spot: Spot; vote: MyVote }[]; mapper: Mapper }

export async function fetchMySpots(wallet: Address): Promise<MySpots> {
  const c = contract()
  const [addedIds, votedIds, mapper] = await Promise.all([
    publicClient.readContract({ ...c, functionName: 'spotsBy', args: [wallet] }),
    publicClient.readContract({ ...c, functionName: 'votedOn', args: [wallet] }),
    publicClient.readContract({ ...c, functionName: 'mapperOf', args: [wallet] }),
  ])
  const newestFirst = (ids: readonly number[]) => [...ids].reverse()
  const [added, votedSpots] = await Promise.all([fetchSpotsByIds(newestFirst(addedIds)), fetchSpotsByIds(newestFirst(votedIds))])
  const votes = await Promise.all(
    votedSpots.map((s) => publicClient.readContract({ ...c, functionName: 'voteOf', args: [BigInt(s.id), wallet] })),
  )
  return { added, voted: votedSpots.map((spot, i) => ({ spot, vote: votes[i] })), mapper }
}

/** Every wallet that has taken part, with its counts. */
export async function fetchMappers(): Promise<Mapper[]> {
  const c = contract()
  const out: Mapper[] = []
  for (let cursor = 0; ; cursor += 100) {
    const page = await publicClient.readContract({ ...c, functionName: 'getMappers', args: [BigInt(cursor), 100n] })
    out.push(...page)
    if (page.length < 100) break
  }
  return out
}

export async function fetchMapper(wallet: Address): Promise<Mapper> {
  return publicClient.readContract({ ...contract(), functionName: 'mapperOf', args: [wallet] })
}

export async function fetchOwner(): Promise<Address> {
  return publicClient.readContract({ ...contract(), functionName: 'owner' })
}

// ───────────────────────────── Writes ─────────────────────────────
//
// Each function dry-runs the call first. A rule the contract would reject surfaces here as a
// readable error before the wallet is asked to sign anything.

export const prepare = {
  addSpot: (account: Address, lat: number, lng: number, amenities: number, place: number, name: string, note: string) =>
    publicClient.simulateContract({
      ...contract(),
      account,
      functionName: 'addSpot',
      args: [lat, lng, amenities, place, name, note],
    }),

  confirm: (account: Address, id: number) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'confirm', args: [BigInt(id)] }),

  report: (account: Address, id: number, reason: number) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'report', args: [BigInt(id), reason] }),

  closeSpot: (account: Address, id: number) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'closeSpot', args: [BigInt(id)] }),

  setHidden: (account: Address, id: number, hidden: boolean) =>
    publicClient.simulateContract({ ...contract(), account, functionName: 'setHidden', args: [BigInt(id), hidden] }),
}
