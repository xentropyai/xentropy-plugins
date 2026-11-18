// A recorder that stands in for pi's ExtensionAPI and ExtensionContext.
type Handler = (event: unknown, ctx: FakeContext) => unknown;

export interface Notice {
  message: string;
  type?: string;
}

export interface FakeContext {
  hasUI: boolean;
  mode: string;
  cwd: string;
  notices: Notice[];
  ui: { notify(message: string, type?: "info" | "warning" | "error"): void };
}

export function fakeContext(): FakeContext {
  const notices: Notice[] = [];
  return {
    hasUI: true,
    mode: "tui",
    cwd: process.cwd(),
    notices,
    ui: {
      notify(message, type) {
        notices.push({ message, type });
      },
    },
  };
}

export interface FakePi {
  tools: Map<string, any>;
  /** Every registerTool call in order, including re-registrations. */
  registrations: any[];
  commands: Map<string, { description?: string; handler: (args: string, ctx: any) => Promise<void> }>;
  handlers: Map<string, Handler[]>;
  on(event: string, handler: Handler): () => void;
  registerTool(tool: any): void;
  registerCommand(name: string, options: any): void;
  emit(event: string, payload: unknown, ctx: FakeContext): Promise<void>;
  /** Tools a model could call: registered and not hidden. */
  visibleTools(): string[];
}

export function fakePi(): FakePi {
  const pi: FakePi = {
    tools: new Map(),
    registrations: [],
    commands: new Map(),
    handlers: new Map(),
    on(event, handler) {
      const list = pi.handlers.get(event) ?? [];
      list.push(handler);
      pi.handlers.set(event, list);
      return () => {
        const i = list.indexOf(handler);
        if (i >= 0) list.splice(i, 1);
      };
    },
    registerTool(tool) {
      // Mirrors pi's loader check (dist/core/extensions/loader.js registerTool).
      if (typeof tool.parameters !== "object" || tool.parameters === null || Array.isArray(tool.parameters)) {
        throw new Error(`Tool "${tool.name}" must define an object parameter schema.`);
      }
      pi.registrations.push(tool);
      pi.tools.set(tool.name, tool);
    },
    registerCommand(name, options) {
      if (typeof options?.handler !== "function") throw new Error("handler required");
      pi.commands.set(name, options);
    },
    async emit(event, payload, ctx) {
      for (const handler of pi.handlers.get(event) ?? []) await handler(payload, ctx);
    },
    visibleTools() {
      return [...pi.tools.values()].filter((t) => t.exposure !== "hidden").map((t) => t.name).sort();
    },
  };
  return pi;
}
