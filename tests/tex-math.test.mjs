// 骰娘消息里的 LaTeX 公式：找得到、换得成纯文字。
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
const source = fs.readFileSync(path.join(root, 'src/utils/texMath.ts'), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
} }).outputText;
const { findMath, texToText, stripMath } = (() => {
  const exports = {};
  vm.runInNewContext(code, { exports }, { filename: 'texMath.ts' });
  return exports;
})();

test('colored status line becomes its plain text', () => {
  assert.equal(stripMath('$\\scriptsize\\textcolor{#E5484D}{\\text{希亚 hp9/9}}$'), '希亚 hp9/9');
});

test('dice result with a bare \\boxed line keeps the surrounding prose', () => {
  const message = [
    '$\\scriptsize\\textcolor{#E5484D}{\\text{茶叶 SAN50 HP0/0 DEX0}}$',
    '司书<茶叶>使用了“60”书页。',
    '拼点结果为: ',
    '\\boxed{\\overset{\\huge\\bf\\sf D100={\\color{green} 6}/60}{【极难成功】}}',
    '要办的事情都办妥了，我们慢慢地走回去吧。',
  ].join('\n');
  assert.equal(stripMath(message), [
    '茶叶 SAN50 HP0/0 DEX0',
    '司书<茶叶>使用了“60”书页。',
    '拼点结果为: ',
    'D100=6/60 【极难成功】',
    '要办的事情都办妥了，我们慢慢地走回去吧。',
  ].join('\n'));
  const segments = findMath(message);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].display, false);
  assert.equal(segments[1].display, true);
});

test('common constructs', () => {
  assert.equal(texToText('\\frac{1}{2} \\times 3'), '1/2×3');
  assert.equal(texToText('\\sqrt{16} \\le 5'), '√16≤5');
  assert.equal(texToText('\\colorbox{yellow}{\\text{注意 事项}}'), '注意 事项');
  assert.equal(texToText('\\underset{下}{上}'), '上 下');
  assert.equal(texToText('a\\\\b'), 'a\nb');
  assert.equal(stripMath('先 $$\\textbf{粗}$$ 后 \\(x^{2}\\) 完'), '先 粗 后 x2 完');
});

test('prose that only looks like math is left alone', () => {
  for (const text of ['花了 $5 和 $10', '价格 $ 5 $', '路径 \\o/ 好耶', 'C:\\Users\\希亚', '只有一个 $ 符号']) {
    assert.equal(stripMath(text), text, text);
  }
  assert.equal(stripMath('\\boxed{没闭合'), '\\boxed{没闭合');
});
