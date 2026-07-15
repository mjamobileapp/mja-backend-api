const fs = require("node:fs");
const path = require("node:path");
const { findDirectServerErrorResponses } = require("./refactor-quality-rules");

const routesDir = path.join(__dirname, "..", "src", "routes");
const violations = [];

const appSource = fs.readFileSync(path.join(__dirname, "..", "src", "app.js"), "utf8");
const controllerHandlers = new Set();
for (const match of appSource.matchAll(/const\s*\{([^}]+)\}\s*=\s*require\(["']\.\/controller\/[^"']+["']\)/g)) {
  match[1]
    .split(",")
    .map((handler) => handler.trim().split(/\s+as\s+/i).pop())
    .filter(Boolean)
    .forEach((handler) => controllerHandlers.add(handler));
}

for (const match of appSource.matchAll(/app\.(?:get|post|put|patch|delete)\s*\(([\s\S]*?)\);/g)) {
  for (const handler of controllerHandlers) {
    if (new RegExp(`\\b${handler}\\b`).test(match[1]) && !match[1].includes("catchAsync(")) {
      const line = appSource.slice(0, match.index).split(/\r?\n/).length;
      violations.push(`${path.join("src", "app.js")}:${line} async controller is not wrapped with catchAsync`);
    }
  }
}

for (const file of fs.readdirSync(routesDir).filter((name) => name.endsWith(".js"))) {
  const fullPath = path.join(routesDir, file);
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/Controller\.[A-Za-z_$][\w$]*\s*\)/.test(line) && !line.includes("catchAsync(")) {
      violations.push(`${path.join("src", "routes", file)}:${index + 1} async controller is not wrapped with catchAsync`);
    }
  });
}

const controllersDir = path.join(__dirname, "..", "src", "controller");
for (const file of fs.readdirSync(controllersDir).filter((name) => name.endsWith(".js"))) {
  const fullPath = path.join(controllersDir, file);
  const relativePath = path.join("src", "controller", file);
  violations.push(...findDirectServerErrorResponses(fs.readFileSync(fullPath, "utf8"), relativePath));
}

const transaksiController = fs.readFileSync(path.join(__dirname, "..", "src", "controller", "transaksi.js"), "utf8");
if (/\b(?:subtotal|totalHarga|hargaSatuan|jumlahHarga)\b/.test(transaksiController)) {
  violations.push("src/controller/transaksi.js contains transaction pricing arithmetic");
}

if (/error\.message\s*===|context\.error/.test(transaksiController)) {
  violations.push("src/controller/transaksi.js contains string-based or object-based HTTP error mapping");
}

const transaksiModel = fs.readFileSync(path.join(__dirname, "..", "src", "models", "transaksi.js"), "utf8");
if (/throw\s+new\s+Error\s*\(/.test(transaksiModel)) {
  violations.push("src/models/transaksi.js contains untyped transaction errors");
}

const mobileController = fs.readFileSync(path.join(__dirname, "..", "src", "controller", "mobile.js"), "utf8");
if (/error\.message\s*===/.test(mobileController)) {
  violations.push("src/controller/mobile.js contains string-based activation error mapping");
}

const modelsDir = path.join(__dirname, "..", "src", "models");
const forbiddenTimestampExpression = /(?<![.\w])(?:NOW|CURDATE|CURRENT_TIMESTAMP)\s*(?:\(\s*\))?/gi;
for (const file of fs.readdirSync(modelsDir).filter((name) => name.endsWith(".js"))) {
  const fullPath = path.join(modelsDir, file);
  const source = fs.readFileSync(fullPath, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (forbiddenTimestampExpression.test(line)) {
      violations.push(`${path.join("src", "models", file)}:${index + 1} uses a non-UTC database timestamp function`);
    }
    forbiddenTimestampExpression.lastIndex = 0;
  });
}

if (violations.length > 0) {
  console.error("Refactor quality gate failed:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log("Refactor quality gate passed: async routes, 5xx response boundaries, and transaction arithmetic boundaries are intact.");
}
