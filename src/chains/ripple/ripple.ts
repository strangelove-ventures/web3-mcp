import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client, Wallet, Payment, TrustSet } from 'xrpl';

// Initialize XRP Ledger client
let xrpClient: Client | null = null;

// XRP Network URL
const XRP_NETWORK_URL = process.env.XRP_RPC_URL || 'wss://s1.ripple.com';
const XRP_EXPLORER = 'https://livenet.xrpl.org';

// Helper function to get or initialize the client
async function getClient(): Promise<Client> {
  if (!xrpClient || !xrpClient.isConnected()) {
    xrpClient = new Client(XRP_NETWORK_URL);
    await xrpClient.connect();
  }
  return xrpClient;
}

// Helper function to format drops to XRP
function dropsToXrp(drops: string): string {
  return (parseInt(drops) / 1000000).toFixed(6);
}

// Helper function to format XRP to drops
function xrpToDrops(xrp: string | number): string {
  // Ensure xrp is a string
  const xrpStr = typeof xrp === 'number' ? xrp.toString() : xrp;
  // Use a string to preserve precision and avoid floating point issues
  const drops = Math.floor(parseFloat(xrpStr) * 1000000).toString();
  return drops;
}

// Helper function to clean up resources
async function cleanUp() {
  if (xrpClient && xrpClient.isConnected()) {
    await xrpClient.disconnect();
  }
}

// Helper function to create a wallet from available credentials
async function createWallet() {
  // Try with private key first if available
  if (process.env.XRP_PRIVATE_KEY) {
    try {
      console.log("Creating wallet from private key...");
      return Wallet.fromSeed(process.env.XRP_PRIVATE_KEY);
    } catch (err) {
      console.log("Failed to create wallet from private key:", err);
    }
  }
  
  // Try with mnemonic if private key failed or isn't available
  if (process.env.XRP_MNEMONIC) {
    try {
      console.log("Creating wallet from mnemonic...");
      return Wallet.fromMnemonic(process.env.XRP_MNEMONIC);
    } catch (err) {
      console.log("Failed to create wallet from mnemonic:", err);
    }
  }
  
  // If we have the address and we get here, throw an error
  if (process.env.XRP_ADDRESS) {
    throw new Error('Could not create wallet from available credentials');
  }
  
  throw new Error('No wallet credentials provided. Please add XRP_PRIVATE_KEY or XRP_MNEMONIC to your .env file');
}

// Register all XRP tools
export function registerRippleTools(server: McpServer) {
  // Get XRP Balance
  server.tool(
    "getXrpBalance",
    "Get balance for an XRP address",
    {
      address: z.string().describe("XRP address to check"),
    },
    async ({ address }) => {
      try {
        const client = await getClient();
        const response = await client.request({
          command: 'account_info',
          account: address,
          ledger_index: 'validated'
        });

        const balance = dropsToXrp(response.result.account_data.Balance);

        return {
          content: [
            {
              type: "text",
              text: `XRP Balance for ${address}:\n${balance} XRP`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve XRP balance: ${error.message}` }],
        };
      }
    }
  );

  // Get account transactions
  server.tool(
    "getXrpTransactionHistory",
    "Get transaction history for an XRP address",
    {
      address: z.string().describe("XRP address to check"),
      limit: z.number().optional().describe("Maximum number of transactions to return (default: 10)"),
    },
    async ({ address, limit = 10 }) => {
      try {
        const client = await getClient();
        const response = await client.request({
          command: 'account_tx',
          account: address,
          limit: limit
        });

        if (!response.result.transactions || response.result.transactions.length === 0) {
          return {
            content: [{ type: "text", text: `No transactions found for ${address}` }],
          };
        }

        const txList = response.result.transactions.map((tx: any) => {
          const transaction = tx.tx;
          let txInfo = `
Transaction: ${transaction.hash}
Type: ${transaction.TransactionType}
Date: ${new Date(transaction.date ? (transaction.date + 946684800) * 1000 : 0).toLocaleString()}`;

          if (transaction.TransactionType === 'Payment') {
            txInfo += `
From: ${transaction.Account}
To: ${transaction.Destination}
Amount: ${transaction.Amount.currency ? 
  `${transaction.Amount.value} ${transaction.Amount.currency}` : 
  `${dropsToXrp(transaction.Amount)} XRP`}`;
          }

          return txInfo;
        }).join('\n---\n');

        return {
          content: [
            {
              type: "text",
              text: `XRP Transaction History for ${address}:\n${txList}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve XRP transaction history: ${error.message}` }],
        };
      }
    }
  );

  // Validate XRP address
  server.tool(
    "validateXrpAddress",
    "Validate an XRP address format",
    {
      address: z.string().describe("XRP address to validate"),
    },
    async ({ address }) => {
      try {
        // XRP addresses start with 'r' and are 25-35 characters in length
        const isValid = /^r[a-zA-Z0-9]{24,34}$/.test(address);
        
        return {
          content: [
            {
              type: "text",
              text: isValid 
                ? `The address ${address} has a valid XRP address format`
                : `The address ${address} does NOT have a valid XRP address format`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Error validating XRP address: ${error.message}` }],
        };
      }
    }
  );

  // Get XRP Ledger Info
  server.tool(
    "getXrpLedgerInfo",
    "Get current XRP Ledger information",
    {},
    async () => {
      try {
        const client = await getClient();
        const serverInfo = await client.request({
          command: 'server_info'
        });
        
        const ledgerInfo = await client.request({
          command: 'ledger',
          ledger_index: 'validated'
        });

        // Extract values safely with null checks
        const serverState = serverInfo.result.info.server_state || 'Unknown';
        const ledgerIndex = ledgerInfo.result.ledger.ledger_index || 'Unknown';
        const ledgerHash = ledgerInfo.result.ledger.ledger_hash || 'Unknown';
        const closeTime = ledgerInfo.result.ledger.close_time 
          ? new Date((ledgerInfo.result.ledger.close_time + 946684800) * 1000).toLocaleString()
          : 'Unknown';
        
        // Safe access to validated_ledger properties
        const baseFee = serverInfo.result.info.validated_ledger?.base_fee_xrp || 'Unknown';
        const reserveBase = serverInfo.result.info.validated_ledger?.reserve_base_xrp || 'Unknown';
        const reserveInc = serverInfo.result.info.validated_ledger?.reserve_inc_xrp || 'Unknown';

        return {
          content: [
            {
              type: "text",
              text: `XRP Ledger Information:
Server Status: ${serverState}
Current Ledger: ${ledgerIndex}
Ledger Hash: ${ledgerHash}
Close Time: ${closeTime}
Base Fee: ${baseFee} XRP
Reserve Base: ${reserveBase} XRP
Reserve Inc: ${reserveInc} XRP`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve XRP Ledger information: ${error.message}` }],
        };
      } finally {
        // No need to clean up here as we want to keep the connection for other operations
      }
    }
  );

  // Send XRP transaction using private key or mnemonic
  server.tool(
    "sendXrpTransaction",
    "Send XRP from your wallet to another address using private key from .env",
    {
      toAddress: z.string().describe("XRP address to send to"),
      amount: z.union([z.string(), z.number()]).describe("Amount of XRP to send (string or number)"),
      memo: z.string().optional().describe("Optional memo to include with the transaction"),
    },
    async ({ toAddress, amount, memo }: { toAddress: string, amount: string | number, memo?: string }) => {
      try {
        // Ensure amount is a string for display
        const amountStr = typeof amount === 'number' ? amount.toString() : amount;

        // Get client
        const client = await getClient();
        
        // Create wallet
        let wallet;
        try {
          wallet = await createWallet();
        } catch (walletError) {
          console.error('Wallet creation error:', walletError);
          throw new Error(`Failed to create wallet: ${(walletError as Error).message}`);
        }
        
        // Log debug info
        console.log(`Wallet created. Address: ${wallet.address}, Public Key: ${wallet.publicKey}`);
        
        // Verify wallet address matches expected address if provided
        if (process.env.XRP_ADDRESS && wallet.address !== process.env.XRP_ADDRESS) {
          console.log(`Warning: Derived wallet address ${wallet.address} does not match provided XRP_ADDRESS ${process.env.XRP_ADDRESS}`);
        }
        
        try {
          // Get account info first to confirm the account exists
          console.log(`Getting account info for ${wallet.address}...`);
          const accountInfo = await client.request({
            command: 'account_info',
            account: wallet.address,
            ledger_index: 'validated'
          });
          console.log(`Account exists with sequence: ${accountInfo.result.account_data.Sequence}`);
          
          // Create a payment transaction
          const payment: Payment = {
            TransactionType: 'Payment',
            Account: wallet.address,
            Destination: toAddress,
            // Convert amount to drops and ensure it's a string
            Amount: xrpToDrops(amount)
          };
          
          // Add memo if provided
          if (memo) {
            payment.Memos = [{
              Memo: {
                MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase()
              }
            }];
          }

          // Prepare transaction with autofill to get all needed fields
          console.log('Preparing transaction...');
          const prepared = await client.autofill(payment);
          console.log('Prepared transaction:', JSON.stringify(prepared));
          
          // Use the wallet's sign method to create the signed tx_blob
          console.log('Signing transaction...');
          const signed = wallet.sign(prepared);
          console.log('Signed transaction. tx_blob length:', signed.tx_blob.length);
          console.log('Signed transaction hash:', signed.hash);
          
          // First submit the transaction to get immediate feedback
          console.log('Submitting transaction...');
          const submitResult = await client.submit(signed.tx_blob);
          console.log('Submit response:', JSON.stringify(submitResult));
          
          // If the submit was successful, wait for validation
          if (submitResult.result.engine_result === 'tesSUCCESS' || submitResult.result.engine_result.startsWith('tes')) {
            // Wait for transaction to be validated
            console.log(`Transaction submitted successfully with hash: ${signed.hash}. Waiting for validation...`);
            
            // Use submitAndWait which will wait for validation
            try {
              const finalResult = await client.submitAndWait(signed.tx_blob);
              console.log('Final transaction result:', JSON.stringify(finalResult));
              
              return {
                content: [
                  {
                    type: "text",
                    text: `XRP Transaction Sent!
From: ${wallet.address}
To: ${toAddress}
Amount: ${amountStr} XRP
Transaction Hash: ${signed.hash}
Explorer Link: ${XRP_EXPLORER}/transactions/${signed.hash}`,
                  },
                ],
              };
            } catch (waitError) {
              // Even if we can't check the result, if submission was successful we return success
              console.log('Could not verify transaction, but submission was successful:', waitError);
              return {
                content: [
                  {
                    type: "text",
                    text: `XRP Transaction Submitted!
From: ${wallet.address}
To: ${toAddress}
Amount: ${amountStr} XRP
Transaction Hash: ${signed.hash}
Explorer Link: ${XRP_EXPLORER}/transactions/${signed.hash}

Note: Transaction was submitted successfully but validation status is pending.`,
                  },
                ],
              };
            }
          } else {
            // If submission wasn't successful, throw an error with the engine result
            throw new Error(`Transaction submission failed: ${submitResult.result.engine_result} - ${submitResult.result.engine_result_message}`);
          }
        } catch (txError) {
          console.error('Transaction error details:', txError);
          throw new Error(`Transaction error: ${(txError as Error).message}`);
        }
      } catch (err) {
        const error = err as Error;
        console.error('Error in sendXrpTransaction:', error);
        return {
          content: [{ type: "text", text: `Failed to send XRP transaction: ${error.message}` }],
        };
      }
    }
  );

  // Check token balances on XRP Ledger
  server.tool(
    "getXrpTokenBalances",
    "Get token balances for an XRP address",
    {
      address: z.string().describe("XRP address to check"),
    },
    async ({ address }) => {
      try {
        const client = await getClient();
        const response = await client.request({
          command: 'account_lines',
          account: address
        });

        if (!response.result.lines || response.result.lines.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No token balances found for ${address}`,
              },
            ],
          };
        }

        const tokenBalances = response.result.lines.map((line: any) => {
          return `${line.balance} ${line.currency} (Issuer: ${line.account})`;
        }).join('\n');

        return {
          content: [
            {
              type: "text",
              text: `Token Balances for ${address}:\n${tokenBalances}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to retrieve XRP token balances: ${error.message}` }],
        };
      }
    }
  );

  // Create trustline for a token on XRP Ledger
  server.tool(
    "createXrpTrustline",
    "Create a trustline for a token on the XRP Ledger using private key from .env",
    {
      currency: z.string().describe("Currency code (3-letter ISO code or hex string)"),
      issuer: z.string().describe("Issuer's XRP address"),
      limit: z.string().describe("Maximum amount of the token to trust"),
    },
    async ({ currency, issuer, limit }) => {
      try {
        // Get client
        const client = await getClient();
        
        // Create wallet
        const wallet = await createWallet();
        
        // Create a trustline transaction
        const trustSetTx: TrustSet = {
          TransactionType: 'TrustSet',
          Account: wallet.address,
          LimitAmount: {
            currency,
            issuer,
            value: limit
          }
        };

        try {
          // Prepare and sign the transaction
          const prepared = await client.autofill(trustSetTx);
          const signed = wallet.sign(prepared);
          
          // Submit the transaction
          const result = await client.submitAndWait(signed.tx_blob);
          
          return {
            content: [
              {
                type: "text",
                text: `XRP Trustline Created!
Account: ${wallet.address}
Currency: ${currency}
Issuer: ${issuer}
Limit: ${limit}
Transaction Hash: ${result.result.hash}
Explorer Link: ${XRP_EXPLORER}/transactions/${result.result.hash}`,
              },
            ],
          };
        } catch (signError) {
          throw new Error(`Failed to sign/submit transaction: ${(signError as Error).message}`);
        }
      } catch (err) {
        const error = err as Error;
        return {
          content: [{ type: "text", text: `Failed to create XRP trustline: ${error.message}` }],
        };
      }
    }
  );

  process.on('beforeExit', async () => {
    await cleanUp();
  });
}