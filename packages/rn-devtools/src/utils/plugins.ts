import {
  DevtoolsPlugin,
  plugins as discovered,
} from "virtual:rn-devtools-plugins";

function isValid(p: any): p is DevtoolsPlugin {
  return (
    p &&
    typeof p.id === "string" &&
    typeof p.title === "string" &&
    typeof p.mount === "function"
  );
}

function normalize(p: any): DevtoolsPlugin | null {
  const candidate = p?.default?.plugin ?? p?.plugin ?? p?.default ?? p;
  if (typeof candidate === "function") {
    // If someone exported a React component directly by accident, ignore it.
    return null;
  }
  if (!isValid(candidate)) {
    console.warn("[rn-devtools] Ignoring invalid plugin export:", p);
    return null;
  }
  return candidate;
}

const list = Array.isArray(discovered) ? discovered : [];
export const PLUGINS: DevtoolsPlugin[] = list
  .map(normalize)
  .filter(Boolean) as DevtoolsPlugin[];

export const findPlugin = (id?: string | null) =>
  PLUGINS.find((p) => p.id === id) ?? null;
