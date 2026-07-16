const findDirectServerErrorResponses = (source, filePath) => {
  const violations = [];
  const directServerErrorExpression = /\bres\.status\(\s*5\d{2}\s*\)/g;

  for (const match of source.matchAll(directServerErrorExpression)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    violations.push(`${filePath}:${line} controller sends a direct 5xx response`);
  }

  return violations;
};

const findRethrowOnlyCatches = (source, filePath) => {
  const violations = [];
  const rethrowOnlyExpression = /catch\s*\(error\)\s*\{\s*throw error;\s*\}/g;

  for (const match of source.matchAll(rethrowOnlyExpression)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    violations.push(`${filePath}:${line} contains a rethrow-only catch`);
  }

  return violations;
};

const findMagicStringViolations = (source, filePath) => {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const canonicalFiles = new Set([
    "src/domain/auth.js",
    "src/domain/mesin.js",
    "src/domain/machineControl.js",
  ]);
  if (canonicalFiles.has(normalizedPath)) return [];

  const violations = [];
  const lines = source.split(/\r?\n/);
  const roleLiteralExpression = /\brole\s*(?:===|!==|==|!=|=|:)\s*["'](?:owner|kasir|backoffice)["']/;
  const actorLiteralExpression = /\btype\s*:\s*["'](?:owner|kasir|backoffice)["']/;
  const statusLiteralExpression = /\bstatus\s*(?:===|!==|==|!=|=|:)\s*["'](?:READY|IN_USE|OFFLINE)["']/;

  lines.forEach((line, index) => {
    const code = line.replace(/\/\/.*$/, "").trim();
    if (!code || code.startsWith("*") || code.startsWith("/*") || code.startsWith("*/")) return;

    const lineNumber = index + 1;
    if (roleLiteralExpression.test(code)) {
      violations.push(`${filePath}:${lineNumber} contains a hardcoded role value; use the auth domain constants`);
    }
    if (actorLiteralExpression.test(code)) {
      violations.push(`${filePath}:${lineNumber} contains a hardcoded machine actor value; use the machine-control domain constants`);
    }
    if (statusLiteralExpression.test(code)) {
      violations.push(`${filePath}:${lineNumber} contains a hardcoded machine status value; use the mesin domain constants`);
    }
  });

  return violations;
};

module.exports = {
  findDirectServerErrorResponses,
  findMagicStringViolations,
  findRethrowOnlyCatches,
};
