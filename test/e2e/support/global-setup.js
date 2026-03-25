import fs from 'fs';
import path from 'path';

function loadEnvFileIfPresent() {
  const envPath = path.join(process.cwd(), '.env.e2e');
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) {
      continue;
    }

    const idx = line.indexOf('=');
    if (idx < 1) {
      continue;
    }

    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export default async function globalSetup() {
  loadEnvFileIfPresent();

  fs.mkdirSync(path.join(process.cwd(), '.coverage', 'e2e-v8'), { recursive: true });
  fs.mkdirSync(path.join(process.cwd(), 'test-results'), { recursive: true });
}
