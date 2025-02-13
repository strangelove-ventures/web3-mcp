# Web3 MCP

A Model-Context-Protocol server for interacting with multiple blockchains including Solana, Ethereum, and UTXO chains. This server provides simple RPC endpoints for common blockchain operations, allowing secure interactions with various blockchains through environment variables.

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

### Network RPC URLs (optional - will use public endpoints if not specified)
```env
# Solana
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

# Private Keys (required for transactions)
ETH_PRIVATE_KEY=your-ethereum-private-key
SOLANA_PRIVATE_KEY=your-base58-encoded-solana-private-key

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

## Usage Examples

Ask Claude:

### Solana Operations
- "What's my Solana address?" - Shows your address derived from private key in .env
- "What's the balance of 62QXuWZ3WT6ws1ZFxJobVDVXn6bEsiYpLo5yG612U6u3?"
- "Transfer 0.001 SOL to Cg6cVS4tjkxHthm3K9BHhmvqF7kSz8GnXqqYXnHBzGXd"
- "Show me my SPL token balances"
- "Swap 0.1 SOL to USDC" (Uses Jupiter for best price routing)

### EVM Operations
- "What's the ETH balance of 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933?"
- "Check the USDC balance for 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933 on Ethereum"
- "Send 0.1 ETH to 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933"
- "What's the current gas price on Arbitrum?"
- "Send 100 USDC to 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933 on Polygon"

### UTXO Chain Operations
- "What's the BTC balance of 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?"
- "Show me the transaction history for bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
- "Is ltc1qgj73yjsc4tm5kgv2zgf9zqt74pac4peugvxhuy a valid Litecoin address?"
- "What are the current network fees for Bitcoin Cash?"
- "Check DOGE balance for D6T2SsXPQPqFBcYzX3EXJvYG1F8BsNAk4z"

## Security Notes

1. **Environment Variables**: All private keys are stored in the .env file and never exposed in the conversation history
2. **Private Keys**: Only use this with test wallets containing small amounts of funds
3. **RPC Endpoints**: Custom RPC endpoints can be configured in the .env file for better reliability and rate limits
4. **.env Security**: The .env file is automatically ignored by git to prevent accidental exposure of private keys

## Advanced Configuration

### Custom RPC Endpoints
You can configure custom RPC endpoints in your .env file for better reliability and higher rate limits. If not specified, the tool will fall back to public RPC endpoints.

### Network Selection
For EVM operations, you can specify the network by name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche). The tool will automatically use the appropriate RPC endpoint and network configuration.

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
