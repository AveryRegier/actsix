import fs from 'fs';
import path from 'path';
import { Report } from 'c8';

const rootDir = process.cwd();
const reportDir = path.join(rootDir, 'coverage', 'e2e-server');
const nycOutputDir = path.join(rootDir, '.nyc_output');

function exists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

/** Return true if the .nyc_output directory has any coverage files with app source entries. */
function hasServerCoverageData() {
  if (!exists(nycOutputDir)) return false;
  const files = fs.readdirSync(nycOutputDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(nycOutputDir, file), 'utf8'));
      const entries = data.result || [];
      if (entries.some((e) => e.url && e.url.includes('/src/'))) return true;
    } catch {
      // Ignore malformed files.
    }
  }
  return false;
}

async function main() {
  fs.mkdirSync(reportDir, { recursive: true });

  if (!hasServerCoverageData()) {
    console.warn(
      '\n⚠  No server-side V8 coverage data found in .nyc_output.\n' +
      '   Run "npm run e2e:coverage" to collect coverage.\n'
    );
    // Write a minimal marker so downstream tooling does not fail.
    fs.writeFileSync(
      path.join(reportDir, 'server-coverage-summary.json'),
      JSON.stringify({ note: 'No coverage data collected.' }, null, 2),
    );
    return;
  }

  const report = new Report({
    reporter: ['text-summary', 'html', 'json-summary'],
    reportsDirectory: reportDir,
    tempDirectory: nycOutputDir,
    include: [
      'src/api/**/*.js',
      'src/auth/**/*.js',
      'src/form/**/*.js',
      'src/util/**/*.js',
      'src/server.js',
      'src/lambda.js',
    ],
    exclude: ['node_modules/**', 'test/**', 'coverage/**', 'dist/**', '.nyc_output/**', 'site/**'],
    all: true,
    resolve: rootDir,
  });

  await report.run();

  console.log('\n✓ E2E Server Coverage Report Generated');
  console.log('=========================================');
  console.log(`  HTML report : coverage/e2e-server/index.html`);
  console.log(`  JSON summary: coverage/e2e-server/coverage-summary.json\n`);
}

await main();
