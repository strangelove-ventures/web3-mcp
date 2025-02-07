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

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";

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

export function registerSolanaTools(server: McpServer) {
  server.tool(
    "getSlot",
    "Get the current slot",
    {},
    async () => {
      try {
        const slot = await solanaConnection.getSlot();
        return {
          content: [
            {
              type: "text",
              text: `Current slot: ${slot}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve current slot: ${error.message}`,
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
    "getKeypairInfo",
    "Get information about a keypair from its secret key",
    {
      secretKey: z.string().describe("Base58 encoded secret key or array of bytes"),
    },
    async ({ secretKey }) => {
      try {
        let keypair: Keypair;
        try {
          const decoded = Uint8Array.from(secretKey.split(',').map(num => parseInt(num.trim())));
          keypair = Keypair.fromSecretKey(decoded);
        } catch {
          keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey)));
        }

        const publicKey = keypair.publicKey;
        const balance = await solanaConnection.getBalance(publicKey);
        const accountInfo = await solanaConnection.getAccountInfo(publicKey);

        return {
          content: [
            {
              type: "text",
              text: `Keypair Information:
Public Key: ${publicKey.toBase58()}
Balance: ${balance / LAMPORTS_PER_SOL} SOL
Account Program Owner: ${accountInfo?.owner?.toBase58() || 'N/A'}
Account Size: ${accountInfo?.data.length || 0} bytes
Is Executable: ${accountInfo?.executable || false}
Rent Epoch: ${accountInfo?.rentEpoch || 0}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve keypair information: ${error.message}`,
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
    "transfer",
    "Transfer SOL from your keypair to another address",
    {
      secretKey: z.string().describe("Your keypair's secret key (as comma-separated numbers or JSON array)"),
      toAddress: z.string().describe("Destination wallet address"),
      amount: z.number().positive().describe("Amount of SOL to send"),
    },
    async ({ secretKey, toAddress, amount }) => {
      try {
        let fromKeypair: Keypair;
        try {
          const decoded = Uint8Array.from(secretKey.split(',').map(num => parseInt(num.trim())));
          fromKeypair = Keypair.fromSecretKey(decoded);
        } catch {
          fromKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey)));
        }

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
    "getSplTokenInfo",
    "Get detailed information about a specific SPL token account",
    {
      tokenMint: z.string().describe("Token mint address"),
      ownerAddress: z.string().describe("Token account owner address"),
    },
    async ({ tokenMint, ownerAddress }) => {
      try {
        const mint = new PublicKey(tokenMint);
        const owner = new PublicKey(ownerAddress);

        const tokenAccounts = await solanaConnection.getParsedTokenAccountsByOwner(
          owner,
          {
            mint: mint,
          }
        );

        if (tokenAccounts.value.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No token account found for mint ${tokenMint} owned by ${ownerAddress}`,
              },
            ],
          };
        }

        const accountInfo = tokenAccounts.value[0].account;
        const parsedInfo = accountInfo.data.parsed.info;

        return {
          content: [
            {
              type: "text",
              text: `Token Account Information:
Token Account: ${tokenAccounts.value[0].pubkey.toString()}
Mint: ${parsedInfo.mint}
Owner: ${parsedInfo.owner}
Balance: ${parsedInfo.tokenAmount.uiAmount}
Decimals: ${parsedInfo.tokenAmount.decimals}
State: ${parsedInfo.state}
Is Native: ${parsedInfo.isNative}
Delegation: ${parsedInfo.delegate || 'None'}
Close Authority: ${parsedInfo.closeAuthority || 'None'}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve token information: ${error.message}`,
            },
          ],
        };
      }
    }
  );
}