import { Client as BitcoinClient, defaultBTCParams, BlockcypherDataProviders as BTCBlockcypherDataProviders } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Initialize client with mainnet by default
const bitcoinClient = new BitcoinClient({
  ...defaultBTCParams,
  network: Network.Mainnet,
  dataProviders: [BTCBlockcypherDataProviders],
})

// Helper function to format base amounts
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerBitcoinTools(server: McpServer) {
  // Bitcoin Balance
  server.tool(
    "getBitcoinBalance",
    "Get balance for a Bitcoin address",
    {
      address: z.string().describe("Bitcoin address to check"),
    },
    async ({ address }) => {
      try {
        const balances = await bitcoinClient.getBalance(address)
        return {
          content: [
            {
              type: "text",
              text: `Bitcoin Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} BTC`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve BTC balance: ${error.message}` }],
        }
      }
    }
  )

  // Transaction History
  server.tool(
    "getBTCTransactionHistory",
    "Get transaction history for a Bitcoin address",
    {
      address: z.string().describe("Bitcoin address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return"),
      offset: z.number().optional().describe("Number of transactions to skip"),
    },
    async ({ address, limit = 10, offset = 0 }) => {
      try {
        const txs = await bitcoinClient.getTransactions({ address, limit, offset })
        const txList = txs.txs.map((tx: any) => {
          const fromAmount = tx.from[0]?.amount ? `${formatBaseAmount(tx.from[0].amount)} BTC` : 'Unknown'
          const toAmount = tx.to[0]?.amount ? `${formatBaseAmount(tx.to[0].amount)} BTC` : 'Unknown'
          
          return `
Transaction: ${tx.hash}
Type: ${tx.type}
From: ${tx.from[0]?.from || 'Unknown'} (${fromAmount})
To: ${tx.to[0]?.to || 'Unknown'} (${toAmount})
Asset: ${tx.asset.ticker}
Date: ${new Date(tx.date).toLocaleString()}`
        }).join('\n---\n')

        return {
          content: [
            {
              type: "text",
              text: `Bitcoin Transaction History for ${address}:\n${txList}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve BTC transaction history: ${error.message}` }],
        }
      }
    }
  )

  // Address Validation
  server.tool(
    "validateBTCAddress",
    "Validate a Bitcoin address format",
    {
      address: z.string().describe("Bitcoin address to validate"),
    },
    async ({ address }) => {
      try {
        const isValid = bitcoinClient.validateAddress(address)
        return {
          content: [
            {
              type: "text",
              text: isValid 
                ? `The address ${address} is a valid Bitcoin address`
                : `The address ${address} is NOT a valid Bitcoin address`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Error validating Bitcoin address: ${error.message}` }],
        }
      }
    }
  )

  // Network Info
  server.tool(
    "getBTCNetworkInfo",
    "Get current Bitcoin network information",
    {},
    async () => {
      try {
        const fees = await bitcoinClient.getFeeRates()
        return {
          content: [
            {
              type: "text",
              text: `Bitcoin Network Information:
Current Network: ${bitcoinClient.getNetwork()}
Fee Rates (sats/byte):
  Fast: ${fees.fast}
  Average: ${fees.average}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve Bitcoin network information: ${error.message}` }],
        }
      }
    }
  )
}