/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: true,
    tsconfigRootDir: __dirname,
  },
  plugins: ["@typescript-eslint", "import", "boundaries"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict-type-checked",
    "plugin:@typescript-eslint/stylistic-type-checked",
    "plugin:import/typescript",
  ],
  settings: {
    "import/resolver": {
      typescript: { project: "./tsconfig.base.json" },
    },
    "boundaries/elements": [
      { type: "shared-types", pattern: "packages/shared-types/src/*" },
      { type: "policy-engine", pattern: "packages/policy-engine/src/*" },
      { type: "audit-sdk", pattern: "packages/audit-sdk/src/*" },
      { type: "i18n", pattern: "packages/i18n/src/*" },
      { type: "design-system", pattern: "packages/design-system/src/*" },
      { type: "ui-components", pattern: "packages/ui-components/src/*" },
      // API module boundaries — cross-module calls must go through public index.ts only
      { type: "module-auth", pattern: "apps/api/src/modules/auth/*" },
      { type: "module-learning", pattern: "apps/api/src/modules/learning/*" },
      { type: "module-comms", pattern: "apps/api/src/modules/comms/*" },
      { type: "module-crm", pattern: "apps/api/src/modules/crm/*" },
      { type: "module-finance", pattern: "apps/api/src/modules/finance/*" },
      { type: "module-ai", pattern: "apps/api/src/modules/ai/*" },
      { type: "module-analytics", pattern: "apps/api/src/modules/analytics/*" },
      { type: "module-gdpr", pattern: "apps/api/src/modules/gdpr/*" },
      { type: "module-migration", pattern: "apps/api/src/modules/migration/*" },
    ],
    "boundaries/rules": [
      // Modules may not import directly from another module's internals
      // — only from the module's public index.ts
      {
        from: ["module-*"],
        disallow: [["module-*", { "not-matching": "$from" }]],
        message:
          "Cross-module imports must go through the module public index. Import from @praxisa/api/modules/<name> not internal paths.",
      },
      // ui-components may use design-system and shared-types only
      {
        from: ["ui-components"],
        allow: ["design-system", "shared-types"],
      },
    ],
  },
  rules: {
    // TypeScript
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/consistent-type-imports": [
      "error",
      { prefer: "type-imports" },
    ],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    // Import discipline
    "import/no-cycle": "error",
    "import/no-default-export": "warn",
    // Boundaries
    "boundaries/element-types": "error",
    // Safety
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  overrides: [
    // Test files — relaxed rules
    {
      files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**/*.ts"],
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "import/no-default-export": "off",
      },
    },
  ],
  ignorePatterns: [
    "dist/",
    "build/",
    "node_modules/",
    "*.js",
    "!.eslintrc.js",
    "**/drizzle.config.ts",
    "**/vitest.config.ts",
    "**/postcss.config.ts",
    "**/tailwind.config.ts",
    "**/vite.config.ts",
  ],
};
