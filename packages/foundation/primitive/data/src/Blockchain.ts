/**
 * Contains blockchain related constant data.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Common blockchain network ticker metadata.
 *
 * **Example** (Access network ticker values)
 *
 * ```typescript
 * import { Blockchain } from "@beep/data"
 *
 * const ethTicker = Blockchain.Networks.Ethereum.ticker
 * console.assert(ethTicker === "ETH")
 *
 * const btcTicker = Blockchain.Networks.Bitcoin.ticker
 * console.assert(btcTicker === "BTC")
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const Networks = {
  Ethereum: {
    ticker: "ETH",
  },
  Solana: {
    ticker: "SOL",
  },
  Bitcoin: {
    ticker: "BTC",
  },
  "BNB Chain": {
    ticker: "BNB",
  },
  Base: {
    ticker: "BASE",
  },
  Tron: {
    ticker: "TRX",
  },
  Arbitrum: {
    ticker: "ARB",
  },
  Avalanche: {
    ticker: "AVAX",
  },
  Polygon: {
    ticker: "POL",
  },
} as const;
