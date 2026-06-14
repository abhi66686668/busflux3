const fs = require('fs');
const path = './frontend';

fs.readdirSync(path).forEach(f => {
  if (!f.endsWith('.html') && !f.endsWith('.js')) return;
  const filePath = path + '/' + f;
  let c = fs.readFileSync(filePath, 'utf8');
  const init = c;

  // Replace ${API.replace('/api', '')}/${xyz.replace(/\\/g, '/')}
  // and ${API.replace('/api', '')}/${xyz.replace(/\\/g, '/')}
  c = c.replace(/\$\{API\.replace\('\/api', ''\)\}\/\$\{([a-zA-Z0-9_\.]+)\.replace\(\/\\\\\/g,\s*'\/'\)\}/g, '${window.getImageUrl($1)}');
  c = c.replace(/\$\{API\.replace\('\/api', ''\)\}\/\$\{([a-zA-Z0-9_\.]+)\.replace\(\/\\\\\/g,\s*'\/'\)\}/g, '${window.getImageUrl($1)}');
  
  // Replace /${xyz.replace(/\\/g, '/')}
  c = c.replace(/\/\$\{([a-zA-Z0-9_\.]+)\.replace\(\/\\\\\/g,\s*'\/'\)\}/g, '${window.getImageUrl($1)}');
  
  // Replace /${xyz.replace(/\\/g,'/')}
  c = c.replace(/\/\$\{([a-zA-Z0-9_\.]+)\.replace\(\/\\\\\/g,'\/'\)\}/g, '${window.getImageUrl($1)}');

  if (c !== init) {
    fs.writeFileSync(filePath, c);
    console.log('Updated ' + f);
  }
});
