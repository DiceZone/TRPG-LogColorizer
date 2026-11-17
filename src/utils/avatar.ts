// 角色头像。QQ 账号用 QQ 的公开头像，其他平台（或认不出平台的账号）用名字首字配角色颜色。

/** 从日志里的账号认出 QQ 号：海豹与 Dice!Next 写作 QQ:123456，文本日志里常是裸的数字。 */
export function qqNumber(imUserId: string | undefined): string | null {
  const match = /^(?:QQ:)?([1-9]\d{4,11})$/.exec(String(imUserId ?? '').trim());
  return match ? match[1] : null;
}

/** QQ 头像地址；不是 QQ 账号时为空。 */
export function avatarUrl(imUserId: string | undefined): string {
  const qq = qqNumber(imUserId);
  return qq ? `https://q1.qlogo.cn/g?b=qq&nk=${qq}&s=100` : '';
}

/** 没有头像时显示的字：名字的第一个字（跳过开头的符号）。 */
export function avatarInitial(name: string | undefined): string {
  const chars = [...String(name ?? '').trim()];
  return chars.find((c) => /[\p{L}\p{N}]/u.test(c)) ?? chars[0] ?? '?';
}
