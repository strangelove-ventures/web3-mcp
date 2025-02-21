import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const COINGECKO_API_BASE = 'https://api.coingecko.com/api/v3';

// Define interfaces for type safety
interface CoinGeckoSearchCoin {
  id: string;
  symbol: string;
  name: string;
  market_cap_rank?: number;
}

interface FormattedCoin {
  id: string;
  symbol: string;
  name: string;
  marketCapRank: number | string;
}

interface PlatformInfo {
  name: string;
  address: string;
  decimal_place?: number;
}

export function registerCoinGeckoTools(server: McpServer) {
  // Search tokens
  server.tool(
    "searchCoinGecko",
    "Search for coins by ticker symbol OR name to get their CoinGecko ID. IMPORTANT: Only search with one term - either ticker (e.g., 'BTC', 'BERA') or name (e.g., 'Bitcoin', 'Berachain'), but not both. $ symbol will be automatically removed from tickers. Use this first to find the coin's CoinGecko ID before querying detailed information.",
    {
      query: z.string().describe("Search query (e.g., 'BTC' or 'Bitcoin', but not 'BTC Bitcoin')"),
    },
    async ({ query }) => {
      try {
        const apiKey = process.env.COINGECKO_API_KEY;
        if (!apiKey) {
          throw new Error('COINGECKO_API_KEY not found in environment variables');
        }

        // Remove $ symbol and trim whitespace
        const cleanQuery = query.replace('$', '').trim();

        const url = new URL(`${COINGECKO_API_BASE}/search`);
        url.searchParams.append('query', cleanQuery);
        
        const headers: Record<string, string> = {
          'accept': 'application/json',
          'x-cg-demo-api-key': apiKey
        };
        
        const response = await fetch(url.toString(), {
          headers,
          method: 'GET'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`CoinGecko API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        const coins = (data.coins || []) as CoinGeckoSearchCoin[];
        
        const formattedCoins: FormattedCoin[] = coins.map(coin => ({
          id: coin.id,
          symbol: coin.symbol.toUpperCase(),
          name: coin.name,
          marketCapRank: coin.market_cap_rank || 'N/A'
        }));

        let textResponse: string;
        if (formattedCoins.length === 0) {
          textResponse = `No coins found matching '${cleanQuery}'.\n\nTips:\n1. Search with just the ticker (e.g., 'BERA') or just the name (e.g., 'Berachain'), but not both\n2. Try searching with the ticker first, then try the name if no results\n3. Make sure the ticker or name is spelled correctly`;
        } else {
          textResponse = `Found ${formattedCoins.length} coins matching '${cleanQuery}':\n\n${
              formattedCoins.map(coin => 
                `${coin.name} (${coin.symbol})\n` +
                `CoinGecko ID: ${coin.id}\n` +
                `Market Cap Rank: ${coin.marketCapRank}\n`
              ).join('\n')}`;
        }
        
        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data: formattedCoins
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to search CoinGecko: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Get token prices
  server.tool(
    "getCoinGeckoPrices",
    "Get current prices of tokens using their CoinGecko IDs. Must provide valid CoinGecko IDs (use searchCoinGecko to find IDs first).",
    {
      ids: z.array(z.string()).describe("Array of CoinGecko token IDs"),
      vsCurrencies: z.array(z.string()).describe("Array of currencies to get prices in (e.g., ['usd', 'eur'])"),
      includeMarketCap: z.boolean().optional().describe("Include market cap data"),
      include24hrVol: z.boolean().optional().describe("Include 24h volume data"),
      include24hrChange: z.boolean().optional().describe("Include 24h price change data"),
      includeLastUpdatedAt: z.boolean().optional().describe("Include last updated timestamp"),
    },
    async ({ ids, vsCurrencies, includeMarketCap, include24hrVol, include24hrChange, includeLastUpdatedAt }) => {
      try {
        const apiKey = process.env.COINGECKO_API_KEY;
        if (!apiKey) {
          throw new Error('COINGECKO_API_KEY not found in environment variables');
        }

        const url = new URL(`${COINGECKO_API_BASE}/simple/price`);
        
        const params = {
          ids: ids.join(','),
          vs_currencies: vsCurrencies.join(','),
          include_market_cap: includeMarketCap?.toString() ?? 'false',
          include_24hr_vol: include24hrVol?.toString() ?? 'false',
          include_24hr_change: include24hrChange?.toString() ?? 'false',
          include_last_updated_at: includeLastUpdatedAt?.toString() ?? 'false',
        };

        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });

        const headers: Record<string, string> = {
          'accept': 'application/json',
          'x-cg-demo-api-key': apiKey
        };

        const response = await fetch(url.toString(), {
          headers,
          method: 'GET'
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`CoinGecko API error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        // Format the response
        let textResponse = '';
        for (const [coinId, prices] of Object.entries(data)) {
          textResponse += `${coinId}:\n`;
          for (const [currency, value] of Object.entries(prices as Record<string, any>)) {
            const formattedValue = currency.includes('last_updated') ? new Date(value * 1000).toISOString()
              : currency.includes('market_cap') ? `$${value.toLocaleString()}`
              : currency.includes('24h_vol') ? `$${value.toLocaleString()}`
              : currency.includes('24h_change') ? `${value.toFixed(2)}%`
              : `${value} ${currency.toUpperCase()}`;
            
            const label = currency.includes('market_cap') ? 'Market Cap'
              : currency.includes('24h_vol') ? '24h Volume'
              : currency.includes('24h_change') ? '24h Change'
              : currency.includes('last_updated') ? 'Last Updated'
              : `Price (${currency.toUpperCase()})`;
            
            textResponse += `  ${label}: ${formattedValue}\n`;
          }
          textResponse += '\n';
        }
        
        return {
          content: [
            {
              type: "text",
              text: textResponse || 'No price data found.'
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
              text: `Failed to get CoinGecko prices: ${error.message}`
            }
          ]
        };
      }
    }
  );

  // Get detailed coin information including contract addresses
  server.tool(
    "getCoinInfoByCoingeckoId",
    "Look up contract addresses and chain information for a token using its CoinGecko ID. Use searchCoinGecko first to find the correct CoinGecko ID before using this tool.",
    {
      id: z.string().describe("CoinGecko coin ID (get this from searchCoinGecko)"),
      marketData: z.boolean().optional().describe("Include market data"),
      localization: z.boolean().optional().describe("Include localized data"),
      tickers: z.boolean().optional().describe("Include ticker data"),
      communityData: z.boolean().optional().describe("Include community data"),
      developerData: z.boolean().optional().describe("Include developer data"),
      sparkline: z.boolean().optional().describe("Include sparkline data"),
    },
    async ({ id, localization = false, tickers = false, marketData = true, communityData = false, developerData = false, sparkline = false }) => {
      try {
        const apiKey = process.env.COINGECKO_API_KEY;
        if (!apiKey) {
          throw new Error('COINGECKO_API_KEY not found in environment variables');
        }

        const url = new URL(`${COINGECKO_API_BASE}/coins/${encodeURIComponent(id)}`);
        url.searchParams.append('localization', localization.toString());
        url.searchParams.append('tickers', tickers.toString());
        url.searchParams.append('market_data', marketData.toString());
        url.searchParams.append('community_data', communityData.toString());
        url.searchParams.append('developer_data', developerData.toString());
        url.searchParams.append('sparkline', sparkline.toString());

        const headers: Record<string, string> = {
          'accept': 'application/json',
          'x-cg-demo-api-key': apiKey
        };

        const response = await fetch(url.toString(), {
          headers,
          method: 'GET'
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`CoinGecko API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        // Format platform and contract info first as it's the primary purpose
        let contractInfo = '';
        if (data.platforms && Object.keys(data.platforms).length > 0) {
          contractInfo = '\nContract Addresses:\n';
          for (const [platform, address] of Object.entries(data.platforms)) {
            if (address && address !== '') {
              contractInfo += `  ${platform}: ${address}\n`;
            }
          }
        }

        // Format general info
        let generalInfo = `${data.name} (${data.symbol.toUpperCase()})`;
        if (data.market_cap_rank) {
          generalInfo += `\nMarket Cap Rank: #${data.market_cap_rank}`;
        }

        // Format market data if requested
        let marketInfo = '';
        if (marketData && data.market_data) {
          const md = data.market_data;
          marketInfo = '\nMarket Data:\n';
          if (md.current_price?.usd) {
            marketInfo += `  Current Price: $${md.current_price.usd.toLocaleString()}\n`;
          }
          if (md.market_cap?.usd) {
            marketInfo += `  Market Cap: $${md.market_cap.usd.toLocaleString()}\n`;
          }
          if (md.total_volume?.usd) {
            marketInfo += `  24h Volume: $${md.total_volume.usd.toLocaleString()}\n`;
          }
          if (md.price_change_percentage_24h) {
            marketInfo += `  24h Change: ${md.price_change_percentage_24h.toFixed(2)}%\n`;
          }
        }

        const textResponse = `${generalInfo}${contractInfo}${marketInfo}\n\nLast Updated: ${data.last_updated}`;

        return {
          content: [
            {
              type: "text",
              text: textResponse
            }
          ],
          data // Include raw data for potential future use
        };
      } catch (err) {
        const error = err as Error;
        return {
          content: [
            {
              type: "text",
              text: `Failed to get coin info: ${error.message}`
            }
          ]
        };
      }
    }
  );
}