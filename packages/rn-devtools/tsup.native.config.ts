export default {
  entry: ["native/index.ts"],
  format: ["esm"],
  dts: true,
  outDir: "dist/native",
  external: ["socket.io-client"],
};
