const fs = require("node:fs");
const path = require("node:path");

const routesDir = path.join(__dirname, "..", "src", "routes");
const violations = [];

for (const file of fs.readdirSync(routesDir).filter((name) => name.endsWith(".js"))) {
  const fullPath = path.join(routesDir, file);
  const lines = fs.readFileSync(fullPath, "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/Controller\.[A-Za-z_$][\w$]*\s*\)/.test(line) && !line.includes("catchAsync(")) {
      violations.push(`${path.join("src", "routes", file)}:${index + 1} async controller is not wrapped with catchAsync`);
    }
  });
}

const transaksiController = fs.readFileSync(path.join(__dirname, "..", "src", "controller", "transaksi.js"), "utf8");
if (/\b(?:subtotal|totalHarga|hargaSatuan|jumlahHarga)\b/.test(transaksiController)) {
  violations.push("src/controller/transaksi.js contains transaction pricing arithmetic");
}

if (violations.length > 0) {
  console.error("Refactor quality gate failed:");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log("Refactor quality gate passed: async routes and transaction arithmetic boundaries are intact.");
}
