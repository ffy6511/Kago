/* Community-page adapters for Magpie's openProtoMenu and Library dialog
   behavior. The matching upstream styles live in vendor/magpie/components.css. */
(() => {
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  let menu = null,
    modal = null,
    sequence = 0;
  const check =
    '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.9"><path d="m3 8 3 3 7-7"/></svg>';
  function closeMenu(restore = false) {
    if (!menu) return;
    const old = menu;
    menu = null;
    old.abort.abort();
    old.anchor.setAttribute('aria-expanded', 'false');
    old.anchor.classList.remove('open');
    old.box.classList.add('leaving');
    const done = () => old.box.remove();
    if (calm()) done();
    else {
      old.box.addEventListener('animationend', done, { once: true });
      setTimeout(done, 250);
    }
    if (restore) old.anchor.focus({ preventScroll: true });
  }
  function popup(anchor, options, value, choose, label) {
    if (menu?.anchor === anchor) {
      closeMenu(true);
      return;
    }
    closeMenu();
    const box = document.createElement('div'),
      abort = new AbortController();
    box.className = 'pop proto-menu';
    box.setAttribute('role', 'menu');
    box.setAttribute('aria-label', label);
    const items = options.map((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'pm-item';
      item.setAttribute('role', 'menuitemradio');
      item.setAttribute('aria-checked', String(option.value === value));
      item.classList.toggle('on', option.value === value);
      const tick = document.createElement('span');
      tick.className = 'pm-tick';
      if (option.value === value) tick.innerHTML = check;
      const words = document.createElement('span');
      words.className = 'pm-words';
      const name = document.createElement('span');
      name.className = 'pm-name';
      name.textContent = option.label;
      words.append(name);
      if (option.note) {
        const note = document.createElement('span');
        note.className = 'pm-note';
        note.textContent = option.note;
        words.append(note);
      }
      item.append(tick, words);
      item.addEventListener('pointerenter', () => item.focus({ preventScroll: true }));
      item.addEventListener('click', () => {
        const id = anchor.id;
        closeMenu();
        Promise.resolve(choose(option.value)).finally(() => {
          (document.getElementById(id) || anchor).focus({ preventScroll: true });
        });
      });
      box.append(item);
      return item;
    });
    document.body.append(box);
    anchor.setAttribute('aria-expanded', 'true');
    anchor.classList.add('open');
    const r = anchor.getBoundingClientRect(),
      pad = 8,
      below = innerHeight - r.bottom - pad - 5,
      above = r.top - pad - 5;
    const height = box.offsetHeight;
    if (height > below && above > below) {
      box.classList.add('up');
      box.style.maxHeight = Math.max(0, above) + 'px';
      box.style.top = Math.max(pad, r.top - 5 - Math.min(height, above)) + 'px';
    } else {
      box.style.maxHeight = Math.max(0, below) + 'px';
      box.style.top = r.bottom + 5 + 'px';
    }
    box.style.left = Math.max(pad, Math.min(r.left, innerWidth - box.offsetWidth - pad)) + 'px';
    let letters = '',
      letterTimer;
    const close = () => closeMenu();
    document.addEventListener(
      'pointerdown',
      (e) => {
        if (!box.contains(e.target) && !anchor.contains(e.target)) closeMenu();
      },
      { capture: true, signal: abort.signal },
    );
    document.addEventListener(
      'scroll',
      (e) => {
        if (!box.contains(e.target)) closeMenu();
      },
      { capture: true, signal: abort.signal },
    );
    window.addEventListener('resize', close, { signal: abort.signal });
    document.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          closeMenu(true);
          return;
        }
        if (e.key === 'Tab') {
          closeMenu();
          return;
        }
        const i = items.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
          e.preventDefault();
          const next =
            e.key === 'Home'
              ? 0
              : e.key === 'End'
                ? items.length - 1
                : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
          items[next]?.focus({ preventScroll: true });
          items[next]?.scrollIntoView({ block: 'nearest' });
        } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && e.key !== ' ') {
          clearTimeout(letterTimer);
          letters += e.key.toLocaleLowerCase();
          letterTimer = setTimeout(() => (letters = ''), 650);
          items
            .find((item) =>
              item.querySelector('.pm-name').textContent.toLocaleLowerCase().startsWith(letters),
            )
            ?.focus({ preventScroll: true });
        }
      },
      { capture: true, signal: abort.signal },
    );
    menu = { anchor, box, abort };
    (items.find((item) => item.classList.contains('on')) || items[0])?.focus({
      preventScroll: true,
    });
  }
  function showModal(content, title, anchor, options = {}) {
    closeMenu();
    if (modal) modal.remove();
    const overlay = document.createElement('div');
    overlay.className = 'modal lib';
    const dialog = document.createElement('div');
    dialog.className = 'dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.tabIndex = -1;
    title.id = 'skill-dialog-title-' + ++sequence;
    dialog.setAttribute('aria-labelledby', title.id);
    dialog.append(content);
    overlay.append(dialog);
    document.body.append(overlay);
    const app = document.getElementById('app');
    app.inert = true;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    let closing = false,
      checking = false;
    const close = async () => {
      if (closing || checking) return;
      checking = true;
      if (options.canClose && !(await options.canClose())) {
        checking = false;
        return;
      }
      closing = true;
      closeMenu();
      overlay.classList.add('out');
      await Promise.all([
        overlay.animate([{ opacity: 1 }, { opacity: 0 }], {
          duration: calm() ? 0 : 180,
          easing: 'ease-out',
          fill: 'forwards',
        }).finished,
        dialog.animate(
          [
            { opacity: 1, transform: 'none' },
            { opacity: 0, transform: 'translateY(14px) scale(.95)' },
          ],
          { duration: calm() ? 0 : 220, easing: 'cubic-bezier(.4,0,.7,.2)', fill: 'forwards' },
        ).finished,
      ]);
      overlay.remove();
      app.inert = false;
      document.body.style.overflow = previousOverflow;
      modal = null;
      anchor?.focus({ preventScroll: true });
      options.onClosed?.();
    };
    overlay.close = close;
    overlay.addEventListener('pointerdown', (e) => {
      if (e.target === overlay) close();
    });
    overlay.addEventListener('keydown', (e) => {
      if (menu) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
      if (e.key === 'Tab') {
        const controls = [
          ...dialog.querySelectorAll(
            'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        ];
        const first = controls[0],
          last = controls.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    });
    content.addEventListener('click', (e) => {
      if (e.target.closest('[data-close-modal]')) close();
    });
    overlay.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: calm() ? 0 : 220,
      easing: 'ease-out',
    });
    dialog.animate(
      [
        { opacity: 0, transform: 'translateY(24px) scale(.94)' },
        { opacity: 1, transform: 'none' },
      ],
      { duration: calm() ? 0 : 380, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    modal = overlay;
    (content.querySelector('[data-close-modal]') || dialog).focus({ preventScroll: true });
    return { close, element: overlay };
  }
  window.workspaceUI = { popup, closeMenu, showModal };
})();
