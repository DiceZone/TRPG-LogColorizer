// 主题清单的校验，与导入主题样式时的地址处理。
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function load(relative) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: () => ({}) }, { filename: relative });
  return exports;
}
const { parseManifest } = load('src/theme/types.ts');
const { rewriteCss } = load('src/theme/css.ts');

const minimal = { engine: 1, id: 'sample', name: '示例' };

test('最小的清单可以通过', () => {
  const manifest = parseManifest(minimal);
  assert.equal(manifest.id, 'sample');
  assert.equal(manifest.layout, undefined);
});

test('随站主题的清单都合法', () => {
  const dir = path.join(root, 'public/themes');
  const ids = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  assert.ok(ids.includes('default'));
  for (const id of ids) {
    const manifest = parseManifest(JSON.parse(fs.readFileSync(path.join(dir, id, 'theme.json'), 'utf8')));
    assert.equal(manifest.id, id, `${id} 的目录名须与清单里的 id 相同`);
  }
});

const invalid = [
  ['engine 不对', { ...minimal, engine: 2 }],
  ['id 含大写', { ...minimal, id: 'Sample' }],
  ['缺 name', { engine: 1, id: 'x' }],
  ['不认识的区块', { ...minimal, sections: ['editor', 'ads'] }],
  ['不认识的版面', { ...minimal, layout: 'grid' }],
  ['不认识的模式', { ...minimal, modes: ['sepia'] }],
  ['变量名不合法', { ...minimal, tokens: { light: { color: 'red' } } }],
  ['变量值想跳出声明', { ...minimal, tokens: { light: { '--lc-bg': 'red; } body { display: none' } } }],
  ['链接不是 http', { ...minimal, brand: { links: [{ label: 'x', url: 'javascript:alert(1)' }] } }],
  ['色板格式不对', { ...minimal, palette: ['red'] }],
];
for (const [name, manifest] of invalid) {
  test(`清单不合法时拒绝：${name}`, () => {
    assert.throws(() => parseManifest(manifest), /主题清单不合法/);
  });
}

const resolve = (p) => `/themes/sample/${p}`;

test('样式里的相对地址换成主题目录下的地址', () => {
  const css = rewriteCss('.a { background: url(assets/bg.png); } .b { background: url("./c.svg"); }', resolve);
  assert.match(css, /url\("\/themes\/sample\/assets\/bg\.png"\)/);
  assert.match(css, /url\("\/themes\/sample\/c\.svg"\)/);
});

test('外部地址、站内绝对地址与内嵌数据原样保留', () => {
  const css = rewriteCss(
    '.a { background: url("https://cdn.example/a.png"); } .b { mask: url(data:image/png;base64,AAAA); }'
    + ' .c { background: url(/static/x.png); } .d { fill: url(#grad); }', resolve);
  assert.match(css, /https:\/\/cdn\.example\/a\.png/);
  assert.match(css, /data:image\/png;base64,AAAA/);
  assert.match(css, /url\("\/static\/x\.png"\)/);
  assert.match(css, /url\("#grad"\)/);
});

const { qqNumber, avatarUrl, avatarInitial } = load('src/utils/avatar.ts');

test('头像：认得出 QQ 号', () => {
  assert.equal(qqNumber('QQ:123456789'), '123456789');
  assert.equal(qqNumber('123456789'), '123456789');
  assert.match(avatarUrl('QQ:123456789'), /nk=123456789/);
});

test('头像：别的平台、示例账号与过短的号码不请求头像', () => {
  for (const id of ['Demo:1001', 'Discord:123456789', 'QQ-Group:123456', '1234', '', undefined]) {
    assert.equal(avatarUrl(id), '', String(id));
  }
});

test('头像：没有图片时取名字的第一个字', () => {
  assert.equal(avatarInitial('林晚'), '林');
  assert.equal(avatarInitial('「沈砚」'), '沈');
  assert.equal(avatarInitial(''), '?');
});
