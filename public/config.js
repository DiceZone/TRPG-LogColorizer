// 运行时配置。用容器部署时，这个文件在启动时按环境变量重新生成（见 docker/entrypoint.sh）。
// 静态部署可以直接改这里，例如：
//   window.__LC_CONFIG__ = { theme: 'parchment', apiBase: 'https://example.com/api/dice' };
window.__LC_CONFIG__ = {};
