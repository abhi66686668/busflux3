const fs = require('fs');
const path = require('path');

const files = ['admin.html', 'conductor.html', 'script.js'];
const fixedGetImageUrl = `function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('data:')) return path;
  if (path.startsWith('http')) return path;
  let clean = path.replace(/\\\\/g, '/').trim();
  if (!clean.startsWith('/')) clean = '/' + clean;
  const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '5000' ? 'http://localhost:5000' : '';
  return baseUrl + clean;
}`;

files.forEach(file => {
  const filePath = path.join(__dirname, '../frontend', file);
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Try to find the existing getImageUrl function and replace it
  const regexAdmin = /function getImageUrl\(path\)\s*\{[\s\S]*?return[^\}]+}/g;
  const regexCond = /window\.getImageUrl = function\(path\)\s*\{[\s\S]*?return[^\}]+};/g;
  const regexScript = /window\.getImageUrl = function\(path\)\s*\{[\s\S]*?return baseUrl \+ clean;\n};/g;
  
  if (file === 'admin.html') {
    content = content.replace(regexAdmin, fixedGetImageUrl);
  } else if (file === 'conductor.html') {
    content = content.replace(regexCond, 'window.' + fixedGetImageUrl + ';');
  } else if (file === 'script.js') {
    content = content.replace(regexScript, 'window.' + fixedGetImageUrl + ';');
  }
  
  fs.writeFileSync(filePath, content);
  console.log(`Fixed ${file}`);
});
