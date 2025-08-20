export default {
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  external: [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "@tanstack/react-query",
  ],
};
