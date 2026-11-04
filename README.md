# Tududi MCP Server

Connect AI assistants to your [tududi](https://github.com/chrisvel/tududi) task manager over the Model Context Protocol (MCP).

The server runs in one of two modes:

- **stdio** (default): a local process started by a desktop client such as Claude Desktop.
- **HTTP**: a network endpoint (stateless Streamable HTTP) for remote clients such as phone apps, other machines, or self-hosted agents. It supports bearer-token auth and a tool allowlist.

> **About this fork:** it adds the HTTP mode, `MCP_AUTH_TOKEN` authentication, the `TUDUDI_TOOLS` allowlist, a Dockerfile and deployment examples. stdio is still the default and behaves as before. See [Changes in this fork](#changes-in-this-fork).

## Quick Start

```bash
npm install
npm run build
```

Get an API token from tududi under **Settings** > **API Tokens** > **Create new token**.

## Option 1: stdio (Claude Desktop and other local clients)

Add this to your Claude config file:

- **Mac**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Linux**: `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tududi": {
      "command": "node",
      "args": ["/path/to/tududi-mcp/dist/index.js"],
      "env": {
        "TUDUDI_URL": "http://localhost:3002",
        "TUDUDI_API_TOKEN": "your-token-here"
      }
    }
  }
}
```

Restart Claude Desktop afterwards.

## Option 2: HTTP (remote clients)

In HTTP mode the server listens on `http://<host>:3000/mcp`. Each POST is handled statelessly, with no sessions or server-initiated streams.

### Run with Docker

```bash
docker build -t tududi-mcp .
docker run -d --name tududi-mcp -p 3000:3000 \
  -e TUDUDI_URL=http://tududi:3002 \
  -e TUDUDI_API_TOKEN=your-tududi-token \
  -e MCP_AUTH_TOKEN=$(openssl rand -hex 32) \
  -e TUDUDI_TOOLS=add_to_inbox,list_inbox \
  tududi-mcp
```

The image defaults to `MCP_TRANSPORT=http` on port 3000. You can also build straight from git:

```yaml
services:
  tududi-mcp:
    build: https://github.com/<you>/tududi-mcp.git#http-transport
```

`deploy/` holds a full compose file and a Caddy reverse-proxy example.

### Run without Docker

```bash
MCP_TRANSPORT=http \
TUDUDI_URL=http://localhost:3002 \
TUDUDI_API_TOKEN=your-tududi-token \
MCP_AUTH_TOKEN=your-mcp-secret \
node dist/index.js
```

### Connect a client

Every request must carry:

```
Authorization: Bearer <MCP_AUTH_TOKEN>
```

The client never sees your tududi API token, which stays on the server. To revoke a client, rotate `MCP_AUTH_TOKEN`.

**Claude Code**

```bash
claude mcp add --transport http tududi https://tududi-mcp.example.com/mcp \
  --header "Authorization: Bearer <MCP_AUTH_TOKEN>"
```

**Pebble Index 01** (Pebble app → Index 01 Settings → MCP & Tool Settings → MCP Servers → Add MCP Server)

| Field | Value |
| --- | --- |
| Name | `tududi` (no spaces) |
| URL | `https://tududi-mcp.example.com/mcp` |
| Transport | Streamable |
| Authorization | `Bearer <MCP_AUTH_TOKEN>` |
| Group | Default MCP Sandbox |

The Pebble agent only calls remote MCP servers when its Agent Model is set to **Cloud LLM** or **Cloud LLM (with Local fallback)**. Say "add to my tududi inbox: …" so it doesn't pick the built-in notes action instead.

**Generic MCP client config**

```json
{
  "mcpServers": {
    "tududi": {
      "type": "http",
      "url": "https://tududi-mcp.example.com/mcp",
      "headers": { "Authorization": "Bearer <MCP_AUTH_TOKEN>" }
    }
  }
}
```

### Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/mcp` | MCP JSON-RPC (Streamable HTTP). Path configurable with `MCP_HTTP_PATH`. |
| GET | `/healthz` | Returns `ok`. No auth, so it can be used for container health checks. |

Other methods on `/mcp` return `405`, missing or wrong tokens return `401`, and unknown paths return `404`.

## Limiting tools (`TUDUDI_TOOLS`)

`TUDUDI_TOOLS` takes a comma-separated list of tool names. Only those tools are registered, so a client can't see or call anything else. Calling a tool outside the list returns `Tool <name> not found`. If the variable is unset, all tools are available. This works in both stdio and HTTP mode.

Suggested presets:

| Use case | `TUDUDI_TOOLS` |
| --- | --- |
| Capture only (voice notes, quick add) | `add_to_inbox,list_inbox` |
| Capture + task creation | `add_to_inbox,list_inbox,create_task,list_projects` |
| Read-only | `list_tasks,get_task,list_projects,list_inbox,list_areas,list_tags,search,get_task_metrics` |
| Full access (trusted local client) | *(unset)* |

For any client driven by voice, or by a model you don't control, leave out the destructive tools (`delete_task`, `update_task`, `update_project`). Tool names are matched exactly, and a misspelled name is silently ignored, so check the startup log: it prints the active tool list.

## Available Tools

**Tasks**: list_tasks, get_task, create_task, update_task, complete_task, delete_task, add_subtask, get_task_metrics

**Projects**: list_projects, create_project, update_project

**Inbox**: list_inbox, add_to_inbox

**Other**: list_areas, list_tags, search

## What You Can Do

Ask your assistant things like:
- "Show my tasks for today"
- "Create a task called 'Review PR'"
- "What's in my inbox?"
- "Add to my inbox: call the plumber about the water heater"
- "Complete the documentation task"

## Environment Variables

| Variable | Default | Mode | Description |
| --- | --- | --- | --- |
| `TUDUDI_API_TOKEN` | – | both | **Required.** tududi API token |
| `TUDUDI_URL` | `http://localhost:3002` | both | tududi base URL, no trailing slash |
| `TUDUDI_API_VERSION` | `v1` | both | tududi API version path segment |
| `TUDUDI_TOOLS` | all tools | both | Comma-separated tool allowlist |
| `MCP_TRANSPORT` | `stdio` (`http` in Docker) | – | `stdio` or `http` |
| `MCP_HTTP_HOST` | `0.0.0.0` | http | Bind address |
| `MCP_HTTP_PORT` | `3000` | http | Listen port |
| `MCP_HTTP_PATH` | `/mcp` | http | MCP endpoint path |
| `MCP_AUTH_TOKEN` | – | http | Bearer token clients must send. If unset, the endpoint is **unauthenticated** and a warning is logged. |

## Security Notes

- Always set `MCP_AUTH_TOKEN` in HTTP mode. Generate it with `openssl rand -hex 32`. Tokens are compared in constant time.
- The server speaks plain HTTP. Put it behind a reverse proxy that handles TLS (Caddy, Traefik, nginx), and preferably restrict it to your LAN or VPN. `deploy/caddy-tududi-mcp.conf` has an example.
- Use `TUDUDI_TOOLS` to give each client only the tools it needs. You can run several containers with different allowlists and tokens if different clients need different access.
- Consider a dedicated tududi API token for this server, so you can revoke it separately from your other integrations.

## Changes in this fork

Compared with upstream [`tududi/tududi-mcp`](https://github.com/tududi/tududi-mcp):

| Change | Files |
| --- | --- |
| Streamable HTTP transport (stateless), selected with `MCP_TRANSPORT=http`; stdio stays the default | `src/index.ts`, `src/config.ts` |
| Bearer authentication through `MCP_AUTH_TOKEN` | `src/index.ts`, `src/config.ts` |
| Tool allowlist through `TUDUDI_TOOLS`, applied without changing the individual tool files | `src/tools/index.ts`, `src/config.ts` |
| `/healthz` endpoint | `src/index.ts` |
| `zod` declared as an explicit dependency (it was only installed transitively before) | `package.json` |
| Dockerfile (non-root, health check) and `deploy/` examples (compose, Caddy) | `Dockerfile`, `.dockerignore`, `deploy/` |

Existing stdio configurations need no changes.
