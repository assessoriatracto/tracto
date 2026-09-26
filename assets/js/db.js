// Camada de dados compartilhada entre /aplicar e /crm.
// Supabase quando configurado em tracto-config.js; senão MODO DEMO (localStorage, mesma API).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.TRACTO_CONFIG || {};
export const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
const sb = LIVE ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const must = ({ data, error }) => { if (error) throw error; return data; };
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

// ============================================================
// SUPABASE
// ============================================================
const live = {
  async submitLead(p) { return must(await sb.rpc('submit_lead', { p })); },
  async trackEvent(e) { await sb.from('form_events').insert(e); },

  async session() { return must(await sb.auth.getSession()).session; },
  async signIn(email, password) { return must(await sb.auth.signInWithPassword({ email, password })).session; },
  async signOut() { await sb.auth.signOut(); },
  async me() {
    const s = await this.session(); if (!s) return null;
    return must(await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle());
  },

  async listLeads() { return must(await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(10000)); },
  async createLead(l) { return must(await sb.from('leads').insert(l).select().single()); },
  async updateLeads(ids, patch) { return must(await sb.from('leads').update(patch).in('id', ids)); },
  async deleteLeads(ids) { return must(await sb.from('leads').delete().in('id', ids)); },

  async listStages() { return must(await sb.from('stages').select('*').order('position')); },
  async saveStage(s) { return must(await sb.from('stages').upsert(s).select().single()); },
  async deleteStage(id, moveTo) {
    if (moveTo) must(await sb.from('leads').update({ stage_id: moveTo }).eq('stage_id', id));
    return must(await sb.from('stages').delete().eq('id', id));
  },

  async listLabels() { return must(await sb.from('labels').select('*').order('name')); },
  async saveLabel(l) { return must(await sb.from('labels').upsert(l).select().single()); },
  async deleteLabel(id) { return must(await sb.from('labels').delete().eq('id', id)); },

  async listProfiles() { return must(await sb.from('profiles').select('*').order('nome')); },
  async updateProfile(id, patch) { return must(await sb.from('profiles').update(patch).eq('id', id)); },

  async listActivity(leadId) { return must(await sb.from('lead_activity').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })); },
  async addActivity(leadId, type, body, me) {
    return must(await sb.from('lead_activity').insert({ lead_id: leadId, type, body, author_id: me?.id, author_name: me?.nome }));
  },

  async listEvents(sinceIso) {
    const out = []; let from = 0;
    for (;;) {
      let q = sb.from('form_events').select('form_id,session_id,event,step_id,created_at').order('id').range(from, from + 999);
      if (sinceIso) q = q.gte('created_at', sinceIso);
      const rows = must(await q); out.push(...rows);
      if (rows.length < 1000) return out;
      from += 1000;
    }
  },

  subscribe(cb) {
    sb.channel('leads-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (p) => cb(p.eventType, p.new))
      .subscribe();
  }
};

// ============================================================
// MODO DEMO (localStorage) — imita os triggers do banco
// ============================================================
const K = { leads: 'tracto_v2_leads', stages: 'tracto_v2_stages', labels: 'tracto_v2_labels', act: 'tracto_v2_activity', ev: 'tracto_v2_events' };
const read = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const DEMO_ME = { id: 'demo-user', nome: 'Você (demo)', email: 'demo@tracto', ativo: true };
const DEMO_TEAM = [DEMO_ME, { id: 'demo-isaque', nome: 'Isaque', email: 'isaque@tracto', ativo: true }, { id: 'demo-luiz', nome: 'Luiz', email: 'luiz@tracto', ativo: true }];

function demoStages() {
  let s = read(K.stages, null);
  if (!s) {
    s = [['Em análise', '#6AA8FF', 'open'], ['Contato realizado', '#B58CFF', 'open'], ['Ligação', '#4FD1C5', 'open'], ['Qualificado', '#FFAD00', 'open'],
      ['Reunião agendada', '#FF8A3D', 'open'], ['Venda realizada', '#3DDC84', 'won'], ['Perdido', '#6B6B6B', 'lost']]
      .map(([name, color, kind], position) => ({ id: uid(), name, color, kind, position }));
    write(K.stages, s);
  }
  return s.sort((a, b) => a.position - b.position);
}
function log(leadId, type, body, who = DEMO_ME, at = now()) {
  const a = read(K.act);
  a.unshift({ id: uid(), lead_id: leadId, created_at: at, author_id: who?.id || null, author_name: who?.nome || 'Sistema', type, body });
  write(K.act, a);
}
const fmtBR = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const demo = {
  async submitLead(p) {
    const wpp = String(p.whatsapp || '').replace(/\D/g, '');
    if (!p.nome || p.nome.trim().length < 2) throw new Error('nome obrigatório');
    if (wpp.length < 10) throw new Error('whatsapp inválido');
    const leads = read(K.leads);
    const dup = leads.find((l) => l.whatsapp === wpp && l.form_id === p.form_id && Date.now() - new Date(l.created_at) < 600000);
    if (dup) { Object.assign(dup, { answers: p.answers, nome: p.nome.trim() }); write(K.leads, leads); return dup.id; }
    const medium = (p.utm_medium || '').toLowerCase();
    const lead = {
      id: uid(), created_at: p._created_at || now(), updated_at: now(), last_activity_at: p._created_at || now(),
      form_id: p.form_id, form_name: p.form_name, answers: p.answers,
      nome: p.nome.trim(), whatsapp: wpp, email: p.email || null, instagram: (p.instagram || '').replace(/[@\s]/g, '').toLowerCase() || null,
      faturamento: p.faturamento || null, stage_id: p._stage_id || demoStages().find((s) => s.kind === 'open').id,
      assigned_to: p._assigned_to || null, label_ids: p._label_ids || [], valor: p._valor || null, reminder_at: null, reminder_note: null,
      source: p.fbclid || p.gclid || ['cpc', 'ppc', 'paid', 'paid_social', 'ads', 'ad', 'pago'].includes(medium) ? 'pago' : 'organico',
      utm_source: p.utm_source || null, utm_medium: p.utm_medium || null, utm_campaign: p.utm_campaign || null,
      utm_content: p.utm_content || null, utm_term: p.utm_term || null, fbclid: p.fbclid || null,
      referrer: p.referrer || null, user_agent: p.user_agent || null, session_id: p.session_id || null
    };
    leads.unshift(lead); write(K.leads, leads);
    log(lead.id, 'created', 'Formulário preenchido: ' + (p.form_name || p.form_id), null, lead.created_at);
    return lead.id;
  },
  async trackEvent(e) { const ev = read(K.ev); ev.push({ ...e, created_at: e.created_at || now() }); write(K.ev, ev.slice(-20000)); },

  async session() { return { user: DEMO_ME }; },
  async signIn() { return { user: DEMO_ME }; },
  async signOut() {},
  async me() { return DEMO_ME; },

  async listLeads() { return read(K.leads).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  async createLead(l) {
    const lead = { id: uid(), created_at: now(), updated_at: now(), last_activity_at: now(), form_id: 'manual', form_name: 'Cadastro manual', answers: [], label_ids: [], source: 'manual', stage_id: demoStages()[0].id, ...l };
    write(K.leads, [lead, ...read(K.leads)]);
    log(lead.id, 'created', 'Lead criado manualmente');
    return lead;
  },
  async updateLeads(ids, patch) {
    const stages = demoStages();
    const leads = read(K.leads).map((l) => {
      if (!ids.includes(l.id)) return l;
      if ('stage_id' in patch && patch.stage_id !== l.stage_id) log(l.id, 'stage', `Estágio: ${stages.find((s) => s.id === l.stage_id)?.name || 'sem estágio'} → ${stages.find((s) => s.id === patch.stage_id)?.name || 'sem estágio'}`);
      if ('assigned_to' in patch && patch.assigned_to !== l.assigned_to) log(l.id, 'assign', 'Atribuído a ' + (DEMO_TEAM.find((p) => p.id === patch.assigned_to)?.nome || 'ninguém'));
      if ('reminder_at' in patch && patch.reminder_at !== l.reminder_at) log(l.id, 'reminder', patch.reminder_at ? 'Lembrete para ' + fmtBR(patch.reminder_at) : 'Lembrete removido');
      return { ...l, ...patch, updated_at: now(), last_activity_at: now() };
    });
    write(K.leads, leads);
  },
  async deleteLeads(ids) {
    write(K.leads, read(K.leads).filter((l) => !ids.includes(l.id)));
    write(K.act, read(K.act).filter((a) => !ids.includes(a.lead_id)));
  },

  async listStages() { return demoStages(); },
  async saveStage(s) {
    const all = demoStages();
    const i = all.findIndex((x) => x.id === s.id);
    const row = i >= 0 ? { ...all[i], ...s } : { id: uid(), color: '#FFAD00', kind: 'open', position: all.length, ...s };
    if (i >= 0) all[i] = row; else all.push(row);
    write(K.stages, all); return row;
  },
  async deleteStage(id, moveTo) {
    if (moveTo) write(K.leads, read(K.leads).map((l) => (l.stage_id === id ? { ...l, stage_id: moveTo } : l)));
    write(K.stages, demoStages().filter((s) => s.id !== id));
  },

  async listLabels() { return read(K.labels).sort((a, b) => a.name.localeCompare(b.name)); },
  async saveLabel(l) {
    const all = read(K.labels);
    const i = all.findIndex((x) => x.id === l.id);
    const row = i >= 0 ? { ...all[i], ...l } : { id: uid(), color: '#FFAD00', ...l };
    if (i >= 0) all[i] = row; else all.push(row);
    write(K.labels, all); return row;
  },
  async deleteLabel(id) {
    write(K.labels, read(K.labels).filter((l) => l.id !== id));
    write(K.leads, read(K.leads).map((l) => ({ ...l, label_ids: (l.label_ids || []).filter((x) => x !== id) })));
  },

  async listProfiles() { return DEMO_TEAM; },
  async updateProfile() {},

  async listActivity(leadId) { return read(K.act).filter((a) => a.lead_id === leadId); },
  async addActivity(leadId, type, body) {
    log(leadId, type, body);
    if (type === 'note') write(K.leads, read(K.leads).map((l) => (l.id === leadId ? { ...l, last_activity_at: now() } : l)));
  },

  async listEvents(sinceIso) { return read(K.ev).filter((e) => !sinceIso || e.created_at >= sinceIso); },

  subscribe(cb) { window.addEventListener('storage', (e) => { if (e.key === K.leads) cb('INSERT', null); }); },

  // só demo: popula dados realistas
  async seed(forms) {
    const stages = demoStages();
    const nomes = ['Carlos Menezes', 'Juliana Prado', 'Roberto Alves', 'Fernanda Lima', 'Marcos Tavares', 'Patrícia Rocha', 'Eduardo Nunes', 'Sandra Queiroz', 'Thiago Barros', 'Luciana Freitas', 'Anderson Moura', 'Renata Dias', 'Wagner Costa', 'Cláudia Ribeiro', 'Nivaldo Rodrigues', 'Marcelo Moraes', 'Douglas Pereira', 'Simone Araújo', 'Paulo Henrique', 'Kátia Mendes', 'José Carlos', 'Aline Batista', 'Rafael Gomes', 'Vanessa Teles'];
    const lojas = ['casadoconstrutor', 'pradoferragens', 'alvesmateriais', 'limatintas', 'tavaresferragens', 'rochaconstrucao', 'nunesmateriais', 'queirozhome', 'barrosferragista', 'freitasacabamentos', 'mouraconstrucoes', 'diasmateriais', 'costamadeiras', 'ribeirotintas', 'wkferragista', 'moraesdepositos', 'drapservicos', 'araujoeletrica', 'phmateriais', 'mendeshidraulica', 'jcferragens', 'batistapisos', 'gomesconstrucao', 'telesmateriais'];
    const camps = ['diagnostico-ferragistas', 'diagnostico-ferragistas', 'remarketing-30d', 'lookalike-clientes', null];
    const labels = [await this.saveLabel({ name: 'Prioridade', color: '#FF8A3D' }), await this.saveLabel({ name: 'Indicação', color: '#3DDC84' }), await this.saveLabel({ name: 'Retornar', color: '#6AA8FF' })];
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    const ev = read(K.ev);
    for (let i = 0; i < nomes.length; i++) {
      const form = forms[i % 3 === 2 ? 1 : 0];
      const at = new Date(Date.now() - Math.random() * 28 * 86400000);
      const fat = form.fields.find((f) => f.id === 'faturamento');
      const exp = form.fields.find((f) => f.id === 'experiencia');
      const answers = [
        { id: 'nome', label: 'Qual o seu nome e sobrenome?', value: nomes[i] },
        { id: 'whatsapp', label: 'Qual seu número de Whatsapp?', value: '+55' + (11 + (i % 80)) + '99' + String(1000000 + i * 7919).slice(0, 7) },
        { id: 'instagram', label: 'Qual o @ do instagram da sua empresa?', value: lojas[i] },
        ...(i % 3 ? [] : [{ id: 'email', label: 'Qual é o seu e-mail?', value: lojas[i] + '@gmail.com' }]),
        { id: 'experiencia', label: exp.title, value: rnd(exp.options) },
        { id: 'faturamento', label: 'Qual é o faturamento médio mensal da sua empresa?', value: fat.options[(i * 7) % 5] }
      ];
      const stage = stages[Math.min(stages.length - 1, Math.floor(Math.pow(Math.random(), 1.6) * stages.length))];
      const camp = rnd(camps);
      await this.submitLead({
        form_id: form.id, form_name: form.name, answers, nome: nomes[i], whatsapp: answers[1].value, instagram: lojas[i],
        email: answers.find((a) => a.id === 'email')?.value, faturamento: answers.at(-1).value,
        utm_source: camp ? 'facebook' : 'instagram', utm_medium: camp ? 'paid_social' : 'bio', utm_campaign: camp,
        fbclid: camp ? 'demo' : null, _created_at: at.toISOString(), _stage_id: stage.id,
        _assigned_to: i % 4 ? rnd(DEMO_TEAM).id : null, _label_ids: i % 5 === 0 ? [rnd(labels).id] : [],
        _valor: stage.kind === 'won' ? 2000 + Math.round(Math.random() * 30) * 100 : null
      });
    }
    // eventos de funil: views > starts > steps > submits
    for (let s = 0; s < 260; s++) {
      const form = forms[s % 3 === 2 ? 1 : 0];
      const at = new Date(Date.now() - Math.random() * 28 * 86400000).toISOString();
      const sid = 'demo' + s;
      ev.push({ form_id: form.id, session_id: sid, event: 'view', created_at: at });
      if (Math.random() < 0.55) {
        ev.push({ form_id: form.id, session_id: sid, event: 'start', created_at: at });
        const qs = form.fields.filter((f) => f.type !== 'welcome' && f.type !== 'thankyou');
        for (const q of qs) {
          ev.push({ form_id: form.id, session_id: sid, event: 'step', step_id: q.id, created_at: at });
          if (Math.random() < 0.13) break;
        }
      }
    }
    write(K.ev, ev);
  }
};

// Fora do localhost, sem Supabase configurado, nada é gravado em silêncio no navegador:
// o form mostra erro de envio e o CRM avisa que falta configurar.
export const DEMO_ALLOWED = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const notConfigured = new Proxy({}, {
  get: (_, key) => {
    if (key === 'trackEvent' || key === 'subscribe') return async () => {};
    if (key === 'session') return async () => null;
    return async () => { throw new Error('Supabase não configurado'); };
  }
});
export const CONFIGURED = LIVE || DEMO_ALLOWED;
export const DB = LIVE ? live : DEMO_ALLOWED ? demo : notConfigured;
