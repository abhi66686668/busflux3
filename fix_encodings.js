const fs = require('fs');
const path = require('path');
const dir = './frontend';

function fixEncoding(text) {
  return text
    .replace(/â‚¹/g, '₹')
    .replace(/Â·/g, '·')
    .replace(/â”€â”€/g, '──')
    .replace(/ðŸ‘‹/g, '👋')
    .replace(/âœ…/g, '✅')
    .replace(/â€¢/g, '•')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/â”€/g, '─')
    .replace(/ðŸ‡®ðŸ‡³/g, '🇮🇳');
}

let count = 0;
fs.readdirSync(dir).forEach(f => {
  if (!f.endsWith('.html') && !f.endsWith('.js') && !f.endsWith('.css')) return;
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  let fixed = fixEncoding(content);
  if (fixed !== content) {
    fs.writeFileSync(p, fixed, 'utf8');
    console.log('Fixed', f);
    count++;
  }
});

console.log('Total files fixed: ' + count);
