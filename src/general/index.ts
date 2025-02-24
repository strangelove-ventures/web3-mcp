import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerCoinGeckoTools } from "./coingecko.js";
import { registerRubicTools } from "./rubic.js";

export function registerGeneralTools(server: McpServer) {
  registerCoinGeckoTools(server);
  registerRubicTools(server);
}