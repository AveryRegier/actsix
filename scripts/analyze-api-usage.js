import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';

const root = process.cwd();
const apiSourceRoots = [
  path.join(root, 'src', 'api.js'),
  path.join(root, 'src', 'api'),
];
const staticScanRoots = [
  path.join(root, 'site'),
  path.join(root, 'scripts'),
];
const traceRoot = path.join(root, 'test-results');
const outputPath = path.join(root, 'test-results', 'api-usage-analysis.json');

const METHOD_RE = /(app)\.(get|post|put|patch|delete|options)\s*\(\s*['"`]([^'"`]+)['"`]/gi;

function exists(targetPath) {
  try {
    fs.accessSync(targetPath);
    return true;
  } catch {
    return false;
  }
}

function walkFiles(targetPath, predicate = () => true, out = []) {
  if (!exists(targetPath)) {
    return out;
  }
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    if (predicate(targetPath)) {
      out.push(targetPath);
    }
    return out;
  }

  for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
    const full = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function normalizePathname(value) {
  if (!value) return null;
  let v = String(value).trim();
  if (!v) return null;
  if (!v.startsWith('/')) {
    v = `/${v}`;
  }
  const q = v.indexOf('?');
  if (q >= 0) v = v.slice(0, q);
  if (v.length > 1 && v.endsWith('/')) {
    v = v.slice(0, -1);
  }
  return v;
}

function toRegexFromDeclared(pathTemplate) {
  const escaped = pathTemplate
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function parseDeclaredRoutes() {
  const jsFiles = [];
  for (const source of apiSourceRoots) {
    walkFiles(source, (p) => p.endsWith('.js'), jsFiles);
  }

  const routes = [];
  for (const file of jsFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let match = METHOD_RE.exec(content);
    while (match) {
      const method = match[2].toUpperCase();
      const routePath = normalizePathname(match[3]);
      if (routePath && routePath.startsWith('/api')) {
        routes.push({
          method,
          path: routePath,
          file: path.relative(root, file).replace(/\\/g, '/'),
          matcher: toRegexFromDeclared(routePath),
        });
      }
      match = METHOD_RE.exec(content);
    }
    METHOD_RE.lastIndex = 0;
  }

  const unique = new Map();
  for (const route of routes) {
    const key = `${route.method} ${route.path}`;
    if (!unique.has(key)) {
      unique.set(key, route);
    }
  }
  return Array.from(unique.values()).sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`));
}

function parseTraceObservedCalls() {
  const traceZips = walkFiles(traceRoot, (p) => p.endsWith('trace.zip'));
  const observed = new Map();

  for (const zipPath of traceZips) {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries().filter((e) => e.entryName.endsWith('.network'));
    for (const entry of entries) {
      const raw = entry.getData().toString('utf8');
      const lines = raw.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const payload = JSON.parse(line);
          const req = payload?.request || payload?.snapshot?.request;
          const method = String(req?.method || '').toUpperCase();
          const url = req?.url;
          if (!method || !url) continue;
          const pathname = normalizePathname(new URL(url).pathname);
          if (!pathname || !pathname.startsWith('/api')) continue;
          const key = `${method} ${pathname}`;
          if (!observed.has(key)) {
            observed.set(key, {
              method,
              path: pathname,
              source: path.relative(root, zipPath).replace(/\\/g, '/'),
            });
          }
        } catch {
          // Ignore malformed lines.
        }
      }
    }
  }

  return {
    tracesScanned: traceZips.length,
    calls: Array.from(observed.values()).sort((a, b) => `${a.method} ${a.path}`.localeCompare(`${b.method} ${b.path}`)),
  };
}

function parseStaticReferences() {
  const files = [];
  for (const source of staticScanRoots) {
    walkFiles(source, (p) => p.endsWith('.js') || p.endsWith('.html'), files);
  }

  const refs = new Map();
  const patterns = [
    /\/api\/[A-Za-z0-9_\-./:${}?=&]*/g,
    /['"`]api\/[A-Za-z0-9_\-./:${}?=&]*['"`]/g,
  ];

  for (const file of files) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const candidates = new Set();

    for (const pattern of patterns) {
      let match = pattern.exec(content);
      while (match) {
        let value = String(match[0] || '');
        value = value.replace(/^['"`]|['"`]$/g, '');
        if (!value.startsWith('/api/') && value.startsWith('api/')) {
          value = `/${value}`;
        }
        value = value.replace(/\$\{[^}]+\}/g, '__SEG__');
        const normalized = normalizePathname(value);
        if (normalized && normalized.startsWith('/api/')) {
          candidates.add(normalized);
        }
        match = pattern.exec(content);
      }
      pattern.lastIndex = 0;
    }

    for (const c of candidates) {
      if (!refs.has(c)) refs.set(c, new Set());
      refs.get(c).add(rel);
    }
  }

  const out = [];
  for (const [apiPath, refFiles] of refs.entries()) {
    out.push({ path: apiPath, files: Array.from(refFiles).sort() });
  }
  out.sort((a, b) => a.path.localeCompare(b.path));
  return out;
}

function methodCompatible(declaredMethod, observedMethod) {
  if (declaredMethod === observedMethod) return true;
  if (declaredMethod === 'OPTIONS' && observedMethod === 'GET') return false;
  return false;
}

function matchDeclaredUsage(declared, runtimeCalls, staticRefs) {
  const runtimeUsage = new Map();
  const staticUsage = new Map();

  for (const route of declared) {
    const key = `${route.method} ${route.path}`;
    runtimeUsage.set(key, []);
    staticUsage.set(key, []);
  }

  for (const call of runtimeCalls) {
    for (const route of declared) {
      if (!methodCompatible(route.method, call.method)) continue;
      if (route.matcher.test(call.path)) {
        runtimeUsage.get(`${route.method} ${route.path}`).push(call.path);
      }
    }
  }

  for (const ref of staticRefs) {
    for (const route of declared) {
      const key = `${route.method} ${route.path}`;
      if (route.matcher.test(ref.path)) {
        staticUsage.get(key).push(ref.path);
        continue;
      }
      // Fallback: reference may include placeholder segment marker.
      const coarse = route.path.replace(/:[A-Za-z_][A-Za-z0-9_]*/g, '__SEG__');
      if (coarse === ref.path) {
        staticUsage.get(key).push(ref.path);
      }
    }
  }

  const rows = [];
  for (const route of declared) {
    const key = `${route.method} ${route.path}`;
    const runtimeMatches = Array.from(new Set(runtimeUsage.get(key) || [])).sort();
    const staticMatches = Array.from(new Set(staticUsage.get(key) || [])).sort();
    rows.push({
      method: route.method,
      path: route.path,
      file: route.file,
      runtimeObserved: runtimeMatches.length > 0,
      staticReferenced: staticMatches.length > 0,
      runtimeMatches,
      staticMatches,
    });
  }

  return rows;
}

function main() {
  const declared = parseDeclaredRoutes();
  const runtime = parseTraceObservedCalls();
  const staticRefs = parseStaticReferences();
  const matched = matchDeclaredUsage(declared, runtime.calls, staticRefs);

  const unusedByBoth = matched.filter((r) => !r.runtimeObserved && !r.staticReferenced);
  const staticOnly = matched.filter((r) => !r.runtimeObserved && r.staticReferenced);
  const runtimeOnly = matched.filter((r) => r.runtimeObserved && !r.staticReferenced);

  const result = {
    generatedAt: new Date().toISOString(),
    inputs: {
      declaredRouteCount: declared.length,
      runtimeTraceZipCount: runtime.tracesScanned,
      runtimeUniqueApiCalls: runtime.calls.length,
      staticReferenceCount: staticRefs.length,
    },
    summary: {
      observedByRuntime: matched.filter((r) => r.runtimeObserved).length,
      referencedByStatic: matched.filter((r) => r.staticReferenced).length,
      unusedByRuntimeAndStatic: unusedByBoth.length,
      staticOnlyCount: staticOnly.length,
      runtimeOnlyCount: runtimeOnly.length,
    },
    unusedByRuntimeAndStatic: unusedByBoth,
    notObservedAtRuntimeButStaticReferenced: staticOnly,
    observedAtRuntimeButNotStaticReferenced: runtimeOnly,
    declaredRoutes: matched,
    runtimeCalls: runtime.calls,
    staticReferences: staticRefs,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');

  console.log(`Declared API routes: ${result.inputs.declaredRouteCount}`);
  console.log(`Trace zip files scanned: ${result.inputs.runtimeTraceZipCount}`);
  console.log(`Unique runtime API calls: ${result.inputs.runtimeUniqueApiCalls}`);
  console.log(`Static API references: ${result.inputs.staticReferenceCount}`);
  console.log(`Observed by runtime: ${result.summary.observedByRuntime}`);
  console.log(`Referenced by static scans: ${result.summary.referencedByStatic}`);
  console.log(`Unused by runtime + static: ${result.summary.unusedByRuntimeAndStatic}`);
  console.log(`Report: ${path.relative(root, outputPath).replace(/\\/g, '/')}`);
}

main();
