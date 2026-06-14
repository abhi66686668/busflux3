const fs = require('fs');

let content = fs.readFileSync('admin.html', 'utf8');

// Replace """ with "--"
content = content.replace(/\"\"[”“]\"/g, '"--"');
content = content.replace(/\"”\"/g, '"--"');

fs.writeFileSync('admin.html', content);
console.log('Fixed quotes in admin.html');
