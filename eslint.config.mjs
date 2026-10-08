import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import prettier from "eslint-config-prettier";

// ESLint catches bugs and enforces conventions; Prettier owns formatting.
// eslint-config-prettier (last) turns off ESLint rules that would fight Prettier.
export default tseslint.config(
  { ignores: ["dist", "coverage", "node_modules"] },
  js.configs.recommended,
  // Type-aware rules: they use the TypeScript compiler to find bugs like un-awaited promises.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: globals.node,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // Top-level functions are declarations; arrows are for callbacks.
      "func-style": ["error", "declaration"],
      // Allow unused args prefixed with _ (e.g. `_req` in Express handlers).
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Express 5 handles promises returned from route handlers, so passing async
      // functions to app.get()/router.post() is safe.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { arguments: false } },
      ],
      "no-console": "warn", // replaced by a real logger in Phase 5
      eqeqeq: "error",
    },
  },
  {
    files: ["eslint.config.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  prettier,
);
