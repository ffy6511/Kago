import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdir, writeFile, readFile, stat, symlink } from 'node:fs/promises';
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

test('file picker reads nested Markdown and plain text and preserves executable modes when saving', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') }),
    root = path.join(f.ssot, 'dev/sample-skill');
  await mkdir(path.join(root, 'references'));
  await writeFile(path.join(root, 'references/guide.md'), '# Guide\n\nDetails\n');
  await writeFile(path.join(root, 'run.sh'), '#!/bin/sh\necho before\n', { mode: 0o755 });
  const doc = await engine.readSkillDocument(f.ssot, 'dev/sample-skill');
  assert.deepEqual(doc.files, ['SKILL.md', 'references/guide.md', 'run.sh']);
  const guide = await engine.readSkillDocument(f.ssot, 'dev/sample-skill', 'references/guide.md');
  assert.match(guide.html, /<h1>Guide/);
  const script = await engine.readSkillDocument(f.ssot, 'dev/sample-skill', 'run.sh');
  assert.equal(script.html, null);
  const result = await engine.saveSkillDocument(
    f.ssot,
    'dev/sample-skill',
    'run.sh',
    '#!/bin/sh\necho after\n',
    script.text,
  );
  assert.equal(result.text, '#!/bin/sh\necho after\n');
  assert.equal((await stat(result.path)).mode & 0o777, 0o755);
});
test('saving refuses outside changes and invalid skill identity without overwriting source files', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') });
  const doc = await engine.readSkillDocument(f.ssot, 'dev/sample-skill');
  await assert.rejects(
    engine.saveSkillDocument(
      f.ssot,
      'dev/sample-skill',
      'SKILL.md',
      doc.text.replace('sample-skill', 'wrong-name'),
      doc.text,
    ),
    /Frontmatter name/,
  );
  assert.equal(await readFile(doc.path, 'utf8'), doc.text);
  await writeFile(doc.path, doc.text + 'External edit\n');
  await assert.rejects(
    engine.saveSkillDocument(
      f.ssot,
      'dev/sample-skill',
      'SKILL.md',
      doc.text + 'Editor change\n',
      doc.text,
    ),
    /changed outside/,
  );
  assert.equal(await readFile(doc.path, 'utf8'), doc.text + 'External edit\n');
});
test('file operations reject traversal, nested links, binary content and oversized text', async (t) => {
  const f = await fixture(t),
    engine = new Engine({ configDir: path.join(f.base, 'config') }),
    root = path.join(f.ssot, 'dev/sample-skill');
  await writeFile(path.join(root, 'binary.bin'), Buffer.from([0, 1, 2]));
  await writeFile(path.join(root, 'invalid.txt'), Buffer.from([0xff, 0xfe]));
  await writeFile(path.join(root, 'large.txt'), 'x'.repeat(1024 * 1024 + 1));
  await symlink(path.join(root, 'SKILL.md'), path.join(root, 'alias.md'));
  await symlink(f.base, path.join(root, 'escape'));
  const doc = await engine.readSkillDocument(f.ssot, 'dev/sample-skill');
  assert(!doc.files.includes('alias.md'));
  assert(!doc.files.includes('large.txt'));
  for (const file of [
    '../SKILL.md',
    '/etc/passwd',
    'escape/project/skills.manifest.yaml',
    'alias.md',
    'binary.bin',
    'invalid.txt',
    'large.txt',
  ])
    await assert.rejects(engine.readSkillDocument(f.ssot, 'dev/sample-skill', file));
  await assert.rejects(
    engine.saveSkillDocument(f.ssot, 'dev/sample-skill', '../SKILL.md', 'bad', ''),
  );
  await assert.rejects(
    engine.saveSkillDocument(
      f.ssot,
      'dev/sample-skill',
      'SKILL.md',
      'x'.repeat(1024 * 1024 + 1),
      doc.text,
    ),
  );
});
test('Library folder links expose their source files without rewriting the Library registry', async (t) => {
  const f = await fixture(t),
    magpieDir = path.join(f.base, 'magpie'),
    library = path.join(magpieDir, 'library/skills');
  await mkdir(library, { recursive: true });
  const registry = JSON.stringify({ skills: [{ name: 'sample-skill' }] });
  await writeFile(path.join(magpieDir, 'library.json'), registry);
  await symlink(path.join(f.ssot, 'dev/sample-skill'), path.join(library, 'sample-skill'));
  const engine = new Engine({ configDir: path.join(f.base, 'config'), magpieDir });
  const doc = await engine.readSkillDocument(library, 'sample-skill');
  await engine.saveSkillDocument(
    library,
    'sample-skill',
    'SKILL.md',
    doc.text + 'Saved source\n',
    doc.text,
  );
  assert.match(await readFile(doc.path, 'utf8'), /Saved source/);
  assert.equal(await readFile(path.join(magpieDir, 'library.json'), 'utf8'), registry);
});
