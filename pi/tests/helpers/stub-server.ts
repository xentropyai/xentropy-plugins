// In-process stub of the Xentropy MCP server: the MCP SDK server over stateless
// Streamable HTTP on 127.0.0.1, with a bearer-key check like the real server.
import { createServer, type IncomingMessage, type Server as HttpServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";

export const TEST_KEY = "xak_EXAMPLE_test_only_0000000000";

export type StubHandler = (
  args: Record<string, unknown>,
  extra: { signal: AbortSignal },
) => Promise<CallToolResult> | CallToolResult;

export interface StubServer {
  url: string;
  tools: Tool[];
  handlers: Map<string, StubHandler>;
  /** Authorization header values seen, in order. */
  authHeaders: (string | undefined)[];
  calls: { name: string; args: Record<string, unknown> }[];
  cancelled: string[];
  close(): Promise<void>;
}

export async function startStubServer(tools: Tool[], handlers: Record<string, StubHandler> = {}): Promise<StubServer> {
  const state: StubServer = {
    url: "",
    tools,
    handlers: new Map(Object.entries(handlers)),
    authHeaders: [],
    calls: [],
    cancelled: [],
    close: async () => {},
  };

  const buildServer = () => {
    const server = new Server({ name: "xentropy-stub", version: "0.0.1" }, { capabilities: { tools: {} } });
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: state.tools }));
    server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
      const name = request.params.name;
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;
      state.calls.push({ name, args });
      extra.signal.addEventListener("abort", () => state.cancelled.push(name), { once: true });
      const handler = state.handlers.get(name);
      if (!handler) {
        return { isError: true, content: [{ type: "text", text: `Unknown tool ${name}` }] };
      }
      return handler(args, { signal: extra.signal });
    });
    return server;
  };

  const readBody = async (req: IncomingMessage) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : undefined;
  };

  const http: HttpServer = createServer(async (req, res) => {
    const auth = req.headers.authorization;
    state.authHeaders.push(auth);
    if (auth !== `Bearer ${TEST_KEY}`) {
      res.writeHead(401, { "content-type": "application/json", "www-authenticate": 'Bearer error="invalid_token"' });
      res.end(JSON.stringify({ error: "invalid_token" }));
      return;
    }
    if (req.method !== "POST") {
      res.writeHead(405).end();
      return;
    }
    const server = buildServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  });

  await new Promise<void>((resolve) => http.listen(0, "127.0.0.1", resolve));
  const { port } = http.address() as AddressInfo;
  state.url = `http://127.0.0.1:${port}/mcp`;
  state.close = () =>
    new Promise<void>((resolve) => {
      http.closeAllConnections();
      http.close(() => resolve());
    });
  return state;
}
