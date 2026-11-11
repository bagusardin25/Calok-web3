import { BaseError, ContractFunctionRevertedError, UserRejectedRequestError } from 'viem'
import { chain } from '../config/chains'
import { NotDeployedError, SpotMissingError } from './contract'
import { formatDate } from './format'

/** What each contract rejection means, in words a person can act on. */
const REVERTS: Record<string, string> = {
  InvalidLatitude: 'That latitude is outside −90 to 90 degrees.',
  InvalidLongitude: 'That longitude is outside −180 to 180 degrees.',
  NoAmenities: 'Pick at least one thing this spot offers.',
  InvalidAmenities: 'Pick from the four listed amenities.',
  InvalidPlace: 'Pick one of the listed place types.',
  InvalidName: 'The name must be between 3 and 48 bytes.',
  InvalidNote: 'The note can be at most 160 bytes.',
  InvalidReason: 'Pick one of the listed reasons.',
  SpotNotFound: 'There is no spot with that number.',
  SpotIsHidden: 'This spot has been hidden by the moderator.',
  SpotIsClosed: 'The person who added this spot has closed it.',
  OwnSpot: 'You added this spot. Other people have to confirm it.',
  NotAdder: 'Only the person who added this spot can close it.',
  NotOwner: 'Only the moderator can do that.',
  ZeroAddress: 'That address is not valid.',
  TooManyCells: 'Too much map at once. Zoom in and try again.',
  TooManyIds: 'Too many spots at once.',
  InvalidLimit: 'That request is out of range.',
}

const CANCELLED = 'You cancelled the request in your wallet.'
const FALLBACK = 'Something went wrong. Please try again.'

export function describeError(err: unknown): string {
  if (err instanceof NotDeployedError || err instanceof SpotMissingError) return err.message

  if (err instanceof BaseError) {
    if (err.walk((e) => e instanceof UserRejectedRequestError)) return CANCELLED

    const revert = err.walk((e) => e instanceof ContractFunctionRevertedError)
    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName
      if (name === 'CoolingDown') {
        const nextAt = Number(revert.data?.args?.[0] ?? 0)
        return `You already voted on this spot in the last 30 days. You can again from ${formatDate(nextAt)}.`
      }
      if (name && REVERTS[name]) return REVERTS[name]
    }

    const text = `${err.shortMessage} ${err.message}`.toLowerCase()
    if (text.includes('insufficient funds')) return 'This wallet does not hold enough BOT to pay for gas.'
    if (text.includes('does not match the target chain') || text.includes('chain mismatch')) {
      return `Your wallet is on another network. Switch it to ${chain.name} and try again.`
    }
    if (text.includes('http request failed') || text.includes('failed to fetch') || text.includes('timed out')) {
      return `Could not reach ${chain.name}. Check your connection and try again.`
    }
    return err.shortMessage || FALLBACK
  }

  if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 4001) {
    return CANCELLED
  }
  if (err instanceof Error && err.message) return err.message
  return FALLBACK
}
