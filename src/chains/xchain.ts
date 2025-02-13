import { Client as BitcoinClient, defaultBTCParams, BlockcypherDataProviders as BTCBlockcypherDataProviders } from '@xchainjs/xchain-bitcoin'
import { Client as LitecoinClient, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { Client as DogeClient, defaultDogeParams } from '@xchainjs/xchain-doge'
import { Client as BitcoinCashClient, defaultBchParams } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import { Asset } from '@xchainjs/xchain-util'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { config } from 'dotenv'
config()

// Initialize clients with mainnet by default
const bitcoinClient = new BitcoinClient({
  ...defaultBTCParams,
  network: Network.Mainnet,
  dataProviders: [BTCBlockcypherDataProviders],
})

const litecoinClient = new LitecoinClient({
  ...defaultLtcParams,
  network: Network.Mainnet,
})

const dogeClient = new DogeClient({
  ...defaultDogeParams,
  network: Network.Mainnet,
})

const bitcoinCashClient = new BitcoinCashClient({
  ...defaultBchParams,
  network: Network.Mainnet,
})

// Helper function to format base amounts for all UTXO chains
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerUtxoTools(server: McpServer) {
  // Bitcoin Tools
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

  // Litecoin Tools
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

  // Dogecoin Tools
  server.tool(
    "getDogeBalance",
    "Get balance for a Dogecoin address",
    {
      address: z.string().describe("Dogecoin address to check"),
    },
    async ({ address }) => {
      try {
        const balances = await dogeClient.getBalance(address)
        return {
          content: [
            {
              type: "text",
              text: `Dogecoin Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} DOGE`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve DOGE balance: ${error.message}` }],
        }
      }
    }
  )

  // Bitcoin Cash Tools
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

  // Common Tools for all UTXO chains
  // Transaction History
  const getTransactionHistory = async (client: any, address: string, chain: string, limit = 10, offset = 0) => {
    try {
      const txs = await client.getTransactions({ address, limit, offset })
      const txList = txs.txs.map((tx: any) => {
        const fromAmount = tx.from[0]?.amount ? `${formatBaseAmount(tx.from[0].amount)} ${chain}` : 'Unknown'
        const toAmount = tx.to[0]?.amount ? `${formatBaseAmount(tx.to[0].amount)} ${chain}` : 'Unknown'
        
        return `
Transaction: ${tx.hash}
Type: ${tx.type}
From: ${tx.from[0]?.from || 'Unknown'} (${fromAmount})
To: ${tx.to[0]?.to || 'Unknown'} (${toAmount})
Asset: ${tx.asset.ticker}
Date: ${new Date(tx.date).toLocaleString()}`
      }).join('\n---\n')

      return { success: true, content: txList }
    } catch (err) {
      const error = err as Error
      return { success: false, error: error.message }
    }
  }

  // Register history tools for each chain
  const chains = [
    { name: 'Bitcoin', symbol: 'BTC', client: bitcoinClient },
    { name: 'Litecoin', symbol: 'LTC', client: litecoinClient },
    { name: 'Dogecoin', symbol: 'DOGE', client: dogeClient },
    { name: 'Bitcoin Cash', symbol: 'BCH', client: bitcoinCashClient },
  ]

  chains.forEach(({ name, symbol, client }) => {
    server.tool(
      `get${symbol}TransactionHistory`,
      `Get transaction history for a ${name} address`,
      {
        address: z.string().describe(`${name} address to check`),
        limit: z.number().optional().describe("Maximum number of transactions to return"),
        offset: z.number().optional().describe("Number of transactions to skip"),
      },
      async ({ address, limit = 10, offset = 0 }) => {
        const result = await getTransactionHistory(client, address, symbol, limit, offset)
        return {
          content: [
            {
              type: "text",
              text: result.success
                ? `${name} Transaction History for ${address}:\n${result.content}`
                : `Failed to retrieve ${name} transaction history: ${result.error}`,
            },
          ],
        }
      }
    )

    // Add address validation
    server.tool(
      `validate${symbol}Address`,
      `Validate a ${name} address format`,
      {
        address: z.string().describe(`${name} address to validate`),
      },
      async ({ address }) => {
        try {
          const isValid = client.validateAddress(address)
          return {
            content: [
              {
                type: "text",
                text: isValid 
                  ? `The address ${address} is a valid ${name} address`
                  : `The address ${address} is NOT a valid ${name} address`,
              },
            ],
          }
        } catch (err) {
          const error = err as Error
          return {
            content: [
              {
                type: "text",
                text: `Error validating ${name} address: ${error.message}`,
              },
            ],
          }
        }
      }
    )

    // Add network info
    server.tool(
      `get${symbol}NetworkInfo`,
      `Get current ${name} network information`,
      {},
      async () => {
        try {
          const fees = await client.getFeeRates()
          return {
            content: [
              {
                type: "text",
                text: `${name} Network Information:
Current Network: ${client.getNetwork()}
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
                text: `Failed to retrieve ${name} network information: ${error.message}`,
              },
            ],
          }
        }
      }
    )
  })
}
