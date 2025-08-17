import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { Plugin } from "vite";

const VIRTUAL_ID = "virtual:rn-devtools-plugins";
const RESOLVED_ID = "\0" + VIRTUAL_ID;

type Config = { plugins?: (string | [string, Record<string, any>])[] };
type Options = {
  /** Absolute or relative (to Vite root) path to the RN project root. */
  projectRoot?: string;
  /** Explicit config file path (abs or relative to projectRoot or Vite root). */
  configFile?: string;
  /** How far to search upwards for a config file. */
  searchDepth?: number;
};

function resolveMaybeRelative(base: string, p: string) {
  return path.isAbsolute(p) ? p : path.join(base, p);
}
function readJsonSafe(p: string): any | null {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return null;
  }
}

function findConfigFileUpwards(
  startDir: string,
  searchDepth = 6,
  explicit?: string
): string | null {
  if (explicit) {
    if (fs.existsSync(explicit)) return explicit;
    const rel = path.join(startDir, explicit);
    if (fs.existsSync(rel)) return rel;
  }
  const candidates = [
    "rn-devtools.config.ts",
    "rn-devtools.config.js",
    "rn-devtools.config.mjs",
    "rn-devtools.config.cjs",
    "rn-devtools.config.json",
  ];

  let dir = startDir;
  for (let i = 0; i < Math.max(1, searchDepth); i++) {
    for (const rel of candidates) {
      const p = path.join(dir, rel);
      if (fs.existsSync(p)) return p;
    }

    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = readJsonSafe(pkgPath) || {};
      const hint =
        pkg?.["rn-devtools"]?.config ??
        pkg?.["rn-devtools"] ??
        pkg?.rnDevtools?.config ??
        pkg?.rnDevtools;
      if (typeof hint === "string") {
        const hinted = resolveMaybeRelative(dir, hint);
        if (fs.existsSync(hinted)) return hinted;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

async function loadConfigFromFile(file: string | null): Promise<Config | null> {
  if (!file) return null;

  const url = pathToFileURL(file).href + `?v=${Date.now()}`;
  const mod = await import(url);
  const cfg = (mod?.default ?? mod) as Config;
  return cfg && typeof cfg === "object" ? cfg : null;
}

// Node 20+: resolve a specifier relative to the RN project root
async function resolveWithImportMeta(
  projectRoot: string,
  spec: string
): Promise<string | null> {
  try {
    const parent = pathToFileURL(
      path.join(projectRoot, "__rn_devtools_resolve__.mjs")
    ).href;
    // @ts-ignore Node 20+
    const r = import.meta.resolve(spec, parent);
    const url = typeof r === "string" ? r : await r;
    return url.startsWith("file:") ? fileURLToPath(url) : url;
  } catch {
    return null;
  }
}

function resolveViaPackageJson(
  projectRoot: string,
  spec: string
): string | null {
  try {
    const tryPaths = [
      path.join(projectRoot, "node_modules", spec, "package.json"),
      path.join(projectRoot, "..", "node_modules", spec, "package.json"),
      path.join(projectRoot, "..", "..", "node_modules", spec, "package.json"),
    ].filter((p, i, a) => a.indexOf(p) === i);

    const pkgJsonPath = tryPaths.find((p) => fs.existsSync(p));
    if (!pkgJsonPath) return null;

    const pkgDir = path.dirname(pkgJsonPath);
    const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));

    const pick = (v: any) =>
      typeof v === "string"
        ? v
        : v?.import || v?.browser || v?.default || v?.module || v?.main;

    if (pkg.exports) {
      if (typeof pkg.exports === "string")
        return path.join(pkgDir, pkg.exports);
      const dot = pkg.exports["."] ?? pkg.exports;
      const chosen = pick(dot);
      if (chosen) return path.join(pkgDir, chosen);
      for (const key of ["./web", "./index", "."]) {
        const v = pkg.exports[key];
        const c = pick(v);
        if (c) return path.join(pkgDir, c);
      }
    }

    const legacy = pkg.module || pkg.browser || pkg.main || "index.js";
    return path.join(pkgDir, legacy);
  } catch {
    return null;
  }
}

export default function devtoolsPlugins(opts: Options = {}): Plugin {
  let viteRoot = process.cwd();
  let projectRoot = "";
  let configPath: string | null = null;

  // directories to pass to Tailwind via @source injection
  let sourceDirs = new Set<string>();

  async function computeSources() {
    sourceDirs = new Set();
    if (!configPath) {
      configPath = findConfigFileUpwards(
        projectRoot,
        opts.searchDepth ?? 6,
        opts.configFile || process.env.RN_DEVTOOLS_CONFIG
      );
    }
    const cfg = await loadConfigFromFile(configPath);
    const entries = (cfg?.plugins ?? []) as (
      | string
      | [string, Record<string, any>]
    )[];

    for (const raw of entries) {
      const [pkg] = Array.isArray(raw) ? raw : [raw, {}];
      let resolved = await resolveWithImportMeta(projectRoot, pkg);
      if (!resolved) resolved = resolveViaPackageJson(projectRoot, pkg);
      if (resolved) {
        try {
          const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
          const scanDir = stat?.isDirectory()
            ? resolved
            : path.dirname(resolved);
          sourceDirs.add(scanDir);
        } catch {}
      }
    }
  }

  return {
    name: "rn-devtools:plugins",
    enforce: "pre",

    // Allow scanning/importing outside Vite root in monorepos
    config(user) {
      const root = user.root || process.cwd();
      const pr =
        (opts.projectRoot && resolveMaybeRelative(root, opts.projectRoot)) ||
        process.env.RN_DEVTOOLS_PROJECT_ROOT ||
        process.env.INIT_CWD ||
        root;

      return {
        server: {
          fs: {
            allow: Array.from(
              new Set([
                pr,
                root,
                path.dirname(pr),
                path.dirname(path.dirname(pr)),
              ])
            ),
          },
        },
      };
    },

    async configResolved(r) {
      viteRoot = r.root;
      projectRoot =
        (opts.projectRoot &&
          resolveMaybeRelative(viteRoot, opts.projectRoot)) ||
        process.env.RN_DEVTOOLS_PROJECT_ROOT ||
        process.env.INIT_CWD ||
        viteRoot;

      const explicitCfg =
        (opts.configFile &&
          resolveMaybeRelative(projectRoot, opts.configFile)) ||
        process.env.RN_DEVTOOLS_CONFIG;

      configPath = findConfigFileUpwards(
        projectRoot,
        opts.searchDepth ?? 6,
        explicitCfg
      );

      console.log("[rn-devtools] Vite root:", viteRoot);
      console.log("[rn-devtools] Project root:", projectRoot);
      console.log("[rn-devtools] Config file:", configPath);

      await computeSources();
    },

    configureServer(server) {
      if (configPath) server.watcher.add(configPath);
    },

    // JS virtual module: exports instantiated plugins array
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },

    async load(id) {
      if (id !== RESOLVED_ID) return;

      if (!configPath) {
        configPath = findConfigFileUpwards(
          projectRoot,
          opts.searchDepth ?? 6,
          opts.configFile || process.env.RN_DEVTOOLS_CONFIG
        );
      }

      const cfg = await loadConfigFromFile(configPath);
      const entries = (cfg?.plugins ?? []) as (
        | string
        | [string, Record<string, any>]
      )[];
      console.log("[rn-devtools] Found plugins (from config):", entries);

      const imports: string[] = [];
      const inits: string[] = [];

      // refresh sources while resolving actual imports
      sourceDirs = new Set();

      for (let i = 0; i < entries.length; i++) {
        const raw = entries[i];
        const [pkg, pluginOpts] = Array.isArray(raw) ? raw : [raw, {}];

        let resolved = await resolveWithImportMeta(projectRoot, pkg);
        if (!resolved) resolved = resolveViaPackageJson(projectRoot, pkg);

        const spec = resolved ?? pkg;

        if (!resolved) {
          console.warn(
            `[rn-devtools] Could not resolve "${pkg}" from project root ${projectRoot}. ` +
              `Is it installed and built? Falling back to bare specifier.`
          );
        } else {
          try {
            const stat = fs.existsSync(resolved) ? fs.statSync(resolved) : null;
            const scanDir = stat?.isDirectory()
              ? resolved
              : path.dirname(resolved);
            sourceDirs.add(scanDir);
          } catch {}
        }

        const varName = `P${i}`;
        imports.push(`import * as ${varName} from ${JSON.stringify(spec)};`);
        inits.push(`
          (() => {
            const mod = ${varName};
            const cand = mod?.default?.plugin ?? mod?.plugin ?? mod?.default ?? mod;
            if (!cand) return null;
            try {
              return (typeof cand === "function") ? cand(${JSON.stringify(pluginOpts)}) : cand;
            } catch (e) {
              console.warn("[rn-devtools] Plugin factory for ${pkg} threw:", e);
              return null;
            }
          })()
        `);
      }

      return `
${imports.join("\n")}
export const plugins = [${inits.join(",")}].filter(Boolean);
`;
    },

    // Inject Tailwind @source lines into CSS that imports tailwind
    async transform(code, id) {
      if (!id.endsWith(".css")) return;
      if (!code.includes("tailwindcss")) return;

      if (sourceDirs.size === 0) await computeSources();
      if (sourceDirs.size === 0) return;

      const header =
        Array.from(sourceDirs)
          .map((dir) => `@source ${JSON.stringify(dir)};`)
          .join("\n") + "\n";

      const needle = '@import "tailwindcss"';
      const idx = code.indexOf(needle);
      if (idx >= 0) {
        const insertAt = code.indexOf(";", idx) + 1;
        const out =
          code.slice(0, insertAt) + "\n" + header + code.slice(insertAt);
        return { code: out, map: null };
      }
      return { code: header + code, map: null };
    },

    async handleHotUpdate(ctx) {
      if (configPath && ctx.file === configPath) {
        await computeSources();
        // Invalidate the JS virtual module
        const modJS = ctx.server.moduleGraph.getModuleById(RESOLVED_ID);
        if (modJS) ctx.server.moduleGraph.invalidateModule(modJS);
        // Nudge CSS so Tailwind regenerates
        const touched: any[] = [];
        for (const m of ctx.server.moduleGraph.getModulesByFile?.(ctx.file) ||
          []) {
          touched.push({ module: m });
        }
        return touched;
      }
    },
  };
}
