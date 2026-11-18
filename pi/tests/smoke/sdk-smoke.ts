// [H-C16] Smoke: load this package into a real pi session (pi SDK, no model call)
// against the stub MCP server. Run: node --import tsx tests/smoke/sdk-smoke.ts <scratch-agent-dir>
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, DefaultResourceLoader, SessionManager, VERSION } from "@earendil-works/pi-coding-agent";
import { startStubServer, TEST_KEY } from "../helpers/stub-server.ts";

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const agentDir = resolve(process.argv[2] ?? join(pkgRoot, ".smoke-agent"));
mkdirSync(agentDir, { recursive: true });

const stub = await startStubServer(
  [
    {
      name: "artifacts_list",
      description: "List artifacts.",
      inputSchema: { type: "object", properties: { limit: { type: "integer" } } },
      annotations: { readOnlyHint: true, destructiveHint: false },
    },
    {
      name: "artifacts_trash",
      description: "Trash an artifact.",
      inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
  ],
  { artifacts_list: (args) => ({ content: [{ type: "text", text: `ok ${JSON.stringify(args)}` }] }) },
);

process.env.XENTROPY_API_KEY = TEST_KEY;
process.env.XENTROPY_MCP_URL = stub.url;

const notices: string[] = [];
// pi spreads the UI context ({...ui}), so it must be a plain object with own properties.
const noop = () => undefined;
const uiContext: any = {
  notify: (m: string, type?: string) => notices.push(`${type ?? "info"}: ${m}`),
  select: noop, confirm: noop, input: noop, editor: noop, custom: noop,
  setStatus: noop, setWidget: noop, setTitle: noop, setFooter: noop, setHeader: noop, setEditorText: noop,
};

const resourceLoader = new DefaultResourceLoader({
  cwd: pkgRoot,
  agentDir,
  additionalExtensionPaths: [pkgRoot],
  additionalSkillPaths: [],
  noExtensions: false,
});
await resourceLoader.reload();
const { session } = await createAgentSession({ cwd: pkgRoot, agentDir, resourceLoader, sessionManager: SessionManager.inMemory() });
try {
  console.log(`pi-coding-agent VERSION=${VERSION}`);
  const ext = resourceLoader.getExtensions();
  console.log("extension load errors:", JSON.stringify(ext.errors ?? []));
  console.log("skills:", resourceLoader.getSkills().skills.map((s: any) => s.name).join(","));
  assert.ok(resourceLoader.getSkills().skills.some((s: any) => s.name === "xentropy-artifact-studio"), "skill loaded");

  await session.bindExtensions({ uiContext, mode: "rpc" });
  const xTools = session.getAllTools().filter((t) => t.name.startsWith("xentropy_"));
  console.log("xentropy tools:", xTools.map((t) => t.name).join(","));
  console.log("active:", session.getActiveToolNames().filter((n) => n.startsWith("xentropy_")).join(","));
  assert.deepEqual(xTools.map((t) => t.name).sort(), ["xentropy_artifacts_list", "xentropy_artifacts_trash"]);
  const trash = xTools.find((t) => t.name === "xentropy_artifacts_trash")!;
  assert.match(trash.description, /^Changes or deletes data\./);

  const def = session.getToolDefinition("xentropy_artifacts_list")!;
  const res = await def.execute("smoke-1", { limit: 2 } as any, undefined, undefined, {} as any);
  console.log("call result:", JSON.stringify(res.content));
  assert.deepEqual(res.content, [{ type: "text", text: 'ok {"limit":2}' }]);

  await session.prompt("/xentropy-status");
  console.log("notices:\n" + notices.join("\n"));
  assert.ok(notices.some((n) => /connected/.test(n)));
  assert.ok(!notices.join("\n").includes(TEST_KEY), "key not shown");
  assert.ok(stub.authHeaders.every((h) => h === `Bearer ${TEST_KEY}`));
  console.log("SMOKE OK");
} finally {
  session.dispose();
  await stub.close();
}
