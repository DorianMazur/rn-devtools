export default {
  entry: ["src/native.ts", "src/web.tsx"],
  format: ["esm"],
  dts: true,
  clean: true,
  outDir: "dist",
  external: [
    "react",
    "react/jsx-runtime",
    "react/jsx-dev-runtime",
    "@react-navigation/native",
  ],
};
