// 构建前检查 Node.js 版本：只接受下面这几条版本线，且不低于各自的最低版本，
// 免得用到缓存里过旧、有已知漏洞的运行时。不依赖任何第三方包。
//   24：EdgeOne Pages 等托管平台目前提供的最高版本线（.node-version 写的就是它）
//   26：本地开发与 Docker 镜像
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const parse = (value) => /^(?:v)?(\d+)\.(\d+)\.(\d+)$/.exec(String(value).trim())?.slice(1).map(Number);

/** version 是否属于 minimum 那条版本线，且不低于 minimum。 */
export function supportsNode(version, minimum) {
  const actual = parse(version);
  const floor = parse(minimum);
  if (!actual || !floor || actual[0] !== floor[0]) return false;
  return actual[1] > floor[1] || (actual[1] === floor[1] && actual[2] >= floor[2]);
}

/** 各条版本线的最低版本。.node-version 里的版本也算一条。 */
export function minimums() {
  const pinned = readFileSync(new URL('../.node-version', import.meta.url), 'utf8').trim();
  return [...new Set([pinned, '24.18.0', '26.12.1'])];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const floors = minimums();
  const floor = floors.find((minimum) => supportsNode(process.versions.node, minimum));
  if (!floor) {
    throw new Error(`Node.js ${process.version} is unsupported: require one of ${floors.map((v) => `>=${v}`).join(', ')} within the same major release line.`);
  }
  console.log(`Node.js ${process.version}; minimum secure version ${floor}`);
}
