import fs from 'fs';
import path from 'path';
import istanbulCoverage from 'istanbul-lib-coverage';
import istanbulReport from 'istanbul-lib-report';
import reports from 'istanbul-reports';
import v8ToIstanbul from 'v8-to-istanbul';

const { createCoverageMap } = istanbulCoverage;
const { createContext } = istanbulReport;

const rootDir = process.cwd();
const rawCoverageDir = path.join(rootDir, '.coverage', 'e2e-browser', 'raw');
const reportDir = path.join(rootDir, 'coverage', 'e2e');
const summaryPath = path.join(reportDir, 'coverage-summary.json');

function exists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function readCoverageFiles(dir) {
  if (!exists(dir)) {
    return [];
  }

  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => path.join(dir, name));
}

function isCoveredSiteScript(url) {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.toLowerCase();
    // Must be a .js file served by the app server
    // Exclude node_modules, src/, and html files
    return pathname.endsWith('.js') && 
           !pathname.includes('/node_modules/') &&
           !pathname.includes('/src/');
  } catch {
    return false;
  }
}

function resolveSitePath(url) {
  const parsed = new URL(url);
  // Extract filename/path from the URL pathname
  // e.g., /fetch-utils.js or /some-file.js
  let pathname = parsed.pathname;
  // Remove leading slash
  if (pathname.startsWith('/')) {
    pathname = pathname.slice(1);
  }
  // Resolve from site directory
  return path.join(rootDir, 'site', pathname);
}

async function buildCoverageMap() {
  const coverageMap = createCoverageMap({});
  const coverageFiles = readCoverageFiles(rawCoverageDir);

  for (const filePath of coverageFiles) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    for (const entry of raw.entries || []) {
      if (!isCoveredSiteScript(entry.url)) {
        continue;
      }

      const sourcePath = resolveSitePath(entry.url);
      if (!exists(sourcePath)) {
        continue;
      }

      const converter = v8ToIstanbul(sourcePath, 0, {
        source: entry.source,
      });
      await converter.load();
      converter.applyCoverage(entry.functions);
      coverageMap.merge(converter.toIstanbul());
    }
  }

  return coverageMap;
}

async function main() {
  const coverageMap = await buildCoverageMap();
  fs.mkdirSync(reportDir, { recursive: true });

  const context = createContext({
    dir: reportDir,
    coverageMap,
    defaultSummarizer: 'nested',
  });

  reports.create('json-summary').execute(context);
  reports.create('html').execute(context);
  reports.create('text-summary').execute(context);

  if (!exists(summaryPath)) {
    console.error('E2E browser coverage summary was not generated.');
    process.exit(1);
  }

  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  console.log('E2E browser coverage totals:', summary.total || summary);
}

await main();
