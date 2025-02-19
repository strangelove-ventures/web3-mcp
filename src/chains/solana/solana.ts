import { config } from 'dotenv';
config();

import { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { 
  TOKEN_PROGRAM_ID,
  AccountLayout,
} from '@solana/spl-token';
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import bs58 from 'bs58';
import { getJupiterQuote, buildJupiterSwapTransaction, executeJupiterSwap, formatQuoteDetails } from './jupiter.js';

const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// Initialize Solana connection
const solanaConnection = new Connection(SOLANA_RPC, 'confirmed');

// Helper function to get token accounts for a wallet
async function getTokenAccounts(walletAddress: string) {
  try {
    const owner = new PublicKey(walletAddress);
    const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(
      owner,
      {
        programId: TOKEN_PROGRAM_ID
      }
    );

    return tokenAccounts.value.map(account => {
      const parsedAccountInfo = account.account.data.parsed.info;
      return {
        mint: new PublicKey(parsedAccountInfo.mint),
        amount: parsedAccountInfo.tokenAmount.uiAmount,
        decimals: parsedAccountInfo.tokenAmount.decimals,
        tokenAccount: account.pubkey.toString()
      };
    });
  } catch (error) {
    console.error('Error fetching token accounts:', error);
    return [];
  }
}

interface SwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps?: number;
}

export function registerSolanaTools(server: McpServer) {
  // Debug: Check environment variables
  console.error('Debug - ENV vars available:', Object.keys(process.env));
  console.error('Debug - SOLANA_PRIVATE_KEY exists:', !!process.env.SOLANA_PRIVATE_KEY);
  if (!process.env.SOLANA_PRIVATE_KEY) {
    console.error('Warning: SOLANA_PRIVATE_KEY not found in environment');
  }

  server.tool(
    "getMyAddress",
    "Get your Solana public address from private key in .env",
    {},
    async () => {
      try {
        if (!process.env.SOLANA_PRIVATE_KEY) {
          throw new Error('SOLANA_PRIVATE_KEY not found in environment variables');
        }

        const privateKeyBytes = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);
        const publicKey = keypair.publicKey.toString();

        // Get SOL balance
        const balance = await solanaConnection.getBalance(keypair.publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        // Get token balances
        const tokenAccounts = await getTokenAccounts(publicKey);
        const tokenBalances = tokenAccounts
          .filter(account => account.amount > 0)
          .map(account => `${account.amount} (Mint: ${account.mint.toString()})`)
          .join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Your Solana Address: ${publicKey}\nSOL Balance: ${solBalance} SOL\n\nToken Balances:\n${tokenBalances}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get address: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "getBalance",
    "Get balance for a Solana address",
    {
      address: z.string().describe("Solana account address"),
    },
    async ({ address }) => {
      try {
        const publicKey = new PublicKey(address);
        const balance = await solanaConnection.getBalance(publicKey);
        const solBalance = balance / LAMPORTS_PER_SOL;

        return {
          content: [
            {
              type: "text",
              text: `Balance for ${address}:\n${solBalance} SOL`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve balance for address: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "getAccountInfo",
    "Get detailed account information for a Solana address",
    {
      address: z.string().describe("Solana account address"),
      encoding: z.enum(['base58', 'base64', 'jsonParsed']).optional().describe("Data encoding format"),
    },
    async ({ address, encoding = 'base64' }) => {
      try {
        const publicKey = new PublicKey(address);
        const accountInfo = await solanaConnection.getAccountInfo(
          publicKey,
          'confirmed'
        );

        if (!accountInfo) {
          return {
            content: [
              {
                type: "text",
                text: `No account found for address: ${address}`,
              },
            ],
          };
        }

        let formattedData: string;
        if (encoding === 'base58') {
          formattedData = bs58.encode(accountInfo.data);
        } else if (encoding === 'base64') {
          formattedData = Buffer.from(accountInfo.data).toString('base64');
        } else {
          formattedData = Buffer.from(accountInfo.data).toString('base64');
        }

        return {
          content: [
            {
              type: "text",
              text: `Account Information for ${address}:
Lamports: ${accountInfo.lamports} (${accountInfo.lamports / LAMPORTS_PER_SOL} SOL)
Owner: ${accountInfo.owner.toBase58()}
Executable: ${accountInfo.executable}
Rent Epoch: ${accountInfo.rentEpoch}
Data Length: ${accountInfo.data.length} bytes
Data (${encoding}): ${formattedData}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve account information: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "getSplTokenBalances",
    "Get SPL token balances for a Solana address",
    {
      address: z.string().describe("Solana account address"),
    },
    async ({ address }) => {
      try {
        const tokenAccounts = await getTokenAccounts(address);

        if (tokenAccounts.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No token accounts found for address: ${address}`,
              },
            ],
          };
        }

        const balancesList = tokenAccounts
          .filter(account => account.amount > 0)
          .map(account => `Mint: ${account.mint.toString()}\nBalance: ${account.amount}\nDecimals: ${account.decimals}\nToken Account: ${account.tokenAccount}`)
          .join('\n\n');

        return {
          content: [
            {
              type: "text",
              text: `Token Balances for ${address}:\n\n${balancesList}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve token balances: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "getSwapQuote",
    "Get best swap quote from Jupiter DEX aggregator",
    {
      inputMint: z.string().describe("Input token mint address"),
      outputMint: z.string().describe("Output token mint address"),
      amount: z.string().describe("Amount of input tokens (in smallest denomination)"),
      slippageBps: z.number().optional().describe("Slippage tolerance in basis points (optional, default 50 = 0.5%)"),
    },
    async ({ inputMint, outputMint, amount, slippageBps }: SwapParams) => {
      try {
        // Validate input parameters
        inputMint = inputMint.trim();
        outputMint = outputMint.trim();
        amount = amount.toString().trim();

        const quote = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);
        const formattedDetails = await formatQuoteDetails(quote);

        return {
          content: [
            {
              type: "text",
              text: formattedDetails,
            },
          ],
          quote, // Store quote for subsequent swap
        };
      } catch (err) {
        console.error('Error getting swap quote:', err);
        return {
          content: [
            {
              type: "text",
              text: `Failed to get swap quote: ${err instanceof Error ? err.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "executeSwap",
    "Execute a token swap using Jupiter DEX aggregator (using private key from .env)",
    {
      inputMint: z.string().describe("Input token mint address"),
      outputMint: z.string().describe("Output token mint address"),
      amount: z.string().describe("Amount of input tokens (in smallest denomination)"),
      slippageBps: z.number().optional().describe("Slippage tolerance in basis points (optional, default 50 = 0.5%)"),
    },
    async ({ inputMint, outputMint, amount, slippageBps }: SwapParams) => {
      try {
        // Validate input parameters
        inputMint = inputMint.trim();
        outputMint = outputMint.trim();
        amount = amount.toString().trim();

        // Check for private key
        if (!process.env.SOLANA_PRIVATE_KEY) {
          throw new Error('SOLANA_PRIVATE_KEY not found in environment variables');
        }

        // Decode private key
        const privateKeyBytes = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
        const keypair = Keypair.fromSecretKey(privateKeyBytes);

        // Get quote
        const quote = await getJupiterQuote(inputMint, outputMint, amount, slippageBps);
        const formattedQuote = await formatQuoteDetails(quote);

        // Build transaction
        const swapTransaction = await buildJupiterSwapTransaction(
          quote,
          keypair.publicKey.toString()
        );

        // Execute swap
        const signature = await executeJupiterSwap(
          solanaConnection,
          swapTransaction,
          privateKeyBytes
        );

        return {
          content: [
            {
              type: "text",
              text: `${formattedQuote}\n\nSwap executed successfully!\nTransaction signature: ${signature}\nExplorer URL: https://explorer.solana.com/tx/${signature}`,
            },
          ],
        };
      } catch (err) {
        console.error('Error executing swap:', err);
        return {
          content: [
            {
              type: "text",
              text: `Failed to execute swap: ${err instanceof Error ? err.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  server.tool(
    "transfer",
    "Transfer SOL from your keypair (using private key from .env) to another address",
    {
      toAddress: z.string().describe("Destination wallet address"),
      amount: z.number().positive().describe("Amount of SOL to send"),
    },
    async ({ toAddress, amount }) => {
      try {
        if (!process.env.SOLANA_PRIVATE_KEY) {
          throw new Error('SOLANA_PRIVATE_KEY not found in environment variables');
        }

        const privateKeyBytes = bs58.decode(process.env.SOLANA_PRIVATE_KEY);
        const fromKeypair = Keypair.fromSecretKey(privateKeyBytes);

        const lamports = amount * LAMPORTS_PER_SOL;

        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: fromKeypair.publicKey,
            toPubkey: new PublicKey(toAddress),
            lamports,
          })
        );

        const signature = await sendAndConfirmTransaction(
          solanaConnection,
          transaction,
          [fromKeypair]
        );

        return {
          content: [
            {
              type: "text",
              text: `Transfer successful!
From: ${fromKeypair.publicKey.toBase58()}
To: ${toAddress}
Amount: ${amount} SOL
Transaction signature: ${signature}
Explorer URL: https://explorer.solana.com/tx/${signature}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to transfer SOL: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}