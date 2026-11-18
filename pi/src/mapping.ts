// Pure conversions between MCP tool data and pi tool definitions and results.
import { createHash } from "node:crypto";

export const TOOL_PREFIX = "xentropy_";
/** Provider tool-name limit (Anthropic and OpenAI): ^[a-zA-Z0-9_-]{1,64}$. pi's own MCP names use [A-Za-z0-9_]. */
export const MAX_TOOL_NAME = 64;
export const DESTRUCTIVE_NOTE = "Changes or deletes data.";

export interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface McpTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: McpToolAnnotations;
}

export type PiContent = { type: "text"; text: string } | { type: "image"; data: string; mimeType: string };

/**
 * pi tool name for an MCP tool: `xentropy_<tool>` with every character outside
 * [A-Za-z0-9_] replaced by `_`. Names that would exceed 64 characters or collide
 * with a name already taken get a short hash of the MCP name instead of their tail.
 */
export function toPiToolName(mcpName: string, taken: ReadonlySet<string>): string {
  const plain = TOOL_PREFIX + mcpName.replace(/[^A-Za-z0-9_]/g, "_");
  if (plain.length <= MAX_TOOL_NAME && !taken.has(plain)) return plain;
  const hash = createHash("sha256").update(mcpName).digest("hex").slice(0, 8);
  return `${plain.slice(0, MAX_TOOL_NAME - hash.length - 1)}_${hash}`;
}

/** MCP input schemas are JSON Schema objects; pi validates JSON Schema directly. */
export function toPiParameters(inputSchema: Record<string, unknown> | undefined): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...(inputSchema ?? {}) };
  delete schema.$schema;
  if (schema.type === undefined) schema.type = "object";
  if (schema.type === "object" && schema.properties === undefined) schema.properties = {};
  return schema;
}

/** MCP defaults: a tool without hints is not read-only and may be destructive. */
export function isDestructive(annotations: McpToolAnnotations | undefined): boolean {
  if (annotations?.readOnlyHint === true) return false;
  return annotations?.destructiveHint !== false;
}

export function toPiDescription(tool: McpTool): string {
  const base = tool.description?.trim() || tool.annotations?.title || tool.title || tool.name;
  return isDestructive(tool.annotations) ? `${DESTRUCTIVE_NOTE} ${base}` : base;
}

export function toPiLabel(tool: McpTool): string {
  return tool.title || tool.annotations?.title || tool.name;
}

export function toPiAnnotations(a: McpToolAnnotations | undefined) {
  if (!a) return undefined;
  const out: Record<string, boolean> = {};
  for (const k of ["readOnlyHint", "destructiveHint", "idempotentHint", "openWorldHint"] as const) {
    if (typeof a[k] === "boolean") out[k] = a[k]!;
  }
  return out;
}

/** Map MCP CallToolResult content to the text and image blocks pi results carry. */
export function toPiContent(content: unknown, structuredContent: unknown): PiContent[] {
  const out: PiContent[] = [];
  for (const block of Array.isArray(content) ? content : []) {
    const b = block as Record<string, any>;
    switch (b?.type) {
      case "text":
        out.push({ type: "text", text: String(b.text ?? "") });
        break;
      case "image":
        out.push({ type: "image", data: String(b.data ?? ""), mimeType: String(b.mimeType ?? "image/png") });
        break;
      case "audio":
        out.push({ type: "text", text: `[Xentropy returned ${b.mimeType ?? "audio"} content, which pi cannot show.]` });
        break;
      case "resource_link":
        out.push({ type: "text", text: `Resource: ${b.name ?? b.title ?? ""} ${b.uri ?? ""}`.trim() });
        break;
      case "resource": {
        const r = b.resource ?? {};
        if (typeof r.text === "string") out.push({ type: "text", text: r.text });
        else out.push({ type: "text", text: `[Binary resource ${r.uri ?? ""} (${r.mimeType ?? "unknown type"}) omitted.]` });
        break;
      }
      default:
        out.push({ type: "text", text: `[Unsupported content type ${String(b?.type)} omitted.]` });
    }
  }
  if (out.length === 0) {
    out.push({ type: "text", text: structuredContent !== undefined ? JSON.stringify(structuredContent) : "(no content)" });
  }
  return out;
}
