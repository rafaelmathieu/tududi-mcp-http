import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTaskTools } from "./tasks.js";
import { registerProjectTools } from "./projects.js";
import { registerInboxTools } from "./inbox.js";
import { registerMiscTools } from "./misc.js";

/**
 * Register tools, optionally limited to an allowlist of tool names.
 * The filter wraps registerTool so individual tool files stay unchanged.
 */
export function registerAllTools(server: McpServer, enabled?: Set<string>) {
  const target: McpServer = enabled
    ? new Proxy(server, {
        get(obj, prop, receiver) {
          if (prop === "registerTool") {
            return (name: string, ...rest: unknown[]) =>
              enabled.has(name)
                ? (obj.registerTool as (...a: unknown[]) => unknown).call(obj, name, ...rest)
                : undefined;
          }
          return Reflect.get(obj, prop, receiver);
        },
      })
    : server;

  registerTaskTools(target);
  registerProjectTools(target);
  registerInboxTools(target);
  registerMiscTools(target);
}
