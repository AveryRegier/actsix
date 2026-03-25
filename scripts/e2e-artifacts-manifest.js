import fs from 'fs';
import path from 'path';

const root = process.cwd();
const outputPath = path.join(root, 'test-results', 'e2e-artifacts.json');

function exists(p) {
  try {
    fs.accessSync(p);
    return true;
  } catch {
    return false;
  }
}

function readDirRecursive(dir, matcher) {
  if (!exists(dir)) {
    return [];
  }

  const out = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (matcher(full)) {
        const stat = fs.statSync(full);
        out.push({
          path: path.relative(root, full).replace(/\\/g, '/'),
          mtimeMs: stat.mtimeMs,
          size: stat.size,
        });
      }
    }
  }

  out.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return out;
}

function readCoverageSummary() {
  const summaryPath = path.join(root, 'coverage', 'coverage-summary.json');
  if (!exists(summaryPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    return parsed.total || null;
  } catch {
    return null;
  }
}

function readE2ECoverageSummary() {
  const summaryPath = path.join(root, 'coverage', 'e2e', 'coverage-summary.json');
  if (!exists(summaryPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    return parsed.total || null;
  } catch {
    return null;
  }
}

const traces = readDirRecursive(path.join(root, 'test-results'), (p) => p.endsWith('trace.zip'));
const videos = readDirRecursive(path.join(root, 'test-results'), (p) => p.endsWith('.webm'));
const screenshots = readDirRecursive(path.join(root, 'test-results'), (p) => p.endsWith('.png'));

const manifest = {
  generatedAt: new Date().toISOString(),
  commands: {
    mcpSmoke: 'npm run e2e:mcp:smoke',
    mcpFull: 'npm run e2e:mcp',
    mcpCoverage: 'npm run e2e:mcp:coverage',
  },
  reports: {
    playwrightHtml: exists(path.join(root, 'test', 'e2e', 'playwright-report', 'index.html'))
      ? 'test/e2e/playwright-report/index.html'
      : null,
    e2eCoverageHtml: exists(path.join(root, 'coverage', 'e2e', 'index.html'))
      ? 'coverage/e2e/index.html'
      : null,
  },
  coverage: {
    unitSummary: readCoverageSummary(),
    e2eSummary: readE2ECoverageSummary(),
  },
  mailbox: exists(path.join(root, 'test-results', 'fake-mailbox.json'))
    ? 'test-results/fake-mailbox.json'
    : null,
  latestArtifacts: {
    traces: traces.slice(0, 10),
    videos: videos.slice(0, 10),
    screenshots: screenshots.slice(0, 20),
  },
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf8');
console.log(`Wrote artifact manifest: ${path.relative(root, outputPath).replace(/\\/g, '/')}`);
