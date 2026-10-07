const { execSync } = require('child_process');
const fs = require('fs');
const zip = 'D:/整理代码/springboot300/springboot300线上医院挂号系统.zip';
const out = 'D:/code-shop/server/scripts/.tmp-arch';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

function tryExtract(args, label) {
  try {
    execSync('tar -xf "' + zip + '" -C "' + out + '" ' + args, { stdio: 'pipe' });
    console.log(label + ' OK');
  } catch (e) {
    console.log(label + ' FAIL: ' + e.message.split('\n')[0]);
  }
}

tryExtract('db.sql', 'db.sql');
tryExtract('"xianshangyiyuanguahaoxitong/pom.xml"', 'pom.xml');

const walk = (d, dep) => {
  if (dep > 2) return;
  for (const e of fs.readdirSync(d)) {
    const f = d + '/' + e;
    const st = fs.statSync(f);
    console.log('  '.repeat(dep) + e + (st.isDirectory() ? ' [dir]' : ' ' + st.size));
    if (st.isDirectory()) walk(f, dep + 1);
  }
};
walk(out, 0);
