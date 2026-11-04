export const TUDUDI_URL = process.env.TUDUDI_URL || "http://localhost:3002";
export const TUDUDI_API_TOKEN = process.env.TUDUDI_API_TOKEN;
export const API_VERSION = process.env.TUDUDI_API_VERSION || "v1";
export const API_BASE = `${TUDUDI_URL}/api/${API_VERSION}`;

export const PRIORITY_MAP: Record<number, string> = {
  0: "low",
  1: "medium",
  2: "high",
};

export const STATUS_MAP: Record<number, string> = {
  0: "pending",
  1: "in_progress",
  2: "completed",
  3: "archived",
};

// Transport: "stdio" (default) or "http" (Streamable HTTP, stateless)
export const MCP_TRANSPORT = (process.env.MCP_TRANSPORT || "stdio").toLowerCase();
export const MCP_HTTP_HOST = process.env.MCP_HTTP_HOST || "0.0.0.0";
export const MCP_HTTP_PORT = parseInt(process.env.MCP_HTTP_PORT || "3000", 10);
export const MCP_HTTP_PATH = process.env.MCP_HTTP_PATH || "/mcp";
// Bearer token MCP clients must send in HTTP mode (separate from the tududi API token)
export const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

// Optional comma-separated allowlist of tool names, e.g. "add_to_inbox,list_inbox".
// Unset = all tools.
export const ENABLED_TOOLS: Set<string> | undefined = process.env.TUDUDI_TOOLS
  ? new Set(
      process.env.TUDUDI_TOOLS.split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  : undefined;
