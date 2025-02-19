import { Client as LitecoinClient, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { Network } from '@xchainjs/xchain-client'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// Initialize client with mainnet by default
const litecoinClient = new LitecoinClient({
  ...defaultLtcParams,
  network: Network.Mainnet,
})

// Helper function to format base amounts
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerLitecoinTools(server: McpServer) {
  // Litecoin Balance
  server.tool(
    "getLitecoinBalance",
    "Get balance for a Litecoin address",
    {
      address: z.string().describe("Litecoin address to check"),
    },
    async ({ address }) => {
      try {
        const balances = await litecoinClient.getBalance(address)
        return {
          content: [
            {
              type: "text",
              text: `Litecoin Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} LTC`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve LTC balance: ${error.message}` }],
        }
      }
    }
  )

  // Transaction History
  server.tool(
    "getLTCTransactionHistory",
    "Get transaction history for a Litecoin address",
    {
      address: z.string().describe("Litecoin address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return"),
      offset: z.number().optional().describe("Number of transactions to skip"),
    },
    async ({ address, limit = 10, offset = 0 }) => {
      try {
        const txs = await litecoinClient.getTransactions({ address, limit, offset })
        const txList = txs.txs.map((tx: any) => {
          const fromAmount = tx.from[0]?.amount ? `${formatBaseAmount(tx.from[0].amount)} LTC` : 'Unknown'
          const toAmount = tx.to[0]?.amount ? `${formatBaseAmount(tx.to[0].amount)} LTC` : 'Unknown'
          
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
              text: `Litecoin Transaction History for ${address}:\n${txList}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve LTC transaction history: ${error.message}` }],
        }
      }
    }
  )

  // Address Validation
  server.tool(
    "validateLTCAddress",
    "Validate a Litecoin address format",
    {
      address: z.string().describe("Litecoin address to validate"),
    },
    async ({ address }) => {
      try {
        const isValid = litecoinClient.validateAddress(address)
        return {
          content: [
            {
              type: "text",
              text: isValid 
                ? `The address ${address} is a valid Litecoin address`
                : `The address ${address} is NOT a valid Litecoin address`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Error validating Litecoin address: ${error.message}` }],
        }
      }
    }
  )

  // Network Info
  server.tool(
    "getLTCNetworkInfo",
    "Get current Litecoin network information",
    {},
    async () => {
      try {
        const fees = await litecoinClient.getFeeRates()
        return {
          content: [
            {
              type: "text",
              text: `Litecoin Network Information:
Current Network: ${litecoinClient.getNetwork()}
Fee Rates (sats/byte):
  Fast: ${fees.fast}
  Average: ${fees.average}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve Litecoin network information: ${error.message}` }],
        }
      }
    }
  )
}