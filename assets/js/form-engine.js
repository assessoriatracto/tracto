// Motor de formulário estilo Typeform: uma pergunta por tela, lógica condicional,
// saltos, validação, atalhos de teclado, animações e rastreamento de abandono.

const ICON = {
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  up: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z"/></svg>',
  caret: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m6 9 6 6 6-6"/></svg>'
};
const MSG = {
  required: 'Essa resposta é obrigatória',
  email: 'Hmm, esse e-mail não parece válido',
  phone: 'Informe um WhatsApp válido com DDD',
  number: 'Digite só números',
  url: 'Esse link não parece válido',
  date: 'Use o formato DD/MM/AAAA',
  instagram: 'Use só letras, números, ponto e underline',
  consent: 'Você precisa aceitar pra continuar',
  submit: 'Não conseguimos enviar agora. Confira sua conexão e tente de novo.'
};
const QUESTION = ['short_text', 'long_text', 'email', 'phone', 'number', 'url', 'date', 'choice', 'multi', 'dropdown', 'yes_no', 'rating', 'scale', 'consent'];
const AUTO_ADVANCE = ['choice', 'yes_no', 'rating', 'scale'];

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const strip = (html) => String(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const letter = (i) => String.fromCharCode(65 + i);

export function evaluate(cond, answers) {
  if (!cond) return true;
  if (cond.all) return cond.all.every((c) => evaluate(c, answers));
  if (cond.any) return cond.any.some((c) => evaluate(c, answers));
  const v = answers[cond.field];
  const list = Array.isArray(cond.value) ? cond.value : [cond.value];
  const arr = Array.isArray(v) ? v : v == null || v === '' ? [] : [v];
  switch (cond.op) {
    case 'is': return v === cond.value;
    case 'is_not': return v !== cond.value;
    case 'in': return list.includes(v);
    case 'not_in': return !list.includes(v);
    case 'includes': return arr.some((x) => list.includes(x));
    case 'excludes': return !arr.some((x) => list.includes(x));
    case 'gt': return Number(v) > cond.value;
    case 'gte': return Number(v) >= cond.value;
    case 'lt': return Number(v) < cond.value;
    case 'lte': return Number(v) <= cond.value;
    case 'filled': return arr.length > 0;
    case 'empty': return arr.length === 0;
    default: return false;
  }
}

export function mountForm(root, form, { submit, track, onDone, onProgress, initial } = {}) {
  const F = form.fields;
  const idx = Object.fromEntries(F.map((f, i) => [f.id, i]));
  const answers = {};
  const history = [];
  const seen = new Set();
  let cur = -1;
  let busy = false;
  let started = false;

  root.innerHTML = `
    <div class="tf-progress" aria-hidden="true"><div class="tf-progress-bar"></div></div>
    <div class="tf-stage" aria-live="polite"></div>
    <div class="tf-nav" hidden>
      <button type="button" class="tf-up" aria-label="Pergunta anterior">${ICON.up}</button>
      <button type="button" class="tf-down" aria-label="Próxima pergunta">${ICON.down}</button>
    </div>`;
  const stage = root.querySelector('.tf-stage');
  const bar = root.querySelector('.tf-progress-bar');
  const nav = root.querySelector('.tf-nav');
  root.querySelector('.tf-up').addEventListener('click', back);
  root.querySelector('.tf-down').addEventListener('click', () => next());

  // ---------- texto com resposta embutida ----------
  function recall(html) {
    return String(html || '').replace(/\{\{(\w+)(?::(first))?\}\}/g, (_, id, mod) => {
      let v = answers[id];
      if (Array.isArray(v)) v = v.join(', ');
      v = String(v ?? '').trim();
      if (mod === 'first') v = v.split(/\s+/)[0];
      return esc(v);
    });
  }

  // ---------- fluxo ----------
  function resolveNext(from) {
    const f = F[from];
    let target = null;
    for (const rule of f.logic || []) if (evaluate(rule.if, answers)) { target = idx[rule.jump]; break; }
    if (target == null && f.next) target = idx[f.next];
    if (target == null) target = from + 1;
    while (target < F.length && F[target].showIf && !evaluate(F[target].showIf, answers)) target++;
    return target < F.length ? target : F.findIndex((x) => x.type === 'thankyou');
  }
  function remaining(from) {
    // estimativa de perguntas até o fim seguindo o fluxo atual
    let n = 0; let i = from; const guard = new Set();
    while (i >= 0 && i < F.length && F[i].type !== 'thankyou' && !guard.has(i)) {
      guard.add(i);
      if (QUESTION.includes(F[i].type)) n++;
      i = resolveNext(i);
    }
    return n;
  }
  function progress() {
    const f = F[cur];
    if (f.type === 'thankyou') return 1;
    if (f.type === 'welcome') return 0;
    const done = history.filter((i) => QUESTION.includes(F[i].type)).length;
    return done / (done + remaining(cur));
  }

  // ---------- render ----------
  function titleHtml(f) {
    const n = history.filter((i) => QUESTION.includes(F[i].type)).length + 1;
    const numbered = QUESTION.includes(f.type);
    return `
      ${numbered ? `<div class="tf-num tf-a">${n} ${ICON.arrow}</div>` : ''}
      <h1 class="tf-title tf-a">${recall(f.title)}${numbered && f.required ? '<span class="tf-req" aria-label="obrigatória"> *</span>' : ''}</h1>
      ${f.desc ? `<p class="tf-desc tf-a">${recall(f.desc).replace(/\n/g, '<br>')}</p>` : ''}`;
  }
  const okBtn = (label = 'Avançar', hint = true) => `
    <div class="tf-actions tf-a">
      <button type="button" class="tf-btn tf-ok">${label}</button>
      ${hint ? '<span class="tf-hint">pressione <kbd>Enter ↵</kbd></span>' : ''}
    </div>`;
  const errBox = '<div class="tf-error" role="alert"></div>';

  function body(f) {
    const v = answers[f.id];
    switch (f.type) {
      case 'welcome':
        return `<div class="tf-actions tf-a"><button type="button" class="tf-btn tf-btn-lg tf-ok">${esc(f.button || 'Começar')} <span aria-hidden="true">→</span></button><span class="tf-hint">pressione <kbd>Enter ↵</kbd></span></div>`;
      case 'statement':
        return okBtn(esc(f.button || 'Continuar'));
      case 'thankyou':
        return `<div class="tf-thanks-icon tf-a">${ICON.check}</div>${f.cta ? `<div class="tf-actions tf-a"><a class="tf-btn tf-btn-lg" href="${esc(f.cta.href)}" target="_blank" rel="noopener">${esc(f.cta.label)} <span aria-hidden="true">→</span></a></div>` : ''}`;
      case 'short_text': case 'email': case 'number': case 'url': {
        const type = { email: 'email', number: 'text', url: 'url' }[f.type] || 'text';
        const mode = { email: 'email', number: 'numeric', url: 'url' }[f.type] || 'text';
        const auto = f.autocomplete || { email: 'email', url: 'url' }[f.type] || 'off';
        const insta = f.transform === 'instagram';
        return `<div class="tf-field tf-a">${insta ? '<span class="tf-prefix">@</span>' : ''}<input class="tf-input" type="${type}" inputmode="${mode}" autocomplete="${auto}" placeholder="${esc(f.placeholder || 'Sua resposta...')}" value="${esc(v ?? '')}" ${f.maxLength ? `maxlength="${f.maxLength}"` : ''} ${insta || f.type !== 'short_text' ? 'autocapitalize="off" spellcheck="false"' : ''} aria-label="${esc(strip(recall(f.title)))}"></div>${errBox}${okBtn()}`;
      }
      case 'phone':
        return `<div class="tf-field tf-a"><span class="tf-prefix tf-flag">🇧🇷 +55</span><input class="tf-input" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="${esc(f.placeholder || '(62) 99999-9999')}" value="${esc(v ? maskPhone(String(v).replace(/^\+?55/, '')) : '')}" aria-label="${esc(strip(recall(f.title)))}"></div>${errBox}${okBtn()}`;
      case 'date':
        return `<div class="tf-field tf-a"><input class="tf-input" type="text" inputmode="numeric" placeholder="DD/MM/AAAA" value="${esc(v ?? '')}" aria-label="${esc(strip(recall(f.title)))}"></div>${errBox}${okBtn()}`;
      case 'long_text':
        return `<div class="tf-field tf-a tf-field-long"><textarea class="tf-input tf-textarea" rows="1" placeholder="${esc(f.placeholder || 'Sua resposta...')}" ${f.maxLength ? `maxlength="${f.maxLength}"` : ''} aria-label="${esc(strip(recall(f.title)))}">${esc(v ?? '')}</textarea>${f.maxLength ? `<span class="tf-count">${(v || '').length}/${f.maxLength}</span>` : ''}</div>${errBox}${okBtn('Avançar', false)}<span class="tf-hint tf-a tf-hint-block"><kbd>Shift ⇧</kbd> + <kbd>Enter ↵</kbd> quebra linha</span>`;
      case 'choice': case 'multi': case 'yes_no': case 'consent': {
        const opts = f.type === 'yes_no' ? ['Sim', 'Não'] : f.type === 'consent' ? [f.label || 'Aceito'] : f.options;
        const multi = f.type === 'multi';
        const sel = multi ? (v || []) : [v];
        const otherVal = f.other && v && !opts.includes(v) ? v : '';
        return `
          ${multi ? `<p class="tf-multi-hint tf-a">${f.max ? `Escolha até ${f.max}` : 'Escolha quantas quiser'}</p>` : ''}
          <div class="tf-choices tf-a ${f.type === 'yes_no' ? 'tf-choices-row' : ''}" role="${multi ? 'group' : 'radiogroup'}">
            ${opts.map((o, i) => `<button type="button" class="tf-choice ${sel.includes(o) ? 'is-on' : ''}" role="${multi ? 'checkbox' : 'radio'}" aria-checked="${sel.includes(o)}" data-value="${esc(o)}"><span class="tf-key">${f.type === 'yes_no' ? o[0] : letter(i)}</span><span class="tf-label">${esc(o)}</span><span class="tf-tick">${ICON.check}</span></button>`).join('')}
            ${f.other ? `<button type="button" class="tf-choice tf-other ${otherVal ? 'is-on' : ''}" role="radio" aria-checked="${!!otherVal}" data-other="1"><span class="tf-key">${letter(opts.length)}</span><span class="tf-label">Outro</span><span class="tf-tick">${ICON.check}</span></button>
              <div class="tf-other-wrap" ${otherVal ? '' : 'hidden'}><input class="tf-input tf-other-input" placeholder="Qual?" value="${esc(otherVal)}"></div>` : ''}
          </div>${errBox}
          ${multi || f.type === 'consent' || f.other ? okBtn('Avançar', false) : ''}`;
      }
      case 'dropdown':
        return `<div class="tf-dd tf-a"><div class="tf-field"><input class="tf-input tf-dd-input" placeholder="Digite ou escolha uma opção" value="${esc(v ?? '')}" autocomplete="off" role="combobox" aria-expanded="false" aria-label="${esc(strip(recall(f.title)))}"><span class="tf-dd-caret">${ICON.caret}</span></div>
          <ul class="tf-dd-list" role="listbox" hidden>${f.options.map((o) => `<li role="option" data-value="${esc(o)}">${esc(o)}</li>`).join('')}</ul></div>${errBox}${okBtn()}`;
      case 'rating': {
        const max = f.max || 5;
        return `<div class="tf-rating tf-a" role="radiogroup">${Array.from({ length: max }, (_, i) => `<button type="button" class="tf-star ${v >= i + 1 ? 'is-on' : ''}" data-value="${i + 1}" aria-label="${i + 1} de ${max}">${ICON.star}<span>${i + 1}</span></button>`).join('')}</div>${errBox}`;
      }
      case 'scale': {
        const min = f.min ?? 0; const max = f.max ?? 10;
        return `<div class="tf-scale tf-a" role="radiogroup">${Array.from({ length: max - min + 1 }, (_, i) => `<button type="button" class="tf-scale-btn ${v === min + i ? 'is-on' : ''}" data-value="${min + i}">${min + i}</button>`).join('')}</div>
          ${f.labels ? `<div class="tf-scale-labels tf-a"><span>${esc(f.labels[0])}</span><span>${esc(f.labels[1])}</span></div>` : ''}${errBox}`;
      }
    }
    return '';
  }

  function render(i, dir) {
    const f = F[i];
    const old = stage.querySelector('.tf-slide:not(.is-leaving)');
    const el = document.createElement('section');
    el.className = `tf-slide tf-${f.type} ${dir < 0 ? 'from-top' : 'from-bottom'}`;
    el.innerHTML = `<div class="tf-inner">${titleHtml(f)}${body(f)}</div>`;
    stage.appendChild(el);
    bind(el, f);
    if (old) {
      old.classList.add('is-leaving', dir < 0 ? 'to-bottom' : 'to-top');
      old.inert = true;
      setTimeout(() => old.remove(), 600);
    }
    void el.offsetWidth; // força o estado inicial antes de animar a entrada
    el.classList.add('is-in');

    bar.style.width = (progress() * 100).toFixed(1) + '%';
    nav.hidden = f.type === 'welcome' || f.type === 'thankyou';
    root.querySelector('.tf-up').disabled = history.length === 0 || F[history.at(-1)].type === 'welcome';
    root.classList.toggle('is-ended', f.type === 'thankyou');

    // foca o input; em telas de escolha foca o slide (letras funcionam sem "pré-selecionar" visualmente a opção A)
    el.tabIndex = -1;
    const focusable = el.querySelector('.tf-input:not(.tf-other-input)') || (f.type === 'welcome' ? el.querySelector('.tf-ok') : el);
    focusable?.focus({ preventScroll: true });

    if (QUESTION.includes(f.type) && !seen.has(f.id)) { seen.add(f.id); track?.('step', f.id); }
  }

  function go(i, dir) {
    cur = i;
    render(i, dir);
  }

  // ---------- interação ----------
  function bind(el, f) {
    el.querySelectorAll('.tf-ok').forEach((b) => b.addEventListener('click', () => next()));
    const input = el.querySelector('.tf-input:not(.tf-other-input):not(.tf-dd-input)');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        if (f.type === 'long_text' && e.shiftKey) return;
        e.preventDefault(); next();
      });
      input.addEventListener('input', () => {
        if (f.type === 'phone') input.value = maskPhone(input.value);
        if (f.type === 'date') input.value = maskDate(input.value);
        if (f.transform === 'instagram') input.value = cleanInsta(input.value);
        if (f.type === 'number') input.value = input.value.replace(/[^\d.,-]/g, '');
        if (f.type === 'long_text') { autosize(input); const c = el.querySelector('.tf-count'); if (c) c.textContent = `${input.value.length}/${f.maxLength}`; }
        hideError(el);
      });
      if (f.type === 'long_text') setTimeout(() => autosize(input), 0);
    }

    el.querySelectorAll('.tf-choice').forEach((c) => c.addEventListener('click', () => pick(el, f, c)));
    const other = el.querySelector('.tf-other-input');
    if (other) {
      other.addEventListener('input', () => { answers[f.id] = other.value.trim() || undefined; hideError(el); });
      other.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); next(); } });
    }

    el.querySelectorAll('.tf-star, .tf-scale-btn').forEach((b) => b.addEventListener('click', () => {
      answers[f.id] = Number(b.dataset.value);
      const val = answers[f.id];
      el.querySelectorAll('.tf-star').forEach((s) => s.classList.toggle('is-on', Number(s.dataset.value) <= val));
      el.querySelectorAll('.tf-scale-btn').forEach((s) => s.classList.toggle('is-on', Number(s.dataset.value) === val));
      b.classList.remove('tf-blink'); void b.offsetWidth; b.classList.add('tf-blink');
      hideError(el);
      setTimeout(() => next(), 450);
    }));

    if (f.type === 'dropdown') bindDropdown(el, f);
  }

  function pick(el, f, btn) {
    const multi = f.type === 'multi';
    if (btn.dataset.other) {
      el.querySelectorAll('.tf-choice').forEach((c) => { c.classList.toggle('is-on', c === btn); c.setAttribute('aria-checked', c === btn); });
      const wrap = el.querySelector('.tf-other-wrap');
      wrap.hidden = false;
      const inp = wrap.querySelector('input');
      answers[f.id] = inp.value.trim() || undefined;
      inp.focus();
      return;
    }
    const val = btn.dataset.value;
    if (multi) {
      const set = new Set(answers[f.id] || []);
      if (set.has(val)) set.delete(val);
      else {
        if (f.max && set.size >= f.max) { showError(el, `Escolha no máximo ${f.max}`); return; }
        set.add(val);
      }
      answers[f.id] = f.options.filter((o) => set.has(o));
      btn.classList.toggle('is-on', set.has(val));
      btn.setAttribute('aria-checked', set.has(val));
    } else if (f.type === 'consent') {
      const on = answers[f.id] !== val;
      answers[f.id] = on ? val : undefined;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-checked', on);
    } else {
      answers[f.id] = val;
      el.querySelectorAll('.tf-choice').forEach((c) => { c.classList.toggle('is-on', c === btn); c.setAttribute('aria-checked', c === btn); });
      const ow = el.querySelector('.tf-other-wrap'); if (ow) ow.hidden = true;
    }
    btn.classList.remove('tf-blink'); void btn.offsetWidth; btn.classList.add('tf-blink');
    hideError(el);
    if (AUTO_ADVANCE.includes(f.type) && !multi) setTimeout(() => { if (F[cur] === f) next(); }, 450);
  }

  function bindDropdown(el, f) {
    const input = el.querySelector('.tf-dd-input');
    const list = el.querySelector('.tf-dd-list');
    const items = [...list.children];
    let active = -1;
    const open = (o) => { list.hidden = !o; input.setAttribute('aria-expanded', o); };
    const filter = () => {
      const q = input.value.trim().toLowerCase();
      items.forEach((li) => { li.hidden = q && !li.dataset.value.toLowerCase().includes(q); });
      active = -1; mark();
    };
    const visible = () => items.filter((li) => !li.hidden);
    const mark = () => items.forEach((li) => li.classList.toggle('is-active', visible()[active] === li));
    const choose = (li) => {
      input.value = li.dataset.value; answers[f.id] = li.dataset.value; open(false); hideError(el);
      li.classList.add('tf-blink'); setTimeout(() => next(), 350);
    };
    input.addEventListener('focus', () => { open(true); filter(); });
    input.addEventListener('click', () => open(true));
    input.addEventListener('input', () => { answers[f.id] = undefined; open(true); filter(); hideError(el); });
    input.addEventListener('keydown', (e) => {
      const vis = visible();
      if (e.key === 'ArrowDown') { e.preventDefault(); open(true); active = Math.min(vis.length - 1, active + 1); mark(); vis[active]?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); mark(); vis[active]?.scrollIntoView({ block: 'nearest' }); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        const exact = f.options.find((o) => o.toLowerCase() === input.value.trim().toLowerCase());
        if (vis[active]) choose(vis[active]);
        else if (exact) choose(items.find((li) => li.dataset.value === exact));
        else if (vis.length === 1) choose(vis[0]);
        else next();
      } else if (e.key === 'Escape') open(false);
    });
    list.addEventListener('mousedown', (e) => { const li = e.target.closest('li'); if (li) { e.preventDefault(); choose(li); } });
    input.addEventListener('blur', () => setTimeout(() => open(false), 120));
  }

  // global: letras escolhem opções, Enter avança telas sem input
  document.addEventListener('keydown', (e) => {
    const f = F[cur];
    if (!f || busy || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.matches('input, textarea')) return;
    const el = stage.querySelector('.tf-slide:not(.is-leaving)');
    if (e.key === 'Enter' && !e.target.matches('button, a')) { e.preventDefault(); next(); return; }
    if (['choice', 'multi', 'yes_no', 'consent'].includes(f.type) && /^[a-z]$/i.test(e.key)) {
      const k = e.key.toUpperCase();
      const btn = [...el.querySelectorAll('.tf-choice')].find((b) => b.querySelector('.tf-key').textContent === k);
      if (btn) { e.preventDefault(); btn.click(); }
    }
    if ((f.type === 'scale' || f.type === 'rating') && /^\d$/.test(e.key)) {
      const btn = el.querySelector(`[data-value="${e.key}"]`);
      if (btn) { e.preventDefault(); btn.click(); }
    }
  });

  // ---------- validação ----------
  function readValue(el, f) {
    const input = el.querySelector('.tf-input:not(.tf-other-input):not(.tf-dd-input)');
    if (!input) return;
    const raw = input.value.trim();
    if (f.type === 'phone') { const d = raw.replace(/\D/g, ''); answers[f.id] = d ? '+55' + d : undefined; return; }
    if (f.type === 'number') { answers[f.id] = raw === '' ? undefined : Number(raw.replace(/\./g, '').replace(',', '.')); return; }
    answers[f.id] = raw || undefined;
  }
  function validate(el, f) {
    readValue(el, f);
    const v = answers[f.id];
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || Number.isNaN(v);
    if (f.type === 'consent' && f.required && !v) return MSG.consent;
    if (empty) {
      if (f.type === 'dropdown' && el.querySelector('.tf-dd-input').value.trim()) return 'Escolha uma opção da lista';
      if (f.type === 'number' && Number.isNaN(v)) return MSG.number;
      return f.required ? MSG.required : '';
    }
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MSG.email;
    if (f.type === 'phone') { const d = v.replace(/\D/g, '').slice(2); if (d.length < 10 || d.length > 11) return MSG.phone; }
    if (f.type === 'url' && !/^(https?:\/\/)?[\w-]+(\.[\w-]+)+\S*$/i.test(v)) return MSG.url;
    if (f.type === 'number') {
      if (f.min != null && v < f.min) return `O mínimo é ${f.min}`;
      if (f.max != null && v > f.max) return `O máximo é ${f.max}`;
    }
    if (f.type === 'date') {
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
      const d = m && new Date(+m[3], +m[2] - 1, +m[1]);
      if (!m) return MSG.date;
      if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return 'Essa data não existe';
    }
    if (f.transform === 'instagram' && !/^[a-z0-9._]{1,30}$/.test(v)) return MSG.instagram;
    if (f.type === 'multi' && f.min && v.length < f.min) return f.min === 1 ? MSG.required : `Escolha pelo menos ${f.min}`;
    return '';
  }
  function showError(el, msg) {
    const box = el.querySelector('.tf-error'); if (!box) return;
    box.textContent = msg;
    box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
    el.querySelector('.tf-field')?.classList.add('has-error');
  }
  function hideError(el) {
    el.querySelector('.tf-error')?.classList.remove('show');
    el.querySelector('.tf-field')?.classList.remove('has-error');
  }

  // ---------- navegação ----------
  async function next() {
    if (busy) return;
    const f = F[cur];
    if (f.type === 'thankyou') return;
    const el = stage.querySelector('.tf-slide:not(.is-leaving)');
    if (QUESTION.includes(f.type)) {
      const err = validate(el, f);
      if (err) { showError(el, err); return; }
    }
    if (f.type === 'welcome' && !started) { started = true; track?.('start'); }
    const target = resolveNext(cur);
    // salvamento automático: cada resposta aceita vai pro rascunho
    if (QUESTION.includes(f.type)) {
      try { onProgress?.(progressState(f.id, target)); } catch (e) { console.error(e); }
    }
    if (F[target].type === 'thankyou') {
      busy = true;
      const btn = el.querySelector('.tf-ok');
      const label = btn?.innerHTML;
      if (btn) btn.innerHTML = '<span class="tf-spinner"></span>';
      el.classList.add('is-sending');
      try {
        await submit?.(collect());
        history.push(cur);
        go(target, 1);
        onDone?.(answers);
      } catch (e) {
        console.error(e);
        if (btn) btn.innerHTML = label;
        el.classList.remove('is-sending');
        showError(el, MSG.submit);
      }
      busy = false;
      return;
    }
    history.push(cur);
    go(target, 1);
  }
  function back() {
    if (busy || !history.length) return;
    const prev = history.pop();
    if (F[prev].type === 'welcome') { history.push(prev); return; }
    go(prev, -1);
  }

  function answeredCount() { return [...history, cur].filter((i) => QUESTION.includes(F[i].type) && answers[F[i].id] !== undefined && answers[F[i].id] !== '').length; }
  function progressState(stepId, target = cur) {
    const done = answeredCount();
    return { ...collect(), raw: JSON.parse(JSON.stringify(answers)), step_id: stepId, step_index: done,
      total_steps: done + (target >= 0 && target < F.length && F[target].type !== 'thankyou' ? remaining(target) : 0) };
  }
  // rascunho com o que está sendo digitado agora (sem validar), pra salvar ao fechar a aba
  function draft() {
    const f = F[cur];
    if (f && QUESTION.includes(f.type)) {
      const input = stage.querySelector('.tf-slide:not(.is-leaving) .tf-input:not(.tf-other-input):not(.tf-dd-input)');
      if (input && input.value.trim()) {
        const v = input.value.trim();
        answers[f.id] = f.type === 'phone' ? (v.replace(/\D/g, '').length >= 10 ? '+55' + v.replace(/\D/g, '') : answers[f.id]) : f.type === 'number' ? answers[f.id] : v;
      }
      if (answers[f.id] !== undefined && answers[f.id] !== '') return progressState(f.id, resolveNext(cur));
    }
    return progressState(f?.id);
  }

  function collect() {
    const path = [...history, cur];
    const list = path.map((i) => F[i]).filter((f) => QUESTION.includes(f.type) && answers[f.id] !== undefined && answers[f.id] !== '');
    const out = {
      answers: list.map((f) => ({ id: f.id, label: strip(recall(f.title)), value: Array.isArray(answers[f.id]) ? answers[f.id].join(', ') : String(answers[f.id]) }))
    };
    list.forEach((f) => { if (f.map) out[f.map] = answers[f.id]; });
    return out;
  }

  // retomada: preenche as respostas salvas e continua na primeira pergunta sem resposta
  if (initial?.answers && Object.keys(initial.answers).length) {
    Object.assign(answers, initial.answers);
    started = true;
    let i = 0;
    const guard = new Set();
    while (i >= 0 && i < F.length && !guard.has(i)) {
      guard.add(i);
      const f = F[i];
      const has = answers[f.id] !== undefined && answers[f.id] !== '' && !(Array.isArray(answers[f.id]) && !answers[f.id].length);
      if (f.type === 'welcome' || (QUESTION.includes(f.type) && has) || f.type === 'statement') { history.push(i); i = resolveNext(i); continue; }
      break;
    }
    if (i < 0 || F[i].type === 'thankyou') i = history.pop() ?? 0;
    go(i, 0);
  } else go(0, 0);
  return { answers, draft, go: (id) => go(idx[id], 1) };
}

// ---------- helpers ----------
function maskPhone(v) {
  let d = v.replace(/\D/g, '');
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2);
  d = d.slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
function maskDate(v) {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/');
}
function cleanInsta(v) {
  return v.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^\s*https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?].*$/, '').replace(/@/g, '').replace(/\s+/g, '').toLowerCase();
}
function autosize(t) { t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 260) + 'px'; }
