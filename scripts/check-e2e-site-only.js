import { promises as fs } from 'fs';
import path from 'path';

const specsDir = path.join(process.cwd(), 'test', 'e2e', 'specs');

const disallowedPatterns = [
  { name: 'page.request', regex: /\bpage\.request\s*\./g },
  { name: 'request.<method>', regex: /\brequest\s*\.\s*(get|post|put|patch|delete|fetch)\s*\(/g },
  { name: 'apiPost/apiGet', regex: /\bapi(Post|Get)\s*\(/g },
  { name: 'workflow-helpers import', regex: /from\s+['\"]\.\.\/support\/workflow-helpers\.js['\"]/g },
  { name: 'seed scenario helper usage', regex: /\bseed[A-Za-z]+Scenario\s*\(/g },
  { name: 'request fixture in test callback', regex: /\(\s*\{[^}]*\brequest\b[^}]*\}\s*\)\s*=>/g },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(full);
    }
  }
  return files;
}

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

async function main() {
  const files = await walk(specsDir);
  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');

    for (const pattern of disallowedPatterns) {
      pattern.regex.lastIndex = 0;
      let match = pattern.regex.exec(content);
      while (match) {
        violations.push({
          file: path.relative(process.cwd(), file).replaceAll('\\\\', '/'),
          line: getLineNumber(content, match.index),
          pattern: pattern.name,
          snippet: match[0],
        });
        match = pattern.regex.exec(content);
      }
    }
  }

  if (violations.length === 0) {
    console.log('E2E site-only policy check passed: no direct API calls in test/e2e/specs.');
    return;
  }

  console.error('E2E site-only policy violations found:');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} (${v.pattern}) -> ${v.snippet}`);
  }
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('Failed to run E2E site-only policy check:', err);
  process.exit(1);
});
