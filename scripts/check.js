const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const ignored = new Set(['node_modules', '.git']);
const files = [];

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else files.push(target);
  }
}

walk(root);

for (const file of files.filter((item) => item.endsWith('.js'))) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

for (const file of files.filter((item) => item.endsWith('.json'))) {
  JSON.parse(fs.readFileSync(file, 'utf8'));
}

console.log(`Syntax check passed for ${files.filter((item) => item.endsWith('.js')).length} JavaScript files.`);
console.log(`JSON validation passed for ${files.filter((item) => item.endsWith('.json')).length} JSON files.`);
