declare namespace NodeJS {
  interface ProcessEnv {
    // Solana
    SOLANA_RPC_URL: string;
    SOLANA_PRIVATE_KEY: string;

    // Ethereum and other EVM chains
    ETH_RPC_URL: string;
    ETH_PRIVATE_KEY: string;
    BASE_RPC_URL: string;
    ARBITRUM_RPC_URL: string;
    OPTIMISM_RPC_URL: string;
    BSC_RPC_URL: string;
    POLYGON_RPC_URL: string;
    AVALANCHE_RPC_URL: string;

    // Ripple (XRP)
    XRP_RPC_URL: string;
    XRP_ADDRESS: string;
    XRP_PRIVATE_KEY: string;
    XRP_PUBLIC_KEY: string;
  }
}