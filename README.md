# Web3 MCP

A Model-Context-Protocol server for interacting with multiple blockchains including Solana, Ethereum, THORChain, XRP Ledger, TON (The Open Network), Cardano, and UTXO chains. This server provides simple RPC endpoints for common blockchain operations, allowing secure interactions with various blockchains through environment variables.

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

Cardano Operations:
- Get network information and statistics
- Check address balances and transaction history
- View UTxOs for an address
- Explore stake pools and delegation information
- Get details about native assets
- View detailed transaction information
- Get statistics about the current epoch

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

XRP Ledger Operations:
- Check XRP account balances
- View transaction history
- Validate XRP addresses
- Send XRP to another address
- Get current XRP Ledger information
- Check token balances
- Create trustlines for tokens

TON (The Open Network) Operations:
- Get TON account balances
- View transaction history
- Validate TON addresses
- Send TON to another address with optional memo/comment
- Get current TON network information

Supported EVM Networks:
- Ethereum
- Base
- Arbitrum
- Optimism
- BSC (Binance Smart Chain)
- Polygon
- Avalanche
- Berachain

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
ENABLE_SOLANA_TOOLS=true      # Enable/disable Solana tools
ENABLE_ETHEREUM_TOOLS=true    # Enable/disable Ethereum and EVM chain tools
ENABLE_CARDANO_TOOLS=true     # Enable/disable Cardano tools

# UTXO Chain Tools
ENABLE_BITCOIN_TOOLS=true     # Enable/disable Bitcoin tools
ENABLE_LITECOIN_TOOLS=true    # Enable/disable Litecoin tools
ENABLE_DOGECOIN_TOOLS=true    # Enable/disable Dogecoin tools
ENABLE_BITCOINCASH_TOOLS=true # Enable/disable Bitcoin Cash tools
ENABLE_THORCHAIN_TOOLS=true   # Enable/disable THORChain tools
ENABLE_RIPPLE_TOOLS=true      # Enable/disable XRP Ledger tools
ENABLE_TON_TOOLS=true         # Enable/disable TON tools

# Private Keys (required for transactions)
ETH_PRIVATE_KEY=your-ethereum-private-key
SOLANA_PRIVATE_KEY=your-base58-encoded-solana-private-key

# XRP Ledger credentials (required for XRP transactions)
# Either private key or mnemonic is required
XRP_PRIVATE_KEY=your-xrp-private-key-in-hex
# OR
XRP_MNEMONIC=your-xrp-mnemonic-recovery-phrase
# Optional - used to verify the derived address
XRP_ADDRESS=your-xrp-account-address

# TON Configuration
TON_MNEMONIC=word1 word2 word3 ... word24  # 24-word recovery phrase for TON wallet
TON_ADDRESS=your-ton-wallet-address       # Your TON wallet address
TON_API_KEY=your-toncenter-api-key        # Get from @tonapibot on Telegram (optional but recommended)
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC  # Optional - default is TON Center API

# Cardano Configuration
BLOCKFROST_API_KEY=your-blockfrost-api-key  # Get a real API key from https://blockfrost.io/
CARDANO_NETWORK=mainnet     # or 'testnet', 'preview', 'preprod'
CARDANO_MNEMONIC=your-cardano-mnemonic-phrase   # Required for transaction signing
CARDANO_ACCOUNT_INDEX=0     # Optional - defaults to 0
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
BERACHAIN_RPC_URL=https://rpc.berachain.com

# XRP Ledger
XRP_RPC_URL=https://xrplcluster.com/     # Optional - will use public endpoint if not specified

# TON Network
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC  # Optional - default is TON Center API
TON_API_KEY=your-toncenter-api-key        # Get from @tonapibot on Telegram (optional but recommended)

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

- `ENABLE_SOLANA_TOOLS`: Enable/disable Solana tools
- `ENABLE_ETHEREUM_TOOLS`: Enable/disable Ethereum and EVM chain tools
- `ENABLE_BITCOIN_TOOLS`: Enable/disable Bitcoin tools
- `ENABLE_LITECOIN_TOOLS`: Enable/disable Litecoin tools
- `ENABLE_DOGECOIN_TOOLS`: Enable/disable Dogecoin tools
- `ENABLE_BITCOINCASH_TOOLS`: Enable/disable Bitcoin Cash tools
- `ENABLE_THORCHAIN_TOOLS`: Enable/disable THORChain tools
- `ENABLE_RIPPLE_TOOLS`: Enable/disable XRP Ledger tools
- `ENABLE_CARDANO_TOOLS`: Enable/disable Cardano tools
- `ENABLE_TON_TOOLS`: Enable/disable TON tools

Set these variables to `true` or `false` in your `.env` file to control which tools are available to the server. This allows you to:

- Reduce startup time by only loading required tools
- Minimize security surface area by disabling unused chains
- Customize the server for specific use cases
- Control resource usage by limiting active connections

## Usage Examples

Ask Claude (or your MCP client of choice):

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

### Cardano Operations (when ENABLE_CARDANO_TOOLS=true)
- Get the balance of any Cardano
- View your wallet information
- Send ADA to another address
- Send native tokens to another address

### Bitcoin Operations (when ENABLE_BITCOIN_TOOLS=true)
- "What's the BTC balance of 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa?"
- "Show me the transaction history for bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh"
- "Validate this Bitcoin address: 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"

### Litecoin Operations (when ENABLE_LITECOIN_TOOLS=true)
- "What's the LTC balance of LM2WMpR1Rp6j3Sa59cMXMs1SPzj9eXpGc1?"
- "Show me the transaction history for this Litecoin address"
- "What's the current Litecoin network fee?"

### Dogecoin Operations (when ENABLE_DOGECOIN_TOOLS=true)
- "Check this DOGE address balance: D8vFz4p1L37jdg47HXKtSHA5uYLYxbGgPD"
- "Show me recent Dogecoin transactions"
- "What are the current DOGE network fees?"

### Bitcoin Cash Operations (when ENABLE_BITCOINCASH_TOOLS=true)
- "What's the BCH balance of this address?"
- "Show me the BCH transaction history"
- "Validate this Bitcoin Cash address"

### THORChain Operations (when ENABLE_THORCHAIN_TOOLS=true)
- "What's the RUNE balance of thor13zpdckczd0jvyhwxmrwnpap8gmy9m5kk2gzum3?"
- "Show me the pool information for BTC.BTC"
- "Get a swap quote for 0.1 BTC.BTC to ETH.ETH"

### XRP Ledger Operations (when ENABLE_RIPPLE_TOOLS=true)
- "What's the XRP balance of rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe?"
- "Show me the transaction history for rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
- "Is rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe a valid XRP address?"
- "Send 10 XRP to rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
- "What's the current XRP Ledger information?"
- "Show me token balances for rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe"
- "Create a trustline for USD with issuer rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe with a limit of 1000"

### TON Operations (when ENABLE_TON_TOOLS=true)
- "What's the TON balance of EQAAFhjXzKuQ5N0c96nsdZQWATcJm909LYSaCAvWFQF8tvUZ?"
- "Show me the transaction history for EQAAFhjXzKuQ5N0c96nsdZQWATcJm909LYSaCAvWFQF8tvUZ"
- "Is UQD0BRQt-QdIEbsjuRsMqzDlBkUAEfQixShDECoKEOXRc4eR a valid TON address?"
- "Send 0.1 TON to EQAAFhjXzKuQ5N0c96nsdZQWATcJm909LYSaCAvWFQF8tvUZ"
- "Send 0.01 TON to UQD0BRQt-QdIEbsjuRsMqzDlBkUAEfQixShDECoKEOXRc4eR with comment 'test payment'"
- "What's the current TON Network information?"

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
For EVM operations, you can specify the network by name (ethereum, base, arbitrum, optimism, bsc, polygon, avalanche, berachain). The tool will automatically use the appropriate RPC endpoint and network configuration.

### Cardano Configuration
The tool uses the Blockfrost API and Lucid library to interact with the Cardano blockchain.
- `BLOCKFROST_API_KEY`: Required - Your Blockfrost API key (register at https://blockfrost.io/)
- `CARDANO_NETWORK`: Optional - The Cardano network to use (mainnet, testnet, preview, preprod). Defaults to 'mainnet'
- `CARDANO_MNEMONIC`: Required for transactions - Your Cardano wallet's mnemonic phrase (15 or 24 words)
- `CARDANO_ACCOUNT_INDEX`: Optional - The account index to use (defaults to 0)

The wallet derived from your mnemonic will be used to sign and send transactions.

### THORChain Configuration
The tool uses Nine Realms public endpoints by default, but you can configure a custom THORChain node URL in the .env file for better reliability and rate limits.

### XRP Ledger Configuration
The tool can use either a private key or mnemonic phrase for XRP transactions. Configure these in your .env file:
- `XRP_PRIVATE_KEY`: Your XRP private key in hex format
- `XRP_MNEMONIC`: Alternative to private key - your 12-word recovery phrase
- `XRP_ADDRESS`: Optional - Your XRP account address (used to verify the derived address)
- `XRP_RPC_URL`: Optional - Custom XRP Ledger node URL (defaults to public endpoint)

### TON Configuration
The tool uses TON Center's API by default and requires a mnemonic phrase for TON transactions. Configure these in your .env file:
- `TON_MNEMONIC`: Required - Your 24-word recovery phrase for TON wallet
- `TON_ADDRESS`: Required - Your TON wallet address
- `TON_API_KEY`: Recommended - API key from @tonapibot on Telegram (for higher rate limits)
- `TON_RPC_URL`: Optional - Custom TON RPC URL (defaults to TON Center API)

The implementation includes automatic retry logic with exponential backoff for rate limit handling.

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