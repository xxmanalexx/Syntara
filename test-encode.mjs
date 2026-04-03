// Instagram shortcode encoding/decoding
// Instagram uses a custom base36 variant where the characters are 0-9, A-Z, a-z (in that order, NOT standard base36)

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

function encodeIdToCode(idStr) {
  let id = BigInt(idStr);
  let result = '';
  while (id > 0n) {
    const idx = id % 36n;
    result = CHARS[Number(idx)] + result;
    id = id / 36n;
  }
  return result;
}

function decodeCodeToId(code) {
  let id = 0n;
  for (const char of code) {
    const idx = BigInt(CHARS.indexOf(char));
    id = id * 36n + idx;
  }
  return id.toString();
}

// Test with known pairs
const pairs = [
  ['17951930523105551', 'DWrIFPGDD1c'],
  ['17877518751427367', 'DWrDZLVDKtV'],
  ['17860682016622556', 'DWrCnTVjD1O'],
  ['18089371256239874', 'DWq5gFfjPvA'],
  ['18588637945061874', 'DWqx83JjGcq'],
  ['18078225329129118', 'DWqqbtWDKXZ'],
  ['18088612838241864', 'DWqmF2dDKl3'],
  ['18071733035330798', 'DWoZmBNDPfw'],
  ['18000972941736186', 'DWoFhjfDGQm'],
];

pairs.forEach(([id, expected]) => {
  const encoded = encodeIdToCode(id);
  const decoded = decodeCodeToId(expected);
  console.log(id, '->', encoded, '| expected:', expected, '| enc match:', encoded === expected, '| dec match:', decoded === id);
});
