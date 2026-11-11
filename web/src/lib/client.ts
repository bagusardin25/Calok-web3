import { createPublicClient, http } from 'viem'
import { chain, rpcUrl } from '../config/chains'

/** Read-only connection to the chain. Works without a wallet, so anyone can read the map. */
export const publicClient = createPublicClient({
  chain,
  // batch: one HTTP request for the reads a screen fires together.
  transport: http(rpcUrl, { retryCount: 2, timeout: 15_000, batch: { wait: 16 } }),
})
