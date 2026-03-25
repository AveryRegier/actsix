import fs from 'fs';
import path from 'path';

const DEFAULT_PATH = path.join(process.cwd(), 'test-results', 'fake-mailbox.json');

export function mailboxPath() {
  return process.env.FAKE_MAILBOX_FILE || DEFAULT_PATH;
}

function ensureParentDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readMailbox(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeMailbox(filePath, messages) {
  ensureParentDir(filePath);
  fs.writeFileSync(filePath, JSON.stringify(messages, null, 2), 'utf8');
}

export function resetMailbox(filePath = mailboxPath()) {
  writeMailbox(filePath, []);
}

export function appendMailboxMessage(message, filePath = mailboxPath()) {
  const messages = readMailbox(filePath);
  messages.push({
    ...message,
    createdAt: new Date().toISOString(),
  });
  writeMailbox(filePath, messages);
}

export function findLatestCodeForEmail(email, filePath = mailboxPath()) {
  const normalized = (email || '').trim().toLowerCase();
  const messages = readMailbox(filePath);

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    const to = (msg?.to || '').toString().trim().toLowerCase();
    if (to !== normalized) {
      continue;
    }

    const candidates = [msg.subject, msg.text, msg.html].filter(Boolean);
    for (const candidate of candidates) {
      const match = String(candidate).match(/\b(\d{6})\b/);
      if (match) {
        return match[1];
      }
    }
  }

  return null;
}
