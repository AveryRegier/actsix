import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'actsix-e2e-secret';
const E2E_PORT = Number(process.env.E2E_PORT || 3101);
const E2E_BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${E2E_PORT}`;
const E2E_ORIGIN = new URL(E2E_BASE_URL);

const PRINCIPALS = {
  deacon: {
    memberId: '688acafeb02a1cc05f074c03',
    householdId: '688acafeb02a1cc05f074c02',
    email: 'deacon-seeded@example.test',
  },
  staff: {
    memberId: '688ac9e0b02a1cc05f074c01',
    householdId: '688ac9e0b02a1cc05f074c00',
    email: 'staff-seeded@example.test',
  },
  helper: {
    memberId: '688acb51b02a1cc05f074c05',
    householdId: '688acb51b02a1cc05f074c04',
    email: 'helper-seeded@example.test',
  },
};

function principalForRole(role) {
  return PRINCIPALS[role] || PRINCIPALS.deacon;
}

export function getKnownHouseholdId(role = 'deacon') {
  return principalForRole(role).householdId;
}

export async function authenticateAsRole(page, role = 'deacon') {
  const principal = principalForRole(role);
  const token = jwt.sign(
    { id: principal.memberId, email: principal.email, role },
    JWT_SECRET,
    { expiresIn: '8h' },
  );

  await page.context().addCookies([
    {
      name: 'actsix',
      value: token,
      domain: E2E_ORIGIN.hostname,
      path: '/',
      secure: E2E_ORIGIN.protocol === 'https:',
      sameSite: 'Lax',
    },
  ]);

  await page.addInitScript((memberId) => {
    try {
      localStorage.setItem('memberId', memberId);
    } catch {
      // Ignore storage errors in hardened browser contexts.
    }
  }, principal.memberId);

  return principal;
}
