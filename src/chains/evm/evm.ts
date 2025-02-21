import { JsonRpcProvider, formatEther, formatUnits, Contract, Wallet, parseUnits, MaxUint256 } from 'ethers';
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// Network configurations
interface NetworkConfig {
  name: string;
  rpc: string;
  chainId: number;
  currencySymbol: string;
  explorer: string;
}

const NETWORKS: { [key: string]: NetworkConfig } = {
  ethereum: {
    name: "Ethereum",
    rpc: process.env.ETH_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
    chainId: 1,
    currencySymbol: "ETH",
    explorer: "https://etherscan.io"
  },
  base: {
    name: "Base",
    rpc: process.env.BASE_RPC_URL || "https://mainnet.base.org",
    chainId: 8453,
    currencySymbol: "ETH",
    explorer: "https://basescan.org"
  },
  arbitrum: {
    name: "Arbitrum",
    rpc: process.env.ARBITRUM_RPC_URL || "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    currencySymbol: "ETH",
    explorer: "https://arbiscan.io"
  },
  optimism: {
    name: "Optimism",
    rpc: process.env.OPTIMISM_RPC_URL || "https://mainnet.optimism.io",
    chainId: 10,
    currencySymbol: "ETH",
    explorer: "https://optimistic.etherscan.io"
  },
  bsc: {
    name: "BNB Smart Chain",
    rpc: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org",
    chainId: 56,
    currencySymbol: "BNB",
    explorer: "https://bscscan.com"
  },
  polygon: {
    name: "Polygon",
    rpc: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
    chainId: 137,
    currencySymbol: "MATIC",
    explorer: "https://polygonscan.com"
  },
  avalanche: {
    name: "Avalanche",
    rpc: process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc",
    chainId: 43114,
    currencySymbol: "AVAX",
    explorer: "https://snowtrace.io"
  },
  berachain: {
    name: "Berachain",
    rpc: process.env.BERACHAIN_RPC_URL || "https://rpc.berachain.com",
    chainId: 80094,
    currencySymbol: "BERA",
    explorer: "https://berascan.com"
  },
  sonic: {
    name: "Sonic",
    rpc: process.env.SONIC_RPC_URL || "https://rpc.soniclabs.com/",
    chainId: 2024,
    currencySymbol: "SONIC",
    explorer: "https://explorer.sonic.ooo"
  }
};

// Initialize providers for each network
const providers: { [key: string]: JsonRpcProvider } = {};
for (const [network, config] of Object.entries(NETWORKS)) {
  providers[network] = new JsonRpcProvider(config.rpc);
}

// ERC-20 minimal ABI
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)"
];

export function registerEvmTools(server: McpServer) {
  // Get native token balance for any EVM network
  server.tool(
    "getEvmBalance",
    "Get native token balance for an EVM address on any supported network",
    {
      address: z.string().describe("EVM account address"),
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain, sonic)"),
    },
    async ({ address, network }) => {
      try {
        if (!NETWORKS[network]) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported network: ${network}. Supported networks are: ${Object.keys(NETWORKS).join(", ")}`,
              },
            ],
          };
        }

        const provider = providers[network];
        const balance = await provider.getBalance(address);
        const formattedBalance = formatEther(balance);
        const networkConfig = NETWORKS[network];

        return {
          content: [
            {
              type: "text",
              text: `Balance on ${networkConfig.name}:\n${formattedBalance} ${networkConfig.currencySymbol}`,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve balance: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get ERC-20 token balance for any EVM network
  server.tool(
    "getEvmTokenBalance",
    "Get ERC-20 token balance for an address on any supported EVM network",
    {
      address: z.string().describe("EVM account address"),
      tokenAddress: z.string().describe("ERC-20 token contract address"),
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain, sonic)"),
    },
    async ({ address, tokenAddress, network }) => {
      try {
        if (!NETWORKS[network]) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported network: ${network}. Supported networks are: ${Object.keys(NETWORKS).join(", ")}`,
              },
            ],
          };
        }

        const provider = providers[network];
        const contract = new Contract(tokenAddress, ERC20_ABI, provider);

        const [balance, decimals, symbol] = await Promise.all([
          contract.balanceOf(address),
          contract.decimals(),
          contract.symbol()
        ]);

        const formattedBalance = formatUnits(balance, decimals);
        const networkConfig = NETWORKS[network];

        return {
          content: [
            {
              type: "text",
              text: `Token Balance on ${networkConfig.name}:\n${formattedBalance} ${symbol} (${tokenAddress})\nExplorer: ${networkConfig.explorer}/token/${tokenAddress}`
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve token balance: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Get gas price for any EVM network
  server.tool(
    "getGasPrice",
    "Get current gas price for any supported EVM network",
    {
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain, sonic)"),
    },
    async ({ network }) => {
      try {
        if (!NETWORKS[network]) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported network: ${network}. Supported networks are: ${Object.keys(NETWORKS).join(", ")}`,
              },
            ],
          };
        }

        const provider = providers[network];
        const feeData = await provider.getFeeData();
        const gasPrice = formatUnits(feeData.gasPrice || 0, 'gwei');
        const maxFeePerGas = feeData.maxFeePerGas ? formatUnits(feeData.maxFeePerGas, 'gwei') : null;
        const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ? formatUnits(feeData.maxPriorityFeePerGas, 'gwei') : null;
        const networkConfig = NETWORKS[network];

        let response = `Gas Prices on ${networkConfig.name}:\nGas Price: ${gasPrice} Gwei`;
        if (maxFeePerGas) {
          response += `\nMax Fee: ${maxFeePerGas} Gwei`;
        }
        if (maxPriorityFeePerGas) {
          response += `\nMax Priority Fee: ${maxPriorityFeePerGas} Gwei`;
        }

        return {
          content: [
            {
              type: "text",
              text: response,
            },
          ],
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to retrieve gas price: ${error.message}`,
            },
          ],
        };
      }
    }
  );

  // Send native tokens on any EVM network
  server.tool(
    "sendEvmTransaction",
    "Send native tokens on any supported EVM network (using private key from .env)",
    {
      toAddress: z.string().describe("Recipient's address"),
      amount: z.string().describe("Amount to send (in native tokens)"),
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain, sonic)"),
    },
    async ({ toAddress, amount, network }) => {
      try {
        if (!NETWORKS[network]) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported network: ${network}. Supported networks are: ${Object.keys(NETWORKS).join(", ")}`
              }
            ]
          };
        }

        const provider = providers[network];
        const networkConfig = NETWORKS[network];

        // Get private key from environment variables
        if (!process.env.ETH_PRIVATE_KEY) {
          throw new Error('ETH_PRIVATE_KEY not found in environment variables');
        }

        // Create wallet from private key
        const wallet = new Wallet(process.env.ETH_PRIVATE_KEY, provider);
        const fromAddress = wallet.address;

        // Get current gas price and nonce
        const [gasPrice, nonce] = await Promise.all([
          provider.getFeeData(),
          provider.getTransactionCount(fromAddress)
        ]);

        // Prepare transaction
        const tx = {
          to: toAddress,
          value: parseUnits(amount),
          nonce: nonce,
          maxPriorityFeePerGas: gasPrice.maxPriorityFeePerGas,
          maxFeePerGas: gasPrice.maxFeePerGas,
          gasLimit: 21000, // Standard ETH transfer
          chainId: networkConfig.chainId
        };

        // Sign and send transaction
        const txResponse = await wallet.sendTransaction(tx);
        
        return {
          content: [
            {
              type: "text",
              text: `Transaction sent on ${networkConfig.name}!\nFrom: ${fromAddress}\nTo: ${toAddress}\nAmount: ${amount} ${networkConfig.currencySymbol}\nTransaction Hash: ${txResponse.hash}\nExplorer Link: ${networkConfig.explorer}/tx/${txResponse.hash}`
            }
          ]
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to send transaction: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Send ERC-20 tokens on any EVM network
  server.tool(
    "sendEvmToken",
    "Send ERC-20 tokens on any supported EVM network (using private key from .env)",
    {
      toAddress: z.string().describe("Recipient's address"),
      tokenAddress: z.string().describe("Token contract address"),
      amount: z.string().describe("Amount to send (in token units)"),
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain)"),
    },
    async ({ toAddress, tokenAddress, amount, network }) => {
      try {
        if (!NETWORKS[network]) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported network: ${network}. Supported networks are: ${Object.keys(NETWORKS).join(", ")}`
              }
            ]
          };
        }

        const provider = providers[network];
        const networkConfig = NETWORKS[network];

        // Get private key from environment variables
        if (!process.env.ETH_PRIVATE_KEY) {
          throw new Error('ETH_PRIVATE_KEY not found in environment variables');
        }

        // Create wallet from private key
        const wallet = new Wallet(process.env.ETH_PRIVATE_KEY, provider);
        const fromAddress = wallet.address;

        // Create contract instance
        const contract = new Contract(tokenAddress, ERC20_ABI, wallet);

        // Get token details
        const [decimals, symbol] = await Promise.all([
          contract.decimals(),
          contract.symbol()
        ]);

        // Convert amount to token units
        const amountInTokenUnits = parseUnits(amount, decimals);

        // Send transaction
        const txResponse = await contract.transfer(toAddress, amountInTokenUnits, {
          gasLimit: 100000 // Estimated gas limit for token transfers
        });

        return {
          content: [
            {
              type: "text",
              text: `Token transfer sent on ${networkConfig.name}!\nFrom: ${fromAddress}\nTo: ${toAddress}\nAmount: ${amount} ${symbol}\nToken Address: ${tokenAddress}\nTransaction Hash: ${txResponse.hash}\nExplorer Link: ${networkConfig.explorer}/tx/${txResponse.hash}`
            }
          ]
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to send token transfer: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Approve ERC-20 token spending
  server.tool(
    "approveEvmToken",
    "Approve ERC-20 token spending on any supported EVM network (using private key from .env)",
    {
      spenderAddress: z.string().describe("Address to approve for spending"),
      tokenAddress: z.string().describe("Token contract address"),
      amount: z.string().optional().describe("Amount to approve (in token units, defaults to unlimited)"),
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain)"),
    },
    async ({ spenderAddress, tokenAddress, amount, network }) => {
      try {
        if (!NETWORKS[network]) {
          return {
            content: [
              {
                type: "text",
                text: `Unsupported network: ${network}. Supported networks are: ${Object.keys(NETWORKS).join(", ")}`
              }
            ]
          };
        }

        const provider = providers[network];
        const networkConfig = NETWORKS[network];

        // Get private key from environment variables
        if (!process.env.ETH_PRIVATE_KEY) {
          throw new Error('ETH_PRIVATE_KEY not found in environment variables');
        }

        // Create wallet from private key
        const wallet = new Wallet(process.env.ETH_PRIVATE_KEY, provider);

        // Create contract instance
        const contract = new Contract(tokenAddress, ERC20_ABI, wallet);

        // Get token details
        const [decimals, symbol] = await Promise.all([
          contract.decimals(),
          contract.symbol()
        ]);

        // Calculate approval amount
        const approvalAmount = amount ? parseUnits(amount, decimals) : MaxUint256;

        // Send approval transaction
        const txResponse = await contract.approve(spenderAddress, approvalAmount, {
          gasLimit: 60000 // Estimated gas limit for approvals
        });

        const formattedAmount = amount || "unlimited";

        return {
          content: [
            {
              type: "text",
              text: `Token approval sent on ${networkConfig.name}!\nToken: ${symbol} (${tokenAddress})\nSpender: ${spenderAddress}\nAmount: ${formattedAmount}\nTransaction Hash: ${txResponse.hash}\nExplorer Link: ${networkConfig.explorer}/tx/${txResponse.hash}`
            }
          ]
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to approve token spending: ${error.message}`
            }
          ]
        };
      }
    }
  );
}