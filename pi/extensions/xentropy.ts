// pi extension entry point for @xentropy/pi. pi loads this file with jiti (no build step).
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { setupXentropy } from "../src/extension.ts";

export default function xentropy(pi: ExtensionAPI): void {
  setupXentropy(pi, { env: process.env });
}
