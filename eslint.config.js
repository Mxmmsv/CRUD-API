import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import nodePlugin from "eslint-plugin-n";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import tseslint from "typescript-eslint";

const tsFiles = ["src/**/*.ts", "test/**/*.ts"];
const configFiles = ["eslint.config.js"];

const nodeRules = {
  ...nodePlugin.configs["flat/recommended-module"].rules,
  "n/no-extraneous-import": "off",
  "n/no-missing-import": "off",
  "n/no-process-exit": "off",
  "n/no-unpublished-import": "off",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "docs/**", "AGENTS.md", "*.md"],
  },
  {
    files: configFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
    plugins: {
      n: nodePlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nodeRules,
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: tsFiles,
  })),
  {
    files: tsFiles,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
      parserOptions: {
        projectService: {
          allowDefaultProject: ["test/*.ts"],
          defaultProject: "tsconfig.eslint.json",
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      n: nodePlugin,
      "simple-import-sort": simpleImportSort,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nodeRules,
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },
  prettierConfig,
];
