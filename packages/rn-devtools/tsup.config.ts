export default {
  entry: ["cli/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node18",
  outDir: "bin",
  external: ["vite", "open", "lightningcss", "rollup", "esbuild", "postcss"],
};
