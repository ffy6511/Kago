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
    projects: ['项目工作区', 'Projects'],
    sources: ['技能来源', 'Skill sources'],
    add: ['添加', 'Add'],
    register: ['注册', 'Register'],
    sourcePath: ['Skill 库根目录', 'Skill source root'],
    projectPath: ['Git 项目根目录', 'Git repository root'],
    manifestPath: ['清单路径（可选）', 'Manifest path (optional)'],
    library: ['读取 Magpie Library', 'Read Magpie Library'],
    sync: ['同步全部项目', 'Sync all projects'],
    skills: ['技能选择', 'Skills'],
    manifest: ['项目清单', 'Manifest'],
    plan: ['同步计划', 'Sync plan'],
    save: ['保存清单', 'Save manifest'],
    preview: ['预览同步', 'Dry run'],
    apply: ['应用同步', 'Apply'],
    open: ['打开文件夹', 'Open folder'],
    remove: ['取消托管', 'Unregister'],
    defaults: ['默认目标 agent', 'Default agents'],
    method: ['部署方式', 'Deployment method'],
    link: ['软链', 'Link'],
    copy: ['复制', 'Copy'],
    search: ['搜索名称或描述…', 'Search names or descriptions…'],
    all: ['全部分类', 'All categories'],
    selected: ['已选', 'Selected'],
    skill: ['Skill / 源路径', 'Skill / source path'],
    targets: ['项目级 agent', 'Project agents'],
    inherit: ['使用项目默认', 'Use project defaults'],
    override: ['自定义', 'Override'],
    chooseProject: ['选择一个项目开始配置', 'Choose a project to configure'],
    chooseHelp: [
      '注册 Git 项目，选择需要的 Skill，再将清单保存到项目仓库。',
      'Register a Git repository, select its skills, and save the manifest in the project.',
    ],
    sourceHelp: [
      '先添加一个分类 Skill 库，或读取已有的 Magpie Library。',
      'Add a categorized skill source or read your Magpie Library.',
    ],
    global: [
      '仅管理项目目录 · 全局 agent 开关由 Magpie Library 管理',
      'Project folders only · Global agent switches stay in Magpie Library',
    ],
    noProjects: ['还没有注册项目', 'No projects registered'],
    noSources: ['还没有注册来源', 'No sources registered'],
    noSkills: ['没有匹配的 Skill', 'No matching skills'],
    source: ['来源', 'Source'],
    unsaved: ['有未保存的修改', 'Unsaved changes'],
    saved: ['已保存到项目', 'Saved to project'],
    noManifest: ['尚未创建清单', 'No manifest yet'],
    notApplied: ['尚未同步', 'Not synced yet'],
    consistent: ['已与清单一致', 'Matches manifest'],
    pending: ['有待同步的变更', 'Changes pending'],
    conflicts: ['存在冲突', 'Conflicts found'],
    keep: ['保留部署文件后取消托管', 'Unregister and keep deployed files'],
    previewHelp: [
      '先保存清单并预览，确认变更后再应用。',
      'Save the manifest and preview its changes before applying.',
    ],
    sourceOnly: [
      '正在浏览源库；选择项目后可部署选中的 Skill。',
      'Browsing a source. Choose a project to deploy selected skills.',
    ],
    reload: ['刷新', 'Refresh'],
    clear: ['清空选择', 'Clear selection'],
    pickAll: ['选择当前分类', 'Select category'],
    unregister: ['取消注册', 'Unregister'],
    yamlHint: [
      '清单会进入 Git；部署产物默认加入忽略规则。',
      'Commit the manifest to Git; generated deployments are ignored.',
    ],
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
    detail = null,
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
    draftVersion = 0,
    manual = false;
  let noticeTimer;
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
  function chips(agents, current, action, extra = '') {
    return agents
      .map(
        (a) =>
          `<button type="button" class="chip ${current.includes(a) ? 'on' : ''}" aria-pressed="${current.includes(a)}" data-action="${action}" data-agent="${esc(a)}" ${extra}>${esc(agentLabels[a] || a)}</button>`,
      )
      .join('');
  }
  function availableSources() {
    return [...new Set([...state.sources.map((s) => s.dir), ...(source ? [source] : [])])];
  }
  function render() {
    const projectName = project ? leaf(project.dir) : 'Skill Workspaces';
    const status = plan
      ? !plan.ok
        ? t('conflicts')
        : plan.operations.every((o) => o.action === 'unchanged')
          ? t('consistent')
          : t('pending')
      : detail?.exists
        ? t('saved')
        : t('noManifest');
    $('#app').innerHTML =
      `<div class="shell"><aside class="rail"><div class="brand"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h7l2 3h9v13H3zM8 12l-2 2 2 2m8-4 2 2-2 2m-3-5-2 6"/></svg><strong>Skill Workspaces<span>Magpie · Project skills</span></strong></div>
 <section><div class="rail-heading">${t('projects')}<button class="ghost" data-action="project-form" aria-label="${t('register')} ${t('projects')}">+</button></div>${state.projects.map((p) => `<button class="rail-item ${project?.dir === p.dir ? 'active' : ''}" data-action="project" data-dir="${esc(p.dir)}" title="${esc(p.dir)}"><strong>${esc(leaf(p.dir))}</strong><small>${esc(state.lastSync[p.dir]?.time ? new Date(state.lastSync[p.dir].time).toLocaleString() : t('notApplied'))}</small></button>`).join('') || `<p class="rail-note">${t('noProjects')}</p>`}
 ${projectForm ? `<form id="project-add" class="rail-form"><input name="dir" aria-label="${t('projectPath')}" placeholder="${t('projectPath')}" required><input name="manifestPath" aria-label="${t('manifestPath')}" placeholder="${t('manifestPath')}"><button>${t('register')}</button></form>` : ''}</section>
 <section><div class="rail-heading">${t('sources')}<button class="ghost" data-action="source-form" aria-label="${t('add')} ${t('sources')}">+</button></div>${state.sources.map((s) => `<div class="source-item"><button class="rail-item ${source === s.dir ? 'active' : ''}" data-action="source" data-dir="${esc(s.dir)}" title="${esc(s.dir)}"><strong>${esc(leaf(s.dir))}</strong><small>${esc(s.dir)}</small></button><button class="ghost" data-action="source-remove" data-dir="${esc(s.dir)}" aria-label="${t('unregister')} ${esc(leaf(s.dir))}">×</button></div>`).join('') || `<p class="rail-note">${t('noSources')}</p>`}
 ${sourceForm ? `<form id="source-add" class="rail-form"><input name="dir" aria-label="${t('sourcePath')}" placeholder="${t('sourcePath')}" required><button>${t('register')}</button></form>` : ''}<button class="ghost" data-action="library" style="font-size:11px;margin-top:9px">${t('library')}</button></section><div class="rail-bottom"><p class="rail-note">${t('global')}</p><button class="ghost" data-action="sync" style="margin-top:10px">↻ ${t('sync')}</button></div></aside>
 <main class="main"><div class="topline"><span class="eyebrow">${t('projects')} / ${esc(projectName)}</span><div class="actions"><button class="ghost" data-action="refresh">↻ ${t('reload')}</button><button class="ghost" data-action="language">${lang === 'zh' ? 'English' : '中文'}</button></div></div>
 ${
   project
     ? `<div class="project-title"><div><h1>${esc(projectName)}</h1><p class="path">${esc(project.dir)}</p></div><div class="actions"><button class="ghost" data-action="reveal">${t('open')}</button><button class="ghost danger" data-action="project-remove" title="${t('keep')}">${t('remove')}</button></div></div>
 <div class="actions" style="margin-bottom:16px"><span id="project-status" class="badge ${plan?.ok ? 'good' : plan && !plan.ok ? 'bad' : ''}">${dirty ? t('unsaved') : status}</span><span class="muted" style="font-size:11px">${t('global')}</span></div>
 ${(detail?.conflicts || []).map((c) => `<div class="callout">${esc(c)}</div>`).join('')}${detail?.parseError ? `<div class="callout error">${esc(detail.parseError)}</div>` : ''}
 <div class="setup"><div class="setting-wide"><span class="setting-label">${t('defaults')}</span><div class="chips">${chips(['cursor', 'codex', 'opencode', 'gemini', 'claude'], defaults, 'default-agent')}</div><details style="margin-top:6px"><summary class="muted" style="font-size:10px">${lang === 'zh' ? '更多 agent' : 'More agents'}</summary><div class="chips" style="margin-top:6px">${chips(
   Object.keys(state.agents).filter(
     (a) => !['cursor', 'codex', 'opencode', 'gemini', 'claude'].includes(a),
   ),
   defaults,
   'default-agent',
 )}</div></details></div><div><span class="setting-label">${t('method')}</span><div class="chips"><button data-action="method" data-value="link" class="chip ${method === 'link' ? 'on' : ''}">${t('link')}</button><button data-action="method" data-value="copy" class="chip ${method === 'copy' ? 'on' : ''}">${t('copy')}</button></div></div></div>
 <nav class="tabs" aria-label="Workspace views">${['skills', 'manifest', 'plan'].map((k) => `<button data-action="tab" data-value="${k}" class="tab ${tab === k ? 'active' : ''}">${t(k)}${k === 'skills' ? ` <small>${entries.length}</small>` : ''}</button>`).join('')}</nav>`
     : `<div class="browse-title"><h1>Skill Workspaces</h1><p class="muted" style="margin-top:8px">${source ? t('sourceOnly') : t('chooseHelp')}</p></div>`
 }
 ${project && tab === 'manifest' ? renderManifest() : project && tab === 'plan' ? renderPlan() : renderSkills()}
 ${project ? `<div class="editor-bar"><small>${t('previewHelp')}</small><div class="actions"><button data-action="save" ${!dirty && detail?.exists ? 'disabled' : ''}>${t('save')}</button><button data-action="preview" ${!text.trim() ? 'disabled' : ''}>${t('preview')}</button><button class="primary" data-action="apply" ${dirty || !detail?.exists || !plan?.ok ? 'disabled' : ''}>${t('apply')}</button></div></div>` : ''}
 <footer class="foot"><span>${t('yamlHint')}</span><span>v0.1.0 · ${esc(state.configDir)}</span></footer></main></div>`;
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }
  function renderSkills() {
    if (!source)
      return `<div class="empty"><h2>${t('chooseProject')}</h2><p>${t('sourceHelp')}</p><button data-action="source-form">+ ${t('add')} ${t('sources')}</button><button class="ghost" data-action="project-form">+ ${t('register')} ${t('projects')}</button></div>`;
    const list = (scan?.skills || []).filter(
      (s) =>
        (!category || s.category === category) &&
        (!query || `${s.name} ${s.description}`.toLowerCase().includes(query.toLowerCase())),
    );
    const categories = [...new Set((scan?.skills || []).map((s) => s.category))];
    return `<div class="toolbar"><select aria-label="${t('source')}" id="source-select">${availableSources()
      .map(
        (s) =>
          `<option value="${esc(s)}" ${s === source ? 'selected' : ''}>${esc(leaf(s))}</option>`,
      )
      .join(
        '',
      )}</select><input type="search" id="search" aria-label="${t('search')}" placeholder="${t('search')}" value="${esc(query)}"><small>${t('selected')} ${entries.length} / ${scan?.skills?.length || 0}</small></div><div class="categories"><button class="category ${!category ? 'active' : ''}" data-action="category" data-value="">${t('all')}</button>${categories.map((c) => `<button class="category ${category === c ? 'active' : ''}" data-action="category" data-value="${esc(c)}">${esc(c)}</button>`).join('')}${project ? `<button class="ghost" data-action="pick-all" style="font-size:11px">${t('pickAll')}</button><button class="ghost" data-action="clear" style="font-size:11px">${t('clear')}</button>` : ''}</div>
 ${(scan?.problems || []).map((p) => `<div class="callout">${esc(p.path)} · ${esc(p.error)}</div>`).join('')}
 <div class="skills"><div class="skill-head"><span></span><span>${t('skill')}</span><span>${t('targets')}</span></div>${
   list
     .map((s) => {
       const e = entries.find((e) => e.name === s.name && e.path === s.path);
       return `<div class="skill-row ${e ? 'selected' : ''}"><input type="checkbox" aria-label="${esc(s.name)}" data-skill="${esc(s.path)}" ${e ? 'checked' : ''} ${!project ? 'disabled' : ''}><div><span class="skill-name">${esc(s.name)}</span><p class="skill-desc" title="${esc(s.description)}">${esc(s.description)}</p><p class="skill-path mono">${esc(s.path)}</p></div><div class="skill-agents">${e ? `<small><button class="ghost" data-action="inherit" data-name="${esc(s.name)}" style="font-size:10px;padding:0">${e.agents === undefined ? '↳ ' + t('inherit') : t('override') + ' ↺'}</button></small><div class="chips">${chips(['cursor', 'codex', 'opencode', 'gemini', 'claude'], e.agents ?? defaults, 'skill-agent', `data-name="${esc(s.name)}"`)}</div>${e.agents?.some((a) => !['cursor', 'codex', 'opencode', 'gemini', 'claude'].includes(a)) ? `<small>${esc(e.agents.join(', '))}</small>` : ''}` : `<small>${project ? '—' : t('sourceOnly')}</small>`}</div></div>`;
     })
     .join('') || `<p class="empty">${t('noSkills')}</p>`
 }</div>`;
  }
  function renderManifest() {
    return `<p class="path" style="margin-bottom:12px">${esc(detail?.file || 'skills.manifest.yaml')}</p><textarea id="manifest-editor" class="editor" spellcheck="false" aria-label="skills.manifest.yaml">${esc(text)}</textarea>`;
  }
  function renderPlan() {
    if (!plan)
      return `<div class="empty"><h2>${t('plan')}</h2><p>${t('previewHelp')}</p><button data-action="preview">${t('preview')}</button></div>`;
    const labels = {
      create: ['新增', 'Create'],
      update: ['更新', 'Update'],
      remove: ['移除', 'Remove'],
      forget: ['清除记录', 'Forget'],
      unchanged: ['一致', 'Unchanged'],
      conflict: ['冲突', 'Conflict'],
    };
    const counts = plan.operations.reduce(
      (r, o) => ((r[o.action] = (r[o.action] || 0) + 1), r),
      {},
    );
    return `<div class="summary">${Object.entries(counts)
      .map(
        ([k, v]) => `<span>${labels[k]?.[lang === 'zh' ? 0 : 1] || k} <strong>${v}</strong></span>`,
      )
      .join('')}</div>${plan.problems
      .filter(
        (p) => !plan.operations.some((o) => o.relative === p.relative && o.action === 'conflict'),
      )
      .map((p) => `<div class="callout error">${esc(p.error)}</div>`)
      .join(
        '',
      )}<div class="plan">${plan.operations.map((o) => `<div class="plan-row ${o.action}"><span><span class="badge ${o.action === 'conflict' ? 'bad' : o.action === 'unchanged' ? 'good' : ''}">${labels[o.action]?.[lang === 'zh' ? 0 : 1]}</span></span><div><code>${esc(o.relative)}</code><p>${esc(o.error || o.source || '')}</p></div></div>`).join('') || `<p class="empty">${t('consistent')}</p>`}</div>`;
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
    manual = false;
  }
  function setDirty() {
    dirty = text !== savedText;
    plan = null;
  }
  async function draft() {
    const version = ++draftVersion;
    const result = await api('draft', { source, skills: entries, agents: defaults, method });
    if (version !== draftVersion) return;
    text = result.text;
    setDirty();
    render();
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
    if (reset && project) {
      entries = [];
      await draft();
    }
    render();
  }
  async function selectProject(dir, { discard = false } = {}) {
    if (
      dirty &&
      !discard &&
      !window.confirm(
        lang === 'zh' ? '放弃尚未保存的清单修改？' : 'Discard unsaved manifest changes?',
      )
    )
      return;
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
    if (detail.doc) {
      try {
        plan = await api('plan', { dir });
      } catch (e) {
        detail.parseError = e.message;
      }
    }
    if (!text && source) await draft();
    else render();
  }
  function toggle(array, value) {
    return array.includes(value) ? array.filter((v) => v !== value) : [...array, value];
  }
  $('#app').addEventListener('click', (event) => {
    const b = event.target.closest('button[data-action]');
    if (!b) return;
    run(async () => {
      const a = b.dataset.action;
      if (a === 'language') {
        lang = lang === 'zh' ? 'en' : 'zh';
        render();
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
      if (a === 'project') {
        await selectProject(b.dataset.dir);
        return;
      }
      if (a === 'source') {
        if (
          project &&
          dirty &&
          !window.confirm(
            lang === 'zh'
              ? '切换来源会重新生成清单，继续？'
              : 'Switch source and regenerate the manifest?',
          )
        )
          return;
        await loadSource(b.dataset.dir, { reset: !!project });
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
      if (['default-agent', 'method', 'skill-agent', 'inherit', 'clear', 'pick-all'].includes(a))
        await formFromText();
      if (a === 'default-agent') {
        defaults = toggle(defaults, b.dataset.agent);
        await draft();
      }
      if (a === 'method') {
        method = b.dataset.value;
        await draft();
      }
      if (a === 'skill-agent') {
        const e = entries.find((e) => e.name === b.dataset.name);
        e.agents = toggle(e.agents ?? defaults, b.dataset.agent);
        await draft();
      }
      if (a === 'inherit') {
        const e = entries.find((e) => e.name === b.dataset.name);
        if (e.agents !== undefined) delete e.agents;
        else e.agents = [...defaults];
        await draft();
      }
      if (a === 'clear') {
        entries = [];
        await draft();
      }
      if (a === 'pick-all') {
        for (const s of scan.skills.filter((s) => !category || s.category === category))
          if (!entries.some((e) => e.name === s.name)) entries.push({ name: s.name, path: s.path });
        await draft();
      }
      if (a === 'save') {
        await api('manifest/save', { dir: project.dir, text, expectedText: savedText });
        savedText = text;
        dirty = false;
        await refresh();
        await selectProject(project.dir, { discard: true });
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
    if (event.target.id === 'source-select')
      return run(() => loadSource(event.target.value, { reset: !!project }));
    if (event.target.dataset.skill)
      return run(async () => {
        const s = scan.skills.find((s) => s.path === event.target.dataset.skill);
        if (event.target.checked) {
          if (entries.some((e) => e.name === s.name))
            throw new Error('Duplicate name; select a single source path');
          entries.push({ name: s.name, path: s.path });
        } else entries = entries.filter((e) => e.name !== s.name || e.path !== s.path);
        await draft();
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
        $('#project-status').className = 'badge';
      }
      const actions = event.target.closest('main').querySelector('.editor-bar');
      actions.querySelector('[data-action="save"]').disabled = !dirty;
      actions.querySelector('[data-action="apply"]').disabled = true;
    }
  });
  $('#app').addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.target,
      data = Object.fromEntries(new FormData(form));
    run(async () => {
      if (form.id === 'source-add') {
        const s = await api('source/add', data);
        sourceForm = false;
        await refresh();
        await loadSource(s.root, { reset: !!project });
      }
      if (form.id === 'project-add') {
        const p = await api('project/add', data);
        projectForm = false;
        await refresh();
        await selectProject(p.dir);
      }
    });
  });
  window.addEventListener('beforeunload', (event) => {
    if (dirty) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  const theme = new URLSearchParams(location.search).get('theme');
  document.documentElement.dataset.theme =
    theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  await refresh();
  source = state.sources[0]?.dir || null;
  if (state.projects.length) await selectProject(state.projects[0].dir);
  else if (source) await loadSource(source);
  else render();
})().catch((err) => {
  document.getElementById('app').textContent = err.message;
});
