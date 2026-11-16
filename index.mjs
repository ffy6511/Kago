import { startServer } from './src/server.mjs';
let started;
async function launch(options) {
  // A previous Magpie host may briefly retain the port while finishing requests.
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      return await startServer({
        port: options.port ?? 3498,
        configDir: options.configDir,
        magpieDir: options.magpieDir,
      });
    } catch (error) {
      if (error.code !== 'EADDRINUSE' || attempt === 59) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
export default {
  id: 'skill-workspaces',
  async server(input, options = {}) {
    // Starting our UI must not delay other plugins in Magpie's shared host.
    started ??= launch(options).catch((error) => {
      console.error('[kago]', error.message);
      started = null;
    });
    return {};
  },
};
