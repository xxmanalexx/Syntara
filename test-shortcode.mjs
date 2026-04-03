const resp = await fetch('https://www.instagram.com/p/17930172741246825/', {
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
});
const html = await resp.text();

// Find shortcode in page
const patterns = [
  /shortcode\\\":\\\"([A-Za-z0-9_-]{5,20})\\\"/,
  /\\\"code\\\":\\\"([A-Za-z0-9_-]{5,20})\\\"/,
  /\"shortcode\":\"([A-Za-z0-9_-]{5,20})\"/,
  /config\":\{\"id\":\"17930172741246825\",\"短code/
];

for (const p of patterns) {
  const m = html.match(p);
  console.log(p.source.slice(0, 30), ':', m ? m[1] : 'not found');
}

// Look for the JSON data embedded in the page
const idx = html.indexOf('"shortcode"');
if (idx > 0) {
  console.log('Near shortcode key:', html.slice(idx, idx + 80));
}

// Check og:url
const ogMatch = html.match(/og:url.*?content=\"([^\"]+)\"/);
console.log('OG URL:', ogMatch ? ogMatch[1] : 'not found');
