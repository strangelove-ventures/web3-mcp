import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerBitcoinTools } from "./UTXO/bitcoin"
import { registerLitecoinTools } from "./UTXO/litecoin"
import { registerDogecoinTools } from "./UTXO/dogecoin"
import { registerBitcoinCashTools } from "./UTXO/bitcoincash"
import { registerThorchainTools } from "./thorchain/thorchain"
import { registerRippleTools } from "./ripple/ripple"

// Export all UTXO tools registration function
export function registerUtxoTools(server: McpServer) {
  registerBitcoinTools(server)
  registerLitecoinTools(server)
  registerDogecoinTools(server)
  registerBitcoinCashTools(server)
}

// Export all tools registration function
export function registerAllTools(server: McpServer) {
  registerUtxoTools(server)
  registerThorchainTools(server)
  registerRippleTools(server)
}