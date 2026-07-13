const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const rootDirectories = ["src", "test", "scripts"];

const collectJavaScriptFiles = (directory) => {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) return collectJavaScriptFiles(entryPath);
    return entry.isFile() && entry.name.endsWith(".js") ? [entryPath] : [];
  });
};

const files = rootDirectories.flatMap(collectJavaScriptFiles);

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { stdio: "inherit" });
}

console.log(`Syntax check passed for ${files.length} JavaScript files.`);
