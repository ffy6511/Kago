#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { Engine } from './src/engine.mjs';
import { startServer } from './src/server.mjs';
const help = `Kago
  scan <source>                     List categorized skills
  source add|remove <source>         Register a local source
  project add <repo> [--manifest file]
  project remove <repo> [--keep|--clean]
  plan <repo> [--manifest file]       Preview without writing
  apply <repo> [--manifest file]      Apply a validated manifest
  sync                              Apply all registered projects
  status                            Show registration and last results
  serve [--port 3498]                Start the local UI
Options: --config-dir <dir>, --magpie-dir <dir>, --help
`;
try {
  const {
    values,
    positionals: [command, ...args],
  } = parseArgs({
    allowPositionals: true,
    options: {
      'config-dir': { type: 'string' },
      'magpie-dir': { type: 'string' },
      manifest: { type: 'string' },
      port: { type: 'string' },
      keep: { type: 'boolean' },
      clean: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  });
  if (values.help || !command) {
    console.log(help);
    process.exit(0);
  }
  const engine = new Engine({ configDir: values['config-dir'], magpieDir: values['magpie-dir'] });
  const required = (value) => {
    if (!value) throw new Error('Missing path argument; use --help');
    return value;
  };
  let result;
  switch (command) {
    case 'scan':
      result = await engine.scan(required(args[0]));
      break;
    case 'source':
      if (args[0] === 'add') result = await engine.registerSource(required(args[1]));
      else if (args[0] === 'remove') result = await engine.removeSource(required(args[1]));
      else throw new Error('Expected source add or remove');
      break;
    case 'project':
      if (args[0] === 'add')
        result = await engine.registerProject(required(args[1]), values.manifest);
      else if (args[0] === 'remove')
        result = await engine.removeProject(required(args[1]), { keep: !values.clean });
      else throw new Error('Expected project add or remove');
      break;
    case 'plan':
      result = await engine.plan(required(args[0]), { manifestPath: values.manifest });
      break;
    case 'apply':
      result = await engine.apply(required(args[0]), { manifestPath: values.manifest });
      break;
    case 'sync':
      result = await engine.syncAll();
      break;
    case 'status':
      result = await engine.status();
      break;
    case 'serve': {
      const service = await startServer({
        port: Number(values.port || process.env.SKILL_WORKSPACES_PORT || 3498),
        configDir: values['config-dir'],
        magpieDir: values['magpie-dir'],
      });
      console.log(`Kago: ${service.url}`);
      break;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
  if (result) {
    console.log(JSON.stringify(result, null, 2));
    if (result.ok === false) process.exitCode = 2;
  }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
