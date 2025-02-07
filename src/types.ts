export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export type MCPHandler = (params: any) => Promise<MCPResponse>;