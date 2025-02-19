import { Client as ThorchainClient } from '@xchainjs/xchain-thorchain'
import { ThorchainAMM } from '@xchainjs/xchain-thorchain-amm'
import { ThorchainQuery } from '@xchainjs/xchain-thorchain-query'
import { Thornode } from '@xchainjs/xchain-thorchain-query'
import { Network } from '@xchainjs/xchain-client'
import { Asset, assetFromString, assetToString } from '@xchainjs/xchain-util'
import { BigNumber } from 'bignumber.js'
import { z } from "zod"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { config } from 'dotenv'
import axios from 'axios'
import { register9Rheader } from '@xchainjs/xchain-util'
import fetch from 'cross-fetch'

config()

// Initialize Nine Realms headers
register9Rheader(axios)

// Initialize Thorchain clients
const thorchainClient = new ThorchainClient({
  network: Network.Mainnet,
  phrase: process.env.THORCHAIN_MNEMONIC || ''
})

const thornode = new Thornode(Network.Mainnet)
const thorchainQuery = new ThorchainQuery()
const thorchainAmm = new ThorchainAMM(thorchainQuery)

// Helper function to format base amounts
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