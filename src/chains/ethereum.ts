import { JsonRpcProvider, formatEther, formatUnits, Contract } from 'ethers';
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
    rpc: "https://eth-mainnet.g.alchemy.com/v2/demo",
    chainId: 1,
    currencySymbol: "ETH",
    explorer: "https://etherscan.io"
  },
  base: {
    name: "Base",
    rpc: "https://mainnet.base.org",
    chainId: 8453,
    currencySymbol: "ETH",
    explorer: "https://basescan.org"
  },
  arbitrum: {
    name: "Arbitrum",
    rpc: "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    currencySymbol: "ETH",
    explorer: "https://arbiscan.io"
  },
  optimism: {
    name: "Optimism",
    rpc: "https://mainnet.optimism.io",
    chainId: 10,
    currencySymbol: "ETH",
    explorer: "https://optimistic.etherscan.io"
  },
  bsc: {
    name: "BNB Smart Chain",
    rpc: "https://bsc-dataseed.binance.org",
    chainId: 56,
    currencySymbol: "BNB",
    explorer: "https://bscscan.com"
  },
  polygon: {
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    chainId: 137,
    currencySymbol: "MATIC",
    explorer: "https://polygonscan.com"
  },
  avalanche: {
    name: "Avalanche",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    chainId: 43114,
    currencySymbol: "AVAX",
    explorer: "https://snowtrace.io"
  },
  tron: {
    name: "Tron",
    rpc: "https://api.trongrid.io",
    chainId: 728126428,  // TRON's chainId
    currencySymbol: "TRX",
    explorer: "https://tronscan.org"
  }
};

// Initialize providers for each network
const providers: { [key: string]: JsonRpcProvider } = {};
for (const [network, config] of Object.entries(NETWORKS)) {
  if (network !== 'tron') { // Tron needs special handling
    providers[network] = new JsonRpcProvider(config.rpc);
  }
}

// ERC-20 minimal ABI
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

export function registerEthereumTools(server: McpServer) {
  // Get native token balance for any EVM network
  server.tool(
    "getEvmBalance",
    "Get native token balance for an EVM address on any supported network",
    {
      address: z.string().describe("EVM account address"),
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche)"),
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
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche)"),
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
      network: z.string().describe("Network name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche)"),
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
}