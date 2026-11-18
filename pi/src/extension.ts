// Xentropy for pi: connects to the Xentropy MCP server on each session start and
// registers its tools as pi tools named `xentropy_<tool>`.
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport, StreamableHTTPError } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { API_KEYS_URL, DEFAULT_MCP_URL, DOCS_URL, displayUrl, redact, resolveConfig, type Env } from "./config.ts";
import {
  toPiAnnotations,
  toPiContent,
  toPiDescription,
  toPiLabel,
  toPiParameters,
  toPiToolName,
  type McpTool,
} from "./mapping.ts";

export { API_KEYS_URL, DEFAULT_MCP_URL } from "./config.ts";

export interface XentropyOptions {
  /** Environment to read XENTROPY_API_KEY and XENTROPY_MCP_URL from (read on every session start). */
  env: Env;
  /** Timeout for connecting and listing tools, in ms. */
  connectTimeoutMs?: number;
  /** Timeout for one tool call without progress, in ms. */
  callTimeoutMs?: number;
}

const CLIENT_INFO = { name: "xentropy-pi", version: "0.1.0" };

interface ToolDetails {
  tool: string;
  server: string;
}

interface State {
  client?: Client;
  url?: URL;
  apiKey?: string;
  serverName?: string;
  /** pi tool name -> MCP tool name, for the tools the current session offers. */
  active: Map<string, string>;
  /** Every pi tool name this extension has ever registered (tools cannot be unregistered). */
  registered: Set<string>;
  error?: string;
  configured: boolean;
}

type Notify = Pick<ExtensionContext, "ui">;

function notify(ctx: Notify, message: string, type: "info" | "warning" | "error" = "info") {
  try {
    ctx.ui.notify(message, type);
  } catch {
    // UI may be unavailable (print or JSON mode); messages are best effort.
  }
}

function describeError(err: unknown, apiKey: string | undefined): string {
  let text: string;
  if (err instanceof StreamableHTTPError && (err.code === 401 || err.code === 403)) {
    text = `the server rejected the API key (HTTP ${err.code}); check XENTROPY_API_KEY or create a new key (/xentropy-login)`;
  } else if (err instanceof Error) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    text = cause?.code ? `${err.message} (${cause.code})` : err.message;
    if (/\b401\b|unauthori[sz]ed/i.test(text)) text += "; check XENTROPY_API_KEY (/xentropy-login)";
  } else {
    text = String(err);
  }
  return redact(text, apiKey);
}

export function setupXentropy(pi: ExtensionAPI, options: XentropyOptions): void {
  const state: State = { active: new Map(), registered: new Set(), configured: false };
  const connectTimeout = options.connectTimeoutMs ?? 15_000;
  const callTimeout = options.callTimeoutMs ?? 300_000;

  async function disconnect() {
    const client = state.client;
    state.client = undefined;
    if (client) await client.close().catch(() => undefined);
  }

  function registerMcpTool(piName: string, tool: McpTool) {
    pi.registerTool({
      name: piName,
      label: toPiLabel(tool),
      description: toPiDescription(tool),
      parameters: toPiParameters(tool.inputSchema) as any,
      annotations: toPiAnnotations(tool.annotations),
      async execute(_toolCallId, params, signal) {
        const mcpName = state.active.get(piName);
        const client = state.client;
        if (!mcpName || !client) {
          throw new Error(`Xentropy tool ${tool.name} is not available in this session. Run /xentropy-status.`);
        }
        let result;
        try {
          result = await client.callTool({ name: mcpName, arguments: (params ?? {}) as Record<string, unknown> }, undefined, {
            signal,
            timeout: callTimeout,
            resetTimeoutOnProgress: true,
          });
        } catch (err) {
          if (signal?.aborted) throw new Error(`Xentropy call ${mcpName} was cancelled.`);
          throw new Error(`Xentropy call ${mcpName} failed: ${describeError(err, state.apiKey)}`);
        }
        const details: ToolDetails = { tool: mcpName, server: state.url ? displayUrl(state.url) : "" };
        const structured = (result as { structuredContent?: unknown }).structuredContent;
        return {
          content: toPiContent(result.content, structured),
          details,
          ...(structured !== undefined ? { structuredContent: structured as any } : {}),
          ...(result.isError ? { isError: true } : {}),
        };
      },
    });
    state.registered.add(piName);
  }

  function withdraw(piName: string) {
    pi.registerTool({
      name: piName,
      label: piName,
      description: "No longer offered by the Xentropy server.",
      parameters: { type: "object", properties: {} } as any,
      exposure: "hidden",
      async execute() {
        throw new Error("This Xentropy tool is no longer offered by the server.");
      },
    });
  }

  async function connect(ctx: Notify) {
    await disconnect();
    state.active.clear();
    state.error = undefined;
    state.serverName = undefined;

    const config = resolveConfig(options.env);
    state.configured = config.ok;
    state.url = config.ok ? config.url : config.reason === "no-key" ? config.url : undefined;
    state.apiKey = config.ok ? config.apiKey : undefined;

    const offered = new Map<string, McpTool>();
    if (!config.ok) {
      state.error = config.message;
      notify(ctx, config.message, config.reason === "bad-url" ? "error" : "info");
    } else {
      const client = new Client(CLIENT_INFO, { capabilities: {} });
      const transport = new StreamableHTTPClientTransport(config.url, {
        requestInit: { headers: { Authorization: `Bearer ${config.apiKey}` } },
      });
      try {
        const signal = AbortSignal.timeout(connectTimeout);
        await client.connect(transport, { signal, timeout: connectTimeout });
        const tools: McpTool[] = [];
        let cursor: string | undefined;
        do {
          const page = await client.listTools(cursor ? { cursor } : undefined, { signal, timeout: connectTimeout });
          tools.push(...(page.tools as McpTool[]));
          cursor = page.nextCursor;
        } while (cursor);
        state.client = client;
        state.serverName = client.getServerVersion()?.name;
        const taken = new Set<string>();
        for (const tool of tools) {
          const piName = toPiToolName(tool.name, taken);
          taken.add(piName);
          offered.set(piName, tool);
        }
      } catch (err) {
        await client.close().catch(() => undefined);
        state.error = `Xentropy: could not connect to ${displayUrl(config.url)}: ${describeError(err, config.apiKey)}`;
        notify(ctx, state.error, "error");
      }
    }

    for (const [piName, tool] of offered) {
      state.active.set(piName, tool.name);
      registerMcpTool(piName, tool);
    }
    for (const piName of state.registered) {
      if (!offered.has(piName)) withdraw(piName);
    }
    if (state.client) {
      notify(ctx, `Xentropy: connected to ${displayUrl(state.url!)} with ${offered.size} tools.`, "info");
    }
  }

  pi.on("session_start", async (_event, ctx) => {
    await connect(ctx);
  });

  pi.on("session_shutdown", async () => {
    await disconnect();
  });

  pi.registerCommand("xentropy-status", {
    description: "Show the Xentropy connection: server, tool count and auth mode",
    handler: async (_args, ctx) => {
      const url = state.url ? displayUrl(state.url) : options.env.XENTROPY_MCP_URL ? "(invalid XENTROPY_MCP_URL)" : DEFAULT_MCP_URL;
      const lines = [`Xentropy server: ${url}`];
      if (state.client) {
        lines.push(`Status: connected${state.serverName ? ` (${state.serverName})` : ""}, ${state.active.size} tools`);
      } else if (!state.configured && !options.env.XENTROPY_API_KEY?.trim()) {
        lines.push("Status: not configured (no API key). Run /xentropy-login for setup steps.");
      } else {
        lines.push(`Status: not connected. ${state.error ?? "No session has started yet."}`);
      }
      lines.push(`Auth: ${state.apiKey ? "API key from XENTROPY_API_KEY (Bearer)" : "none"}`);
      notify(ctx, redact(lines.join("\n"), state.apiKey), "info");
    },
  });

  pi.registerCommand("xentropy-login", {
    description: "Show how to connect pi to Xentropy with an API key",
    handler: async (_args, ctx) => {
      notify(
        ctx,
        [
          "Connect pi to Xentropy:",
          `1. Create an API key at ${API_KEYS_URL} (choose the Agent preset).`,
          "2. Set it in the shell that starts pi: export XENTROPY_API_KEY=xak_...",
          "   Optional: export XENTROPY_MCP_URL=https://... for a non-production server.",
          "3. Restart pi or run /reload, then check /xentropy-status.",
          `Docs: ${DOCS_URL}`,
        ].join("\n"),
        "info",
      );
    },
  });
}
