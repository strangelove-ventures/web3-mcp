# Web3 MCP

A Model-Context-Protocol server for interacting with multiple blockchains including Solana, Ethereum, THORChain, and UTXO chains. This server provides simple RPC endpoints for common blockchain operations, allowing secure interactions with various blockchains through environment variables.

<a href="https://glama.ai/mcp/servers/an8x6gmzdn"><img width="380" height="200" src="https://glama.ai/mcp/servers/an8x6gmzdn/badge" alt="Web3 Server MCP server" /></a>

## Features

Solana Operations:
- Check SOL account balances
- Get detailed account information
- Transfer SOL between accounts
- View SPL token balances
- Get your wallet address from private key
- Swap tokens using Jupiter (Best price routing across all Solana DEXs)

Ethereum & EVM Chain Operations:
- Check native token balances across multiple networks
- Check ERC-20 token balances
- Send native tokens (using private key from .env)
- Send ERC-20 tokens (using private key from .env)
- Approve ERC-20 token spending (using private key from .env)

THORChain Operations:
- Check RUNE balances
- Get detailed pool information
- Get swap quotes between any supported assets
- Cross-chain swaps via THORChain protocol

UTXO Chain Operations:
- Bitcoin (BTC)
  - Check address balances
  - View transaction history
  - Validate addresses
  - Get network info and fees
- Litecoin (LTC)
  - Check address balances
  - View transaction history
  - Validate addresses
  - Get network info and fees
- Dogecoin (DOGE)
  - Check address balances
  - View transaction history
  - Validate addresses
  - Get network info and fees
- Bitcoin Cash (BCH)
  - Check address balances
  - View transaction history
  - Validate addresses
  - Get network info and fees

Supported EVM Networks:
- Ethereum
- Base
- Arbitrum
- Optimism
- BSC (Binance Smart Chain)
- Polygon
- Avalanche

## Setup

1. Clone and install dependencies:
```bash
git clone https://github.com/strangelove-ventures/web3-mcp.git
cd web3-mcp
npm install
```

2. Create a .env file in the root directory:
```bash
cp .env.example .env
```

3. Configure your environment variables in .env:

### Required Configuration

```env
# Tool Registration Controls
ENABLE_SOLANA_TOOLS=true      # Enable/disable Solana-specific tools
ENABLE_ETHEREUM_TOOLS=true    # Enable/disable Ethereum and EVM chain tools
ENABLE_XCHAIN_TOOLS=true      # Enable/disable cross-chain tools (THORChain, etc.)

# Private Keys (required for transactions)
ETH_PRIVATE_KEY=your-ethereum-private-key
SOLANA_PRIVATE_KEY=your-base58-encoded-solana-private-key
```

### Optional Configuration

```env
# Network RPC URLs (optional - will use public endpoints if not specified)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Ethereum & Layer 2s
ETH_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your-api-key
ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc
BASE_RPC_URL=https://mainnet.base.org
OPTIMISM_RPC_URL=https://mainnet.optimism.io

# Other EVM Chains
BSC_RPC_URL=https://bsc-dataseed.binance.org
POLYGON_RPC_URL=https://polygon-rpc.com
AVALANCHE_RPC_URL=https://api.avax.network/ext/bc/C/rpc

# THORChain Configuration
THORCHAIN_NODE_URL=https://thornode.ninerealms.com  # Optional - will use public endpoint if not specified
THORCHAIN_PRIVATE_KEY=your-thorchain-private-key
THORCHAIN_MNEMONIC=your-thorchain-mnemonic

# UTXO Chain API Keys (optional)
BLOCKCYPHER_API_KEY=your-blockcypher-api-key
SOCHAIN_API_KEY=your-sochain-api-key
```

4. Build the tool:
```bash
npm run build
```

5. Add the tool to your claude_desktop_config.json:
```json
{
  "mcpServers": {
    "web3-rpc": {
      "command": "node",
      "args": [
        "/PATH/TO/web3-mcp/build/index.js"
      ]
    }
  }
}
```

## Tool Registration

The Web3 MCP server allows you to control which blockchain tools are registered through environment variables:

- `ENABLE_SOLANA_TOOLS`: Enable/disable Solana-specific tools
- `ENABLE_ETHEREUM_TOOLS`: Enable/disable Ethereum and EVM chain tools
- `ENABLE_XCHAIN_TOOLS`: Enable/disable cross-chain tools (THORChain, etc.)

Set these variables to `true` or `false` in your `.env` file to control which tools are available to the server. This allows you to:

- Reduce startup time by only loading required tools
- Minimize security surface area by disabling unused chains
- Customize the server for specific use cases
- Control resource usage by limiting active connections

## Usage Examples

Ask Claude:

### Solana Operations (when ENABLE_SOLANA_TOOLS=true)
- "What's my Solana address?" - Shows your address derived from private key in .env
- "What's the balance of 62QXuWZ3WT6ws1ZFxJobVDVXn6bEsiYpLo5yG612U6u3?"
- "Transfer 0.001 SOL to Cg6cVS4tjkxHthm3K9BHhmvqF7kSz8GnXqqYXnHBzGXd"
- "Show me my SPL token balances"
- "Swap 0.1 SOL to USDC" (Uses Jupiter for best price routing)

### EVM Operations (when ENABLE_ETHEREUM_TOOLS=true)
- "What's the ETH balance of 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933?"
- "Check the USDC balance for 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933 on Ethereum"
- "Send 0.1 ETH to 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933"
- "What's the current gas price on Arbitrum?"
- "Send 100 USDC to 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933 on Polygon"

### Cross-chain Operations (when ENABLE_XCHAIN_TOOLS=true)
- "What's the RUNE balance of thor13zpdckczd0jvyhwxmrwnpap8gmy9m5kk2gzum3?"
- "Show me the pool information for BTC.BTC"
- "Get a swap quote for 0.1 BTC.BTC to ETH.ETH"
- "What's the current state of the RUNE.RUNE pool?"
- "What's the BTC balance of 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?"
- "Show me the transaction history for bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"

## Security Notes

1. **Environment Variables**: All private keys are stored in the .env file and never exposed in the conversation history
2. **Private Keys**: Only use this with test wallets containing small amounts of funds
3. **RPC Endpoints**: Custom RPC endpoints can be configured in the .env file for better reliability and rate limits
4. **.env Security**: The .env file is automatically ignored by git to prevent accidental exposure of private keys
5. **Tool Registration**: Use the tool registration controls to minimize security surface area by only enabling required chains

## Advanced Configuration

### Custom RPC Endpoints
You can configure custom RPC endpoints in your .env file for better reliability and higher rate limits. If not specified, the tool will fall back to public RPC endpoints.

### Network Selection
For EVM operations, you can specify the network by name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche). The tool will automatically use the appropriate RPC endpoint and network configuration.

### THORChain Configuration
The tool uses Nine Realms public endpoints by default, but you can configure a custom THORChain node URL in the .env file for better reliability and rate limits.

### UTXO Chain Data Providers
The tool uses several data providers for UTXO chains:
- BlockCypher
- SoChain
- Haskoin (for Bitcoin Cash)

You can configure API keys for these providers in the .env file for better rate limits.

## Development

To modify or extend the tool:

1. Source code is in the `src` directory
2. Chain-specific code in `src/chains`
3. Run `npm run build` after making changes
4. Use TypeScript for all new code

## Contributing

Contributions are welcome! Please submit pull requests with any improvements or bug fixes.

## License

ISC License