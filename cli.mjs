#!/usr/bin/env node
import { startServer } from './src/server.mjs';
if (process.argv[2] === 'serve') {
  const service = await startServer({ port: Number(process.env.SKILL_WORKSPACES_PORT || 3498) });
  console.log(`Skill Workspaces: ${service.url}`);
} else console.log('Usage: skill-workspaces serve');
