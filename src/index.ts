import { config } from 'dotenv';

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { existsSync } from 'fs';

// Get directory name for ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Check for .env file
const envPath = resolve(__dirname, '../.env');
console.error('Looking for .env file at:', envPath);
console.error('.env file exists:', existsSync(envPath));

// Load environment variables
const result = config({ path: envPath });
if (result.error) {
  console.error('Error loading .env file:', result.error);
  process.exit(1);
}

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSolanaTools } from "./chains/solana/solana.js";
import { registerEvmTools } from "./chains/evm/evm.js";
import { 
  registerBitcoinTools,
  registerLitecoinTools,
  registerDogecoinTools,
  registerBitcoinCashTools,
  registerCardanoTools,
} from "./chains/UTXO/index.js";
import { registerThorchainTools } from "./chains/thorchain/thorchain.js";
import { registerRippleTools } from "./chains/ripple/ripple.js";
import { registerTonTools } from "./chains/ton/ton.js";
import { registerGeneralTools } from "./general/index.js";

// Create server instance
const server = new McpServer({
  name: "web3-rpc",
  version: "1.0.0",
});

// Helper function to check if a feature is enabled
const isEnabled = (envVar: string): boolean => {
  const value = process.env[envVar]?.toLowerCase();
  return value === 'true' || value === '1' || value === 'yes';
};

// Register chain-specific tools based on environment variables
if (isEnabled('ENABLE_SOLANA_TOOLS')) {
  console.error('Registering Solana tools...');
  registerSolanaTools(server);
}

if (isEnabled('ENABLE_EVM_TOOLS')) {
  console.error('Registering EVM chain tools...');
  registerEvmTools(server);
}

// UTXO Chain Tools
if (isEnabled('ENABLE_BITCOIN_TOOLS')) {
  console.error('Registering Bitcoin tools...');
  registerBitcoinTools(server);
}

if (isEnabled('ENABLE_LITECOIN_TOOLS')) {
  console.error('Registering Litecoin tools...');
  registerLitecoinTools(server);
}

if (isEnabled('ENABLE_DOGECOIN_TOOLS')) {
  console.error('Registering Dogecoin tools...');
  registerDogecoinTools(server);
}

if (isEnabled('ENABLE_BITCOINCASH_TOOLS')) {
  console.error('Registering Bitcoin Cash tools...');
  registerBitcoinCashTools(server);
}

if (isEnabled('ENABLE_CARDANO_TOOLS')) {
  console.error('Registering Cardano tools...');
  registerCardanoTools(server);
}

if (isEnabled('ENABLE_THORCHAIN_TOOLS')) {
  console.error('Registering THORChain tools...');
  registerThorchainTools(server);
}

if (isEnabled('ENABLE_RIPPLE_TOOLS')) {
  console.error('Registering Ripple (XRP) tools...');
  registerRippleTools(server);
}

if (isEnabled('ENABLE_TON_TOOLS')) {
  console.error('Registering TON tools...');
  registerTonTools(server);
}

// Register general tools
console.error('Registering general tools...');
registerGeneralTools(server);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err: unknown) => {
  const error = err as Error;
  console.error("Fatal error in main():", error.message);
  process.exit(1);
});