import { defineChain, getAddress, isAddress } from 'viem'
import type { Address, Chain } from 'viem'
import deployments from './deployments.json'

export type NetworkKey = 'local' | 'testnet' | 'mainnet'

const BOT = { name: 'BOT', symbol: 'BOT', decimals: 18 } as const

const chains: Record<NetworkKey, Chain> = {
  mainnet: defineChain({
    id: 677,
    name: 'BOT Chain',
    nativeCurrency: BOT,
    rpcUrls: { default: { http: ['https://rpc.botchain.ai'] } },
    blockExplorers: { default: { name: 'BOT Chain Explorer', url: 'https://scan.botchain.ai' } },
  }),
  testnet: defineChain({
    id: 968,
    name: 'BOT Chain Testnet',
    nativeCurrency: BOT,
    rpcUrls: { default: { http: ['https://rpc.bohr.life'] } },
    blockExplorers: { default: { name: 'BOT Chain Testnet Explorer', url: 'https://scan.bohr.life' } },
    testnet: true,
  }),
  local: defineChain({
    id: 31337,
    name: 'Local chain',
    nativeCurrency: BOT,
    rpcUrls: { default: { http: ['http://127.0.0.1:8547'] } },
    testnet: true,
  }),
}

function isNetworkKey(value: unknown): value is NetworkKey {
  return value === 'local' || value === 'testnet' || value === 'mainnet'
}

/**
 * Which network the app talks to. Set VITE_CHAIN to override; otherwise the dev server
 * uses the local chain and production builds use BOT Chain Mainnet.
 */
export const NETWORK: NetworkKey = isNetworkKey(import.meta.env.VITE_CHAIN)
  ? import.meta.env.VITE_CHAIN
  : import.meta.env.DEV
    ? 'local'
    : 'mainnet'

export const chain: Chain = chains[NETWORK]
export const rpcUrl: string = chain.rpcUrls.default.http[0]

const deployed = (deployments as Record<NetworkKey, string>)[NETWORK]

/** Address of the Colok contract on the active network, if it has been deployed there. */
export const CONTRACT_ADDRESS: Address | undefined = isAddress(deployed) ? getAddress(deployed) : undefined

const explorer = chain.blockExplorers?.default.url

export const explorerAddressUrl = (address: string): string | undefined =>
  explorer ? `${explorer}/address/${address}` : undefined

export const explorerTxUrl = (hash: string): string | undefined => (explorer ? `${explorer}/tx/${hash}` : undefined)
