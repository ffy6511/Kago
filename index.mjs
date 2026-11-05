import { startServer } from './src/server.mjs';
let started;
export default {
  id: 'skill-workspaces',
  async server(input, options = {}) {
    started ??= startServer({ port: options.port ?? 3498, configDir: options.configDir });
    await started;
    return {};
  }
};
