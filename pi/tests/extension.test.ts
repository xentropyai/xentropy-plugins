// Scenarios [H-C1]..[H-C12] for the @xentropy/pi extension.
// Each runs the extension against a fake ExtensionAPI recorder and, where it
// needs a server, the in-process stub MCP server on 127.0.0.1.
import { test, describe, after, before } from "node:test";
import assert from "node:assert/strict";
import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import { setupXentropy, DEFAULT_MCP_URL, API_KEYS_URL } from "../src/extension.ts";
import defaultExport from "../extensions/xentropy.ts";
import { fakeContext, fakePi } from "./helpers/fake-pi.ts";
import { startStubServer, TEST_KEY, type StubServer } from "./helpers/stub-server.ts";

const PNG_1PX =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

const TOOLS: Tool[] = [
  {
    name: "artifacts_list",
    title: "List artifacts",
    description: "List artifacts in the workspace.",
    inputSchema: {
      type: "object",
      properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "artifacts_trash",
    description: "Move an artifact to the trash.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
  },
  {
    name: "artifacts_update",
    description: "Update an artifact.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
    annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  },
  {
    name: "legacy.no-hints",
    description: "A tool without annotations.",
    inputSchema: { type: "object" },
  },
  {
    name: "artifacts_export",
    description: "Export an artifact as an image.",
    inputSchema: { type: "object", properties: { id: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "slow_tool",
    description: "Takes a long time.",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  },
];

let stub: StubServer;

before(async () => {
  stub = await startStubServer(structuredClone(TOOLS), {
    artifacts_list: (args) => ({
      content: [{ type: "text", text: `listed ${JSON.stringify(args)}` }],
      structuredContent: { items: [], limit: args.limit ?? null },
    }),
    artifacts_trash: () => ({
      isError: true,
      content: [{ type: "text", text: "NOT_FOUND: artifact art_missing does not exist" }],
    }),
    artifacts_export: () => ({
      content: [
        { type: "text", text: "exported" },
        { type: "image", data: PNG_1PX, mimeType: "image/png" },
        { type: "audio", data: "AAAA", mimeType: "audio/wav" },
        { type: "resource_link", uri: "https://xentropy.ai/a/art_1", name: "art_1" },
      ],
    }),
    slow_tool: (_args, { signal }) =>
      new Promise((resolve) => {
        const t = setTimeout(() => resolve({ content: [{ type: "text", text: "late" }] }), 10_000);
        signal.addEventListener("abort", () => {
          clearTimeout(t);
          resolve({ content: [{ type: "text", text: "aborted" }] });
        });
      }),
  });
});

after(async () => {
  await stub?.close();
});

async function startSession(env: Record<string, string | undefined>) {
  const pi = fakePi();
  const ctx = fakeContext();
  setupXentropy(pi as any, { env });
  await pi.emit("session_start", { type: "session_start", reason: "startup" }, ctx);
  return { pi, ctx };
}

async function shutdown(pi: ReturnType<typeof fakePi>, ctx: ReturnType<typeof fakeContext>) {
  await pi.emit("session_shutdown", { type: "session_shutdown", reason: "quit" }, ctx);
}

describe("@xentropy/pi extension", () => {
  test("[H-C1] Given no XENTROPY_API_KEY, When a session starts, Then no tools are registered and a one-line hint is shown", async () => {
    const before = stub.authHeaders.length;
    const { pi, ctx } = await startSession({});
    assert.equal(pi.tools.size, 0);
    assert.equal(ctx.notices.length, 1);
    const hint = ctx.notices[0]!.message;
    assert.ok(!hint.includes("\n"), "hint is one line");
    assert.match(hint, /XENTROPY_API_KEY/);
    assert.match(hint, /\/xentropy-login/);
    assert.equal(stub.authHeaders.length, before, "no network request without a key");
    assert.ok(pi.commands.has("xentropy-status"));
    assert.ok(pi.commands.has("xentropy-login"));
    await shutdown(pi, ctx);
  });

  test("[H-C2] Given a key and a server, When a session starts, Then each MCP tool is registered as xentropy_<tool> with its schema, description and annotations", async () => {
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    assert.deepEqual(pi.visibleTools(), [
      "xentropy_artifacts_export",
      "xentropy_artifacts_list",
      "xentropy_artifacts_trash",
      "xentropy_artifacts_update",
      "xentropy_legacy_no_hints",
      "xentropy_slow_tool",
    ]);
    const list = pi.tools.get("xentropy_artifacts_list");
    assert.equal(list.label, "List artifacts");
    assert.equal(list.description, "List artifacts in the workspace.");
    assert.deepEqual(list.parameters, TOOLS[0]!.inputSchema);
    assert.deepEqual(list.annotations, TOOLS[0]!.annotations);
    assert.equal(typeof list.execute, "function");
    // A schema without properties still becomes an object schema pi accepts.
    assert.deepEqual(pi.tools.get("xentropy_legacy_no_hints").parameters, { type: "object", properties: {} });
    assert.ok(ctx.notices.some((n) => /connected/i.test(n.message) && /6 tools/.test(n.message)));
    await shutdown(pi, ctx);
  });

  test("[H-C3] Given a registered tool, When pi executes it, Then tools/call is forwarded and text, image and other content are mapped", async () => {
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    const res = await pi.tools.get("xentropy_artifacts_list").execute("call-1", { limit: 5 }, undefined, undefined, ctx);
    assert.deepEqual(stub.calls.at(-1), { name: "artifacts_list", args: { limit: 5 } });
    assert.deepEqual(res.content, [{ type: "text", text: 'listed {"limit":5}' }]);
    assert.deepEqual(res.structuredContent, { items: [], limit: 5 });
    assert.ok(!res.isError);

    const exp = await pi.tools.get("xentropy_artifacts_export").execute("call-2", { id: "art_1" }, undefined, undefined, ctx);
    assert.deepEqual(exp.content[0], { type: "text", text: "exported" });
    assert.deepEqual(exp.content[1], { type: "image", data: PNG_1PX, mimeType: "image/png" });
    assert.equal(exp.content[2].type, "text");
    assert.match(exp.content[2].text, /audio/i);
    assert.equal(exp.content[3].type, "text");
    assert.match(exp.content[3].text, /https:\/\/xentropy\.ai\/a\/art_1/);
    await shutdown(pi, ctx);
  });

  test("[H-C4] Given the server returns isError, When the tool runs, Then pi gets an error result with the server's message", async () => {
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    const res = await pi.tools.get("xentropy_artifacts_trash").execute("call-3", { id: "art_missing" }, undefined, undefined, ctx);
    assert.equal(res.isError, true);
    assert.match(res.content[0].text, /NOT_FOUND: artifact art_missing does not exist/);
    await shutdown(pi, ctx);
  });

  test("[H-C5] Given a running call, When pi aborts the signal, Then the call stops promptly with a cancellation error", async () => {
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    const controller = new AbortController();
    const started = Date.now();
    const pending = pi.tools.get("xentropy_slow_tool").execute("call-4", {}, controller.signal, undefined, ctx);
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(pending, /cancel|abort/i);
    assert.ok(Date.now() - started < 3000, "abort is prompt");
    await shutdown(pi, ctx);
  });

  test("[H-C6] Given tool annotations, When tools are registered, Then destructive tools (and tools without hints) carry a 'Changes or deletes data' note", async () => {
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    const note = /^Changes or deletes data\./;
    assert.match(pi.tools.get("xentropy_artifacts_trash").description, note);
    assert.match(pi.tools.get("xentropy_artifacts_trash").description, /Move an artifact to the trash\./);
    assert.match(pi.tools.get("xentropy_legacy_no_hints").description, note);
    assert.doesNotMatch(pi.tools.get("xentropy_artifacts_list").description, note);
    assert.doesNotMatch(pi.tools.get("xentropy_artifacts_update").description, note);
    await shutdown(pi, ctx);
  });

  test("[H-C7] Given XENTROPY_MCP_URL, When it is plain http on a non-loopback host, Then it is refused; https and loopback http are accepted", async () => {
    const before = stub.authHeaders.length;
    for (const url of ["http://api.xentropy.ai/mcp", "http://10.0.0.5:3718/mcp", "ftp://api.xentropy.ai/mcp", "not a url"]) {
      const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: url });
      assert.equal(pi.tools.size, 0, url);
      assert.ok(ctx.notices.some((n) => n.type === "error" && /https/i.test(n.message)), url);
      await shutdown(pi, ctx);
    }
    assert.equal(stub.authHeaders.length, before, "refused URLs are never contacted");
    // loopback http is allowed (the stub itself is http://127.0.0.1)
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    assert.ok(pi.tools.size > 0);
    await shutdown(pi, ctx);
    assert.equal(DEFAULT_MCP_URL, "https://api.xentropy.ai/mcp");
  });

  test("[H-C8] Given a key, When the extension talks to the server, Then it sends Authorization: Bearer <key> and never shows the key", async () => {
    const logged: string[] = [];
    const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
    for (const k of Object.keys(orig) as (keyof typeof orig)[]) {
      console[k] = (...a: unknown[]) => logged.push(a.map(String).join(" "));
    }
    try {
      const startIdx = stub.authHeaders.length;
      const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
      assert.ok(stub.authHeaders.length > startIdx);
      for (const h of stub.authHeaders.slice(startIdx)) assert.equal(h, `Bearer ${TEST_KEY}`);
      await pi.commands.get("xentropy-status")!.handler("", ctx);
      await pi.commands.get("xentropy-login")!.handler("", ctx);
      // a failing connection must not echo the key either
      const bad = await startSession({ XENTROPY_API_KEY: "xak_EXAMPLE_wrong_key_000000", XENTROPY_MCP_URL: stub.url });
      const all = [...ctx.notices, ...bad.ctx.notices].map((n) => n.message).concat(logged);
      for (const line of all) {
        assert.ok(!line.includes(TEST_KEY), `key leaked: ${line}`);
        assert.ok(!line.includes("xak_EXAMPLE_wrong_key_000000"), `key leaked: ${line}`);
      }
      for (const t of pi.tools.values()) assert.ok(!JSON.stringify(t).includes(TEST_KEY));
      await shutdown(pi, ctx);
      await shutdown(bad.pi, bad.ctx);
    } finally {
      Object.assign(console, orig);
    }
  });

  test("[H-C9] Given the server is unreachable or rejects the key, When a session starts, Then it does not throw, registers no tools and shows a clear message", async () => {
    const down = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: "http://127.0.0.1:9/mcp" });
    assert.equal(down.pi.tools.size, 0);
    assert.ok(down.ctx.notices.some((n) => n.type === "error" && /could not connect/i.test(n.message)));
    await shutdown(down.pi, down.ctx);

    const denied = await startSession({ XENTROPY_API_KEY: "xak_EXAMPLE_wrong_key_000000", XENTROPY_MCP_URL: stub.url });
    assert.equal(denied.pi.tools.size, 0);
    const msg = denied.ctx.notices.find((n) => n.type === "error")?.message ?? "";
    assert.match(msg, /could not connect/i);
    assert.match(msg, /401|unauthori[sz]ed|rejected/i);
    assert.match(msg, /\/xentropy-login/);
    await shutdown(denied.pi, denied.ctx);
  });

  test("[H-C10] Given the server's tool list changes, When a new session starts, Then tools are listed again: new tools appear and withdrawn tools are hidden (Q17)", async () => {
    const pi = fakePi();
    const ctx = fakeContext();
    setupXentropy(pi as any, { env: { XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url } });
    await pi.emit("session_start", { reason: "startup" }, ctx);
    assert.ok(pi.visibleTools().includes("xentropy_slow_tool"));
    const saved = stub.tools;
    stub.tools = [
      ...saved.filter((t) => t.name !== "slow_tool"),
      { name: "dashboards_list", description: "List dashboards.", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } },
    ];
    try {
      await pi.emit("session_shutdown", { reason: "new" }, ctx);
      await pi.emit("session_start", { reason: "new" }, ctx);
      assert.ok(pi.visibleTools().includes("xentropy_dashboards_list"));
      assert.ok(!pi.visibleTools().includes("xentropy_slow_tool"));
      assert.equal(pi.tools.get("xentropy_slow_tool").exposure, "hidden");
    } finally {
      stub.tools = saved;
      await shutdown(pi, ctx);
    }
  });

  test("[H-C11] Given tool names with other characters or too long for providers, When registered, Then names use only [A-Za-z0-9_], stay within 64 characters and stay unique", async () => {
    const saved = stub.tools;
    const long = "a".repeat(80);
    stub.tools = [
      { name: "data.preview", inputSchema: { type: "object" } },
      { name: "data-preview", inputSchema: { type: "object" } },
      { name: long, inputSchema: { type: "object" } },
      { name: long + "b", inputSchema: { type: "object" } },
    ];
    try {
      const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
      const names = pi.visibleTools();
      assert.equal(names.length, 4);
      assert.equal(new Set(names).size, 4);
      for (const n of names) {
        assert.match(n, /^xentropy_[A-Za-z0-9_]+$/);
        assert.ok(n.length <= 64, n);
      }
      // forwarding uses the original MCP name
      const dotted = [...pi.tools.values()].find((t) => t.name.startsWith("xentropy_data_preview"))!;
      await dotted.execute("c", {}, undefined, undefined, ctx).catch(() => undefined);
      assert.ok(["data.preview", "data-preview"].includes(stub.calls.at(-1)!.name));
      await shutdown(pi, ctx);
    } finally {
      stub.tools = saved;
    }
  });

  test("[H-C12] Given the commands, When /xentropy-status and /xentropy-login run, Then status shows server, tool count and auth mode, and login shows setup steps and the API keys URL", async () => {
    const { pi, ctx } = await startSession({ XENTROPY_API_KEY: TEST_KEY, XENTROPY_MCP_URL: stub.url });
    ctx.notices.length = 0;
    await pi.commands.get("xentropy-status")!.handler("", ctx);
    const status = ctx.notices.map((n) => n.message).join("\n");
    assert.match(status, new RegExp(stub.url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(status, /6 tools/);
    assert.match(status, /API key/i);
    assert.match(status, /xentropy-stub/);
    await shutdown(pi, ctx);

    const none = await startSession({});
    none.ctx.notices.length = 0;
    await none.pi.commands.get("xentropy-status")!.handler("", none.ctx);
    assert.match(none.ctx.notices.map((n) => n.message).join("\n"), /not configured|no API key/i);

    none.ctx.notices.length = 0;
    await none.pi.commands.get("xentropy-login")!.handler("", none.ctx);
    const login = none.ctx.notices.map((n) => n.message).join("\n");
    assert.equal(API_KEYS_URL, "https://xentropy.ai/settings/api-keys");
    assert.ok(login.includes(API_KEYS_URL));
    assert.match(login, /Agent preset/);
    assert.match(login, /export XENTROPY_API_KEY=/);
    assert.match(login, /\/reload/);
  });

  test("[H-C13] Given the package entry point, When pi loads it, Then the default export is a factory that registers the commands", () => {
    const pi = fakePi();
    defaultExport(pi as any);
    assert.ok(pi.commands.has("xentropy-status"));
    assert.ok(pi.handlers.has("session_start"));
    assert.ok(pi.handlers.has("session_shutdown"));
  });
});
