import fs from 'fs';
import path from 'path';
import { test as base, expect } from '@playwright/test';

const coverageDir = path.join(process.cwd(), '.coverage', 'e2e-browser', 'raw');

function sanitizeSegment(value) {
  return String(value || 'unknown')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'unknown';
}

function coverageFileForTest(testInfo) {
  const title = testInfo.titlePath.map(sanitizeSegment).join('__');
  const fileName = `${title}__retry-${testInfo.retry}__repeat-${testInfo.repeatEachIndex}.json`;
  return path.join(coverageDir, fileName);
}

export const test = base.extend({
  page: async ({ page, browserName }, use, testInfo) => {
    if (browserName !== 'chromium') {
      await use(page);
      return;
    }

    fs.mkdirSync(coverageDir, { recursive: true });

    const client = await page.context().newCDPSession(page);
    await client.send('Profiler.enable');
    await client.send('Debugger.enable');
    await client.send('Profiler.startPreciseCoverage', {
      callCount: true,
      detailed: true,
      allowTriggeredUpdates: false,
    });

    await use(page);

    const { result } = await client.send('Profiler.takePreciseCoverage');
    await client.send('Profiler.stopPreciseCoverage');

    const entries = [];
    for (const entry of result || []) {
      if (!entry.url || !entry.functions?.length) {
        continue;
      }

      try {
        const { scriptSource } = await client.send('Debugger.getScriptSource', {
          scriptId: entry.scriptId,
        });

        entries.push({
          url: entry.url,
          functions: entry.functions,
          source: scriptSource,
        });
      } catch {
        // Ignore scripts whose source cannot be retrieved.
      }
    }

    await client.send('Profiler.disable');
    await client.send('Debugger.disable');

    fs.writeFileSync(coverageFileForTest(testInfo), JSON.stringify({
      testId: testInfo.testId,
      title: testInfo.title,
      entries,
    }, null, 2));
  },
});

export { expect };
