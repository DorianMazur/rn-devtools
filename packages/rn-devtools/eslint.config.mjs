import { baseConfigs } from "../../eslint.config.mjs";
import react from "eslint-plugin-react";
import tseslint from "typescript-eslint";
import typescriptParser from "@typescript-eslint/parser";

const configs = [
  ...baseConfigs,
  ...[
    ...tseslint.configs.recommended,
    {
      languageOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        globals: {
          browser: true,
          node: true,
          es6: true,
        },
        parser: typescriptParser,
        parserOptions: {
          tsconfigRootDir: import.meta.dirname,
          project: true,
        },
      },
      rules: {
        "@typescript-eslint/no-wrapper-object-types": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/await-thenable": "error",
      },
    },
  ].map((configObj) => ({
    ...configObj,
    files: ["**/*.{ts,mts,cts,tsx}"],
  })),
  ...[react.configs.flat.recommended, react.configs.flat["jsx-runtime"]].map(
    (configObj) => ({
      ...configObj,
      files: ["**/*.{t,j}sx"],
      settings: {
        react: {
          version: "detect",
        },
      },
    }),
  ),
];

export default configs;
