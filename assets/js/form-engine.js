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
const IC = {
  star: (on) => `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>`,
  upload: '<svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>',
  pin: '<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  br: '<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><rect width="22" height="16" rx="2.5" fill="#009B3A"/><path d="M11 2.2 19.6 8 11 13.8 2.4 8z" fill="#FEDF00"/><circle cx="11" cy="8" r="3.2" fill="#002776"/></svg>'
};
// ícones que o construtor oferece pros botões (chave salva no formulário)
const bi = (d, fill) => `<svg viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const BTN_ICONS = {
  arrow: ['Seta', bi('<path d="M5 12h14M13 6l6 6-6 6"/>')],
  whatsapp: ['WhatsApp', bi('<path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.2-.2-.5-.3z"/>', true)],
  send: ['Enviar', bi('<path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/>')],
  calendar: ['Agenda', bi('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>')],
  phone: ['Telefone', bi('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>')],
  mail: ['E-mail', bi('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>')],
  check: ['Confirmar', bi('<path d="M20 6 9 17l-5-5"/>')],
  play: ['Play', bi('<path d="M7 4v16l13-8z"/>', true)],
  download: ['Baixar', bi('<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>')],
  link: ['Link', bi('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>')],
  instagram: ['Instagram', bi('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>')],
  star: ['Estrela', bi('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>')]
};
// ícone escolhido (ou automático: WhatsApp pra links do WhatsApp, seta nos demais). "none" = sem ícone.
export function btnIcon(key, href = '') {
  const k = key || (/wa\.me|whatsapp/i.test(href) ? 'whatsapp' : 'arrow');
  if (k === 'none' || !BTN_ICONS[k]) return { before: '', after: '' };
  const html = `<span class="tf-btn-ic tf-btn-ic-${k}" aria-hidden="true">${BTN_ICONS[k][1]}</span>`;
  return k === 'arrow' ? { before: '', after: html } : { before: html, after: '' };
}
const btnLabel = (label, key, href) => { const i = btnIcon(key, href); return `${i.before}<span>${label}</span>${i.after}`; };

const MSG = {
  required: 'Essa resposta é obrigatória',
  email: 'Hmm, esse e-mail não parece válido',
  phone: 'Informe um WhatsApp válido com DDD',
  number: 'Digite só números',
  url: 'Esse link não parece válido',
  date: 'Use o formato DD/MM/AAAA',
  instagram: 'Use só letras, números, ponto e underline',
  consent: 'Você precisa aceitar pra continuar',
  submit: 'Não conseguimos enviar agora. Confira sua conexão e tente de novo.',
  business: 'Use seu e-mail de trabalho (não aceitamos Gmail, Hotmail e similares)',
  cpf: 'CPF inválido. Confira os números',
  cnpj: 'CNPJ inválido. Confira os números',
  cep: 'CEP não encontrado. Confira os números',
  file: 'Envie um arquivo pra continuar'
};
const FREE_EMAIL = ['gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.com.br', 'outlook.com', 'outlook.com.br', 'live.com', 'msn.com', 'yahoo.com', 'yahoo.com.br',
  'icloud.com', 'me.com', 'bol.com.br', 'uol.com.br', 'terra.com.br', 'ig.com.br', 'globo.com', 'globomail.com', 'r7.com', 'zipmail.com.br', 'aol.com', 'gmx.com', 'proton.me', 'protonmail.com', 'yandex.com'];
const QUESTION = ['short_text', 'long_text', 'email', 'phone', 'number', 'url', 'date', 'choice', 'multi', 'dropdown', 'yes_no', 'rating', 'scale', 'consent', 'cep', 'cpf', 'cnpj', 'file', 'calendly'];
export const QUESTION_TYPES = QUESTION;
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

export function mountForm(root, form, { submit, track, onDone, onProgress, initial, upload, settings = {} } = {}) {
  const F = form.fields;
  const ac = new AbortController(); // destroy() remove os ouvintes globais (prévia do construtor remonta o form)
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
    const media = f.image ? `<figure class="tf-media tf-a ${f.imageSize === 'large' ? 'is-large' : ''}"><img src="${esc(f.image)}" alt="${esc(f.imageAlt || '')}" loading="lazy"></figure>` : '';
    if (f.type === 'testimonial') return media;
    return `${media}
      ${numbered ? `<div class="tf-num tf-a">${n} ${ICON.arrow}</div>` : ''}
      <h1 class="tf-title tf-a">${recall(f.title)}${numbered && f.required ? '<span class="tf-req" aria-label="obrigatória"> *</span>' : ''}</h1>
      ${f.desc ? `<p class="tf-desc tf-a">${recall(f.desc).replace(/\n/g, '<br>')}</p>` : ''}`;
  }
  const okBtn = (label = 'Avançar', hint = true, icon = null) => `
    <div class="tf-actions tf-a">
      <button type="button" class="tf-btn tf-ok">${icon ? btnLabel(label, icon) : label}</button>
      ${hint ? '<span class="tf-hint">pressione <kbd>Enter ↵</kbd></span>' : ''}
    </div>`;
  const errBox = '<div class="tf-error" role="alert"></div>';

  function body(f) {
    const v = answers[f.id];
    switch (f.type) {
      case 'welcome':
        return `<div class="tf-actions tf-a"><button type="button" class="tf-btn tf-btn-lg tf-ok">${btnLabel(esc(f.button || 'Começar'), f.icon)}</button><span class="tf-hint">pressione <kbd>Enter ↵</kbd></span></div>
          ${settings.privacy !== false ? `<p class="tf-privacy tf-a">Ao continuar, você concorda com a <a href="${esc(settings.privacyUrl || '/privacidade/')}" target="_blank" rel="noopener">Política de Privacidade</a>. Seus dados ficam protegidos conforme a LGPD.</p>` : ''}`;
      case 'statement':
        return okBtn(esc(f.button || 'Continuar'), true, f.icon || 'none');
      case 'testimonial': {
        const stars = f.rating ? `<div class="tf-stars tf-a" aria-label="${f.rating} de 5">${[1, 2, 3, 4, 5].map((n) => IC.star(n <= f.rating)).join('')}</div>` : '';
        return `${f.title ? `<p class="tf-kicker tf-a">${recall(f.title)}</p>` : ''}${stars}
          <blockquote class="tf-quote tf-a">“${recall(f.quote || '')}”</blockquote>
          <div class="tf-author tf-a">${f.photo ? `<img src="${esc(f.photo)}" alt="">` : `<span class="tf-author-av">${esc((f.author || '?').slice(0, 1))}</span>`}<div><b>${esc(f.author || '')}</b>${f.role ? `<span>${esc(f.role)}</span>` : ''}</div></div>
          ${okBtn(esc(f.button || 'Continuar'), true, f.icon || 'none')}`;
      }
      case 'thankyou':
        return `<div class="tf-thanks-icon tf-a">${ICON.check}</div>${f.cta ? `<div class="tf-actions tf-a"><a class="tf-btn tf-btn-lg" href="${esc(f.cta.href)}" target="_blank" rel="noopener">${btnLabel(esc(f.cta.label), f.cta.icon, f.cta.href)}</a></div>` : ''}
          ${f.redirect?.url ? `<p class="tf-redirect tf-a" data-redirect>Redirecionando em <b>${f.redirect.delay ?? 5}</b> s…</p>` : ''}`;
      case 'cep': {
        const info = answers.__cep?.[f.id];
        return `<div class="tf-field tf-a"><input class="tf-input" type="text" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" value="${esc(v ?? '')}" aria-label="${esc(strip(recall(f.title)))}"><span class="tf-cep-spin" hidden><span class="tf-spinner"></span></span></div>
          <div class="tf-cep-info tf-a" ${info ? '' : 'hidden'}>${info ? cepText(info) : ''}</div>${errBox}${okBtn()}`;
      }
      case 'cpf': case 'cnpj':
        return `<div class="tf-field tf-a"><input class="tf-input" type="text" inputmode="numeric" autocomplete="off" placeholder="${f.type === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}" value="${esc(v ?? '')}" aria-label="${esc(strip(recall(f.title)))}"></div>${errBox}${okBtn()}`;
      case 'file': {
        const maxMb = f.maxMb || 20;
        const cur = answers.__files?.[f.id];
        return `<label class="tf-drop tf-a ${cur ? 'has-file' : ''}"><input type="file" class="tf-file" ${f.accept ? `accept="${esc(f.accept)}"` : ''} hidden>
            <span class="tf-drop-ic">${IC.upload}</span><span class="tf-drop-t">${cur ? esc(cur.name) : 'Clique pra escolher ou arraste o arquivo aqui'}</span><small>${cur ? `<span class="tf-sent">${ICON.check}Enviado</span> · clique pra trocar` : `Até ${maxMb} MB${f.accept ? ' · ' + esc(f.accept.replace(/\./g, '').toUpperCase()) : ''}`}</small></label>
          ${errBox}${okBtn(f.required ? 'Avançar' : cur ? 'Avançar' : 'Pular')}`;
      }
      case 'calendly': {
        const u = new URL(f.url || 'https://calendly.com');
        u.searchParams.set('embed_type', 'Inline'); u.searchParams.set('embed_domain', location.hostname); u.searchParams.set('hide_gdpr_banner', '1');
        if (answers.nome) u.searchParams.set('name', answers.nome);
        const mail = Object.values(answers).find((x) => typeof x === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(x));
        if (mail) u.searchParams.set('email', mail);
        return `<div class="tf-cal tf-a">${v ? `<div class="tf-cal-done">${ICON.check} Horário agendado</div>` : `<iframe src="${esc(u.toString())}" title="Agendar horário" loading="lazy"></iframe>`}</div>${errBox}
          ${f.required && !v ? '' : okBtn(v ? 'Avançar' : 'Pular')}`;
      }
      case 'short_text': case 'email': case 'number': case 'url': {
        const type = { email: 'email', number: 'text', url: 'url' }[f.type] || 'text';
        const mode = { email: 'email', number: 'numeric', url: 'url' }[f.type] || 'text';
        const auto = f.autocomplete || { email: 'email', url: 'url' }[f.type] || 'off';
        const insta = f.transform === 'instagram';
        return `<div class="tf-field tf-a">${insta ? '<span class="tf-prefix">@</span>' : ''}<input class="tf-input" type="${type}" inputmode="${mode}" autocomplete="${auto}" placeholder="${esc(f.placeholder || 'Sua resposta...')}" value="${esc(v ?? '')}" ${f.maxLength ? `maxlength="${f.maxLength}"` : ''} ${insta || f.type !== 'short_text' ? 'autocapitalize="off" spellcheck="false"' : ''} aria-label="${esc(strip(recall(f.title)))}"></div>${errBox}${okBtn()}`;
      }
      case 'phone':
        return `<div class="tf-field tf-a"><span class="tf-prefix tf-flag">${IC.br}<span>+55</span></span><input class="tf-input" type="tel" inputmode="tel" autocomplete="tel-national" placeholder="${esc(f.placeholder || '(62) 99999-9999')}" value="${esc(v ? maskPhone(String(v).replace(/^\+?55/, '')) : '')}" aria-label="${esc(strip(recall(f.title)))}"></div>${errBox}${okBtn()}`;
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
    if (f.type === 'thankyou' && f.redirect?.url) {
      let left = f.redirect.delay ?? 5;
      const b = el.querySelector('[data-redirect] b');
      const url = recall(f.redirect.url).replace(/&amp;/g, '&');
      const iv = setInterval(() => { left--; if (b) b.textContent = Math.max(0, left); if (left <= 0) { clearInterval(iv); location.href = url; } }, 1000);
    }

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
        if (f.type === 'cpf') input.value = maskCpf(input.value);
        if (f.type === 'cnpj') input.value = maskCnpj(input.value);
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
    if (f.type === 'cep') bindCep(el, f);
    if (f.type === 'file') bindFile(el, f);
    if (f.type === 'calendly') bindCalendly(el, f);
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

  // CEP: busca endereço no ViaCEP (cidade e estado melhoram a correspondência nos anúncios)
  function bindCep(el, f) {
    const input = el.querySelector('.tf-input'); const box = el.querySelector('.tf-cep-info'); const spin = el.querySelector('.tf-cep-spin');
    const look = async () => {
      const d = input.value.replace(/\D/g, '');
      if (d.length !== 8) { box.hidden = true; return; }
      spin.hidden = false;
      try {
        const r = await (await fetch(`https://viacep.com.br/ws/${d}/json/`)).json();
        if (r.erro) throw new Error('cep');
        answers.__cep = { ...(answers.__cep || {}), [f.id]: { cep: d, logradouro: r.logradouro, bairro: r.bairro, cidade: r.localidade, estado: r.uf } };
        box.innerHTML = cepText(answers.__cep[f.id]); box.hidden = false; hideError(el);
      } catch (e) { if (answers.__cep) delete answers.__cep[f.id]; box.hidden = true; showError(el, MSG.cep); }
      spin.hidden = true;
    };
    input.addEventListener('input', () => { input.value = maskCep(input.value); if (input.value.replace(/\D/g, '').length === 8) look(); else box.hidden = true; });
  }
  function bindFile(el, f) {
    const inp = el.querySelector('.tf-file'); const drop = el.querySelector('.tf-drop');
    const send = async (file) => {
      if (!file) return;
      const maxMb = f.maxMb || 20;
      if (file.size > maxMb * 1048576) return showError(el, `Arquivo maior que ${maxMb} MB`);
      if (f.accept && !f.accept.split(',').some((a) => { a = a.trim().toLowerCase(); return a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : file.name.toLowerCase().endsWith(a) || file.type === a; }))
        return showError(el, 'Tipo de arquivo não aceito');
      drop.classList.add('is-uploading'); drop.querySelector('.tf-drop-t').textContent = 'Enviando ' + file.name + '…'; hideError(el);
      try {
        const path = upload ? await upload(file) : file.name;
        answers[f.id] = path;
        answers.__files = { ...(answers.__files || {}), [f.id]: { name: file.name, size: file.size } };
        drop.classList.add('has-file'); drop.querySelector('.tf-drop-t').textContent = file.name; drop.querySelector('small').innerHTML = `<span class="tf-sent">${ICON.check}Enviado</span> · clique pra trocar`;
        const ok = el.querySelector('.tf-ok'); if (ok) ok.textContent = 'Avançar';
      } catch (e) { console.error(e); showError(el, 'Não conseguimos enviar o arquivo. Tente de novo.'); drop.querySelector('.tf-drop-t').textContent = 'Clique pra escolher ou arraste o arquivo aqui'; }
      drop.classList.remove('is-uploading');
    };
    inp.addEventListener('change', () => send(inp.files[0]));
    ['dragover', 'dragenter'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
    drop.addEventListener('drop', (e) => send(e.dataTransfer.files[0]));
  }
  function bindCalendly(el, f) {
    const onMsg = (e) => {
      if (!/calendly\.com$/.test(new URL(e.origin).hostname) || e.data?.event !== 'calendly.event_scheduled') return;
      answers[f.id] = 'Agendado' + (e.data.payload?.event?.uri ? ` (${e.data.payload.event.uri.split('/').pop()})` : '');
      window.removeEventListener('message', onMsg);
      if (F[cur] === f) next();
    };
    window.addEventListener('message', onMsg, { signal: ac.signal });
  }

  // global: letras escolhem opções, Enter avança telas sem input
  document.addEventListener('keydown', (e) => {
    const f = F[cur];
    if (!root.isConnected) return;
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
  }, { signal: ac.signal });

  // ---------- validação ----------
  function readValue(el, f) {
    if (f.type === 'file' || f.type === 'calendly') return;
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
    if (empty && f.type === 'file' && f.required) return MSG.file;
    if (empty) {
      if (f.type === 'dropdown' && el.querySelector('.tf-dd-input').value.trim()) return 'Escolha uma opção da lista';
      if (f.type === 'number' && Number.isNaN(v)) return MSG.number;
      return f.required ? MSG.required : '';
    }
    if (f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) return MSG.email;
    if (f.type === 'email' && f.business && FREE_EMAIL.includes(String(v).split('@')[1].toLowerCase())) return MSG.business;
    if (f.type === 'cpf' && !validCpf(v)) return MSG.cpf;
    if (f.type === 'cnpj' && !validCnpj(v)) return MSG.cnpj;
    if (f.type === 'cep' && !answers.__cep?.[f.id]) return MSG.cep;
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
    const show = (f) => {
      const v = answers[f.id];
      if (f.type === 'cep' && answers.__cep?.[f.id]) return cepText(answers.__cep[f.id], true);
      if (f.type === 'file' && answers.__files?.[f.id]) return v;
      return Array.isArray(v) ? v.join(', ') : String(v);
    };
    const out = {
      answers: list.map((f) => ({ id: f.id, label: strip(recall(f.title)), value: show(f), ...(f.type === 'file' ? { type: 'file', file_name: answers.__files?.[f.id]?.name } : {}) }))
    };
    list.forEach((f) => {
      if (f.map) out[f.map] = answers[f.id];
      if (f.type === 'cep' && answers.__cep?.[f.id]) { const c = answers.__cep[f.id]; out.cep = c.cep; out.cidade = c.cidade; out.estado = out.estado || c.estado; }
    });
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
      if (f.type === 'welcome' || (QUESTION.includes(f.type) && has) || f.type === 'statement' || f.type === 'testimonial') { history.push(i); i = resolveNext(i); continue; }
      break;
    }
    if (i < 0 || F[i].type === 'thankyou') i = history.pop() ?? 0;
    go(i, 0);
  } else go(0, 0);
  return { answers, draft, go: (id) => { if (idx[id] != null) go(idx[id], 1); }, destroy: () => { ac.abort(); root.innerHTML = ''; } };
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
function maskCep(v) { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d; }
function maskCpf(v) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  return d.replace(/^(\d{3})(\d)/, '$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}
function maskCnpj(v) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}
export function validCpf(v) {
  const d = String(v).replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const dig = (n) => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  return dig(9) === +d[9] && dig(10) === +d[10];
}
export function validCnpj(v) {
  const d = String(v).replace(/\D/g, '');
  if (d.length !== 14 || /^(\d)\1+$/.test(d)) return false;
  const dig = (n) => { const w = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]; const s = w.reduce((a, x, i) => a + x * +d[i], 0); const r = s % 11; return r < 2 ? 0 : 11 - r; };
  return dig(12) === +d[12] && dig(13) === +d[13];
}
function cepText(c, plain = false) {
  const line = [c.logradouro, c.bairro].filter(Boolean).join(', ');
  const t = `${c.cep.slice(0, 5)}-${c.cep.slice(5)} · ${c.cidade}/${c.estado}${line ? ' · ' + line : ''}`;
  return plain ? t : `<span class="tf-pin">${IC.pin}</span>${esc(t)}`;
}
