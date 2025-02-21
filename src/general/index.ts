import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCoinGeckoTools } from "./coingecko.js";

export function registerGeneralTools(server: McpServer) {
  registerCoinGeckoTools(server);
}