// Configuration from environment variables. pi has no secrets API, so the key
// comes from XENTROPY_API_KEY and is only ever placed in the Authorization header.

export const DEFAULT_MCP_URL = "https://api.xentropy.ai/mcp";
export const API_KEYS_URL = "https://xentropy.ai/settings/api-keys";
export const DOCS_URL = "https://docs.xentropy.ai";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export type Env = Record<string, string | undefined>;

export type Config =
  | { ok: true; url: URL; apiKey: string }
  | { ok: false; reason: "no-key"; url?: URL; message: string }
  | { ok: false; reason: "bad-url"; message: string };

/** Accept https anywhere, and plain http only on a loopback host (local development). */
export function checkServerUrl(raw: string): { ok: true; url: URL } | { ok: false; message: string } {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, message: "XENTROPY_MCP_URL is not a valid URL; it must be an https:// URL." };
  }
  if (url.protocol === "https:") return { ok: true, url };
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) return { ok: true, url };
  return {
    ok: false,
    message: `XENTROPY_MCP_URL must use https (plain http is allowed only for localhost); refusing ${url.protocol}//${url.host}.`,
  };
}

export function resolveConfig(env: Env): Config {
  const rawUrl = env.XENTROPY_MCP_URL?.trim() || DEFAULT_MCP_URL;
  const checked = checkServerUrl(rawUrl);
  if (!checked.ok) return { ok: false, reason: "bad-url", message: checked.message };
  const apiKey = env.XENTROPY_API_KEY?.trim();
  if (!apiKey) {
    return {
      ok: false,
      reason: "no-key",
      url: checked.url,
      message: "Xentropy: set XENTROPY_API_KEY to use Xentropy tools; run /xentropy-login for setup steps.",
    };
  }
  return { ok: true, url: checked.url, apiKey };
}

/** The server URL without credentials, query or fragment, for display. */
export function displayUrl(url: URL): string {
  return `${url.protocol}//${url.host}${url.pathname}`;
}

/** Remove any occurrence of the key from text before it is shown. */
export function redact(text: string, apiKey: string | undefined): string {
  if (!apiKey) return text;
  return text.split(apiKey).join("[redacted]");
}
