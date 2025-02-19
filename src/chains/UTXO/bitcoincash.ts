import { Client as BitcoinCashClient, defaultBchParams } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Initialize client with mainnet by default
const bitcoinCashClient = new BitcoinCashClient({
  ...defaultBchParams,
  network: Network.Mainnet,
})

// Helper function to format base amounts
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerBitcoinCashTools(server: McpServer) {
  // Bitcoin Cash Balance
  server.tool(
    "getBitcoinCashBalance",
    "Get balance for a Bitcoin Cash address",
    {
      address: z.string().describe("Bitcoin Cash address to check"),
    },
    async ({ address }) => {
      try {
        const balances = await bitcoinCashClient.getBalance(address)
        return {
          content: [
            {
              type: "text",
              text: `Bitcoin Cash Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} BCH`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve BCH balance: ${error.message}` }],
        }
      }
    }
  )

  // Transaction History
  server.tool(
    "getBCHTransactionHistory",
    "Get transaction history for a Bitcoin Cash address",
    {
      address: z.string().describe("Bitcoin Cash address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return"),
      offset: z.number().optional().describe("Number of transactions to skip"),
    },
    async ({ address, limit = 10, offset = 0 }) => {
      try {
        const txs = await bitcoinCashClient.getTransactions({ address, limit, offset })
        const txList = txs.txs.map((tx: any) => {
          const fromAmount = tx.from[0]?.amount ? `${formatBaseAmount(tx.from[0].amount)} BCH` : 'Unknown'
          const toAmount = tx.to[0]?.amount ? `${formatBaseAmount(tx.to[0].amount)} BCH` : 'Unknown'
          
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
              text: `Bitcoin Cash Transaction History for ${address}:\n${txList}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve BCH transaction history: ${error.message}` }],
        }
      }
    }
  )

  // Address Validation
  server.tool(
    "validateBCHAddress",
    "Validate a Bitcoin Cash address format",
    {
      address: z.string().describe("Bitcoin Cash address to validate"),
    },
    async ({ address }) => {
      try {
        const isValid = bitcoinCashClient.validateAddress(address)
        return {
          content: [
            {
              type: "text",
              text: isValid 
                ? `The address ${address} is a valid Bitcoin Cash address`
                : `The address ${address} is NOT a valid Bitcoin Cash address`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Error validating Bitcoin Cash address: ${error.message}` }],
        }
      }
    }
  )

  // Network Info
  server.tool(
    "getBCHNetworkInfo",
    "Get current Bitcoin Cash network information",
    {},
    async () => {
      try {
        const fees = await bitcoinCashClient.getFeeRates()
        return {
          content: [
            {
              type: "text",
              text: `Bitcoin Cash Network Information:
Current Network: ${bitcoinCashClient.getNetwork()}
Fee Rates (sats/byte):
  Fast: ${fees.fast}
  Average: ${fees.average}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve Bitcoin Cash network information: ${error.message}` }],
        }
      }
    }
  )
}