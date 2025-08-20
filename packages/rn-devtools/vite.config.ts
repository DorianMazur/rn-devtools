import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import devtoolsPlugins from "./src/vitePlugins/devtoolsConfigVitePlugin";

export default defineConfig({
  resolve: {
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  plugins: [devtoolsPlugins(), tailwindcss(), tsconfigPaths()],
});
