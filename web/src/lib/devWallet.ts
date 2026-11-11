// Development only. Loaded through a dynamic import that production builds drop.
//
// A local Hardhat node signs for its own unlocked accounts, so these wallets hold no keys:
// they ask the node to send from one of its addresses. That makes it possible to add a spot
// from one wallet and confirm it from two others without a browser extension.
import { createWalletClient, http } from 'viem'
import type { Address, WalletClient } from 'viem'
import { chain, rpcUrl } from '../config/chains'

export type DevWallet = { id: string; name: string; account: Address; client: WalletClient }

// Account 0 deploys the contract and moderates; 7–9 are left untouched by the seed script.
const SLOTS = [
  { index: 0, name: 'Dev wallet: Moderator' },
  { index: 7, name: 'Dev wallet: Rani' },
  { index: 8, name: 'Dev wallet: Sari' },
  { index: 9, name: 'Dev wallet: Tono' },
]

export async function loadDevWallets(): Promise<DevWallet[]> {
  const client = createWalletClient({ chain, transport: http(rpcUrl) })
  const accounts = await client.getAddresses()
  return SLOTS.filter((slot) => accounts[slot.index]).map((slot) => ({
    id: `dev:${slot.index}`,
    name: slot.name,
    account: accounts[slot.index],
    client,
  }))
}
