import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fixture } from '../support/fixtures.mjs';
import { Engine } from '../src/engine.mjs';
import { renderSkillDocument } from '../src/skill-document.mjs';

test('skill reader returns the full document and parsed frontmatter', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  const doc = await engine.readSkillDocument(f.ssot, 'dev/sample-skill');
  assert.equal(doc.metadata.name, 'sample-skill');
  assert.match(doc.html, /<p>Body/);
  assert.match(doc.text, /---/);
  await assert.rejects(engine.readSkillDocument(f.ssot, '../outside'), /valid scanned skill/);
});
test('document preview escapes active HTML and blocks remote images and script URLs', () => {
  const result = renderSkillDocument(
    '<script>alert(1)</script>\n\n![image](https://remote.example/image.png)\n\n[bad](javascript:alert(1))\n\n[local](references/test.md) [docs](https://example.com/docs)',
  );
  assert(!result.html.includes('<script>'));
  assert(!result.html.includes('<img'));
  assert(!result.html.includes('href="javascript:'));
  assert(!result.html.includes('href="references/'));
  assert.match(
    result.html,
    /href="https:\/\/example.com\/docs" target="_blank" rel="noopener noreferrer"/,
  );
});
