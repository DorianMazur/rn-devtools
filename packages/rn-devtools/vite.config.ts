import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import devtoolsPlugins from "./src/vitePlugins/devtoolsConfigVitePlugin";

export default defineConfig({
  plugins: [devtoolsPlugins(), tailwindcss(), tsconfigPaths()],
});
