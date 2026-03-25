import fs from 'fs';
import path from 'path';

const coverageDir = path.join(process.cwd(), 'coverage');
const summaryPath = path.join(coverageDir, 'coverage-summary.json');
const finalPath = path.join(coverageDir, 'coverage-final.json');

function pct(covered, total) {
  if (!total || total < 1) {
    return 0;
  }
  return (covered / total) * 100;
}

function loadTotals() {
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    if (summary.total) {
      return {
        statements: summary.total.statements?.pct ?? 0,
        branches: summary.total.branches?.pct ?? 0,
        functions: summary.total.functions?.pct ?? 0,
        lines: summary.total.lines?.pct ?? 0,
      };
    }
  }

  if (fs.existsSync(finalPath)) {
    const finalData = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
    const totals = {
      statements: { covered: 0, total: 0 },
      branches: { covered: 0, total: 0 },
      functions: { covered: 0, total: 0 },
      lines: { covered: 0, total: 0 },
    };

    for (const fileCoverage of Object.values(finalData)) {
      const statements = Object.values(fileCoverage.s || {});
      totals.statements.total += statements.length;
      totals.statements.covered += statements.filter((n) => Number(n) > 0).length;

      const branches = Object.values(fileCoverage.b || {}).flat();
      totals.branches.total += branches.length;
      totals.branches.covered += branches.filter((n) => Number(n) > 0).length;

      const functions = Object.values(fileCoverage.f || {});
      totals.functions.total += functions.length;
      totals.functions.covered += functions.filter((n) => Number(n) > 0).length;

      const lines = Object.values(fileCoverage.l || {});
      totals.lines.total += lines.length;
      totals.lines.covered += lines.filter((n) => Number(n) > 0).length;
    }

    return {
      statements: pct(totals.statements.covered, totals.statements.total),
      branches: pct(totals.branches.covered, totals.branches.total),
      functions: pct(totals.functions.covered, totals.functions.total),
      lines: totals.lines.total > 0
        ? pct(totals.lines.covered, totals.lines.total)
        : pct(totals.statements.covered, totals.statements.total),
    };
  }

  console.error('Coverage output not found. Expected coverage-summary.json or coverage-final.json in coverage/.');
  process.exit(1);
}

const thresholds = {
  statements: Number(process.env.COVERAGE_MIN_STATEMENTS || 15),
  branches: Number(process.env.COVERAGE_MIN_BRANCHES || 70),
  functions: Number(process.env.COVERAGE_MIN_FUNCTIONS || 20),
  lines: Number(process.env.COVERAGE_MIN_LINES || 15),
};

const actual = loadTotals();

const failed = Object.keys(thresholds).filter((key) => actual[key] < thresholds[key]);

console.log('Coverage totals:', actual);
console.log('Coverage thresholds:', thresholds);

if (failed.length > 0) {
  console.error(`Coverage below threshold for: ${failed.join(', ')}`);
  process.exit(1);
}

console.log('Coverage thresholds satisfied.');
