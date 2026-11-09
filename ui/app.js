(async () => {
  'use strict';
  const $ = (s) => document.querySelector(s),
    esc = (v) =>
      String(v ?? '').replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
      );
  const token = $('meta[name="page-token"]').content;
  let lang = new URLSearchParams(location.search).get('lang')?.startsWith('en') ? 'en' : 'zh';
  const words = {
    addProject: ['添加项目', 'Add project'],
    addSource: ['添加来源', 'Add source'],
    removeSource: ['移除来源', 'Remove source'],
    cancel: ['取消', 'Cancel'],
    more: ['更多', 'More'],
    moreAgents: ['更多 agent', 'More agents'],
    selectAll: ['全选', 'Select all'],
    resetSelection: ['还原未保存的更改', 'Revert unsaved changes'],
    fewerAgents: ['收起', 'Fewer agents'],
    close: ['关闭', 'Close'],
    edit: ['编辑', 'Edit'],
    files: ['文件', 'Files'],
    showFolder: ['在文件管理器中打开文件夹', 'Open folder in file manager'],
    discardFile: ['放弃尚未保存的文件修改？', 'Discard unsaved file changes?'],
    resetAgents: ['恢复项目默认', 'Reset to project defaults'],
    projects: ['项目', 'Project'],
    add: ['添加', 'Add'],
    sourcePath: ['Skill 库根目录', 'Skill source root'],
    projectPath: ['Git 项目根目录', 'Git repository root'],
    manifestPath: ['清单路径', 'Manifest path'],
    manifestPathHint: [
      '清单路径，默认 skills.manifest.yaml',
      'Manifest path, default skills.manifest.yaml',
    ],
    library: ['读取 Magpie Library', 'Read Magpie Library'],
    sync: ['同步全部项目', 'Sync all projects'],
    skills: ['技能', 'Skills'],
    manifest: ['清单', 'Manifest'],
    plan: ['变更', 'Changes'],
    save: ['保存', 'Save'],
    preview: ['预览', 'Preview'],
    apply: ['同步', 'Sync'],
    open: ['打开文件夹', 'Open folder'],
    remove: ['取消托管', 'Unregister'],
    defaults: ['默认目标 agent', 'Default agents'],
    method: ['部署方式', 'Deployment method'],
    link: ['软链', 'Link'],
    copy: ['复制', 'Copy'],
    search: ['搜索技能…', 'Search skills…'],
    all: ['全部', 'All'],
    targets: ['项目级 agent', 'Project agents'],
    inherit: ['使用项目默认', 'Use project defaults'],
    chooseProject: ['选择项目', 'Choose a project'],
    noSkills: ['没有匹配的 Skill', 'No matching skills'],
    source: ['来源', 'Source'],
    unsaved: ['未保存', 'Unsaved'],
    saved: ['已保存', 'Saved'],
    existing: ['已存在', 'Exists'],
    willRemove: ['将移除', 'Will remove'],
    externalDeployment: [
      '非本插件托管的部署不会自动删除',
      'Deployments not owned by this plugin are not removed automatically',
    ],
    noManifest: ['未保存', 'Unsaved'],
    consistent: ['已同步', 'Synced'],
    pending: ['待同步', 'Pending'],
    conflicts: ['存在冲突', 'Conflicts found'],
    keep: ['保留部署文件后取消托管', 'Unregister and keep deployed files'],
    reload: ['刷新', 'Refresh'],
    adopt: ['接管', 'Adopt'],
    recorded: ['记录', 'Recorded'],
    current: ['当前', 'Current'],
  };
  const t = (k) => words[k]?.[lang === 'zh' ? 0 : 1] || k,
    leaf = (p) => p.split(/[\\/]/).filter(Boolean).at(-1) || p;
  const agentLabels = {
    cursor: 'Cursor',
    codex: 'Codex',
    opencode: 'OpenCode',
    gemini: 'Gemini CLI',
    claude: 'Claude Code',
    pi: 'Pi',
    copilot: 'Copilot',
    agy: 'Antigravity',
    kimi: 'Kimi',
    goose: 'Goose',
    grok: 'Grok',
    droid: 'Droid',
    cline: 'Cline',
    dsh: 'DSH',
    qoder: 'Qoder',
    'qoder-cn': 'Qoder CN',
    codebuddy: 'CodeBuddy',
    commandcode: 'Command Code',
  };
  let state,
    project = null,
    source = null,
    scan = null,
    deployments = { skills: [], problems: [] },
    detail = null,
    selectionBaseline = null,
    entries = [],
    defaults = ['cursor'],
    method = 'link',
    text = '',
    savedText = '',
    tab = 'skills',
    category = '',
    query = '',
    plan = null,
    dirty = false,
    busy = false,
    sourceForm = false,
    projectForm = false,
    moreAgentsOpen = false,
    draftVersion = 0,
    manual = false;
  let noticeTimer,
    skillEditorDirty = () => false;
  function notice(message, error = false) {
    const el = $('#notice');
    clearTimeout(noticeTimer);
    el.textContent = message;
    el.className = error ? 'error' : '';
    el.hidden = false;
    noticeTimer = setTimeout(() => (el.hidden = true), error ? 14000 : 4500);
  }
  async function api(route, data) {
    const res = await fetch('./api/' + route, {
      method: data === undefined ? 'GET' : 'POST',
      headers: { 'x-skill-workspaces-token': token, 'content-type': 'application/json' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || res.statusText);
    return body;
  }
  async function run(fn) {
    if (busy) return;
    busy = true;
    document.body.classList.add('busy');
    try {
      await fn();
    } catch (e) {
      notice(e.message, true);
    } finally {
      busy = false;
      document.body.classList.remove('busy');
    }
  }
  async function refresh() {
    state = await api('state');
  }
  const agentIcons = {
    cursor: 'cursor',
    codex: 'codex-color',
    opencode: 'opencode',
    gemini: 'geminicli-color',
    claude: 'claudecode-color',
    pi: 'pi',
    copilot: 'githubcopilot',
    agy: 'antigravity-color',
    kimi: 'kimi',
    goose: 'goose',
    grok: 'grok',
    droid: 'factory',
    cline: 'cline',
    dsh: 'deepseek-color',
    qoder: 'qoder',
    'qoder-cn': 'qoder',
    codebuddy: 'codebuddy-color',
    commandcode: 'commandcode',
  };
  const primaryAgents = ['cursor', 'codex', 'opencode', 'gemini', 'claude'];
  const glyphs = {
    plus: 'M12 5v14M5 12h14',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    refresh: 'M20 7v5h-5M4 17v-5h5M6.1 7a7 7 0 0 1 11.6-2L20 8M4 16l2.3 3A7 7 0 0 0 18 17',
    folder: 'M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
    reset: 'M4 5v5h5M4.5 10a8 8 0 1 1 .8 7',
    chevron: 'm8 10 4 4 4-4',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6 M8 13h8 M8 17h6',
  };
  const glyph = (name) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${glyphs[name]}"/></svg>`;
  function iconButton(action, label, icon) {
    return `<button type="button" class="icon-button" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${glyph(icon)}</button>`;
  }
  function chips(agents, current, action, extra = '', compact = false) {
    return agents
      .map((a) => {
        const name = agentIcons[a],
          url = `./vendor/magpie/${name}.svg`;
        const icon = name.endsWith('-color')
          ? `<img src="${url}" alt="" draggable="false">`
          : `<span class="mask" style="--i:url('${url}')"></span>`;
        return `<button type="button" class="lib-ag ${current.includes(a) ? 'on' : ''}" aria-pressed="${current.includes(a)}" aria-label="${esc(agentLabels[a] || a)}" title="${esc(agentLabels[a] || a)}" data-action="${action}" data-agent="${esc(a)}" ${extra}><span class="ic" aria-hidden="true">${icon}</span>${compact ? '' : `<span>${esc(agentLabels[a] || a)}</span>`}</button>`;
      })
      .join('');
  }
  function availableSources() {
    return [...new Set([...state.sources.map((s) => s.dir), ...(source ? [source] : [])])];
  }
  function sourceTitle(dir) {
    if (dir === state.library.dir) return 'Magpie Library';
    return leaf(dir) === 'skills' ? leaf(dir.replace(/[\\/]skills\/?$/, '')) : leaf(dir);
  }
  function issue(error, relative = '', conflict = null) {
    const text = typeof error === 'string' ? error : String(error?.message ?? error ?? '');
    const parentLink = text.includes('Deployment parent is a symlink');
    const titles = {
      'link-target': ['链接指向已被修改', 'Link target changed'],
      'link-replaced': ['部署位置已不是软链接', 'Deployed path is no longer a link'],
      'copy-content': ['部署内容被本地修改', 'Deployed copy was edited'],
      'copy-modes': ['部署文件权限被修改', 'Deployed copy permissions changed'],
      'copy-replaced': ['部署位置已不是复制目录', 'Deployed path is no longer a copied folder'],
      copy: ['部署内容与记录不一致', 'Deployed content differs from the record'],
      unmanaged: ['已有内容不属于本插件', 'Existing target is not owned'],
    };
    const title = parentLink
      ? lang === 'zh'
        ? '技能目录是整目录软链，迁移后才能同步。'
        : 'Migrate the linked skills folder before syncing.'
      : titles[conflict?.kind]?.[lang === 'zh' ? 0 : 1] || text;
    const lines = [];
    if (conflict?.kind === 'copy-modes')
      lines.push(
        `<code>${esc(lang === 'zh' ? '内容一致，只有文件权限位不同。' : 'Content is identical; only permission bits differ.')}</code>`,
      );
    else {
      if (conflict?.expected)
        lines.push(`<code>${t('recorded')}: ${esc(conflict.expected)}</code>`);
      if (conflict?.kind === 'link-replaced')
        lines.push(
          `<code>${t('current')}: ${esc(lang === 'zh' ? '不是软链接' : 'not a link')}</code>`,
        );
      else if (conflict?.actual)
        lines.push(`<code>${t('current')}: ${esc(conflict.actual)}</code>`);
    }
    return `<details class="issue"><summary>${esc(title)}</summary><code>${esc(relative ? relative + ': ' : '')}${esc(text)}</code>${lines.join('')}</details>`;
  }
  function projectStatus() {
    return dirty
      ? t('unsaved')
      : !detail?.exists
        ? t('noManifest')
        : plan
          ? !plan.ok
            ? t('conflicts')
            : plan.operations.every((o) => o.action === 'unchanged' && !o.adopted)
              ? t('consistent')
              : t('pending')
          : t('saved');
  }
  function selectionChanged() {
    return (
      !!selectionBaseline &&
      selectionBaseline.project === project?.dir &&
      (text !== selectionBaseline.text || source !== selectionBaseline.source)
    );
  }
  function updateResetButton() {
    const button = $('[data-action="reset-selection"]');
    if (button) button.disabled = !selectionChanged();
  }
  function rememberSelection() {
    selectionBaseline = structuredClone({
      project: project.dir,
      source,
      entries,
      defaults,
      method,
      text,
      dirty,
      plan,
    });
    updateResetButton();
  }
  async function resetSelection() {
    if (!selectionChanged()) return;
    const baseline = structuredClone(selectionBaseline),
      changedSource = source !== baseline.source;
    if (changedSource) {
      scan = await api('scan', { dir: baseline.source });
      category = '';
      query = '';
    }
    source = baseline.source;
    entries = baseline.entries;
    defaults = baseline.defaults;
    method = baseline.method;
    text = baseline.text;
    dirty = baseline.dirty;
    plan = baseline.plan;
    manual = false;
    if (changedSource) {
      await loadDeployments();
      render();
    } else updateSkillSelection();
    $('#category-all')?.focus({ preventScroll: true });
  }
  function render() {
    window.workspaceUI.closeMenu();
    const status = projectStatus();
    $('#app').innerHTML = `<main class="workspace">
      <header class="workspace-header">
        <div class="project-picker">${glyph('folder')}<button id="project-select" class="picker project-choice" data-action="project-picker" aria-haspopup="menu" aria-expanded="false" aria-label="${t('projects')}" title="${esc(project?.dir || '')}"><span>${esc(project ? leaf(project.dir) : t('chooseProject'))}</span>${glyph('chevron')}</button>${iconButton('project-form', t('addProject'), 'plus')}</div>
        <div class="actions">
          ${project ? `<span id="project-status" class="state ${plan && !plan.ok ? 'error' : ''}">${status}</span><button data-action="save" ${!dirty && detail?.exists ? 'disabled' : ''}>${t('save')}</button><button data-action="preview" ${!text.trim() ? 'disabled' : ''}>${t('preview')}</button><button class="primary" data-action="apply" ${dirty || !detail?.exists || !plan?.ok ? 'disabled' : ''}>${t('apply')}</button>` : ''}
          <details class="menu"><summary class="icon-button" aria-label="${t('more')}" title="${t('more')}">${glyph('more')}</summary><div class="menu-items">
            <button data-action="source-form">${t('addSource')}</button><button data-action="library">${t('library')}</button>
            <button data-action="refresh">${t('reload')}</button><button data-action="sync">${t('sync')}</button>
            ${source && state.sources.some((s) => s.dir === source) ? `<button data-action="source-remove" data-dir="${esc(source)}">${t('removeSource')}</button>` : ''}
            ${project ? `<hr><button data-action="reveal">${t('open')}</button><button class="danger" data-action="project-remove">${t('remove')}</button>` : ''}
          </div></details>
        </div>
      </header>
      ${projectForm ? `<form id="project-add" class="add-form"><input name="dir" aria-label="${t('projectPath')}" placeholder="${t('projectPath')}" required><input name="manifestPath" aria-label="${t('manifestPath')}" placeholder="${t('manifestPathHint')}"><button type="button" data-action="submit-form">${t('add')}</button>${iconButton('project-form', t('cancel'), 'plus')}</form>` : ''}
      ${sourceForm ? `<form id="source-add" class="add-form"><input name="dir" aria-label="${t('sourcePath')}" placeholder="${t('sourcePath')}" required><button type="button" data-action="submit-form">${t('add')}</button>${iconButton('source-form', t('cancel'), 'plus')}</form>` : ''}
      ${(detail?.conflicts || []).map((c) => issue(c.error ?? c, '', c.conflict)).join('')}${detail?.parseError ? issue(detail.parseError) : ''}
      ${
        project
          ? `<div class="project-settings"><div class="lib-agents" role="group" aria-label="${t('defaults')}">${chips(primaryAgents, defaults, 'default-agent')}<button class="more-agents-button" data-action="more-agents" aria-expanded="${moreAgentsOpen}" aria-controls="extra-agents"><span>${t(moreAgentsOpen ? 'fewerAgents' : 'moreAgents')}</span>${glyph('chevron')}</button></div><div class="seg" role="group" aria-label="${t('method')}">${['link', 'copy'].map((m) => `<button data-action="method" data-value="${m}" aria-pressed="${m === method}">${t(m)}</button>`).join('')}</div></div><div id="extra-agents" class="extra-agents ${moreAgentsOpen ? 'expanded' : ''}" ${moreAgentsOpen ? '' : 'inert'}><div><div class="lib-agents" role="group" aria-label="${t('moreAgents')}">${chips(
              Object.keys(state.agents).filter((a) => !primaryAgents.includes(a)),
              defaults,
              'default-agent',
            )}</div></div></div>
      <nav class="view-tabs" aria-label="Workspace views">${['skills', 'manifest', 'plan'].map((k) => `<button data-action="tab" data-value="${k}" aria-selected="${tab === k}">${t(k)}${k === 'skills' && entries.length ? ` <span class="count">${entries.length}</span>` : ''}</button>`).join('')}</nav>`
          : ''
      }
      <section class="workspace-view">${project && tab === 'manifest' ? renderManifest() : project && tab === 'plan' ? renderPlan() : renderSkills()}</section>
    </main>`;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    const all = $('#category-all');
    if (all) {
      const scope = categorySkills(),
        count = scope.filter(isSelected).length;
      all.checked = scope.length > 0 && count === scope.length;
      all.indeterminate = count > 0 && count < scope.length;
    }
  }
  const categorySkills = () =>
    (scan?.skills || []).filter((s) => !category || s.category === category);
  const isSelected = (s) => entries.some((e) => e.name === s.name && e.path === s.path);
  function renderSkills() {
    if (!source)
      return `<div class="empty"><button data-action="source-form">${glyph('plus')}${t('addSource')}</button><button data-action="library">${t('library')}</button></div>`;
    const list = (scan?.skills || []).filter(
      (s) =>
        (!category || s.category === category) &&
        (!query || `${s.name} ${s.description}`.toLowerCase().includes(query.toLowerCase())),
    );
    const categories = [...new Set((scan?.skills || []).map((s) => s.category))];
    return `<div class="source-toolbar"><button id="source-select" class="picker source-choice" data-action="source-picker" aria-haspopup="menu" aria-expanded="false" aria-label="${t('source')}" title="${esc(source)}"><span>${esc(sourceTitle(source))}</span>${glyph('chevron')}</button><input type="search" id="search" aria-label="${t('search')}" placeholder="${t('search')}" value="${esc(query)}"></div>
      <div class="category-toolbar"><div class="category-tabs"><button data-action="category" data-value="" aria-selected="${!category}">${t('all')}</button>${categories.map((c) => `<button data-action="category" data-value="${esc(c)}" aria-selected="${category === c}">${esc(c)}</button>`).join('')}</div>${project ? `<div class="selection-actions"><button type="button" class="icon-button reset-selection" data-action="reset-selection" aria-label="${t('resetSelection')}" title="${t('resetSelection')}" ${selectionChanged() ? '' : 'disabled'}>${glyph('reset')}</button><label class="category-all"><input id="category-all" type="checkbox" ${!categorySkills().length ? 'disabled' : ''}><span>${t('selectAll')}</span></label></div>` : ''}</div>
      ${[...(scan?.problems || []), ...deployments.problems].map((p) => issue(p.error, p.path)).join('')}
      <div class="skills">${
        list
          .map((s) => {
            const e = entries.find((e) => e.name === s.name && e.path === s.path);
            return `<div class="skill-row ${e ? 'selected' : ''}"><input type="checkbox" aria-label="${esc(s.name)}" data-skill="${esc(s.path)}" ${e ? 'checked' : ''} ${!project ? 'disabled' : ''}><button class="skill-info" data-action="skill-preview" data-path="${esc(s.path)}" title="${esc(s.description)}">${esc(s.name)}</button>${deploymentTag(s, e)}${e ? skillAgents(e) : ''}</div>`;
          })
          .join('') || `<p class="empty">${t('noSkills')}</p>`
      }</div>`;
  }
  function skillAgents(e) {
    return `<div class="skill-agents lib-agents" role="group" aria-label="${esc(e.name)} ${t('targets')}">${chips([...new Set([...primaryAgents, ...(e.agents ?? defaults).filter((a) => !primaryAgents.includes(a))])], e.agents ?? defaults, 'skill-agent', `data-name="${esc(e.name)}"`, true)}<button class="icon-button inherit ${e.agents === undefined ? 'inherited' : ''}" data-action="inherit" data-name="${esc(e.name)}" aria-label="${t('inherit')}" title="${e.agents === undefined ? t('inherit') : t('resetAgents')}">${glyph('reset')}</button></div>`;
  }
  function updateSkillSelection() {
    document.querySelectorAll('.skill-row').forEach((row) => {
      const input = row.querySelector('[data-skill]');
      const entry = entries.find((e) => e.path === input.dataset.skill);
      input.checked = !!entry;
      row.classList.toggle('selected', !!entry);
      let group = row.querySelector('.skill-agents');
      if (entry && !group) {
        row.insertAdjacentHTML('beforeend', skillAgents(entry));
        group = row.querySelector('.skill-agents');
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
          group.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180 });
      }
      if (entry && group) {
        group.classList.remove('leaving');
        group.inert = false;
      }
      if (!entry && group) {
        group.classList.add('leaving');
        group.inert = true;
        const remove = () => {
          if (group.classList.contains('leaving')) group.remove();
        };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
        else setTimeout(remove, 200);
      }
    });
    const all = $('#category-all'),
      scope = categorySkills(),
      count = scope.filter(isSelected).length;
    if (all) {
      all.checked = scope.length > 0 && count === scope.length;
      all.indeterminate = count > 0 && count < scope.length;
    }
    updateAgentControls();
  }
  function deploymentTag(skill, entry) {
    const found = deployments.skills.find((s) => s.name === skill.name && s.path === skill.path);
    if (!found) return '';
    const wanted = entry && (entry.agents ?? defaults).length > 0;
    const paths = found.targets.map((target) => target.relative).join('\n');
    const external = found.targets.some((target) => !target.managed);
    return `<span class="deployment-tag ${wanted ? 'existing' : 'removing'}" title="${esc(paths + (external ? '\n' + t('externalDeployment') : ''))}" role="status">${t(wanted ? 'existing' : 'willRemove')}</span>`;
  }
  function updateDeploymentTags() {
    document.querySelectorAll('.skill-row').forEach((row) => {
      const skill = scan.skills.find(
        (s) => s.path === row.querySelector('[data-skill]').dataset.skill,
      );
      const entry = entries.find((e) => e.name === skill.name && e.path === skill.path);
      const tag = row.querySelector('.deployment-tag');
      const wanted = entry && (entry.agents ?? defaults).length > 0;
      if (tag) {
        tag.classList.toggle('existing', !!wanted);
        tag.classList.toggle('removing', !wanted);
        tag.textContent = t(wanted ? 'existing' : 'willRemove');
      }
    });
  }
  async function loadDeployments({ seed = false, seedManaged = false } = {}) {
    try {
      deployments =
        project && source
          ? await api('deployments', { dir: project.dir, source })
          : { skills: [], problems: [] };
    } catch (error) {
      deployments = { skills: [], problems: [{ path: project.dir, error: error.message }] };
    }
    let added = false;
    if (seed)
      for (const found of deployments.skills) {
        if (entries.some((e) => e.name === found.name)) continue;
        // An omission from a saved manifest of an owned output is already a
        // persisted removal request. Do not silently undo it on reopening.
        if (!seedManaged && found.targets.some((target) => target.managed)) continue;
        const folders = new Set(
          found.targets.map((target) => target.relative.slice(0, target.relative.lastIndexOf('/'))),
        );
        const agents = defaults.filter((agent) => folders.has(state.agents[agent]));
        for (const target of found.targets)
          if (!agents.some((agent) => target.agents.includes(agent))) agents.push(target.agents[0]);
        const entry = { name: found.name, path: found.path };
        if (agents.length !== defaults.length || agents.some((agent) => !defaults.includes(agent)))
          entry.agents = agents;
        entries.push(entry);
        added = true;
      }
    return added;
  }
  function renderManifest() {
    return `<textarea id="manifest-editor" class="manifest-editor" spellcheck="false" aria-label="skills.manifest.yaml">${esc(text)}</textarea>`;
  }
  function renderPlan() {
    if (!plan)
      return `<div class="empty"><button data-action="preview">${t('preview')}</button></div>`;
    const labels = {
      create: ['新增', 'Create'],
      update: ['更新', 'Update'],
      remove: ['移除', 'Remove'],
      forget: ['清除记录', 'Forget'],
      unchanged: ['一致', 'Unchanged'],
      conflict: ['冲突', 'Conflict'],
    };
    const extraProblems = plan.problems.filter(
      (p) => !plan.operations.some((o) => o.relative === p.relative && o.action === 'conflict'),
    );
    return `${extraProblems.map((p) => issue(p.error, p.relative, p.conflict)).join('')}<div class="plan">${plan.operations.map((o) => `<div class="plan-row ${o.action}"><span class="operation">${o.adopted ? t('adopt') : labels[o.action]?.[lang === 'zh' ? 0 : 1]}</span><div><code>${esc(o.relative)}</code>${o.error ? issue(o.error, '', o.conflict) : ''}</div></div>`).join('') || `<p class="empty">${t('consistent')}</p>`}</div>`;
  }
  async function previewSkill(anchor) {
    await window.openSkillReader({
      api,
      esc,
      t,
      glyph,
      source,
      path: anchor.dataset.path,
      anchor,
      onDirty: (check) => {
        skillEditorDirty = check;
      },
      onSaved: async () => {
        scan = await api('scan', { dir: source });
        plan = null;
      },
      onClosed: () => {
        render();
        $('#app')
          .querySelector(
            `[data-action="skill-preview"][data-path="${CSS.escape(anchor.dataset.path)}"]`,
          )
          ?.focus({ preventScroll: true });
      },
    });
  }
  async function formFromText() {
    if (!manual) return;
    const parsed = await api('parse', { dir: project.dir, text });
    entries = parsed.doc.skills.map((s) => ({ ...s }));
    defaults = parsed.doc.defaults.agents;
    method = parsed.doc.deploy.method;
    source = parsed.source;
    scan = await api('scan', { dir: source });
    for (const e of entries)
      if (e.path === undefined) {
        const matches = scan.skills.filter((s) => s.name === e.name);
        if (matches.length === 1) e.path = matches[0].path;
      }
    await loadDeployments();
    manual = false;
  }
  function setDirty() {
    dirty = text !== savedText;
    plan = null;
  }
  // Keep agent buttons alive so native CSS can interpolate both on and off.
  function updateAgentControls() {
    const selected = (button, agents) => {
      button.classList.toggle('on', agents.includes(button.dataset.agent));
      button.setAttribute('aria-pressed', agents.includes(button.dataset.agent));
    };
    document
      .querySelectorAll('[data-action="default-agent"]')
      .forEach((button) => selected(button, defaults));
    document.querySelectorAll('.skill-agents').forEach((group) => {
      const reset = group.querySelector('[data-action="inherit"]');
      const entry = entries.find((e) => e.name === reset.dataset.name);
      if (!entry) return;
      const agents = entry.agents ?? defaults;
      const visible = new Set([...primaryAgents, ...agents]);
      for (const agent of visible) {
        let button = group.querySelector(`[data-agent="${CSS.escape(agent)}"]`);
        if (!button) {
          reset.insertAdjacentHTML(
            'beforebegin',
            chips([agent], agents, 'skill-agent', `data-name="${esc(entry.name)}"`, true),
          );
          button = reset.previousElementSibling;
          if (!matchMedia('(prefers-reduced-motion: reduce)').matches)
            button.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 180, easing: 'ease-out' });
        }
        button.classList.remove('leaving');
        button.removeAttribute('aria-hidden');
        button.removeAttribute('tabindex');
        selected(button, agents);
      }
      for (const button of group.querySelectorAll('[data-action="skill-agent"]')) {
        if (visible.has(button.dataset.agent)) continue;
        selected(button, []);
        button.classList.add('leaving');
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
        if (document.activeElement === button) reset.focus({ preventScroll: true });
        const remove = () => {
          if (button.classList.contains('leaving')) button.remove();
        };
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) remove();
        else setTimeout(remove, 200);
      }
      reset.classList.toggle('inherited', entry.agents === undefined);
      reset.title = t(entry.agents === undefined ? 'inherit' : 'resetAgents');
    });
    document
      .querySelectorAll('[data-action="method"]')
      .forEach((button) => button.setAttribute('aria-pressed', button.dataset.value === method));
    updateDeploymentTags();
    const status = $('#project-status');
    if (status) {
      status.textContent = projectStatus();
      status.className = 'state' + (plan && !plan.ok ? ' error' : '');
    }
    $('[data-action="save"]').disabled = !dirty && detail?.exists;
    $('[data-action="preview"]').disabled = !text.trim();
    $('[data-action="apply"]').disabled = dirty || !detail?.exists || !plan?.ok;
    $('.view-tabs [data-value="skills"]').innerHTML =
      t('skills') + (entries.length ? ` <span class="count">${entries.length}</span>` : '');
    if (tab === 'manifest') $('#manifest-editor').value = text;
    if (tab === 'plan') $('.workspace-view').innerHTML = renderPlan();
    updateResetButton();
  }
  async function draft({ initial = false, agentsOnly = false, selectionOnly = false } = {}) {
    const version = ++draftVersion;
    const result = await api('draft', { source, skills: entries, agents: defaults, method });
    if (version !== draftVersion) return;
    text = result.text;
    setDirty();
    if (initial) dirty = false;
    if (selectionOnly) updateSkillSelection();
    else if (agentsOnly) updateAgentControls();
    else render();
  }
  async function loadSource(dir, { reset = false } = {}) {
    source = dir;
    try {
      scan = await api('scan', { dir });
    } catch (e) {
      scan = { skills: [], problems: [{ path: dir, error: e.message }] };
    }
    category = '';
    query = '';
    if (reset && project) entries = [];
    await loadDeployments({ seed: reset, seedManaged: reset });
    if (reset && project) await draft();
    else render();
  }
  async function selectProject(dir, { discard = false, seedExisting = true } = {}) {
    if (
      dirty &&
      !discard &&
      !window.confirm(
        lang === 'zh' ? '放弃尚未保存的清单修改？' : 'Discard unsaved manifest changes?',
      )
    ) {
      render();
      return;
    }
    project = state.projects.find((p) => p.dir === dir);
    try {
      detail = await api('project', { dir });
    } catch (e) {
      detail = { text: '', exists: false, file: project.manifestPath, conflicts: [e.message] };
    }
    text = savedText = detail.text;
    dirty = false;
    manual = false;
    plan = null;
    tab = detail.parseError ? 'manifest' : 'skills';
    entries = detail.doc?.skills.map((s) => ({ ...s })) || [];
    defaults = detail.doc?.defaults.agents || ['cursor'];
    method = detail.doc?.deploy.method || 'link';
    if (detail.source) {
      source = detail.source;
      try {
        scan = await api('scan', { dir: source });
      } catch (e) {
        scan = { skills: [], problems: [{ path: source, error: e.message }] };
      }
    } else if (source) {
      try {
        scan = await api('scan', { dir: source });
      } catch (e) {
        scan = { skills: [], problems: [{ path: source, error: e.message }] };
      }
    }
    for (const e of entries)
      if (e.path === undefined) {
        const matches = (scan?.skills || []).filter((s) => s.name === e.name);
        if (matches.length === 1) e.path = matches[0].path;
      }
    const detectedAdded = await loadDeployments({
      seed: seedExisting && !detail.parseError,
      seedManaged: !detail.exists,
    });
    if (detail.doc) {
      try {
        plan = await api('plan', { dir });
      } catch (e) {
        detail.parseError = e.message;
      }
    }
    if (source && (detectedAdded || !text)) await draft({ initial: !detail.exists });
    else render();
    rememberSelection();
  }
  function toggle(array, value) {
    return array.includes(value) ? array.filter((v) => v !== value) : [...array, value];
  }
  $('#app').addEventListener('click', (event) => {
    const b = event.target.closest('button[data-action]');
    if (!b) return;
    if (b.dataset.action === 'project-picker') {
      window.workspaceUI.popup(
        b,
        state.projects.map((p) => ({ value: p.dir, label: leaf(p.dir) })),
        project?.dir || '',
        (dir) => run(() => selectProject(dir)),
        t('projects'),
      );
      return;
    }
    if (b.dataset.action === 'source-picker') {
      window.workspaceUI.popup(
        b,
        availableSources().map((dir) => ({ value: dir, label: sourceTitle(dir) })),
        source,
        (dir) => run(() => loadSource(dir, { reset: !!project })),
        t('source'),
      );
      return;
    }
    if (b.dataset.action === 'more-agents') {
      moreAgentsOpen = !moreAgentsOpen;
      b.setAttribute('aria-expanded', moreAgentsOpen);
      b.querySelector('span').textContent = t(moreAgentsOpen ? 'fewerAgents' : 'moreAgents');
      $('#extra-agents').classList.toggle('expanded', moreAgentsOpen);
      $('#extra-agents').inert = !moreAgentsOpen;
      return;
    }
    run(async () => {
      const a = b.dataset.action;
      if (a === 'skill-preview') {
        await previewSkill(b);
        return;
      }
      if (a === 'submit-form') {
        await submitForm(b.closest('form'));
        return;
      }
      if (a === 'project-form') {
        projectForm = !projectForm;
        render();
        return;
      }
      if (a === 'source-form') {
        sourceForm = !sourceForm;
        render();
        return;
      }
      if (a === 'tab') {
        if (b.dataset.value === 'skills' && project) await formFromText();
        tab = b.dataset.value;
        render();
        return;
      }
      if (a === 'category') {
        category = b.dataset.value;
        render();
        return;
      }
      if (a === 'source-remove') {
        await api('source/remove', { dir: b.dataset.dir });
        await refresh();
        if (source === b.dataset.dir && !project) {
          source = null;
          scan = null;
        }
        render();
        return;
      }
      if (a === 'library') {
        const s = await api('source/add', { dir: state.library.dir });
        await refresh();
        await loadSource(s.root, { reset: !!project });
        return;
      }
      if (a === 'refresh') {
        await refresh();
        if (project) await selectProject(project.dir);
        else if (source) await loadSource(source);
        else render();
        return;
      }
      if (a === 'sync') {
        if (dirty)
          throw new Error(
            lang === 'zh' ? '请先保存清单或放弃修改。' : 'Save or discard changes first.',
          );
        const r = await api('sync', {});
        await refresh();
        notice(
          r.ok
            ? lang === 'zh'
              ? '所有项目已同步'
              : 'All projects synced'
            : JSON.stringify(r.results.filter((p) => !p.ok)),
          !r.ok,
        );
        if (project) await selectProject(project.dir, { discard: true });
        else render();
        return;
      }
      if (!project) return;
      if (a === 'reset-selection') {
        await resetSelection();
        return;
      }
      if (['default-agent', 'method', 'skill-agent', 'inherit'].includes(a)) await formFromText();
      if (a === 'default-agent') {
        defaults = toggle(defaults, b.dataset.agent);
        await draft({ agentsOnly: true });
      }
      if (a === 'method') {
        method = b.dataset.value;
        await draft();
      }
      if (a === 'skill-agent') {
        const e = entries.find((e) => e.name === b.dataset.name);
        e.agents = toggle(e.agents ?? defaults, b.dataset.agent);
        await draft({ agentsOnly: true });
      }
      if (a === 'inherit') {
        const e = entries.find((e) => e.name === b.dataset.name);
        if (e.agents !== undefined) delete e.agents;
        else e.agents = [...defaults];
        await draft({ agentsOnly: true });
      }
      if (a === 'save') {
        await api('manifest/save', { dir: project.dir, text, expectedText: savedText });
        savedText = text;
        dirty = false;
        await refresh();
        await selectProject(project.dir, { discard: true, seedExisting: false });
        notice(t('saved'));
      }
      if (a === 'preview') {
        plan = await api('plan', { dir: project.dir, text });
        tab = 'plan';
        render();
      }
      if (a === 'apply') {
        const r = await api('apply', { dir: project.dir });
        plan = r.ok ? await api('plan', { dir: project.dir }) : r;
        tab = 'plan';
        await refresh();
        await loadDeployments();
        render();
        notice(
          r.ok ? (lang === 'zh' ? '项目技能已同步' : 'Project skills synced') : t('conflicts'),
          !r.ok,
        );
      }
      if (a === 'reveal') await api('reveal', { dir: project.dir });
      if (a === 'project-remove') {
        if (!window.confirm(t('keep') + '?')) return;
        await api('project/remove', { dir: project.dir, keep: true });
        project = null;
        selectionBaseline = null;
        deployments = { skills: [], problems: [] };
        detail = null;
        entries = [];
        text = savedText = '';
        dirty = false;
        await refresh();
        render();
      }
    });
  });
  $('#app').addEventListener('change', (event) => {
    if (event.target.id === 'category-all') {
      const checked = event.target.checked;
      return run(async () => {
        await formFromText();
        const scope = categorySkills();
        if (checked) {
          const next = [...entries];
          for (const skill of scope) {
            if (next.some((e) => e.name === skill.name && e.path !== skill.path))
              throw new Error('Duplicate name; select a single source path');
            if (!next.some((e) => e.name === skill.name && e.path === skill.path))
              next.push({ name: skill.name, path: skill.path });
          }
          entries = next;
        } else
          entries = entries.filter(
            (e) => !scope.some((s) => s.name === e.name && s.path === e.path),
          );
        await draft({ selectionOnly: true });
      });
    }
    if (event.target.dataset.skill)
      return run(async () => {
        const s = scan.skills.find((s) => s.path === event.target.dataset.skill);
        if (event.target.checked) {
          if (entries.some((e) => e.name === s.name))
            throw new Error('Duplicate name; select a single source path');
          entries.push({ name: s.name, path: s.path });
        } else entries = entries.filter((e) => e.name !== s.name || e.path !== s.path);
        await draft({ selectionOnly: true });
      });
  });
  $('#app').addEventListener('input', (event) => {
    if (event.target.id === 'search') {
      query = event.target.value;
      const pos = event.target.selectionStart;
      render();
      $('#search').focus();
      $('#search').setSelectionRange(pos, pos);
    }
    if (event.target.id === 'manifest-editor') {
      manual = true;
      text = event.target.value;
      setDirty();
      if ($('#project-status')) {
        $('#project-status').textContent = dirty ? t('unsaved') : t('saved');
        $('#project-status').className = 'state';
      }
      const actions = event.target.closest('main').querySelector('.workspace-header .actions');
      actions.querySelector('[data-action="save"]').disabled = !dirty;
      actions.querySelector('[data-action="apply"]').disabled = true;
      updateResetButton();
    }
  });
  async function submitForm(form) {
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form));
    if (form.id === 'source-add') {
      const s = await api('source/add', data);
      sourceForm = false;
      await refresh();
      await loadSource(s.root, { reset: !!project });
    } else if (form.id === 'project-add') {
      const p = await api('project/add', data);
      projectForm = false;
      await refresh();
      await selectProject(p.dir);
    }
  }
  $('#app').addEventListener('keydown', (event) => {
    const form = event.target.closest('form');
    if (form && event.key === 'Enter') {
      event.preventDefault();
      run(() => submitForm(form));
    }
  });
  $('#app').addEventListener('submit', (event) => {
    event.preventDefault();
    run(() => submitForm(event.target));
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty || skillEditorDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  const queryTheme = new URLSearchParams(location.search).get('theme');
  document.documentElement.dataset.theme =
    queryTheme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function hostTheme(theme) {
    if (!theme) return;
    lang = theme.lang?.startsWith('en') ? 'en' : 'zh';
    if (state) render();
  }
  window.magpie?.onTheme(hostTheme);
  if (window.magpie)
    hostTheme(
      await Promise.race([
        window.magpie.ready,
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
      ]),
    );
  await refresh();
  source = state.sources[0]?.dir || null;
  if (state.projects.length) await selectProject(state.projects[0].dir);
  else if (source) await loadSource(source);
  else render();
})().catch((err) => {
  document.getElementById('app').textContent = err.message;
});
