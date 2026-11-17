// 把一个主题目录打成 zip，方便分享给别的站长：对方解压进自己站点的 themes/ 目录即可。
//   pnpm theme:pack public/themes/parchment          → parchment.zip
//   pnpm theme:pack path/to/my-theme out/my.zip
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join, relative, resolve } from 'node:path';
import { zipSync } from 'fflate';

const [dirArg, outArg] = process.argv.slice(2);
if (!dirArg) {
  console.error('用法：pnpm theme:pack <主题目录> [输出文件]');
  process.exit(1);
}

const dir = resolve(dirArg);
let manifest;
try {
  manifest = JSON.parse(readFileSync(join(dir, 'theme.json'), 'utf8'));
} catch (err) {
  console.error(`读不到 ${join(dir, 'theme.json')}：${err.message}`);
  process.exit(1);
}
// 完整的检查在页面载入主题时做；这里先挡住最常见的错误。
if (manifest.engine !== 1 || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(manifest.id || '') || !manifest.name) {
  console.error('theme.json 须有 engine: 1、合法的 id（小写字母、数字、短横线）与 name。');
  process.exit(1);
}

// 主题只用得到这些类型的文件，其余的（草稿、源文件之类）不打进去。
const ALLOWED = /\.(json|css|png|jpe?g|gif|webp|svg|woff2?|ttf|otf)$/i;
const files = {};
const skipped = [];
const walk = (current) => {
  for (const name of readdirSync(current)) {
    const full = join(current, name);
    const path = relative(dir, full).split('\\').join('/');
    if (statSync(full).isDirectory()) walk(full);
    else if (ALLOWED.test(name)) files[`${manifest.id}/${path}`] = new Uint8Array(readFileSync(full));
    else skipped.push(path);
  }
};
walk(dir);

const out = resolve(outArg || `${manifest.id}.zip`);
const data = zipSync(files, { level: 9 });
writeFileSync(out, data);
console.log(`已打包「${manifest.name}」：${Object.keys(files).length} 个文件，${(data.length / 1024).toFixed(1)} KB → ${out}`);
if (skipped.length) console.log(`未打包（类型不支持）：${skipped.join('、')}`);
console.log(`目录名须与 id 相同才能放进站点的 themes/ 目录：${basename(dir) === manifest.id ? '是' : `否（应为 ${manifest.id}）`}`);
