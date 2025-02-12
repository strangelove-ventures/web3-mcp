import { Client as BitcoinClient, defaultBTCParams, BlockcypherDataProviders } from '@xchainjs/xchain-bitcoin'
import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { config } from 'dotenv'
config()

const BTC_ASSET: Asset = { 
  chain: 'BTC',
  symbol: 'BTC',
  ticker: 'BTC',
  synth: false
}

// Initialize Bitcoin client with mainnet by default
const bitcoinClient = new BitcoinClient({
  ...defaultBTCParams,
  network: Network.Mainnet,
  dataProviders: [BlockcypherDataProviders],
})

export function registerBitcoinTools(server: McpServer) {
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
              text: `Bitcoin Balance for ${address}:\n${balances[0].amount.amount().toString()} BTC`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve balance: ${error.message}`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    "validateBitcoinAddress",
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
          content: [
            {
              type: "text",
              text: `Error validating address: ${error.message}`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    "getBitcoinTransactionData",
    "Get transaction details for a Bitcoin transaction",
    {
      txId: z.string().describe("Bitcoin transaction ID/hash"),
    },
    async ({ txId }) => {
      try {
        const txData = await bitcoinClient.getTransactionData(txId)
        
        // Format amounts if available using amount.amount()
        const fromAmount = txData.from[0]?.amount ? `${txData.from[0].amount.amount().toString()} BTC` : 'Unknown'
        const toAmount = txData.to[0]?.amount ? `${txData.to[0].amount.amount().toString()} BTC` : 'Unknown'

        return {
          content: [
            {
              type: "text",
              text: `Transaction Details for ${txId}:
Hash: ${txData.hash}
From: ${txData.from[0]?.from || 'Unknown'} (${fromAmount})
To: ${txData.to[0]?.to || 'Unknown'} (${toAmount})
Asset: ${txData.asset.ticker}
Type: ${txData.type}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve transaction data: ${error.message}`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    "getBitcoinTransactionHistory",
    "Get transaction history for a Bitcoin address",
    {
      address: z.string().describe("Bitcoin address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return"),
      offset: z.number().optional().describe("Number of transactions to skip"),
    },
    async ({ address, limit = 10, offset = 0 }) => {
      try {
        const txs = await bitcoinClient.getTransactions({
          address,
          limit,
          offset
        })

        const txList = txs.txs.map(tx => {
          const fromAmount = tx.from[0]?.amount ? `${tx.from[0].amount.amount().toString()} BTC` : 'Unknown'
          const toAmount = tx.to[0]?.amount ? `${tx.to[0].amount.amount().toString()} BTC` : 'Unknown'
          
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
              text: `Transaction History for ${address}:\n${txList}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve transaction history: ${error.message}`,
            },
          ],
        }
      }
    }
  )

  server.tool(
    "getBitcoinNetworkInfo",
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
          content: [
            {
              type: "text",
              text: `Failed to retrieve network information: ${error.message}`,
            },
          ],
        }
      }
    }
  )
}
