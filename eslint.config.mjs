import globals from "globals";
import js from "@eslint/js";
import prettierPlugin from "eslint-plugin-prettier/recommended";

const rootConfigs = [
  {
    ignores: [
      "packages/**/*",
      "example",
      ".github",
      ".vscode",
      ".yarn",
      "node_modules",
    ],
  },
  {
    files: ["*.{js,mjs,cjs}", ".*.{js,mjs,cjs}", "utils/*.{js,mjs,cjs}"],
    languageOptions: {
      sourceType: "commonjs",
      globals: {
        ...globals.node,
      },
    },
  },
  {
    files: ["*.mjs", ".*.mjs", "utils/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
];

/**
 * Base configs that should be inherited in all packages as well
 * @type {Array<import('eslint').Linter.FlatConfig>}
 */
export const baseConfigs = [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/public/**",
      "**/bin/**/*",
    ],
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      sourceType: "module",
    },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
  {
    files: ["**/*.{js,mjs,cjs}", "**/.*.{js,mjs,cjs}"],
    ...js.configs.recommended,
  },
  prettierPlugin,
];

const configs = [...baseConfigs, ...rootConfigs];

export { globals, prettierPlugin };
export default configs;
