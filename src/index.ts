#!/usr/bin/env node

import { createServer as createHttpServer } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "./tools/index.js";
import {
  ENABLED_TOOLS,
  MCP_AUTH_TOKEN,
  MCP_HTTP_HOST,
  MCP_HTTP_PATH,
  MCP_HTTP_PORT,
  MCP_TRANSPORT,
} from "./config.js";

function createServer(): McpServer {
  const server = new McpServer({ name: "tududi", version: "1.0.0" });
  registerAllTools(server, ENABLED_TOOLS);
  return server;
}

async function runStdio() {
  await createServer().connect(new StdioServerTransport());
  console.error("Tududi MCP server running on stdio");
}

function authorized(header: string | undefined): boolean {
  if (!MCP_AUTH_TOKEN) return true;
  const expected = Buffer.from(`Bearer ${MCP_AUTH_TOKEN}`);
  const got = Buffer.from(header ?? "");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

async function runHttp() {
  if (!MCP_AUTH_TOKEN) {
    console.error("WARNING: MCP_AUTH_TOKEN is not set; the HTTP endpoint is unauthenticated");
  }

  const httpServer = createHttpServer(async (req, res) => {
    const path = (req.url ?? "").split("?")[0];

    if (path === "/healthz") {
      res.writeHead(200).end("ok");
      return;
    }
    if (path !== MCP_HTTP_PATH) {
      res.writeHead(404).end();
      return;
    }
    if (!authorized(req.headers.authorization)) {
      res.writeHead(401, { "WWW-Authenticate": "Bearer" }).end();
      return;
    }
    if (req.method !== "POST") {
      // Stateless mode: no server-initiated streams or sessions.
      res.writeHead(405, { Allow: "POST" }).end();
      return;
    }

    // Stateless: a fresh server + transport per request.
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      transport.close();
      server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" }).end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          })
        );
      }
    }
  });

  httpServer.listen(MCP_HTTP_PORT, MCP_HTTP_HOST, () => {
    console.error(
      `Tududi MCP server listening on http://${MCP_HTTP_HOST}:${MCP_HTTP_PORT}${MCP_HTTP_PATH}` +
        (ENABLED_TOOLS ? ` (tools: ${[...ENABLED_TOOLS].join(", ")})` : " (all tools)")
    );
  });
}

(MCP_TRANSPORT === "http" ? runHttp() : runStdio()).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
