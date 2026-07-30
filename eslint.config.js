const promise = require("eslint-plugin-promise");

module.exports = [
  {
    ignores: ["node_modules/**", "uploads/**", "public/**"],
  },
  {
    files: ["src/**/*.js", "test/**/*.js", "scripts/**/*.js", "eslint.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        clearInterval: "readonly",
        clearTimeout: "readonly",
        console: "readonly",
        exports: "writable",
        module: "writable",
        process: "readonly",
        queueMicrotask: "readonly",
        require: "readonly",
        setInterval: "readonly",
        setTimeout: "readonly",
      },
    },
    plugins: { promise },
    rules: {
      "no-async-promise-executor": "error",
      "no-duplicate-imports": "error",
      "no-promise-executor-return": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "promise/catch-or-return": ["error", { allowFinally: true }],
      "promise/no-multiple-resolved": "error",
      "promise/valid-params": "error",
    },
  },
];
