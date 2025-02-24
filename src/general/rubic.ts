import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const RUBIC_API_BASE = 'https://api-v2.rubic.exchange/api';

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

  // Get bridge quote
  server.tool(
    "getRubicBridgeQuote",
    "Get the best cross-chain bridge route for swapping tokens between different blockchains.",
    {
      srcTokenAddress: z.string().describe("Source token address. Use 0x0000000000000000000000000000000000000000 for native tokens like ETH, BNB, etc."),
      srcTokenBlockchain: z.string().describe("Source blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      srcTokenAmount: z.string().describe("Amount of source token to bridge (as a string with decimals)"),
      dstTokenAddress: z.string().describe("Destination token address. Use 0x0000000000000000000000000000000000000000 for native tokens."),
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

        // Ensure all values are properly formatted as strings where needed
        const requestBody = {
          srcTokenBlockchain: String(srcTokenBlockchain),
          srcTokenAddress: String(srcTokenAddress),
          srcTokenAmount: String(srcTokenAmount),
          dstTokenBlockchain: String(dstTokenBlockchain),
          dstTokenAddress: String(dstTokenAddress),
          referrer: "web3-mcp", // Recommended to set your application name as referrer
          timeout: Number(timeout),
          includeTestnets: Boolean(includeTestnets),
          showFailedRoutes: Boolean(showFailedRoutes),
          slippageTolerance: Number(slippageTolerance) / 100, // Convert percentage to decimal
          ...(walletAddress ? { walletAddress: String(walletAddress) } : {})
        };

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
        textResponse += `From: ${data.tokens.from.amount} ${data.tokens.from.symbol} (${data.tokens.from.blockchain})\n`;
        textResponse += `To: ${data.estimate.destinationTokenAmount} ${data.tokens.to.symbol} (${data.tokens.to.blockchain})\n\n`;
        
        if (data.tokens.from.price && data.tokens.to.price) {
          textResponse += `USD Value: $${(parseFloat(data.tokens.from.amount) * data.tokens.from.price).toFixed(2)} → $${data.estimate.destinationUsdAmount.toFixed(2)}\n\n`;
        }
        
        textResponse += `Provider: ${data.providerType.toUpperCase()}\n`;
        textResponse += `Type: ${data.swapType}\n`;
        
        textResponse += `Estimated Duration: ${data.estimate.durationInMinutes} minutes\n`;
        
        if (data.fees.gasTokenFees) {
          textResponse += `Gas Fee: ${data.fees.gasTokenFees.provider.fixedAmount} ${data.fees.gasTokenFees.nativeToken.symbol} (≈$${data.fees.gasTokenFees.provider.fixedUsdAmount.toFixed(2)})\n`;
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
      srcTokenAddress: z.string().describe("Source token address. Use 0x0000000000000000000000000000000000000000 for native tokens like ETH, BNB, etc."),
      srcTokenBlockchain: z.string().describe("Source blockchain name (e.g., ETH, BSC, POLYGON, etc.)"),
      srcTokenAmount: z.string().describe("Amount of source token to bridge (as a string with decimals)"),
      dstTokenAddress: z.string().describe("Destination token address. Use 0x0000000000000000000000000000000000000000 for native tokens."),
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

        // Ensure all values are properly formatted as strings where needed
        const requestBody = {
          srcTokenBlockchain: String(srcTokenBlockchain),
          srcTokenAddress: String(srcTokenAddress),
          srcTokenAmount: String(srcTokenAmount),
          dstTokenBlockchain: String(dstTokenBlockchain),
          dstTokenAddress: String(dstTokenAddress),
          referrer: "web3-mcp", // Recommended to set your application name as referrer
          timeout: Number(timeout),
          includeTestnets: Boolean(includeTestnets),
          showFailedRoutes: Boolean(showFailedRoutes),
          slippageTolerance: Number(slippageTolerance) / 100, // Convert percentage to decimal
          ...(walletAddress ? { walletAddress: String(walletAddress) } : {})
        };

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

        const data = await response.json() as RubicQuoteResponse[];

        // Format response for readable output
        let textResponse = `Available Bridge Routes:\n\n`;
        
        if (data.length === 0) {
          textResponse += `No available routes found.`;
        } else {
          data.forEach((route, index) => {
            textResponse += `Route ${index + 1}: ${route.providerType.toUpperCase()}\n`;
            textResponse += `From: ${route.tokens.from.amount} ${route.tokens.from.symbol} (${route.tokens.from.blockchain})\n`;
            textResponse += `To: ${route.estimate.destinationTokenAmount} ${route.tokens.to.symbol} (${route.tokens.to.blockchain})\n`;
            
            if (route.tokens.from.price && route.tokens.to.price) {
              textResponse += `USD Value: $${(parseFloat(route.tokens.from.amount) * route.tokens.from.price).toFixed(2)} → $${route.estimate.destinationUsdAmount.toFixed(2)}\n`;
            }
            
            textResponse += `Estimated Time: ${route.estimate.durationInMinutes} minutes\n`;
            
            if (route.fees.gasTokenFees) {
              textResponse += `Gas Fee: ${route.fees.gasTokenFees.provider.fixedAmount} ${route.fees.gasTokenFees.nativeToken.symbol} (≈$${route.fees.gasTokenFees.provider.fixedUsdAmount.toFixed(2)})\n`;
            }
            
            if (route.estimate.priceImpact) {
              textResponse += `Price Impact: ${(route.estimate.priceImpact * 100).toFixed(2)}%\n`;
            }
            
            textResponse += `\n`;
          });
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
}