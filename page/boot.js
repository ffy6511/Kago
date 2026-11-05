(async () => {
  const theme = await window.magpie?.ready;
  const options = (await window.magpie?.options?.get?.()) || {};
  const port = Number(options.port || 3498);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid service port');
  const service = window.magpie?.service;
  const target =
    typeof service === 'string' && /^https?:\/\//.test(service)
      ? service
      : `http://127.0.0.1:${port}/`;
  const url = new URL(target);
  url.searchParams.set('theme', theme?.dark ? 'dark' : 'light');
  if (theme?.lang) url.searchParams.set('lang', theme.lang);
  setTimeout(() => {
    document.getElementById('status').textContent =
      '服务尚未连接，请确认插件已启用后重试。 / Service not connected. Enable the plugin and retry.';
    document.getElementById('retry').hidden = false;
  }, 5000);
  document.getElementById('retry').onclick = () => location.reload();
  location.replace(url.href);
})().catch((err) => {
  document.getElementById('status').textContent = err.message;
});
