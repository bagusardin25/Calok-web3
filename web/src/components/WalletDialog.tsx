import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { chain } from '../config/chains'
import { href } from '../lib/router'
import { useWallet } from '../lib/wallet'
import { CopyButton, Notice } from './Bits'

export function WalletDialog() {
  const wallet = useWallet()
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (wallet.dialogOpen && !dialog.open) dialog.showModal()
    if (!wallet.dialogOpen && dialog.open) dialog.close()
  }, [wallet.dialogOpen])

  const { active } = wallet

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby="wallet-title"
      onClose={wallet.closeDialog}
      onClick={(event) => {
        if (event.target === ref.current) wallet.closeDialog()
      }}
    >
      <div className="dialog__panel">
        <div className="dialog__head">
          <p className="sign-label">Wallet</p>
          <h2 id="wallet-title">{active ? 'Connected' : 'Connect a wallet'}</h2>
          <button type="button" className="icon-btn icon-btn--dark dialog__close" onClick={wallet.closeDialog} aria-label="Close">
            <X size={22} aria-hidden="true" />
          </button>
        </div>

        {active ? (
          <>
            <dl className="facts facts--dark">
              <div>
                <dt>Address</dt>
                <dd className="mono wrap-anywhere">{active.account}</dd>
              </div>
              <div>
                <dt>Wallet</dt>
                <dd>{active.connectorName}</dd>
              </div>
              <div>
                <dt>Network</dt>
                <dd>{wallet.wrongChain ? `Not ${chain.name}` : chain.name}</dd>
              </div>
            </dl>

            {wallet.wrongChain ? (
              <Notice
                tone="warn"
                title={`Your wallet is on another network.`}
                action={
                  <button type="button" className="btn btn--yellow btn--sm" onClick={() => void wallet.switchChain()}>
                    Switch to {chain.name}
                  </button>
                }
              >
                <p>Colok lives on {chain.name}. Switch to add, confirm or report spots.</p>
              </Notice>
            ) : null}
            {wallet.error ? (
              <p className="tx-error" role="alert">
                {wallet.error}
              </p>
            ) : null}

            <div className="dialog__actions">
              <CopyButton text={active.account} label="Copy address" dark />
              <a className="btn btn--ghost-dark btn--sm" href={href.me} onClick={wallet.closeDialog}>
                My spots
              </a>
              <button
                type="button"
                className="btn btn--ghost-dark btn--sm"
                onClick={() => {
                  wallet.disconnect()
                  wallet.closeDialog()
                }}
              >
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="dialog__lead">
              The map is open to everyone. A wallet is only needed to add a spot, confirm one, or report a problem.
            </p>

            {wallet.connectors.length > 0 ? (
              <ul className="connectors">
                {wallet.connectors.map((connector) => (
                  <li key={connector.id}>
                    <button
                      type="button"
                      className="connector"
                      onClick={() => void wallet.connect(connector)}
                      disabled={wallet.connecting !== undefined}
                    >
                      {connector.icon ? (
                        <img className="connector__icon" src={connector.icon} alt="" width={32} height={32} />
                      ) : (
                        <span className="connector__icon connector__icon--blank" aria-hidden="true" />
                      )}
                      <span className="connector__name">{connector.name}</span>
                      <span className="connector__hint">
                        {wallet.connecting === connector.id
                          ? 'Waiting for wallet…'
                          : connector.kind === 'dev'
                            ? 'Local test account'
                            : 'Detected'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Notice title="No wallet found in this browser.">
                <p>
                  Install{' '}
                  <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
                    MetaMask
                  </a>{' '}
                  or open this page inside{' '}
                  <a href="https://wallet.botchain.ai/" target="_blank" rel="noreferrer">
                    BO Wallet
                  </a>
                  , then come back. You can keep using the map in the meantime.
                </p>
              </Notice>
            )}

            {wallet.error ? (
              <p className="tx-error" role="alert">
                {wallet.error}
              </p>
            ) : null}
            <p className="dialog__fine">
              Colok runs on {chain.name} (chain ID {chain.id}). If your wallet does not know the network yet, it will offer to
              add it. Every action costs a little BOT for gas; nothing else is charged.
            </p>
          </>
        )}
      </div>
    </dialog>
  )
}
