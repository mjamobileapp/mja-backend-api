const findDirectServerErrorResponses = (source, filePath) => {
  const violations = [];
  const directServerErrorExpression = /\bres\.status\(\s*5\d{2}\s*\)/g;

  for (const match of source.matchAll(directServerErrorExpression)) {
    const line = source.slice(0, match.index).split(/\r?\n/).length;
    violations.push(`${filePath}:${line} controller sends a direct 5xx response`);
  }

  return violations;
};

module.exports = { findDirectServerErrorResponses };
