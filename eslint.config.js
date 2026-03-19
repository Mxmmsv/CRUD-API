import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import nodePlugin from "eslint-plugin-n";
import perfectionist from "eslint-plugin-perfectionist";
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

const importSortRules = {
  "perfectionist/sort-imports": [
    "error",
    {
      groups: [
        "side-effect",
        { newlinesBetween: 1 },
        ["value-builtin", "value-external"],
        { newlinesBetween: 0 },
        ["type-builtin", "type-external"],
        { newlinesBetween: 1 },
        "value-internal",
        { newlinesBetween: 0 },
        "type-internal",
        { newlinesBetween: 1 },
        ["value-parent", "value-sibling", "value-index"],
        { newlinesBetween: 0 },
        ["type-parent", "type-sibling", "type-index"],
        "ts-equals-import",
        "unknown",
      ],
      internalPattern: ["^@/.+"],
      newlinesBetween: 0,
      order: "asc",
      type: "natural",
    },
  ],
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
      perfectionist,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nodeRules,
      ...importSortRules,
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
      perfectionist,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...nodeRules,
      ...importSortRules,
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          fixStyle: "separate-type-imports",
          prefer: "type-imports",
        },
      ],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
  prettierConfig,
];
