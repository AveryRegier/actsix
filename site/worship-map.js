// Aisle entrance coordinates on the worship center map (stage at right), keyed by position number prefix.
const AISLE_MARKERS = {
  1: { x: 655, y: 270 }, 2: { x: 548, y: 395 }, 3: { x: 478, y: 520 }, 4: { x: 460, y: 610 },
  5: { x: 475, y: 705 }, 6: { x: 545, y: 825 }, 7: { x: 635, y: 958 }, 8: { x: 480, y: 85 },
  9: { x: 320, y: 232 }, 10: { x: 258, y: 342 }, 11: { x: 212, y: 435 }, 12: { x: 185, y: 615 },
  13: { x: 210, y: 790 }, 14: { x: 245, y: 895 }, 15: { x: 330, y: 1005 }, 16: { x: 460, y: 1140 }
};

const SEAT_BLOCKS = [
  '383,237 497,120 657,275 543,378', '265,438 366,262 527,415 480,500', '235,597 255,471 475,520 462,597',
  '232,637 462,628 468,690 240,762', '262,792 480,720 535,820 365,968', '385,1015 545,860 640,960 500,1115',
  '275,130 395,20 465,85 345,200', '125,243 205,130 320,232 270,320', '60,380 130,272 255,340 220,425',
  '25,597 50,410 210,465 190,597', '25,635 190,635 210,775 52,822', '62,855 215,805 245,885 105,962',
  '120,990 262,915 335,1005 205,1100', '280,1085 345,1030 455,1130 405,1210'
];

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function getAisleNumber(position) {
  const match = /^(\d+)(?:-|$)/.exec(String(position.positionId || ''));
  const number = match ? Number(match[1]) : null;
  return number && AISLE_MARKERS[number] ? number : null;
}

function personName(position) {
  const member = position.assignedMember;
  if (!member) {
    return '';
  }
  return `${member.firstName || ''} ${member.lastName || ''}`.trim();
}

// Returns a small SVG map highlighting only the aisle of one position; empty string if the position has no aisle.
export function renderAssignedAisleMap(positionId, note = '') {
  const aisle = getAisleNumber({ positionId });
  if (aisle === null) {
    return '';
  }

  const { x, y } = AISLE_MARKERS[aisle];
  const blocks = SEAT_BLOCKS.map(points => `<polygon points="${points}" fill="#f7f9fa" stroke="#222" stroke-width="4"/>`).join('');
  const stage = '<polygon points="640,330 710,265 945,495 945,730 710,965 640,900" fill="#eef1f3" stroke="#222" stroke-width="4"/>'
    + '<text x="800" y="620" font-size="34" text-anchor="middle" fill="#555">Stage</text>';
  const marker = `<circle cx="${x}" cy="${y}" r="38" fill="#8b1a1a" fill-opacity="0.2" stroke="#8b1a1a" stroke-width="4"/>`
    + `<circle cx="${x}" cy="${y}" r="24" fill="#8b1a1a"/>`
    + `<text x="${x}" y="${y + 10}" font-size="28" font-weight="700" text-anchor="middle" fill="#fff">${aisle}</text>`
    + (note ? `<text x="${x - 46}" y="${y + 9}" font-size="26" font-style="italic" text-anchor="end" fill="#333" stroke="#fff" stroke-width="5" paint-order="stroke">${esc(note)}</text>` : '');

  return `<div class="assigned-aisle-map" style="margin-top:12px;">`
    + `<svg viewBox="-150 0 1120 1230" role="img" aria-label="Your assigned aisle: ${aisle}" style="width:100%; max-width:260px; display:block; background:#fff;">`
    + `${blocks}${stage}${marker}</svg></div>`;
}

// Returns an SVG map placing each assigned person at their aisle; unassigned slots get a blank line. Empty string if no position maps to an aisle.
export function renderWorshipMap(positions) {
  const byAisle = new Map();
  for (const position of positions || []) {
    const aisle = getAisleNumber(position);
    if (aisle === null) {
      continue;
    }
    if (!byAisle.has(aisle)) {
      byAisle.set(aisle, []);
    }
    byAisle.get(aisle).push(position);
  }

  if (byAisle.size === 0) {
    return '';
  }

  const blocks = SEAT_BLOCKS.map(points => `<polygon points="${points}" fill="#f7f9fa" stroke="#222" stroke-width="4"/>`).join('');
  const stage = '<polygon points="640,330 710,265 945,495 945,730 710,965 640,900" fill="#eef1f3" stroke="#222" stroke-width="4"/>'
    + '<text x="800" y="620" font-size="34" text-anchor="middle" fill="#555">Stage</text>';

  const markers = Array.from(byAisle.entries()).map(([aisle, aislePositions]) => {
    const { x, y } = AISLE_MARKERS[aisle];
    let offsetY = 8;
    const lines = aislePositions.map((position) => {
      const lineY = y + offsetY;
      const name = personName(position);
      let markup = name
        ? `<text x="${x - 24}" y="${lineY}" font-size="22" font-weight="600" text-anchor="end" fill="#111" stroke="#fff" stroke-width="5" paint-order="stroke">${esc(name)}</text>`
        : `<line x1="${x - 24}" y1="${lineY}" x2="${x - 164}" y2="${lineY}" stroke="#000" stroke-width="2"/>`;
      offsetY += 30;
      if (position.note) {
        markup += `<text x="${x - 24}" y="${lineY + 22}" font-size="17" font-style="italic" text-anchor="end" fill="#444" stroke="#fff" stroke-width="4" paint-order="stroke">${esc(position.note)}</text>`;
        offsetY += 22;
      }
      return markup;
    }).join('');
    return `<circle cx="${x}" cy="${y}" r="17" fill="#fff" stroke="#8b1a1a" stroke-width="3"/>`
      + `<text x="${x}" y="${y + 7}" font-size="20" font-weight="700" text-anchor="middle" fill="#8b1a1a">${aisle}</text>${lines}`;
  }).join('');

  return `<div class="worship-map" style="margin-top:14px; page-break-inside:avoid; break-inside:avoid;">`
    + `<svg viewBox="-150 0 1120 1230" role="img" aria-label="Worship center assignment map" style="width:100%; max-width:760px; max-height:90vh; display:block; margin:0 auto; background:#fff;">`
    + `${blocks}${stage}${markers}</svg></div>`;
}
