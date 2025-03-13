# Cardano Support for Web3-MCP

This document covers the Cardano blockchain integration for web3-mcp.

## Overview

The Cardano integration in web3-mcp allows you to interact with the Cardano blockchain through the Blockfrost API, providing access to network data, address information, transaction details, stake pools, and more.

## Prerequisites

To use the Cardano integration, you need a Blockfrost API key. You can get one by signing up at [blockfrost.io](https://blockfrost.io/).

## Configuration

Update your `.env` file with the following settings:

```
# Cardano Configuration
BLOCKFROST_API_KEY=your-blockfrost-api-key-here
CARDANO_NETWORK=mainnet     # or 'testnet', 'preview', 'preprod'
ENABLE_CARDANO_TOOLS=true
```

## Available Tools

### Network Information

#### 1. Get Cardano Network Information

```javascript
const response = await server.call("getCardanoNetworkInfo", {});
```

Returns current information about the Cardano network including:
- Latest block details (height, hash, slot, epoch)
- Network parameters
- Timing information

#### 2. Get Cardano Network Statistics

```javascript
const response = await server.call("getCardanoNetworkStats", {});
```

Returns statistics about the Cardano network including:
- Number of blocks
- Number of transactions
- Number of native tokens
- Number of addresses with ADA
- Number of delegated stakes

#### 3. Get Current Epoch Information

```javascript
const response = await server.call("getCardanoEpochInfo", {});
```

Returns information about the current epoch including:
- Epoch number
- Start and end time
- Block and transaction counts
- Protocol parameters

### Address Operations

#### 1. Get Address Information

```javascript
const response = await server.call("getCardanoAddressInfo", {
  address: "addr1qyx...",
});
```

Returns information about a Cardano address including:
- Balance in ADA
- UTxO count
- Address type (script or key-based)
- Stake address (if delegated)

#### 2. Get Address Transactions

```javascript
const response = await server.call("getCardanoAddressTransactions", {
  address: "addr1qyx...",
  count: 10,   // Optional, default is 10
  page: 1      // Optional, default is 1
});
```

Returns a list of transactions for the specified address, including:
- Transaction hash
- Block and slot
- Output amounts
- Fees
- Date and time

#### 3. Get Address UTxOs

```javascript
const response = await server.call("getCardanoAddressUtxos", {
  address: "addr1qyx...",
});
```

Returns a list of unspent transaction outputs (UTxOs) for the specified address.

### Staking Operations

#### 1. Get Stake Address Information

```javascript
const response = await server.call("getCardanoStakeAddressInfo", {
  stakeAddress: "stake1ux...",
});
```

Returns information about a Cardano stake address including:
- Total balance delegated
- Rewards balance
- Withdrawal history
- Delegation information
- Recent rewards

#### 2. Get Pool Information

```javascript
const response = await server.call("getCardanoPoolInfo", {
  poolId: "pool1...",
});
```

Returns detailed information about a specific stake pool:
- Pool metadata (name, ticker, description)
- Performance metrics
- Stake and delegator information
- Reward details

#### 3. List Top Stake Pools

```javascript
const response = await server.call("listCardanoTopPools", {
  count: 10,   // Optional, default is 10
});
```

Returns a list of the top stake pools by live stake, including key metrics for each pool.

### Asset Operations

#### 1. Get Asset Information

```javascript
const response = await server.call("getCardanoAssetInfo", {
  assetId: "asset1...",
});
```

Returns detailed information about a Cardano native asset:
- Asset policy and name
- Total supply
- Mint/burn history
- Metadata
- Top addresses holding the asset

### Transaction Operations

#### 1. Get Transaction Information

```javascript
const response = await server.call("getCardanoTransactionInfo", {
  txHash: "5c7...",
});
```

Returns detailed information about a Cardano transaction:
- Basic transaction details (block, slot, fees)
- Inputs and outputs
- Metadata
- Validity interval

## Error Handling

All tools return a standardized error format if they fail:

```javascript
{
  content: [
    { 
      type: "text", 
      text: "Failed to [operation]: [error message]" 
    }
  ]
}
```

## Advanced Usage

For more advanced Cardano operations that go beyond querying blockchain data, such as:

1. Creating and submitting transactions
2. Minting native tokens
3. Working with smart contracts

You may need to extend the functionality by implementing additional tools that use:

- [Cardano Serialization Library](https://github.com/Emurgo/cardano-serialization-lib)
- [Mesh.js](https://meshjs.dev/) for client-side operations

## References

- [Blockfrost Documentation](https://docs.blockfrost.io/)
- [Cardano Developer Portal](https://developers.cardano.org/)
- [Mesh.js Documentation](https://meshjs.dev/)
