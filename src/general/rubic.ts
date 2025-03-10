import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Wallet } from "ethers";

const RUBIC_API_BASE = 'https://api-v2.rubic.exchange/api';
const RUBIC_REFERRER = 'rubic.exchange'; // Using Rubic's referrer code for better compatibility

// Helper function to sanitize addresses and replace placeholders
function sanitizeAddress(address: string | undefined): string | undefined {
  if (!address) return undefined;
  
  // Check if it's a placeholder address
  if (address === '0xYourWalletAddressHere' || 
      address === '0xYourAddressHere' || 
      address === '0x0000000000000000000000000000000000000001') {
    try {
      const derivedAddress = getWalletAddress();
      console.log(`Replacing placeholder address ${address} with ${derivedAddress}`);
      return derivedAddress;
    } catch (error) {
      console.warn(`Could not replace placeholder address: ${error}`);
      return undefined;
    }
  }
  
  return address;
}

// Helper function to get wallet address from .env file or derive from private key if needed
function getWalletAddress(): string {
  // First check if ETH_PUBLIC_ADDRESS is available
  if (process.env.ETH_PUBLIC_ADDRESS) {
    const address = process.env.ETH_PUBLIC_ADDRESS;
    console.log(`Using ETH_PUBLIC_ADDRESS from .env: ${address}`);
    return address;
  }
  
  // Fall back to deriving from private key
  if (!process.env.ETH_PRIVATE_KEY) {
    throw new Error('Neither ETH_PUBLIC_ADDRESS nor ETH_PRIVATE_KEY found in environment variables');
  }
  
  try {
    const privateKey = process.env.ETH_PRIVATE_KEY.startsWith('0x') 
      ? process.env.ETH_PRIVATE_KEY 
      : `0x${process.env.ETH_PRIVATE_KEY}`;
    const wallet = new Wallet(privateKey);
    const address = wallet.address;
    console.log(`Successfully derived wallet address from private key: ${address}`);
    return address;
  } catch (error) {
    console.error(`Error deriving address from private key:`, error);
    throw new Error(`Failed to derive address from private key: ${error}`);
  }
}

// Define interfaces for type safety matching the actual Rubic API response
interface TokenInfo {
  address: string;
  blockchain: string;
  blockchainId: number;
  decimals: number;
  name: string;
  symbol: string;
  price?: number;
}

interface RubicQuoteResponse {
  id: string;
  estimate: {
    destinationTokenAmount: string;
    destinationTokenMinAmount: string;
    destinationUsdAmount: number;
    destinationUsdMinAmount: number;
    destinationWeiAmount: string;
    destinationWeiMinAmount: string;
    durationInMinutes: number;
    priceImpact: number;
    slippage: number;
  };
  fees: {
    gasTokenFees: {
      nativeToken: TokenInfo;
      protocol: {
        fixedAmount: string;
        fixedUsdAmount: number;
        fixedWeiAmount: string;
      };
      provider: {
        fixedAmount: string;
        fixedUsdAmount: number;
        fixedWeiAmount: string;
      };
    };
    percentFees: {
      percent: number;
      token: TokenInfo | null;
    };
  };
  providerType: string;
  provider?: string; // Added provider property as optional
  routing: Array<{
    path: Array<TokenInfo & { amount: string }>;
    provider: string;
    type: string;
  }>;
  swapType: 'cross-chain' | 'on-chain';
  tokens: {
    from: TokenInfo & { amount: string };
    to: TokenInfo;
  };
  transaction: {
    approvalAddress: string;
  };
  warnings: Array<any>;
}

interface RubicSwapResponse {
  id: string;
  provider: string;
  type: string;
  transaction: {
    to?: string;
    data: string;
    value?: string;
    approvalAddress?: string;
  };
  estimate?: {
    destinationTokenAmount: string;
    destinationTokenMinAmount: string;
    destinationUsdAmount: number;
    destinationUsdMinAmount: number;
    destinationWeiAmount: string;
    destinationWeiMinAmount: string;
    durationInMinutes: number;
    priceImpact: number;
    slippage: number;
  };
  tokens?: {
    from: TokenInfo & { amount: string };
    to: TokenInfo;
  };
}

interface AvailableBlockchain {
  name: string;
  id: number;
  testnet: boolean;
  providers: {
    crossChain: string[];
    onChain: string[];
  };
  proxyAvailable: boolean;
  type: 'EVM' | 'TRON' | 'SOLANA' | 'Other';
}

interface CrossChainStatusResponse {
  srcTxHash: string;
  dstTxHash?: string;
  status: 'pending' | 'indexing' | 'revert' | 'failed' | 'claim' | 'success' | 'error';
  message?: string;
  error?: string;
  bridgeName?: string;
}

export function registerRubicTools(server: McpServer) {
  // Get available blockchains
  server.tool(
    "getRubicSupportedChains",
    "Get a list of all blockchains supported by Rubic for cross-chain bridging.",
    {
      includeTestnets: z.boolean().optional().describe("Include testnet blockchains in the results."),
    },
    async ({ includeTestnets = false }) => {
      try {
        const url = new URL(`${RUBIC_API_BASE}/info/chains`);
        url.searchParams.append('includeTestnets', includeTestnets.toString());

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Rubic API error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as AvailableBlockchain[];

        // Format the response for readable output
        const formattedChains = data.map(chain => ({
          name: chain.name,
          id: chain.id,
          testnet: chain.testnet,
          type: chain.type,
          crossChainProviders: chain.providers.crossChain,
          onChainProviders: chain.providers.onChain,
          proxyAvailable: chain.proxyAvailable
        }));

        // Create readable text response
        const textResponse = `Available blockchains for cross-chain bridging:\n\n${
          formattedChains.map(chain => 
            `${chain.name} (ID: ${chain.id})${chain.testnet ? ' [TESTNET]' : ''}\n` +
            `Type: ${chain.type}\n` +
            `Cross-Chain Providers: ${chain.crossChainProviders.join(', ')}\n` +
            `On-Chain Providers: ${chain.onChainProviders.join(', ')}\n` +
            `Fee Collection Available: ${chain.proxyAvailable ? 'Yes' : 'No'}\n`
          ).join('\n')
        }`;

        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data: formattedChains
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get supported blockchains: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Get best bridge quote (Will keep this method for backward compatibility)
  server.tool(
    "getRubicBridgeQuote",
    "Get the best cross-chain bridge route for swapping tokens between different blockchains.",
    {
      srcTokenAddress: z.string().describe("Source token contract address. Use 0x0000000000000000000000000000000000000000 for native tokens like ETH, BNB, etc. This is NOT your wallet address."),
      srcTokenBlockchain: z.string().describe("Source blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      srcTokenAmount: z.string().describe("Amount of source token to bridge (as a string with decimals)"),
      dstTokenAddress: z.string().describe("Destination token contract address. Use 0x0000000000000000000000000000000000000000 for native tokens. This is NOT your wallet address."),
      dstTokenBlockchain: z.string().describe("Destination blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      walletAddress: z.string().optional().describe("Wallet address to send tokens to on the destination blockchain"),
      slippageTolerance: z.number().min(0.01).max(50).optional().describe("Slippage tolerance in percentage (min: 0.01, max: 50)"),
      showFailedRoutes: z.boolean().optional().describe("Show failed routes in the response"),
      includeTestnets: z.boolean().optional().describe("Include testnets in calculations"),
      timeout: z.number().min(5).max(60).optional().describe("Calculation timeout in seconds (min: 5, max: 60)"),
    },
    async ({ srcTokenAddress, srcTokenBlockchain, srcTokenAmount, dstTokenAddress, dstTokenBlockchain, walletAddress, slippageTolerance = 1, showFailedRoutes = false, includeTestnets = false, timeout = 30 }) => {
      try {
        const url = new URL(`${RUBIC_API_BASE}/routes/quoteBest`);

        // Derive wallet address from private key if not provided
        const sanitizedWalletAddress = sanitizeAddress(walletAddress);
        
        let userWalletAddress: string | undefined;
        if (!sanitizedWalletAddress) {
          try {
            userWalletAddress = getWalletAddress();
            console.log(`Using derived wallet address for quote: ${userWalletAddress}`);
          } catch (error) {
            console.log(`Could not derive wallet address from private key: ${error}`);
            // Continue without wallet address
          }
        } else {
          userWalletAddress = sanitizedWalletAddress;
          console.log(`Using wallet address for quote: ${userWalletAddress}`);
        }

        // Ensure all values are properly formatted as strings where needed
        const requestBody = {
          srcTokenBlockchain: String(srcTokenBlockchain),
          srcTokenAddress: String(srcTokenAddress),
          srcTokenAmount: String(srcTokenAmount),
          dstTokenBlockchain: String(dstTokenBlockchain),
          dstTokenAddress: String(dstTokenAddress),
          referrer: RUBIC_REFERRER,
          timeout: Number(timeout),
          includeTestnets: Boolean(includeTestnets),
          showFailedRoutes: Boolean(showFailedRoutes),
          slippageTolerance: Number(slippageTolerance) / 100, // Convert percentage to decimal
          ...(userWalletAddress ? { walletAddress: String(userWalletAddress) } : {})
        };

        console.log('Request body for getBestQuote:', JSON.stringify(requestBody));

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Rubic API error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as RubicQuoteResponse;

        // Format response for readable output
        let textResponse = `Bridge Quote Results:\n\n`;
        textResponse += `Quote ID: ${data.id}\n`; // Include the quote ID in the response
        textResponse += `From: ${data.tokens.from.amount} ${data.tokens.from.symbol} (${data.tokens.from.blockchain})\n`;
        textResponse += `To: ${data.estimate.destinationTokenAmount} ${data.tokens.to.symbol} (${data.tokens.to.blockchain})\n\n`;
        
        if (data.tokens.from.price && data.estimate.destinationUsdAmount) {
          textResponse += `USD Value: ${(parseFloat(data.tokens.from.amount) * (data.tokens.from.price || 0)).toFixed(2)} → ${data.estimate.destinationUsdAmount.toFixed(2)}\n\n`;
        }
        
        textResponse += `Provider: ${data.providerType || data.provider || 'Unknown'}\n`;
        textResponse += `Type: ${data.swapType}\n`;
        
        textResponse += `Estimated Duration: ${data.estimate.durationInMinutes} minutes\n`;
        
        if (data.fees.gasTokenFees) {
          textResponse += `Gas Fee: ${data.fees.gasTokenFees.provider.fixedAmount} ${data.fees.gasTokenFees.nativeToken.symbol} (≈${data.fees.gasTokenFees.provider.fixedUsdAmount.toFixed(2)})\n`;
        }
        
        textResponse += `\nFees:\n`;
        if (data.fees.percentFees) {
          textResponse += `Percent Fee: ${data.fees.percentFees.percent}%\n`;
        }
        
        if (data.estimate.priceImpact) {
          textResponse += `\nPrice Impact: ${(data.estimate.priceImpact * 100).toFixed(2)}%\n`;
        }
        
        if (data.warnings && data.warnings.length > 0) {
          textResponse += `\nWarnings: ${data.warnings.length}\n`;
        }
        
        // Add routing path details
        if (data.routing && data.routing.length > 0) {
          textResponse += `\nRouting Path:\n`;
          data.routing.forEach((route, i) => {
            textResponse += `Step ${i + 1}: ${route.provider} (${route.type})\n`;
            if (route.path.length > 0) {
              const fromToken = route.path[0];
              const toToken = route.path[route.path.length - 1];
              textResponse += `  ${fromToken.amount} ${fromToken.symbol} → ${toToken.amount} ${toToken.symbol}\n`;
            }
          });
        }
        
        textResponse += `\nIMPORTANT: To execute this swap, use the quote ID above with the prepareRubicBridgeSwap tool.`;

        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get bridge quote: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Get multiple bridge quotes
  server.tool(
    "getRubicBridgeQuotes",
    "Get all available cross-chain bridge routes for swapping tokens between different blockchains.",
    {
      srcTokenAddress: z.string().describe("Source token contract address. Use 0x0000000000000000000000000000000000000000 for native tokens like ETH, BNB, etc. This is NOT your wallet address."),
      srcTokenBlockchain: z.string().describe("Source blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      srcTokenAmount: z.string().describe("Amount of source token to bridge (as a string with decimals)"),
      dstTokenAddress: z.string().describe("Destination token contract address. Use 0x0000000000000000000000000000000000000000 for native tokens. This is NOT your wallet address."),
      dstTokenBlockchain: z.string().describe("Destination blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      walletAddress: z.string().optional().describe("Wallet address to send tokens to on the destination blockchain"),
      slippageTolerance: z.number().min(0.01).max(50).optional().describe("Slippage tolerance in percentage (min: 0.01, max: 50)"),
      showFailedRoutes: z.boolean().optional().describe("Show failed routes in the response"),
      includeTestnets: z.boolean().optional().describe("Include testnets in calculations"),
      timeout: z.number().min(5).max(60).optional().describe("Calculation timeout in seconds (min: 5, max: 60)"),
    },
    async ({ srcTokenAddress, srcTokenBlockchain, srcTokenAmount, dstTokenAddress, dstTokenBlockchain, walletAddress, slippageTolerance = 1, showFailedRoutes = false, includeTestnets = false, timeout = 30 }) => {
      try {
        const url = new URL(`${RUBIC_API_BASE}/routes/quoteAll`);

        // Derive wallet address from private key if not provided
        const sanitizedWalletAddress = sanitizeAddress(walletAddress);
        
        let userWalletAddress: string | undefined;
        if (!sanitizedWalletAddress) {
          try {
            userWalletAddress = getWalletAddress();
            console.log(`Using derived wallet address: ${userWalletAddress}`);
          } catch (error) {
            console.log(`Could not derive wallet address from private key: ${error}`);
            // Continue without wallet address
          }
        } else {
          userWalletAddress = sanitizedWalletAddress;
          console.log(`Using wallet address: ${userWalletAddress}`);
        }

        // Ensure all values are properly formatted as strings where needed
        const requestBody = {
          srcTokenBlockchain: String(srcTokenBlockchain),
          srcTokenAddress: String(srcTokenAddress),
          srcTokenAmount: String(srcTokenAmount),
          dstTokenBlockchain: String(dstTokenBlockchain),
          dstTokenAddress: String(dstTokenAddress),
          referrer: RUBIC_REFERRER, // Recommended to set your application name as referrer
          timeout: Number(timeout),
          includeTestnets: Boolean(includeTestnets),
          showFailedRoutes: Boolean(showFailedRoutes),
          slippageTolerance: Number(slippageTolerance) / 100, // Convert percentage to decimal
          ...(userWalletAddress ? { walletAddress: String(userWalletAddress) } : {})
        };

        console.log('Request body for getAllQuotes:', JSON.stringify(requestBody));

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Rubic API error (${response.status}): ${errorText}`);
        }

        const rawData = await response.json();
        console.log('Raw response from quoteAll:', JSON.stringify(rawData));

        // Format response for readable output
        let textResponse = `Available Bridge Routes:\n\n`;
        
        // Check if the response is an array or a single object
        if (!Array.isArray(rawData)) {
          if (rawData.id) {
            // Single route response
            const data = rawData as RubicQuoteResponse;
            textResponse += `Quote ID: ${data.id}\n`; // Include the quote ID in the response
            textResponse += `Provider: ${data.providerType || data.provider || 'Unknown'}\n`;
            
            if (data.tokens && data.tokens.from && data.tokens.to) {
              textResponse += `From: ${data.tokens.from.amount} ${data.tokens.from.symbol} (${data.tokens.from.blockchain})\n`;
              if (data.estimate && data.estimate.destinationTokenAmount) {
                textResponse += `To: ${data.estimate.destinationTokenAmount} ${data.tokens.to.symbol} (${data.tokens.to.blockchain})\n`;
              }
              
              if (data.tokens.from.price && data.estimate && data.estimate.destinationUsdAmount) {
                textResponse += `USD Value: ${(parseFloat(data.tokens.from.amount) * (data.tokens.from.price || 0)).toFixed(2)} → ${data.estimate.destinationUsdAmount.toFixed(2)}\n`;
              }
            }
            
            if (data.estimate && data.estimate.durationInMinutes) {
              textResponse += `Estimated Time: ${data.estimate.durationInMinutes} minutes\n`;
            }
            
            if (data.fees && data.fees.gasTokenFees) {
              textResponse += `Gas Fee: ${data.fees.gasTokenFees.provider.fixedAmount} ${data.fees.gasTokenFees.nativeToken.symbol} (≈${data.fees.gasTokenFees.provider.fixedUsdAmount.toFixed(2)})\n`;
            }
            
            if (data.estimate && data.estimate.priceImpact) {
              textResponse += `Price Impact: ${(data.estimate.priceImpact * 100).toFixed(2)}%\n`;
            }
            
            textResponse += `\nIMPORTANT: To execute this swap, use the quote ID above with the prepareRubicBridgeSwap tool.\n`;
          } else {
            textResponse += `No available routes found or invalid response format.`;
          }
        } else if (rawData.length === 0) {
          textResponse += `No available routes found.`;
        } else {
          // Handle array response
          const dataArray = rawData as RubicQuoteResponse[];
          dataArray.forEach((route, index) => {
            textResponse += `Route ${index + 1}: ${route.providerType || route.provider || 'Unknown'}\n`;
            textResponse += `Quote ID: ${route.id}\n`; // Include the quote ID in the response
            
            if (route.tokens && route.tokens.from && route.tokens.to) {
              textResponse += `From: ${route.tokens.from.amount} ${route.tokens.from.symbol} (${route.tokens.from.blockchain})\n`;
              if (route.estimate && route.estimate.destinationTokenAmount) {
                textResponse += `To: ${route.estimate.destinationTokenAmount} ${route.tokens.to.symbol} (${route.tokens.to.blockchain})\n`;
              }
              
              if (route.tokens.from.price && route.estimate && route.estimate.destinationUsdAmount) {
                textResponse += `USD Value: ${(parseFloat(route.tokens.from.amount) * (route.tokens.from.price || 0)).toFixed(2)} → ${route.estimate.destinationUsdAmount.toFixed(2)}\n`;
              }
            }
            
            if (route.estimate && route.estimate.durationInMinutes) {
              textResponse += `Estimated Time: ${route.estimate.durationInMinutes} minutes\n`;
            }
            
            if (route.fees && route.fees.gasTokenFees) {
              textResponse += `Gas Fee: ${route.fees.gasTokenFees.provider.fixedAmount} ${route.fees.gasTokenFees.nativeToken.symbol} (≈${route.fees.gasTokenFees.provider.fixedUsdAmount.toFixed(2)})\n`;
            }
            
            if (route.estimate && route.estimate.priceImpact) {
              textResponse += `Price Impact: ${(route.estimate.priceImpact * 100).toFixed(2)}%\n`;
            }
            
            textResponse += `\n`;
          });
          
          textResponse += `IMPORTANT: To execute any of these swaps, use the specific Quote ID with the prepareRubicBridgeSwap tool.`;
        }

        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data: rawData
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get bridge quotes: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Check cross-chain transaction status
  server.tool(
    "getRubicBridgeStatus",
    "Check the status of a cross-chain bridge transaction.",
    {
      srcTxHash: z.string().describe("Source transaction hash to check status"),
    },
    async ({ srcTxHash }) => {
      try {
        const url = new URL(`${RUBIC_API_BASE}/info/status`);
        url.searchParams.append('srcTxHash', String(srcTxHash));

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Rubic API error (${response.status}): ${errorText}`);
        }

        const data = await response.json() as CrossChainStatusResponse;

        // Format response for readable output
        let textResponse = `Cross-Chain Transaction Status:\n\n`;
        textResponse += `Source Transaction: ${data.srcTxHash}\n`;
        
        if (data.dstTxHash) {
          textResponse += `Destination Transaction: ${data.dstTxHash}\n`;
        }
        
        textResponse += `Status: ${data.status.toUpperCase()}\n`;
        
        if (data.message) {
          textResponse += `Message: ${data.message}\n`;
        }
        
        if (data.error) {
          textResponse += `Error: ${data.error}\n`;
        }
        
        if (data.bridgeName) {
          textResponse += `Bridge Provider: ${data.bridgeName}\n`;
        }
        
        // Provide a human-readable explanation of the status
        textResponse += `\nStatus Explanation:\n`;
        switch (data.status) {
          case 'pending':
            textResponse += `Your transaction is still in progress. This could take a few minutes to complete.`;
            break;
          case 'indexing':
            textResponse += `The transaction has been detected but is still being indexed. Please check back soon.`;
            break;
          case 'revert':
            textResponse += `The transaction on the destination chain failed and needs to be reverted. You should collect your funds.`;
            break;
          case 'failed':
            textResponse += `The transaction has failed. Your funds may be reverted automatically.`;
            break;
          case 'claim':
            textResponse += `The transaction was successful! You can now claim your tokens on the destination chain.`;
            break;
          case 'success':
            textResponse += `The transaction was completed successfully! Your tokens have been sent to the destination address.`;
            break;
          case 'error':
            textResponse += `An error occurred during the transaction. Please check the error message for details.`;
            break;
          default:
            textResponse += `Unknown status. Please check the Rubic interface for more information.`;
        }

        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get bridge transaction status: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Prepare bridge swap transaction
  server.tool(
    "prepareRubicBridgeSwap",
    "Prepare a transaction for executing a cross-chain bridge swap. Returns transaction data that can be executed through an EVM or Solana wallet.",
    {
      quoteId: z.string().describe("Quote ID obtained from getRubicBridgeQuote or getRubicBridgeQuotes"),
      fromAddress: z.string().optional().describe("User wallet address that will execute the transaction (uses ETH_PUBLIC_ADDRESS from .env if not provided)"),
      srcTokenAddress: z.string().describe("Source token contract address. Use 0x0000000000000000000000000000000000000000 for native tokens like ETH, BNB, etc. This is NOT your wallet address."),
      srcTokenBlockchain: z.string().describe("Source blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      srcTokenAmount: z.string().describe("Amount of source token to bridge (as a string with decimals)"),
      dstTokenAddress: z.string().describe("Destination token contract address. Use 0x0000000000000000000000000000000000000000 for native tokens. This is NOT your wallet address."),
      dstTokenBlockchain: z.string().describe("Destination blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      receiver: z.string().optional().describe("Optional receiver address for the tokens on the destination chain (defaults to fromAddress if not specified)"),
      slippageTolerance: z.number().min(0.01).max(50).optional().describe("Slippage tolerance in percentage (min: 0.01, max: 50)")
    },
    async ({ quoteId, fromAddress, srcTokenAddress, srcTokenBlockchain, srcTokenAmount, dstTokenAddress, dstTokenBlockchain, receiver, slippageTolerance = 1 }) => {
      try {
        // Special case for Stargate provider
        if (quoteId.toUpperCase().includes('STARGATE')) {
          console.log('Using custom handler for STARGATE');
          
          // Stargate often requires a direct call to generate a transaction
          // Return a template transaction with instructions
          let textResponse = `Stargate Bridge Swap Information:\n\n`;
          textResponse += `Chain: ${srcTokenBlockchain}\n`;
          textResponse += `Provider: ${quoteId}\n\n`;
          
          textResponse += `Stargate bridging from ${srcTokenBlockchain} to ${dstTokenBlockchain} requires:\n`;
          textResponse += `1. Amount: ${srcTokenAmount} ${srcTokenBlockchain === 'OPTIMISM' ? 'ETH' : srcTokenBlockchain}\n`;
          textResponse += `2. Destination: ${dstTokenBlockchain}\n\n`;
          
          textResponse += `This provider currently requires manual transaction construction.\n`;
          textResponse += `Please use the Stargate Bridge UI directly at https://stargate.finance/transfer\n`;
          textResponse += `\nAlternatively, try using another provider like LIFI or SQUIDROUTER.`;
          
          return {
            content: [{ type: "text", text: textResponse }],
            data: {
              error: "Provider requires manual transaction",
              quoteId: quoteId,
              blockchain: srcTokenBlockchain,
              sourceToken: { address: srcTokenAddress, blockchain: srcTokenBlockchain },
              destinationToken: { address: dstTokenAddress, blockchain: dstTokenBlockchain },
              provider: quoteId
            }
          };
        }
        
        const url = new URL(`${RUBIC_API_BASE}/routes/swap`);
        
        // Use address from private key if not provided or if it's a placeholder
        let userFromAddress: string;
        const sanitizedAddress = sanitizeAddress(fromAddress);
        
        if (!sanitizedAddress) {
          try {
            userFromAddress = getWalletAddress();
            console.log(`Using derived wallet address: ${userFromAddress}`);
          } catch (error) {
            throw new Error(`No valid fromAddress provided and failed to get from private key: ${error}`);
          }
        } else {
          userFromAddress = sanitizedAddress;
          console.log(`Using address: ${userFromAddress}`);
        }

        console.log('Swap Request URL:', url.toString());
        console.log('Using fromAddress:', userFromAddress, 'and referrer:', RUBIC_REFERRER);

        const requestBody = {
          id: quoteId,  // Use the exact quote ID string without converting
          fromAddress: userFromAddress,  // Set fromAddress explicitly 
          walletAddress: userFromAddress, // Explicitly set wallet address 
          srcTokenBlockchain: String(srcTokenBlockchain),
          srcTokenAddress: String(srcTokenAddress),
          srcTokenAmount: String(srcTokenAmount),
          dstTokenBlockchain: String(dstTokenBlockchain),
          dstTokenAddress: String(dstTokenAddress),
          referrer: RUBIC_REFERRER,  // Set referrer explicitly
          slippageTolerance: Number(slippageTolerance) / 100,  // Convert percentage to decimal
          ...(receiver ? { receiver: String(receiver) } : {})
        };

        console.log('Sending swap request with payload:', JSON.stringify(requestBody, null, 2));

        // Debug information
        console.log('Using fromAddress:', userFromAddress);
        
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(requestBody)
        });

        // Log the raw response for debugging
        const responseText = await response.text();
        console.log(`Raw API response status: ${response.status}`);
        console.log(`Raw API response: ${responseText}`);
        
        if (!response.ok) {
          throw new Error(`Rubic API error (${response.status}): ${responseText}`);
        }

        // Parse the response as JSON if it's valid
        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`Failed to parse API response as JSON: ${responseText}`);
        }

        console.log('Response data from swap:', JSON.stringify(data, null, 2));
        
        // First, check if there's an error message in the response
        if (data.error || data.statusCode || (data.message && typeof data.message === 'string')) {
          const errorMessage = data.message || data.error || 'Unknown API error';
          throw new Error(`API returned an error: ${errorMessage}`);
        }
        
        // Check for empty response or unsupported route
        if (!data || Object.keys(data).length === 0) {
          throw new Error(`No data returned for ${quoteId}. This route might not be available.`);
        }
        
        // Special handling for various providers with different response formats
        if (quoteId.toUpperCase().includes('SQUIDROUTER') || 
            quoteId.toUpperCase().includes('LIFI') ||
            quoteId.toUpperCase().includes('SYMBIOSIS') ||
            quoteId.toUpperCase().includes('ACROSS') ||
            quoteId.toUpperCase().includes('BRIDGED')) {
          // Handle special provider formats
          console.log(`Special handling for provider: ${quoteId}`);
          console.log('Full response data:', JSON.stringify(data, null, 2));
          
          if (!data.transaction && !data.tx && !data.transactionRequest) {
            throw new Error(`No transaction data found in response for ${quoteId}`);
          }
          
          // Format response for special provider
          let textResponse = `Transaction Details for ${quoteId} Bridge Swap:\n\n`;
          textResponse += `Chain: ${srcTokenBlockchain}\n`;
          textResponse += `Provider: ${quoteId}\n\n`;
          
          // For these providers, we need to look in different places for the transaction data
          let txData = {
            to: '',
            data: '',
            value: '0'
          };
          
          // Try different locations for transaction data
          if (data.transaction) {
            txData.to = data.transaction.targetAddress || data.transaction.to || data.transaction.routeTransaction?.targetAddress || '';
            txData.data = data.transaction.data || '';
            txData.value = data.transaction.value || '0';
          }
          
          if (!txData.to && data.tx) {
            txData.to = data.tx.to || data.tx.targetAddress || '';
            txData.data = data.tx.data || data.transaction?.data || '';
            txData.value = data.tx.value || data.transaction?.value || '0';
          }
          
          if (!txData.to && data.transactionRequest) {
            txData.to = data.transactionRequest.to || data.transactionRequest.targetAddress || '';
            txData.data = data.transactionRequest.data || '';
            txData.value = data.transactionRequest.value || '0';
          }
          
          // If still no 'to' address, try to extract it from other properties
          if (!txData.to) {
            // Try to find any property that might contain a transaction address
            const findToAddress = (obj: any, depth = 0): string => {
              if (depth > 3) return ''; // Limit recursion depth
              if (!obj || typeof obj !== 'object') return '';
              
              for (const key in obj) {
                if (typeof obj[key] === 'string' && obj[key].startsWith('0x') && obj[key].length === 42) {
                  if (key === 'to' || key === 'targetAddress' || key === 'contractAddress') {
                    return obj[key];
                  }
                } else if (typeof obj[key] === 'object') {
                  const result = findToAddress(obj[key], depth + 1);
                  if (result) return result;
                }
              }
              return '';
            };
            
            txData.to = findToAddress(data);
          }
          
          if (!txData.to) {
            console.error('Full response:', JSON.stringify(data, null, 2));
            throw new Error(`Could not find transaction target address in ${quoteId} response`);
          }
          
          if (!txData.data) {
            console.error('Full response:', JSON.stringify(data, null, 2));
            throw new Error(`Could not find transaction data in ${quoteId} response`);
          }
          
          textResponse += `To Address: ${txData.to}\n`;
          textResponse += `Data: ${txData.data.substring(0, 40)}...\n`;
          textResponse += `Value: ${txData.value}\n`;
          
          // Add special instructions
          textResponse += `\nThis is a ${quoteId} transaction. Please ensure you have:\n`;
          textResponse += `1. Selected the correct network (${srcTokenBlockchain})\n`;
          textResponse += `2. Have sufficient gas for the transaction\n`;
          
          return {
            content: [{ type: "text", text: textResponse }],
            data: {
              transaction: txData,
              quoteId: quoteId,
              blockchain: srcTokenBlockchain,
              sourceToken: { address: srcTokenAddress, blockchain: srcTokenBlockchain },
              destinationToken: { address: dstTokenAddress, blockchain: dstTokenBlockchain },
              provider: quoteId
            }
          };
        }

        // Handle Solana transactions
        if (srcTokenBlockchain.toUpperCase() === 'SOLANA' || srcTokenBlockchain.toUpperCase() === 'SOL') {
          const swapData = data as RubicSwapResponse;
          
          // Format response for readable output
          let textResponse = `Transaction Details for Solana Bridge Swap:\n\n`;
          textResponse += `Provider: ${swapData.provider || 'Unknown'}\n`;
          textResponse += `Type: ${swapData.type || 'cross-chain'}\n\n`;
          
          if (!swapData.transaction.data) {
            throw new Error(`Missing transaction data in Solana response: ${JSON.stringify(swapData)}`);
          }
          
          // Solana transaction data is usually provided as Base64
          textResponse += `Transaction Data Format: Base64\n`;
          textResponse += `Transaction Data: ${swapData.transaction.data.substring(0, 40)}...\n\n`;
          
          textResponse += `\nTo execute this Solana transaction:\n`;
          textResponse += `1. Deserialize the transaction data using @solana/web3.js\n`;
          textResponse += `2. Use your Solana wallet to sign the transaction\n`;
          textResponse += `3. Submit the signed transaction to the Solana network\n`;
          
          return {
            content: [{ type: "text", text: textResponse }],
            data: {
              transactionData: swapData.transaction.data,
              blockchain: 'SOLANA',
              provider: swapData.provider,
              quoteId: swapData.id
            }
          };
        }

        // Standard response handling for other EVM providers
        const swapData = data as RubicSwapResponse;

        // Format response for readable output
        let textResponse = `Transaction Details for Bridge Swap:\n\n`;
        
        textResponse += `Chain: ${srcTokenBlockchain}\n`;
        textResponse += `Type: ${swapData.type || 'cross-chain'}\n`;
        textResponse += `Provider: ${swapData.provider || 'Unknown'}\n\n`;
        
        // Check for required EVM transaction data
        if (!swapData.transaction.to) {
          throw new Error(`Missing 'to' address in transaction data: ${JSON.stringify(swapData.transaction)}`);
        }
        
        if (!swapData.transaction.data) {
          throw new Error(`Missing 'data' in transaction data: ${JSON.stringify(swapData.transaction)}`);
        }
        
        textResponse += `To Address: ${swapData.transaction.to}\n`;
        textResponse += `Data: ${swapData.transaction.data.substring(0, 40)}...\n`;
        textResponse += `Value: ${swapData.transaction.value || '0'}\n`;
        
        if (swapData.transaction.approvalAddress) {
          textResponse += `\nWARNING: This token requires approval first!\n`;
          textResponse += `Approval Address: ${swapData.transaction.approvalAddress}\n`;
          textResponse += `You must approve this token before executing the swap.\n`;
        }

        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data: {
            transaction: swapData.transaction,
            quoteId: swapData.id,
            blockchain: srcTokenBlockchain,
            sourceToken: swapData.tokens?.from,
            destinationToken: swapData.tokens?.to,
            estimate: swapData.estimate,
            provider: swapData.provider
          }
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to prepare bridge swap: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Check token approval for EVM chains
  server.tool(
    "checkRubicTokenAllowance",
    "Check if a token has sufficient allowance for a Rubic bridge transaction on EVM chains.",
    {
      tokenAddress: z.string().describe("Token address to check allowance for"),
      ownerAddress: z.string().optional().describe("Wallet address of the token owner (uses ETH_PUBLIC_ADDRESS from .env if not provided)"),
      spenderAddress: z.string().describe("Address of the contract that will spend the tokens (obtain from prepareRubicBridgeSwap)"),
      blockchain: z.string().describe("Blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      amount: z.string().describe("Amount to check allowance for (as a string with decimals)"),
    },
    async ({ tokenAddress, ownerAddress, spenderAddress, blockchain, amount }) => {
      try {
        // Use address from private key if not provided
        let userOwnerAddress: string;
        const sanitizedAddress = sanitizeAddress(ownerAddress);
        
        if (!sanitizedAddress) {
          try {
            userOwnerAddress = getWalletAddress();
            console.log(`Using derived wallet address: ${userOwnerAddress}`);
          } catch (error) {
            throw new Error(`No valid ownerAddress provided and failed to get from private key: ${error}`);
          }
        } else {
          userOwnerAddress = sanitizedAddress;
          console.log(`Using address: ${userOwnerAddress}`);
        }

        // This is a placeholder for actual implementation
        // In a real implementation, we would use ethers.js or web3.js to check allowance

        return {
          content: [
            {
              type: "text",
              text: `To implement this function properly, you need to use ethers.js or web3.js to check the token allowance on ${blockchain}. The requirements are:\n\n` +
                     `- Token Address: ${tokenAddress}\n` +
                     `- Owner Address: ${userOwnerAddress}\n` +
                     `- Spender Address: ${spenderAddress}\n` +
                     `- Required Amount: ${amount}\n\n` +
                     `This would involve:` +
                     `1. Creating an ERC20 contract instance\n` +
                     `2. Calling the allowance(owner, spender) function\n` +
                     `3. Comparing the result with the required amount\n` +
                     `4. If the allowance is insufficient, the user needs to approve first\n`
            }
          ],
          data: {
            tokenAddress,
            ownerAddress: userOwnerAddress,
            spenderAddress,
            blockchain,
            requiredAmount: amount,
            // This would be the actual allowance in a real implementation
            currentAllowance: "0",
            sufficientAllowance: false
          }
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to check token allowance: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Create token approval transaction for EVM chains
  server.tool(
    "createRubicApprovalTx",
    "Create a token approval transaction for Rubic bridge on EVM chains.",
    {
      tokenAddress: z.string().describe("Token address to approve"),
      spenderAddress: z.string().describe("Address of the contract that will spend the tokens (obtain from prepareRubicBridgeSwap)"),
      ownerAddress: z.string().optional().describe("Wallet address of the token owner (uses ETH_PUBLIC_ADDRESS from .env if not provided)"),
      blockchain: z.string().describe("Blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      amount: z.string().describe("Amount to approve (as a string with decimals)"),
    },
    async ({ tokenAddress, spenderAddress, ownerAddress, blockchain, amount }) => {
      try {
        // Use address from private key if not provided
        let userOwnerAddress: string;
        const sanitizedAddress = sanitizeAddress(ownerAddress);
        
        if (!sanitizedAddress) {
          try {
            userOwnerAddress = getWalletAddress();
            console.log(`Using derived wallet address: ${userOwnerAddress}`);
          } catch (error) {
            throw new Error(`No valid ownerAddress provided and failed to get from private key: ${error}`);
          }
        } else {
          userOwnerAddress = sanitizedAddress;
          console.log(`Using address: ${userOwnerAddress}`);
        }

        // This is a placeholder for actual implementation
        // In a real implementation, we would use ethers.js or web3.js to create the approval transaction

        // Create a generic ERC20 approval transaction
        // The standard ERC20 approve method has function signature: approve(address spender, uint256 amount)
        // Function selector: 0x095ea7b3
        // Then packed with the address (32 bytes) and a uint256 (32 bytes)
        // For max approval, use: ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
        const approvalData = "0x095ea7b3000000000000000000000000" + 
                           spenderAddress.slice(2).padStart(64, '0') + 
                           "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

        return {
          content: [
            {
              type: "text",
              text: `ERC20 Approval Transaction for ${blockchain}:\n\n` +
                     `Token Address: ${tokenAddress}\n` +
                     `Spender Address: ${spenderAddress}\n` +
                     `Owner Address: ${userOwnerAddress}\n` +
                     `Amount: Maximum approval\n\n` +
                     `Transaction Details:\n` +
                     `To: ${tokenAddress}\n` +
                     `Data: ${approvalData.substring(0, 66)}...\n` +
                     `Value: 0\n\n` +
                     `This transaction will approve the spender to use all of your tokens. This is a standard practice for DEXs and bridges, but you can modify the amount if desired.`
            }
          ],
          data: {
            tokenAddress,
            spenderAddress,
            ownerAddress: userOwnerAddress,
            blockchain,
            amount,
            // The actual transaction data
            transaction: {
              to: tokenAddress,
              data: approvalData,
              value: "0"
            }
          }
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to create approval transaction: ${error.message}`
            }
          ]
        };
      }
    }
  );
}