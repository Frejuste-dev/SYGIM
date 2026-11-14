
const fs = require('fs');
const path = require('path');
const dir = './database';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js') || f.endsWith('.sql'));
let changedFiles = 0;

files.forEach(f => {
  const p = path.join(dir, f);
  let content = fs.readFileSync(p, 'utf8');
  const orig = content;
  
  content = content.replace(/\u00E2\u20AC\u201C/g, '-').replace(/\u00E2\u20AC\u201D/g, '-');
  content = content.replace(/\u2013/g, '-').replace(/\u2014/g, '-'); 
  
  if (content !== orig) {
    fs.writeFileSync(p, content, 'utf8');
    changedFiles++;
    console.log('Fixed:', f);
  }
});
console.log('Changed files:', changedFiles);

