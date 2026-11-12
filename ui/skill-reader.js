/* Library-style file reader/editor. Source text is written only by explicit Save. */
window.openSkillReader = async ({
  api,
  esc,
  t,
  glyph,
  source,
  workspace = false,
  project,
  path,
  anchor,
  onSaved,
  onDirty,
  onClosed,
}) => {
  const route = workspace ? 'workspace/skill/' : 'skill/',
    location = () => (workspace ? { dir: project, relative: path } : { source, path });
  let current = await api(route + 'read', location()),
    editor = null,
    pending = false;
  const reader = document.createElement('div');
  reader.className = 'editor lib-editor lib-reader lib-skillfile';
  reader.innerHTML = `<div class="ehead"><span class="lib-glyph">${glyph('file')}</span><b>${esc(current.name)}</b><button id="skill-file-select" class="lib-filepick" aria-haspopup="menu" aria-expanded="false" aria-label="${t('files')}"></button></div><div class="lib-skillbody"></div><p class="editor-error" role="alert" hidden></p><div class="bar"></div>`;
  const pick = reader.querySelector('.lib-filepick'),
    body = reader.querySelector('.lib-skillbody'),
    bar = reader.querySelector('.bar'),
    error = reader.querySelector('.editor-error');
  const lf = (text) => text.replace(/\r\n?/g, '\n');
  const dirty = () => !!editor && editor.value !== lf(current.text);
  const discard = () => !dirty() || window.confirm(t('discardFile'));
  onDirty(dirty);
  async function act(fn) {
    if (pending) return;
    pending = true;
    error.hidden = true;
    reader.setAttribute('aria-busy', 'true');
    reader.querySelectorAll('button').forEach((b) => (b.disabled = true));
    if (editor) editor.readOnly = true;
    try {
      await fn();
    } catch (e) {
      error.textContent = e.message;
      error.hidden = false;
    } finally {
      pending = false;
      reader.removeAttribute('aria-busy');
      reader.querySelectorAll('button').forEach((b) => (b.disabled = false));
      pick.disabled = current.files.length < 2;
      if (editor) editor.readOnly = false;
    }
  }
  const pathButton = () =>
    `<button type="button" class="lib-path" data-reader-action="reveal" title="${esc(current.directory)}" aria-label="${t('showFolder')}">${esc(current.path)}</button>`;
  function show() {
    editor = null;
    pick.innerHTML = `<span>${esc(current.file)}</span>${glyph('chevron')}`;
    pick.disabled = current.files.length < 2;
    const metadata = Object.entries(current.metadata)
      .map(
        ([key, value]) =>
          `<dt>${esc(key)}</dt><dd>${esc(typeof value === 'object' ? JSON.stringify(value) : value)}</dd>`,
      )
      .join('');
    body.innerHTML =
      current.html === null
        ? `<pre class="lib-md">${esc(current.text)}</pre>`
        : `<div class="lib-mdview">${metadata ? `<dl class="lib-fm">${metadata}</dl>` : ''}${current.html}</div>`;
    bar.innerHTML = `${pathButton()}<span class="grow"></span><button data-reader-action="edit">${t('edit')}</button><button data-close-modal>${t('close')}</button>`;
  }
  function edit() {
    editor = document.createElement('textarea');
    editor.className = 'lib-text lib-skilltext';
    editor.spellcheck = false;
    editor.setAttribute('aria-label', current.file);
    editor.value = lf(current.text);
    editor.addEventListener('keydown', (e) => {
      if (e.isComposing) return;
      if (e.key !== 'Escape') e.stopPropagation();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        act(save);
      }
    });
    body.replaceChildren(editor);
    bar.innerHTML = `${pathButton()}<span class="grow"></span><button data-reader-action="cancel">${t('cancel')}</button><button class="primary" data-reader-action="save">${t('save')}</button>`;
    editor.focus({ preventScroll: true });
    editor.setSelectionRange(0, 0);
  }
  async function save() {
    if (!dirty()) {
      show();
      return;
    }
    current = await api(route + 'save', {
      ...location(),
      file: current.file,
      text: editor.value,
      expectedText: current.text,
    });
    show();
    await onSaved();
    bar.querySelector('[data-reader-action="edit"]').focus({ preventScroll: true });
  }
  pick.addEventListener('click', () => {
    window.workspaceUI.popup(
      pick,
      current.files.map((file) => ({ value: file, label: file })),
      current.file,
      (file) =>
        act(async () => {
          if (file === current.file || !discard()) return;
          const next = await api(route + 'read', { ...location(), file });
          current = next;
          show();
        }),
      t('files'),
    );
  });
  reader.addEventListener('click', (event) => {
    const action = event.target.closest('[data-reader-action]')?.dataset.readerAction;
    if (action === 'edit' && !pending) edit();
    if (action === 'cancel' && !pending && discard()) {
      error.hidden = true;
      show();
      pick.focus();
    }
    if (action === 'save') act(save);
    if (action === 'reveal') act(() => api(route + 'reveal', location()));
  });
  show();
  window.workspaceUI.showModal(reader, reader.querySelector('.ehead b'), anchor, {
    canClose: () => !pending && discard(),
    onClosed: () => {
      onDirty(() => false);
      onClosed();
    },
  });
};
