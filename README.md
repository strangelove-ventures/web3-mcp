# Web3 MCP
[![smithery badge](https://smithery.ai/badge/@strangelove-ventures/web3-mcp)](https://smithery.ai/server/@strangelove-ventures/web3-mcp)

A Model-Context-Protocol server for interacting with multiple blockchains including Solana and Ethereum. This server provides simple RPC endpoints for common blockchain operations.

## Features

Solana Operations:
- Get current slot number
- Check SOL account balances
- Get detailed account information
- Display keypair information
- Transfer SOL between accounts
- View SPL token balances
- Get detailed SPL token account information

Ethereum Operations:
- Check ETH account balances
- Check ERC-20 token balances

## Quickstart

### Installing via Smithery

To install Web3 MCP for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@strangelove-ventures/web3-mcp):

```bash
npx -y @smithery/cli install @strangelove-ventures/web3-mcp --client claude
```

clone and install dependencies:

```bash
git clone https://github.com/strangelove-ventures/web3-mcp.git
cd web3-mcp
npm install
```

build the tool

```bash
npm run build
```

add the tool to your claude_desktop_config.json
```
"web3-rpc": {
            "command": "node",
            "args": [
                "/PATH/TO/web3-mcp/build/index.js"
            ]
        }
```

## Usage

Ask Claude:
- whats the latest slot on solana?
- whats the balance of 62QXuWZ3WT6ws1ZFxJobVDVXn6bEsiYpLo5yG612U6u3?
- Here's my test key [REPLACE WITH SECRET KEY]. let's transfer 0.001 SOL to [REPLACE WITH PUBLIC ADDRESS]
- what's the balance of 0x556437c4d22ceaeeebf82006b85bdcc0ae67d933?

## Security Note

Only use this with a test wallet with a small amount of funds.

## RPC Endpoint

The server connects to Solana's mainnet at `https://api.mainnet-beta.solana.com`. To use a different network (like devnet or testnet), modify the `SOLANA_RPC` constant in `src/index.ts`.
