#!/usr/bin/env node
// Builds dist/xentropy-openai.zip, the OpenAI (Codex/ChatGPT) directory upload, from plugins/xentropy.
// The OpenAI directory refuses hooks and .app.json; dotfiles (.claude-plugin/, .mcp.json) are the
// Claude Code manifests, which OpenAI does not read. Deterministic: sorted entries, fixed timestamps.
// Usage: node scripts/build-openai-zip.mjs [pluginDir] [outFile]
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

/** Whether a plugin-relative path goes into the OpenAI upload. */
export function includeInOpenAiZip(path) {
  const parts = path.split("/");
  if (parts.some((p) => p.startsWith("."))) return false; // .claude-plugin/, .mcp.json, .app.json, .DS_Store
  if (parts[0] === "hooks" || parts[0] === "bin") return false;
  return true;
}

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(join(dir, e.name), base) : [relative(base, join(dir, e.name)).split(sep).join("/")],
  );
}

export function openAiZipEntries(pluginDir) {
  return walk(pluginDir).filter(includeInOpenAiZip).sort();
}

// DOS time 1980-01-01 00:00: the earliest ZIP timestamp, so rebuilds are byte-identical.
const DOS_TIME = 0;
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/** A minimal ZIP writer (deflate, no extra fields), enough for a directory upload. */
export function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data) >>> 0;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuf, compressed);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4); // made by: unix, 2.0
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuf);
    offset += 30 + nameBuf.length + compressed.length;
  }
  const centralBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBuf, end]);
}

/** Entry names of a ZIP buffer, read from its central directory. */
export function zipEntryNames(buf) {
  const endAt = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(endAt + 10);
  let at = buf.readUInt32LE(endAt + 16);
  const names = [];
  for (let i = 0; i < count; i++) {
    const nameLen = buf.readUInt16LE(at + 28);
    const extra = buf.readUInt16LE(at + 30);
    const comment = buf.readUInt16LE(at + 32);
    names.push(buf.subarray(at + 46, at + 46 + nameLen).toString("utf8"));
    at += 46 + nameLen + extra + comment;
  }
  return names;
}

export function buildOpenAiZip(pluginDir, outFile) {
  const entries = openAiZipEntries(pluginDir);
  const buf = zip(entries.map((name) => ({ name, data: readFileSync(join(pluginDir, name)) })));
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, buf);
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), "..");
  const pluginDir = resolve(process.argv[2] ?? join(repo, "plugins/xentropy"));
  const outFile = resolve(process.argv[3] ?? join(repo, "dist/xentropy-openai.zip"));
  const entries = buildOpenAiZip(pluginDir, outFile);
  console.log(`${relative(process.cwd(), outFile)}: ${entries.length} files`);
  for (const e of entries) console.log(`  ${e}`);
}
