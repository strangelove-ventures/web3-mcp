import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  Connection, 
  PublicKey, 
  Keypair,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { z } from "zod";
import bs58 from 'bs58';
import { JsonRpcProvider, formatEther } from 'ethers';

const SOLANA_RPC = "https://api.mainnet-beta.solana.com";
const ETH_RPC = "https://eth-mainnet.g.alchemy.com/v2/demo";

// Create server instance
const server = new McpServer({
  name: "web3-rpc",
  version: "1.0.0",
});

// Initialize blockchain connections
const solanaConnection = new Connection(SOLANA_RPC, 'confirmed');
const ethProvider = new JsonRpcProvider(ETH_RPC);

// Register Solana tools
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
      // Handle both base58 encoded strings and byte arrays
      let keypair: Keypair;
      try {
        // First try parsing as comma-separated string
        const decoded = Uint8Array.from(secretKey.split(',').map(num => parseInt(num.trim())));
        keypair = Keypair.fromSecretKey(decoded);
      } catch {
        // If that fails, try as a byte array string
        keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey)));
      }

      // Get account info and balance
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

      // Format the data based on encoding
      let formattedData: string;
      if (encoding === 'base58') {
        formattedData = bs58.encode(accountInfo.data);
      } else if (encoding === 'base64') {
        formattedData = Buffer.from(accountInfo.data).toString('base64');
      } else {
        // For jsonParsed, we'll still return base64 but note that it's not parsed
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
      // Parse the secret key and create keypair
      let fromKeypair: Keypair;
      try {
        // First try parsing as comma-separated string
        const decoded = Uint8Array.from(secretKey.split(',').map(num => parseInt(num.trim())));
        fromKeypair = Keypair.fromSecretKey(decoded);
      } catch {
        // If that fails, try as a JSON array string
        fromKeypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(secretKey)));
      }

      // Convert SOL amount to lamports
      const lamports = amount * LAMPORTS_PER_SOL;

      // Create transfer instruction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: new PublicKey(toAddress),
          lamports,
        })
      );

      // Send and confirm transaction
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

// Register Ethereum tools
server.tool(
  "getEthBalance",
  "Get balance for an Ethereum address",
  {
    address: z.string().describe("Ethereum account address"),
  },
  async ({ address }) => {
    try {
      const balance = await ethProvider.getBalance(address);
      const ethBalance = formatEther(balance); // Convert from wei to ETH

      return {
        content: [
          {
            type: "text",
            text: `Balance for ${address}:\n${ethBalance} ETH`,
          },
        ],
      };
    } catch (err) {
      const error = err as Error;
      return {
        content: [
          {
            type: "text",
            text: `Failed to retrieve ETH balance: ${error.message}`,
          },
        ],
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Web3 MCP running on stdio");
}

main().catch((err: unknown) => {
  const error = err as Error;
  console.error("Fatal error in main():", error.message);
  process.exit(1);
});