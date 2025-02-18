import { Client as BitcoinClient, defaultBTCParams, BlockcypherDataProviders as BTCBlockcypherDataProviders } from '@xchainjs/xchain-bitcoin'
import { Client as LitecoinClient, defaultLtcParams } from '@xchainjs/xchain-litecoin'
import { Client as DogeClient, defaultDogeParams } from '@xchainjs/xchain-doge'
import { Client as BitcoinCashClient, defaultBchParams } from '@xchainjs/xchain-bitcoincash'
import { Network } from '@xchainjs/xchain-client'
import { Client as ThorchainClient } from '@xchainjs/xchain-thorchain'
import { ThorchainAMM } from '@xchainjs/xchain-thorchain-amm'
import { ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import { Thornode } from '@xchainjs/xchain-thorchain-query'
import { Asset, Chain, CryptoAmount, assetFromString, assetToString, baseAmount } from '@xchainjs/xchain-util'
import { BigNumber } from 'bignumber.js'
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing'
import { SigningStargateClient } from '@cosmjs/stargate'
import { Registry } from '@cosmjs/proto-signing'
import { HdPath, Slip10RawIndex } from '@cosmjs/crypto'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import pkg from '../../../thornode-js/types/MsgCompiled.js'
const { types } = pkg
import { config } from 'dotenv'
config()

// Initialize Nine Realms headers
import axios from 'axios'
import { register9Rheader } from '@xchainjs/xchain-util'
import fetch from 'cross-fetch'

register9Rheader(axios)

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

// Initialize Thorchain clients
const thorchainClient = new ThorchainClient({
  network: Network.Mainnet,
  phrase: process.env.THORCHAIN_MNEMONIC || ''
})

const thornode = new Thornode(Network.Mainnet)
const thorchainQuery = new ThorchainQuery()
const thorchainAmm = new ThorchainAMM(thorchainQuery)

const bitcoinCashClient = new BitcoinCashClient({
  ...defaultBchParams,
  network: Network.Mainnet,
})

// Helper function to format base amounts for all UTXO chains
function formatBaseAmount(baseAmount: any): string {
  return baseAmount.amount().toString()
}

export function registerThorchainTools(server: McpServer) {
  // Get THORChain balance
  server.tool(
    "getThorchainBalance",
    "Get RUNE balance for an address",
    {
      address: z.string().describe("THORChain address to check"),
    },
    async ({ address }) => {
      try {
        const balances = await thorchainClient.getBalance(address)
        return {
          content: [{
            type: "text",
            text: `THORChain Balance for ${address}:\n${formatBaseAmount(balances[0].amount)} RUNE`,
          }],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve RUNE balance: ${error.message}` }],
        }
      }
    }
  )

  // Execute swap
  server.tool(
    "executeThorchainSwap",
    "Execute a token swap using THORChain (using private key from .env)",
    {
      fromAsset: z.string().describe("Source asset (e.g., 'THOR.RUNE')"),
      toAsset: z.string().describe("Destination asset (e.g., 'BTC.BTC')"),
      amount: z.string().describe("Amount to swap in base units (all THORChain assets use 8 decimals)"),
      destinationAddress: z.string().optional().describe("Optional: Destination address for receiving tokens. If not provided, assets will be kept as synths in your THORChain address"),
      tolerance: z.number().optional().describe("Slippage tolerance in basis points (optional, default 100 = 1%)"),
    },
    async ({ fromAsset: fromAssetString, toAsset: toAssetString, amount, destinationAddress = '', tolerance = 100 }) => {
      try {
        // Parse and validate amount
        const numAmount = new BigNumber(amount);
        if (numAmount.isNaN() || numAmount.isLessThanOrEqualTo(0)) {
          throw new Error('Invalid amount. Please provide a valid positive number.');
        }

        // THORChain standardizes all assets to 8 decimals
        const amountInBaseUnits = numAmount.multipliedBy(1e8).integerValue().toString();

        if (!process.env.THORCHAIN_MNEMONIC) {
          throw new Error('THORCHAIN_MNEMONIC environment variable not set');
        }

        // Parse assets
        const fromAsset = assetFromString(fromAssetString);
        const toAsset = assetFromString(toAssetString);
        if (!fromAsset || !toAsset) {
          throw new Error(`Invalid asset format. Expected format: 'CHAIN.SYMBOL' (e.g., 'THOR.RUNE', 'BTC.BTC')`);
        }

        // Set up registry with THORChain message types
        const registry = new Registry()
        registry.register("/types.MsgDeposit", types.MsgDeposit)

        // Initialize wallet and client
        const wallet = await DirectSecp256k1HdWallet.fromMnemonic(process.env.THORCHAIN_MNEMONIC, {
          prefix: "thor",
          hdPaths: [[Slip10RawIndex.hardened(44), Slip10RawIndex.hardened(931), Slip10RawIndex.hardened(0), Slip10RawIndex.normal(0), Slip10RawIndex.normal(0)]]  // m/44'/931'/0'/0/0
        });
        const client = await SigningStargateClient.connectWithSigner(
          "https://rpc.ninerealms.com",
          wallet,
          { registry }
        );


        // Create swap memo
        const memo = destinationAddress ? `SWAP:${toAssetString}:${destinationAddress}:${tolerance}` : `SWAP:${toAssetString}::${tolerance}`;

        // Create and encode MsgDeposit
        const coin = {
          asset: {
            chain: fromAsset.chain,
            symbol: fromAsset.symbol,
            ticker: fromAsset.ticker,
            synth: false
          },
          amount: amountInBaseUnits,
          decimals: 8
        };

        console.log('Getting wallet accounts...');
        const [address] = await wallet.getAccounts();
        console.log('Using address:', address.address);
        const msgDeposit = {
          coins: [coin],
          memo: memo,
          signer: new TextEncoder().encode(address.address)
        };

        // Prepare transaction
        const msg = {
          typeUrl: "/types.MsgDeposit",
          value: msgDeposit
        };

        // Sign and broadcast
        const fee = {
          amount: [{
            denom: "rune",
            amount: "2000000" // 0.02 RUNE
          }],
          gas: "200000"
        };

        const result = await client.signAndBroadcast(
          address.address,
          [msg],
          fee,
          memo
        );

        if (result.code !== 0) {
          throw new Error(`Transaction failed: ${result.rawLog}`);
        }

        return {
          content: [{
            type: "text",
            text: `Swap transaction successful!\n` +
                  `Transaction Hash: ${result.transactionHash}\n` +
                  `Block Height: ${result.height}\n` +
                  `Gas Used: ${result.gasUsed}\n` +
                  `Raw Log: ${result.rawLog}`
          }]
        };

      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to execute swap: ${error.message}` }]
        };
      }
    }
  )

  // Get pool info
  server.tool(
    "getThorchainPoolInfo",
    "Get information about a THORChain liquidity pool",
    {
      asset: z.string().describe("Asset symbol (e.g., 'BTC.BTC', 'ETH.ETH')"),
    },
    async ({ asset }) => {
      try {
        const pool = await thornode.getPool(asset)
        return {
          content: [{
            type: "text",
            text: `Pool Information for ${asset}:\n` +
              `Status: ${pool.status}\n` +
              `Asset Depth: ${pool.balance_asset}\n` +
              `RUNE Depth: ${pool.balance_rune}\n` +
              `LP Units: ${pool.LP_units}\n` +
              `Synth Units: ${pool.synth_units}`,
          }],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ type: "text", text: `Failed to retrieve pool information: ${error.message}` }],
        }
      }
    }
  )

  // Get swap quote
  server.tool(
    "getThorchainSwapQuote",
    "Get a quote for swapping assets on THORChain",
    {
      fromAsset: z.string().describe("Source asset (e.g., 'BTC.BTC')"),
      toAsset: z.string().describe("Destination asset (e.g., 'ETH.ETH')"),
      amount: z.string().describe("Amount to swap"),
    },
    async ({ fromAsset: fromAssetString, toAsset: toAssetString, amount: amountString }) => {
      try {
        // Parse assets
        const fromAsset = assetFromString(fromAssetString);
        const toAsset = assetFromString(toAssetString);
        if (!fromAsset || !toAsset) {
          return {
            content: [{ type: "text", text: `Invalid asset format. Expected format: 'CHAIN.SYMBOL' (e.g., 'BTC.BTC', 'ETH.ETH')` }],
          }
        }

        // Parse amount
        let numAmount;
        try {
          numAmount = new BigNumber(amountString);
          if (numAmount.isNaN() || numAmount.isLessThanOrEqualTo(0)) {
            throw new Error('Invalid amount');
          }
        } catch (error) {
          return {
            content: [{ type: "text", text: `Invalid amount format. Please provide a valid positive number.` }],
          }
        }

        // Convert amount to base units
        const amountInBaseUnits = numAmount.multipliedBy(10 ** 8).toFixed(0);

        // Format the quote request parameters
        const quoteParams = {
          amount: amountInBaseUnits,
          from_asset: assetToString(fromAsset),
          to_asset: assetToString(toAsset).replace('-B1A', ''),  // Remove B1A suffix
          destination: '',  // Optional destination address
          streaming_interval: '1',
          streaming_quantity: '0'
        };

        // Get quote from THORNode directly
        const response = await fetch(`https://thornode.ninerealms.com/thorchain/quote/swap?${new URLSearchParams(quoteParams)}`);
        if (!response.ok) {
          throw new Error(`THORNode API error: ${response.status} ${response.statusText}`);
        }
        const quote = await response.json();

        // Helper function to format asset amounts with proper decimals
        const formatAssetAmount = (amount: string | number, decimals: number = 8) => {
          const num = Number(amount) / Math.pow(10, decimals);
          return num.toLocaleString('en-US', { maximumFractionDigits: decimals });
        };

        return {
          content: [{
            type: "text",
            text: `Swap Quote:\n` +
              `Expected Output: ${formatAssetAmount(quote.expected_amount_out)} ${quoteParams.to_asset}\n` +
              `Fees:\n` +
              `- Affiliate Fee: ${formatAssetAmount(quote.fees.affiliate)} ${quote.fees.asset}\n` +
              `- Outbound Fee: ${formatAssetAmount(quote.fees.outbound)} ${quote.fees.asset}\n` +
              `- Liquidity Fee: ${formatAssetAmount(quote.fees.liquidity)} ${quote.fees.asset}\n` +
              `- Total Fee: ${formatAssetAmount(quote.fees.total)} ${quote.fees.asset}\n` +
              `Slippage: ${quote.fees.slippage_bps / 100}%\n` +
              `Expires: ${new Date(quote.expiry * 1000).toLocaleString()}\n` +
              `Total Swap Time: ~${quote.total_swap_seconds} seconds`,
          }],
        }
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to get swap quote: ${error.message}` }],
        }
      }
    }
  )

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

// Export both tool registration functions
export function registerAllTools(server: McpServer) {
  registerUtxoTools(server)
  registerThorchainTools(server)
}