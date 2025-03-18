import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { TonClient, Address, toNano, fromNano, beginCell, WalletContractV4, internal, SendMode } from '@ton/ton';
import { mnemonicToWalletKey, KeyPair } from '@ton/crypto';
import { Contract, Builder } from '@ton/core';

// Initialize TON client
let tonClient: TonClient | null = null;

// TON Network URL - Default to mainnet
const TON_MAINNET_ENDPOINT = process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC';
const TON_TESTNET_ENDPOINT = 'https://testnet.toncenter.com/api/v2/jsonRPC';
const TON_API_KEY = process.env.TON_API_KEY || '';
const TON_EXPLORER = 'https://tonscan.org';

// Helper function to get or initialize the client
function getClient(testnet: boolean = false): TonClient {
  const endpoint = testnet ? TON_TESTNET_ENDPOINT : TON_MAINNET_ENDPOINT;
  
  if (!tonClient) {
    tonClient = new TonClient({
      endpoint,
      apiKey: TON_API_KEY
    });
  }
  return tonClient;
}

// Helper function to create a wallet from mnemonic
async function createWalletFromMnemonic(mnemonic: string): Promise<KeyPair> {
  const mnemonicArray = mnemonic.split(' ');
  const keyPair = await mnemonicToWalletKey(mnemonicArray);
  return keyPair;
}

// Helper function to determine wallet version and create appropriate contract
async function createWalletContract(client: TonClient, address: Address, keyPair: KeyPair): Promise<{ contract: WalletContractV4, walletVersion: string }> {
  // We'll use WalletV4 (most common and recent standard wallet)
  // For production use, you might want to detect the wallet version from on-chain data
  const walletContract = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0
  });
  
  // Check if the derived address matches the expected address
  const derivedAddress = walletContract.address;
  if (!derivedAddress.equals(address)) {
    console.warn('Warning: Derived wallet address does not match provided address.');
    console.warn(`Derived: ${derivedAddress.toString()}`);
    console.warn(`Provided: ${address.toString()}`);
    
    // We'll use the provided address anyway, but this is a warning sign
  }
  
  return { 
    contract: walletContract,
    walletVersion: 'v4r2' 
  };
}

// Helper function to implement exponential backoff for API rate limits
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5): Promise<T> {
  let retries = 0;
  
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      retries++;
      
      // If we've exceeded our max retries or it's not a rate limit error, rethrow
      if (retries > maxRetries || !error.message.includes('429')) {
        throw error;
      }
      
      // Calculate exponential backoff time (1s, 2s, 4s, 8s, 16s)
      const delay = Math.pow(2, retries - 1) * 1000;
      console.log(`Rate limit hit, retrying in ${delay}ms (attempt ${retries} of ${maxRetries})...`);
      
      // Wait for the calculated time before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Register all TON tools
export function registerTonTools(server: McpServer) {
  // Get TON Balance
  server.tool(
    "getTonBalance",
    "Get balance for a TON address",
    {
      address: z.string().describe("TON address to check"),
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet"),
    },
    async ({ address, testnet = false }) => {
      try {
        const client = getClient(testnet);
        
        // Validate the address
        let validAddress;
        try {
          validAddress = Address.parse(address);
        } catch (error) {
          return {
            content: [{ type: "text", text: `Invalid TON address format: ${address}` }],
          };
        }

        // Get account information including balance with retry logic
        const accountInfo = await withRetry(() => client.getBalance(validAddress));
        const balance = fromNano(accountInfo);

        return {
          content: [
            {
              type: "text",
              text: `TON Balance for ${validAddress.toString()}:\n${balance} TON`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve TON balance: ${error.message}` }],
        };
      }
    }
  );

  // Get TON transaction history
  server.tool(
    "getTonTransactionHistory",
    "Get transaction history for a TON address",
    {
      address: z.string().describe("TON address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return (default: 10)"),
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet"),
    },
    async ({ address, limit = 10, testnet = false }) => {
      try {
        const client = getClient(testnet);
        
        // Validate the address
        let validAddress;
        try {
          validAddress = Address.parse(address);
        } catch (error) {
          return {
            content: [{ type: "text", text: `Invalid TON address format: ${address}` }],
          };
        }

        // Get transactions with retry logic
        const transactions = await withRetry(() => 
          client.getTransactions(validAddress, { limit: limit })
        );

        if (transactions.length === 0) {
          return {
            content: [{ type: "text", text: `No transactions found for ${validAddress.toString()}` }],
          };
        }

        const txList = transactions.map((tx: any) => {
          const timestamp = new Date(tx.time * 1000).toLocaleString();
          const inMsg = tx.inMessage;
          const outMsgs = tx.outMessages;
          
          let txType = "Unknown";
          let fromAddress = "N/A";
          let toAddress = "N/A";
          let amount = "0";
          let comment = "";
          
          // Determine if it's incoming or outgoing
          if (inMsg && inMsg.source) {
            txType = "Incoming";
            fromAddress = inMsg.source.toString();
            toAddress = validAddress.toString();
            amount = inMsg.value ? fromNano(inMsg.value) : "0";
            
            // Try to extract comment if present
            if (inMsg.body) {
              try {
                const msgBody = inMsg.body;
                // Attempt to decode comment if it's an op=0 message
                if (msgBody && msgBody.beginParse) {
                  const slice = msgBody.beginParse();
                  if (slice.loadUint(32) === 0) { // op=0 indicates text comment
                    comment = slice.loadStringTail();
                  }
                }
              } catch (e) {
                // Silent fail if we can't parse the comment
              }
            }
          } else if (outMsgs && outMsgs.length > 0) {
            txType = "Outgoing";
            fromAddress = validAddress.toString();
            
            // Sum total sent amount across all outgoing messages
            let totalAmount = 0n;
            outMsgs.forEach((msg: any) => {
              if (msg.destination) {
                toAddress = msg.destination.toString();
              }
              if (msg.value) {
                totalAmount += msg.value;
              }
              
              // Try to extract comment from the first message if present
              if (!comment && msg.body) {
                try {
                  const msgBody = msg.body;
                  // Attempt to decode comment if it's an op=0 message
                  if (msgBody && msgBody.beginParse) {
                    const slice = msgBody.beginParse();
                    if (slice.loadUint(32) === 0) { // op=0 indicates text comment
                      comment = slice.loadStringTail();
                    }
                  }
                } catch (e) {
                  // Silent fail if we can't parse the comment
                }
              }
            });
            
            amount = fromNano(totalAmount);
          }

          return `
Transaction: ${tx.hash}
Type: ${txType}
Date: ${timestamp}
From: ${fromAddress}
To: ${toAddress}
Amount: ${amount} TON${comment ? `\nComment: ${comment}` : ""}`;
        }).join('\n---\n');

        return {
          content: [
            {
              type: "text",
              text: `TON Transaction History for ${validAddress.toString()}:\n${txList}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve TON transaction history: ${error.message}` }],
        };
      }
    }
  );

  // Validate TON address
  server.tool(
    "validateTonAddress",
    "Validate a TON address format",
    {
      address: z.string().describe("TON address to validate"),
    },
    async ({ address }) => {
      try {
        let isValid = false;
        let normalized = "";
        
        try {
          const parsedAddress = Address.parse(address);
          isValid = true;
          normalized = parsedAddress.toString();
        } catch (e) {
          isValid = false;
        }
        
        return {
          content: [
            {
              type: "text",
              text: isValid 
                ? `The address ${address} has a valid TON address format.\nNormalized format: ${normalized}`
                : `The address ${address} does NOT have a valid TON address format.`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Error validating TON address: ${error.message}` }],
        };
      }
    }
  );

  // Get TON Network Info
  server.tool(
    "getTonNetworkInfo",
    "Get current TON network information",
    {
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet"),
    },
    async ({ testnet = false }) => {
      try {
        const client = getClient(testnet);
        
        // Get masterchain info with retry logic
        const masterchainInfo = await withRetry(() => client.getMasterchainInfo());
        
        return {
          content: [
            {
              type: "text",
              text: `TON Network Information (${testnet ? 'Testnet' : 'Mainnet'}):
Current Workchain: ${masterchainInfo.workchain}
Current Shard: ${masterchainInfo.shard}
Initial Seqno: ${masterchainInfo.initSeqno}
Latest Seqno: ${masterchainInfo.latestSeqno}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve TON Network information: ${error.message}` }],
        };
      }
    }
  );

  // Send TON transaction using mnemonic
  server.tool(
    "sendTonTransaction",
    "Send TON from your wallet to another address using mnemonic from .env",
    {
      toAddress: z.string().describe("TON address to send to"),
      amount: z.union([z.string(), z.number()]).describe("Amount of TON to send"),
      comment: z.string().optional().describe("Optional comment to include with the transaction"),
      testnet: z.boolean().optional().describe("Use testnet instead of mainnet"),
    },
    async ({ toAddress, amount, comment, testnet = false }) => {
      try {
        // Check if mnemonic is available
        if (!process.env.TON_MNEMONIC) {
          throw new Error("TON_MNEMONIC is required in the .env file");
        }
        
        // Check if address is available
        if (!process.env.TON_ADDRESS) {
          throw new Error("TON_ADDRESS is required in the .env file");
        }
        
        // Get client
        const client = getClient(testnet);
        
        // Parse sender and destination address
        const walletAddress = Address.parse(process.env.TON_ADDRESS);
        let destinationAddress: Address;
        try {
          destinationAddress = Address.parse(toAddress);
        } catch (error) {
          throw new Error(`Invalid destination address: ${toAddress}`);
        }
        
        // Create wallet from mnemonic
        const keyPair = await createWalletFromMnemonic(process.env.TON_MNEMONIC);
        
        // Convert amount to nanoTON
        const amountInNano = toNano(typeof amount === 'number' ? amount.toString() : amount);
        
        // Create wallet contract and determine wallet version
        const { contract: walletContract, walletVersion } = 
          await createWalletContract(client, walletAddress, keyPair);
        
        // Connect to the wallet and ensure we're working with the right contract
        const wallet = client.open(walletContract);
        
        // Check wallet balance with retry logic
        const balance = await withRetry(() => wallet.getBalance());
        const balanceInTon = fromNano(balance);
        console.log(`Wallet balance: ${balanceInTon} TON`);
        
        // Ensure wallet has enough funds for the transaction
        const sendAmount = BigInt(amountInNano);
        const gasFee = toNano('0.05'); // rough estimate for fees
        if (balance < sendAmount + gasFee) {
          throw new Error(`Insufficient funds: ${balanceInTon} TON available, need at least ${fromNano(sendAmount + gasFee)} TON (including fees)`);
        }
        
        // Create transfer payload with comment if provided
        const body = comment 
          ? beginCell().storeUint(0, 32).storeStringTail(comment).endCell() 
          : undefined;
        
        // Create internal message for the transfer
        const message = internal({
          to: destinationAddress,
          value: amountInNano,
          body: body,
        });
        
        // Send the transaction with retry logic for rate limits
        console.log(`Sending ${fromNano(amountInNano)} TON to ${destinationAddress.toString()}`);
        
        // Get seqno with retry
        const seqno = await withRetry(() => wallet.getSeqno());
        
        // Get current time to create transaction ID
        const timestamp = Math.floor(Date.now() / 1000);
        const txId = `${timestamp}-${walletAddress.toString().slice(0, 8)}-${destinationAddress.toString().slice(0, 8)}`;
        
        // Send transfer with retry
        await withRetry(() => 
          wallet.sendTransfer({
            seqno: seqno,
            secretKey: keyPair.secretKey,
            messages: [message],
            sendMode: SendMode.PAY_GAS_SEPARATELY | SendMode.IGNORE_ERRORS,
          })
        );
        
        // For explorers, we'll create links based on the addresses since we can't get the hash directly
        const explorerLink = testnet 
          ? `https://testnet.tonscan.org/address/${destinationAddress.toString()}`
          : `${TON_EXPLORER}/address/${destinationAddress.toString()}`;
        
        return {
          content: [
            {
              type: "text",
              text: `TON Transaction Sent Successfully!
From: ${walletAddress.toString()}
To: ${destinationAddress.toString()}
Amount: ${typeof amount === 'number' ? amount.toString() : amount} TON
${comment ? `Comment: ${comment}\n` : ''}
Wallet Version: ${walletVersion}
Transaction ID: ${txId}
Explorer Link: ${explorerLink}

Note: The transaction has been sent to the network. Check the explorer link to see when it appears (usually within seconds).`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        console.error('Error in sendTonTransaction:', error);
        return {
          content: [{ type: "text", text: `Failed to send TON transaction: ${error.message}` }],
        };
      }
    }
  );
}
