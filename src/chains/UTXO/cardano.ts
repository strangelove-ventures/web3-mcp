import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import fetch from 'cross-fetch';
import { Lucid, Blockfrost, fromText } from 'lucid-cardano';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

// Type definitions
export interface CardanoToken {
  unit: string;
  name: string;
  quantity: string;
}

export interface CardanoWalletInfo {
  address: string;
  utxoCount: number;
  ada: string;
  tokens: CardanoToken[];
}

export interface CardanoAdaTransactionResult {
  txHash: string;
  senderAddress: string;
  recipientAddress: string;
  amount: number;
  links: {
    explorer: string;
  };
}

export interface CardanoTokenTransactionResult {
  txHash: string;
  senderAddress: string;
  recipientAddress: string;
  token: {
    policyId: string;
    name: string;
    amount: string;
  };
  ada: string;
  links: {
    explorer: string;
  };
}

// Direct .env loading for debugging
const __filename = fileURLToPath(import.meta.url);
const projectRoot = resolve(__filename, '../../../..');
const envPath = resolve(projectRoot, '.env');

// Load env file directly
if (existsSync(envPath)) {
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error('Error loading .env file:', result.error);
  }
}

// Configuration from environment variables
const BLOCKFROST_API_KEY = process.env.BLOCKFROST_API_KEY || '';
const CARDANO_NETWORK = process.env.CARDANO_NETWORK || 'mainnet';
const BLOCKFROST_BASE_URL = `https://cardano-${CARDANO_NETWORK}.blockfrost.io/api/v0`;
const CARDANO_MNEMONIC = process.env.CARDANO_MNEMONIC || '';
const CARDANO_ACCOUNT_INDEX = parseInt(process.env.CARDANO_ACCOUNT_INDEX || '0');

// Helper function to make Blockfrost API requests
async function blockfrostRequest<T>(endpoint: string): Promise<T> {
  const url = `${BLOCKFROST_BASE_URL}${endpoint}`;
  
  try {
    const headers = {
      'project_id': BLOCKFROST_API_KEY
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      let errorText = await response.text();
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    return await response.json() as T;
  } catch (error) {
    throw error;
  }
}

// Helper function to format ADA amounts
function lovelaceToAda(lovelace: string | number): string {
  return (parseInt(String(lovelace)) / 1000000).toFixed(6);
}

// Helper function to format asset name
function formatAssetName(name: string): string {
  try {
    // If the name is in hex, try to convert it to ASCII
    if (/^[0-9a-fA-F]+$/.test(name)) {
      return Buffer.from(name, 'hex').toString('utf8');
    }
    return name;
  } catch (e) {
    return name; // Return original if conversion fails
  }
}

// Initialize Lucid instance
async function initLucid() {
  // Map network name to Lucid network name
  let network: 'Mainnet' | 'Preprod' | 'Preview';
  if (CARDANO_NETWORK === 'mainnet') {
    network = 'Mainnet';
  } else if (['testnet', 'preprod'].includes(CARDANO_NETWORK)) {
    network = 'Preprod';
  } else if (CARDANO_NETWORK === 'preview') {
    network = 'Preview';
  } else {
    network = 'Mainnet';
  }
  
  try {
    // Check for required configurations
    if (!BLOCKFROST_API_KEY) {
      throw new Error('BLOCKFROST_API_KEY is required in .env file');
    }
    
    if (!CARDANO_MNEMONIC) {
      throw new Error('CARDANO_MNEMONIC is required in .env file');
    }
    
    // Create Lucid instance
    const provider = new Blockfrost(
      `https://cardano-${CARDANO_NETWORK}.blockfrost.io/api/v0`,
      BLOCKFROST_API_KEY
    );
    
    const lucid = await Lucid.new(provider, network);
    
    // Load wallet from mnemonic
    try {
      // Trim mnemonic and check for valid words
      const trimmedMnemonic = CARDANO_MNEMONIC.trim();
      const words = trimmedMnemonic.split(/\s+/);
      
      // Check if word count is valid (should be 15 or 24 for Cardano)
      if (words.length !== 15 && words.length !== 24) {
        throw new Error(`Invalid mnemonic: Expected 15 or 24 words, got ${words.length}`);
      }
      
      // Select wallet from seed
      lucid.selectWalletFromSeed(trimmedMnemonic, { accountIndex: CARDANO_ACCOUNT_INDEX });
      
      // Verify wallet was loaded correctly by checking address
      const address = await lucid.wallet.address();
      if (!address) {
        throw new Error('Failed to derive address from mnemonic');
      }
      
      return lucid;
    } catch (error) {
      throw new Error(`Failed to load wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  } catch (error) {
    throw new Error(`Failed to initialize Lucid: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Get wallet info
export async function getWalletInfo(): Promise<CardanoWalletInfo> {
  try {
    // Initialize Lucid with wallet
    const lucid = await initLucid();
    
    // Get wallet address
    const address = await lucid.wallet.address();
    
    // Get UTXOs
    const utxos = await lucid.wallet.getUtxos();
    
    // Calculate balance
    let adaBalance = '0';
    let tokenBalances: CardanoToken[] = [];
    
    if (utxos.length > 0) {
      // Combine all UTXOs to get total balance
      const value = utxos.reduce(
        (acc, utxo) => acc.add(utxo.assets),
        // @ts-ignore: Lucid types are not fully compatible
        lucid.newValue()
      ).assets;
      
      // Extract ADA balance
      adaBalance = value.lovelace ? lovelaceToAda(value.lovelace) : '0';
      
      // Extract token balances
      for (const [unit, quantity] of Object.entries(value)) {
        if (unit === 'lovelace') continue;
        
        try {
          // Try to get a readable name for the token
          // @ts-ignore: Lucid types are not fully compatible
          const { policyId, assetName } = lucid.utils.fromUnit(unit);
          const displayName = assetName ? 
            // @ts-ignore: Lucid types are not fully compatible
            (lucid.utils.toText(assetName) || formatAssetName(assetName)) : 
            `${policyId.substring(0, 8)}...`;
          
          tokenBalances.push({
            unit,
            name: displayName,
            quantity: (quantity as bigint).toString()
          });
        } catch (e) {
          tokenBalances.push({
            unit,
            name: unit,
            quantity: (quantity as bigint).toString()
          });
        }
      }
    }
    
    return {
      address,
      utxoCount: utxos.length,
      ada: adaBalance,
      tokens: tokenBalances
    };
  } catch (error) {
    throw error;
  }
}

// Send ADA transaction
export async function sendAda(
  recipientAddress: string, 
  amountAda: number, 
  metadata: any = null
): Promise<CardanoAdaTransactionResult> {
  try {
    // Validate input
    if (!recipientAddress) {
      throw new Error('Recipient address is required');
    }
    
    if (typeof amountAda !== 'number' || amountAda <= 0) {
      throw new Error('Amount must be a positive number');
    }
    
    // Initialize Lucid with wallet
    const lucid = await initLucid();
    
    // Get sender address for return value
    const senderAddress = await lucid.wallet.address();
    
    // Validate recipient address
    try {
      // @ts-ignore: Lucid types are not fully compatible
      lucid.utils.getAddressDetails(recipientAddress);
    } catch (error) {
      throw new Error(`Invalid recipient address: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Convert ADA to lovelace
    const lovelaceAmount = BigInt(Math.floor(amountAda * 1000000));
    
    // Build transaction
    // @ts-ignore: Lucid types are not fully compatible
    let tx = lucid.newTx()
      .payToAddress(recipientAddress, { lovelace: lovelaceAmount });
    
    // Add metadata if provided
    if (metadata) {
      const parsedMetadata = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
      // @ts-ignore: Lucid types are not fully compatible
      tx = tx.attachMetadata(674, parsedMetadata);
    }
    
    // Complete the transaction (adds inputs and change output)
    // @ts-ignore: Lucid types are not fully compatible
    tx = await tx.complete();
    
    // Sign the transaction
    // @ts-ignore: Lucid types are not fully compatible
    const signedTx = await tx.sign().complete();
    
    // Submit the transaction
    const txHash = await signedTx.submit();
    
    return {
      txHash,
      senderAddress,
      recipientAddress,
      amount: amountAda,
      links: {
        explorer: `https://cardanoscan.io/transaction/${txHash}`
      }
    };
  } catch (error) {
    throw error;
  }
}

// Send tokens transaction
export async function sendTokens(
  recipientAddress: string, 
  policyId: string, 
  assetName: string, 
  amount: string, 
  adaAmount: number | null = null
): Promise<CardanoTokenTransactionResult> {
  try {
    // Validate input
    if (!recipientAddress) {
      throw new Error('Recipient address is required');
    }
    
    if (!policyId) {
      throw new Error('Policy ID is required');
    }
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Amount must be a positive number');
    }
    
    // Initialize Lucid with wallet
    const lucid = await initLucid();
    
    // Get sender address for return value
    const senderAddress = await lucid.wallet.address();
    
    // Validate recipient address
    try {
      // @ts-ignore: Lucid types are not fully compatible
      lucid.utils.getAddressDetails(recipientAddress);
    } catch (error) {
      throw new Error(`Invalid recipient address: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Convert asset name to hex if it's in readable format
    let assetNameHex = assetName;
    if (assetName && !/^[0-9a-fA-F]+$/.test(assetName)) {
      assetNameHex = fromText(assetName);
    }
    
    // Create the unit identifier
    const unit = `${policyId}${assetNameHex}`;
    
    // Create the assets object
    const assets = { [unit]: BigInt(amount) };
    
    // Calculate minimum required ADA
    // @ts-ignore: Lucid types are not fully compatible
    const minLovelace = await lucid.utils.minAdaRequired({
      outputs: [{ address: recipientAddress, assets }]
    });
    
    // Use provided ADA amount or minimum required
    const outputLovelace = adaAmount 
      ? BigInt(Math.floor(adaAmount * 1000000)) 
      : minLovelace;
    
    // Check if we're sending at least the minimum required
    if (outputLovelace < minLovelace) {
      throw new Error(`Minimum ${lovelaceToAda(minLovelace)} ADA required to send these tokens`);
    }
    
    // Build transaction
    // @ts-ignore: Lucid types are not fully compatible
    let tx = lucid.newTx()
      .payToAddress(recipientAddress, {
        lovelace: outputLovelace,
        ...assets
      });
    
    // Complete the transaction (adds inputs and change output)
    // @ts-ignore: Lucid types are not fully compatible
    tx = await tx.complete();
    
    // Sign the transaction
    // @ts-ignore: Lucid types are not fully compatible
    const signedTx = await tx.sign().complete();
    
    // Submit the transaction
    const txHash = await signedTx.submit();
    
    // Format asset name for display
    const displayAssetName = assetName ? formatAssetName(assetNameHex) : '';
    
    return {
      txHash,
      senderAddress,
      recipientAddress,
      token: {
        policyId,
        name: displayAssetName,
        amount
      },
      ada: lovelaceToAda(outputLovelace),
      links: {
        explorer: `https://cardanoscan.io/transaction/${txHash}`
      }
    };
  } catch (error) {
    throw error;
  }
}

// Interface for Cardano amount
interface CardanoAmount {
  unit: string;
  quantity: string;
}

// Interface for address info
interface AddressInfo {
  address: string;
  amount: string;
  stake_address: string | null;
  type: string;
  script: boolean;
}

export function registerCardanoTools(server: McpServer) {
  // Get Address Balance
  server.tool(
    "getCardanoAddressBalance",
    "Get balance and token holdings for a Cardano address",
    {
      address: z.string().describe("Cardano address to check"),
    },
    async ({ address }) => {
      try {
        // Get address info
        const addressInfo = await blockfrostRequest<AddressInfo>(`/addresses/${address}`);
        
        // Get address UTXOs to get token info
        interface CardanoUtxo {
          tx_hash: string;
          tx_index: number;
          output_index: number;
          amount: CardanoAmount[];
          block: string;
        }
        
        const utxos = await blockfrostRequest<CardanoUtxo[]>(`/addresses/${address}/utxos`);
        
        // Extract all tokens from UTXOs
        const tokenMap = new Map<string, bigint>();
        
        utxos.forEach(utxo => {
          utxo.amount.forEach(asset => {
            const currentAmount = tokenMap.get(asset.unit) || BigInt(0);
            tokenMap.set(asset.unit, currentAmount + BigInt(asset.quantity));
          });
        });
        
        // Get ADA balance
        const adaBalance = tokenMap.get('lovelace') || BigInt(addressInfo.amount);
        
        // Remove lovelace from token map for separate display
        tokenMap.delete('lovelace');
        
        // Convert token map to array for sorting and formatting
        const tokens = Array.from(tokenMap.entries()).map(([unit, quantity]) => {
          // Split into policy ID and asset name
          const policyId = unit.slice(0, 56);
          const assetName = unit.slice(56);
          const formattedName = formatAssetName(assetName);
          
          return {
            unit,
            policyId,
            assetName: formattedName,
            quantity: quantity.toString()
          };
        });
        
        // Sort tokens by quantity (descending)
        tokens.sort((a, b) => (BigInt(b.quantity) - BigInt(a.quantity)) > 0n ? 1 : -1);
        
        // Format token list for display
        const tokenList = tokens.length > 0 
          ? tokens.map(token => 
              `${token.quantity} ${token.assetName || token.unit} (Policy: ${token.policyId.substring(0, 8)}...)`
            ).join('\n')
          : 'No tokens found';
        
        // Build response
        return {
          content: [
            {
              type: "text",
              text: `Cardano Address Balance for ${address}:

ADA Balance: ${lovelaceToAda(adaBalance.toString())} ADA
Stake Address: ${addressInfo.stake_address || 'Not staked'}
Address Type: ${addressInfo.script ? 'Script' : 'Key-based'}

${tokens.length > 0 ? `Token Holdings (${tokens.length}):\n${tokenList}` : 'No token holdings found'}`,
            },
          ],
        }
      } catch (err) {
        const error = err as Error
        return {
          content: [{ 
            type: "text", 
            text: `Failed to retrieve Cardano address balance: ${error.message}` 
          }],
        }
      }
    }
  )
  
  // Get Cardano Wallet Info
  server.tool(
    "getCardanoWalletInfo",
    "Get the current wallet information, including balance and tokens",
    {},
    async () => {
      try {
        // Get wallet info
        const walletInfo = await getWalletInfo();
        
        // Format token list
        const tokenList = walletInfo.tokens.length > 0
          ? walletInfo.tokens.map((token: CardanoToken) => `${token.quantity} ${token.name}`).join('\n')
          : 'No tokens found';
        
        return {
          content: [
            {
              type: "text",
              text: `# Cardano Wallet Information

Address: ${walletInfo.address}
ADA Balance: ${walletInfo.ada} ADA
UTXO Count: ${walletInfo.utxoCount}

${walletInfo.tokens.length > 0 ? `## Token Holdings (${walletInfo.tokens.length}):\n${tokenList}` : 'No token holdings found'}`
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get wallet information: ${error.message}\n\n**Troubleshooting Tips:**\n1. Make sure you have a valid 15 or 24-word Cardano mnemonic in your .env file\n2. Verify your Blockfrost API key is correct and has sufficient access rights\n3. Check the console logs for detailed error information`
            },
          ],
        };
      }
    }
  )
  
  // Send ADA Transaction
  server.tool(
    "sendCardanoAda",
    "Send ADA from your wallet to a recipient address",
    {
      recipientAddress: z.string().describe("Recipient Cardano address"),
      amount: z.number().min(1).describe("Amount of ADA to send"),
      metadata: z.optional(z.string()).describe("Optional transaction metadata in JSON format")
    },
    async ({ recipientAddress, amount, metadata }) => {
      try {
        // Call sendAda
        const result = await sendAda(recipientAddress, amount, metadata);
        
        return {
          content: [
            {
              type: "text",
              text: `# ADA Transaction Successful

Transaction Hash: ${result.txHash}
From: ${result.senderAddress}
To: ${result.recipientAddress}
Amount: ${result.amount} ADA

[View on Explorer](${result.links.explorer})`
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to send ADA: ${error.message}\n\n**Troubleshooting Tips:**\n1. Make sure you have a valid 15 or 24-word Cardano mnemonic in your .env file\n2. Verify your Blockfrost API key is correct and has sufficient access rights\n3. Check that your wallet has sufficient balance\n4. Verify the recipient address is correct\n5. Check the console logs for detailed error information`
            },
          ],
        };
      }
    }
  )
  
  // Send Tokens Transaction
  server.tool(
    "sendCardanoTokens",
    "Send Cardano native tokens from your wallet to a recipient address",
    {
      recipientAddress: z.string().describe("Recipient Cardano address"),
      policyId: z.string().describe("Token policy ID"),
      assetName: z.string().describe("Asset name (can be empty for policy-only tokens)"),
      amount: z.string().describe("Amount of tokens to send"),
      adaAmount: z.optional(z.number()).describe("Optional amount of ADA to send with tokens (will use minimum required if not specified)")
    },
    async ({ recipientAddress, policyId, assetName, amount, adaAmount }) => {
      try {
        // Call sendTokens
        const result = await sendTokens(recipientAddress, policyId, assetName, amount, adaAmount);
        
        return {
          content: [
            {
              type: "text",
              text: `# Token Transaction Successful

Transaction Hash: ${result.txHash}
From: ${result.senderAddress}
To: ${result.recipientAddress}

Token Details:
- Policy ID: ${result.token.policyId}
- Asset Name: ${result.token.name || '(none)'}
- Amount: ${result.token.amount}

Included ADA: ${result.ada} ADA

[View on Explorer](${result.links.explorer})`
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to send tokens: ${error.message}\n\n**Troubleshooting Tips:**\n1. Make sure you have a valid 15 or 24-word Cardano mnemonic in your .env file\n2. Verify your Blockfrost API key is correct and has sufficient access rights\n3. Check that your wallet has sufficient ADA balance for the transaction\n4. Verify the policy ID and asset name are correct\n5. Verify the recipient address is correct\n6. Check the console logs for detailed error information`
            },
          ],
        };
      }
    }
  )
}