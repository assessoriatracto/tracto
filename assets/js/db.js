// Camada de dados compartilhada entre /aplicar e /crm.
// Supabase quando configurado em tracto-config.js; senão MODO DEMO (localStorage, mesma API e mesmas regras do banco).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const cfg = window.TRACTO_CONFIG || {};
export const LIVE = !!(cfg.supabaseUrl && cfg.supabaseAnonKey);
const sb = LIVE ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;

const must = ({ data, error }) => { if (error) throw error; return data; };
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const PIXEL_EVENTS_RECOMMENDED = { page_view: true, view_content: true, form_start: true, form_step: false, lead: true, funnel: true };

// ============================================================
// SUPABASE
// ============================================================
const live = {
  // ---------- formulário (visitante) ----------
  async submitLead(p) { return must(await sb.rpc('submit_lead', { p })); },
  async trackEvent(e) { await sb.from('form_events').insert(e); },
  async savePartial(p, { keepalive = false } = {}) {
    if (!keepalive) return must(await sb.rpc('save_partial', { p }));
    // ao fechar a aba: fetch com keepalive pra não perder a última resposta
    await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/save_partial`, {
      method: 'POST', keepalive: true,
      headers: { apikey: cfg.supabaseAnonKey, Authorization: `Bearer ${cfg.supabaseAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p })
    });
  },
  async getPartial(token) { return must(await sb.rpc('get_partial', { p_token: token })); },
  async publicTracking() { return must(await sb.rpc('public_tracking')); },

  // ---------- sessão ----------
  async session() { return must(await sb.auth.getSession()).session; },
  async signIn(email, password) { return must(await sb.auth.signInWithPassword({ email, password })).session; },
  async signOut() { await sb.auth.signOut(); },
  async me() {
    const s = await this.session(); if (!s) return null;
    return must(await sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle());
  },

  // ---------- leads ----------
  async listLeads() { return must(await sb.from('leads').select('*').order('created_at', { ascending: false }).limit(10000)); },
  async createLead(l) { return must(await sb.from('leads').insert(l).select().single()); },
  async updateLeads(ids, patch) { return must(await sb.from('leads').update(patch).in('id', ids)); },
  async deleteLeads(ids) { return must(await sb.from('leads').delete().in('id', ids)); },
  async listActivity(leadId) { return must(await sb.from('lead_activity').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })); },
  async addActivity(leadId, type, body, me) {
    return must(await sb.from('lead_activity').insert({ lead_id: leadId, type, body, author_id: me?.id, author_name: me?.nome }));
  },

  // ---------- pipeline e equipe ----------
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

  // ---------- analytics do form ----------
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

  // ---------- recuperação ----------
  async listPartials() { return must(await sb.from('partial_leads').select('*').neq('status', 'convertido').order('updated_at', { ascending: false }).limit(1000)); },
  async updatePartial(id, patch) { return must(await sb.from('partial_leads').update(patch).eq('id', id)); },
  async convertPartial(id) { return must(await sb.rpc('convert_partial', { p_id: id })); },
  async sweepPartials() { try { return must(await sb.rpc('partials_sweep')); } catch (e) { return 0; } },

  // ---------- rastreamento ----------
  async getTracking() { return must(await sb.from('tracking_settings').select('*').eq('id', 1).maybeSingle()); },
  async saveTracking(patch) { return must(await sb.from('tracking_settings').update({ ...patch, updated_at: now() }).eq('id', 1).select().single()); },
  async listPixels() { return must(await sb.from('tracking_pixels').select('*').order('created_at')); },
  async savePixel(p) { return must(await sb.from('tracking_pixels').upsert(p).select().single()); },
  async deletePixel(id) { return must(await sb.from('tracking_pixels').delete().eq('id', id)); },
  async testPixel(id) { return must(await sb.rpc('tracking_test', { p_pixel: id })); },
  async listTrackingEvents({ limit = 100, leadId } = {}) {
    let q = sb.from('tracking_events').select('id,created_at,platform,pixel_ref,pixel_id,lead_id,event_name,event_id,test,status_code,response,payload').order('id', { ascending: false }).limit(limit);
    if (leadId) q = q.eq('lead_id', leadId);
    return must(await q);
  },

  // ---------- integrações ----------
  async listApiKeys() { return must(await sb.from('api_keys').select('id,created_at,name,prefix,last_used_at,revoked').order('created_at', { ascending: false })); },
  async createApiKey(name) { return must(await sb.rpc('create_api_key', { p_name: name })); },
  async revokeApiKey(id) { return must(await sb.from('api_keys').update({ revoked: true }).eq('id', id)); },
  async listWebhooks() { return must(await sb.from('webhooks').select('*').order('created_at')); },
  async saveWebhook(w) { return must(await sb.from('webhooks').upsert(w).select().single()); },
  async deleteWebhook(id) { return must(await sb.from('webhooks').delete().eq('id', id)); },
  async testWebhook(id) { return must(await sb.rpc('webhook_test', { p_id: id })); },
  async listDeliveries(limit = 60) { return must(await sb.from('webhook_deliveries').select('id,created_at,webhook_id,event,lead_id,status_code,response,payload').order('id', { ascending: false }).limit(limit)); },
  async refreshIntegrations() { try { await sb.rpc('integrations_refresh'); } catch (e) {} },

  subscribe(cb) {
    sb.channel('crm-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, (p) => cb(p.eventType, p.new, 'leads'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'partial_leads' }, (p) => cb(p.eventType, p.new, 'partial_leads'))
      .subscribe();
  }
};

// ============================================================
// MODO DEMO (localStorage) — reproduz as regras do banco sem enviar nada
// ============================================================
const K = {
  leads: 'tracto_v2_leads', stages: 'tracto_v2_stages', labels: 'tracto_v2_labels', act: 'tracto_v2_activity', ev: 'tracto_v2_events',
  track: 'tracto_v3_tracking', pixels: 'tracto_v3_pixels', tev: 'tracto_v3_tracking_events', partials: 'tracto_v3_partials',
  keys: 'tracto_v2_apikeys', hooks: 'tracto_v2_webhooks', dels: 'tracto_v2_deliveries'
};
const read = (k, d = []) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const DEMO_ME = { id: 'demo-user', nome: 'Você (demo)', email: 'demo@tracto', ativo: true };
const DEMO_TEAM = [DEMO_ME, { id: 'demo-isaque', nome: 'Isaque', email: 'isaque@tracto', ativo: true }, { id: 'demo-luiz', nome: 'Luiz', email: 'luiz@tracto', ativo: true }];
const DDD_UF = { SP: [11, 19], RJ: [21, 22, 24], ES: [27, 28], MG: [31, 32, 33, 34, 35, 37, 38], PR: [41, 42, 43, 44, 45, 46], SC: [47, 48, 49], RS: [51, 53, 54, 55], DF: [61], GO: [62, 64], TO: [63], MT: [65, 66], MS: [67], AC: [68], RO: [69], BA: [71, 73, 74, 75, 77], SE: [79], PE: [81, 87], AL: [82], PB: [83], RN: [84], CE: [85, 88], PI: [86, 89], PA: [91, 93, 94], AM: [92, 97], RR: [95], AP: [96], MA: [98, 99] };
export const normPhone = (v) => { const d = String(v || '').replace(/\D/g, ''); if (d.length < 10) return null; return d.length <= 11 ? '55' + d : d; };
export const dddUf = (v) => {
  const p = normPhone(v); if (!p?.startsWith('55')) return null;
  const ddd = +p.slice(2, 4);
  return Object.keys(DDD_UF).find((uf) => (uf === 'SP' ? ddd >= 11 && ddd <= 19 : DDD_UF[uf].includes(ddd))) || null;
};

const STAGE_DEFAULTS = {
  'Contato realizado': ['LeadContatado', 'working_lead', 'none'], 'Qualificado': ['LeadQualificado', 'qualify_lead', 'lead'],
  'Reunião agendada': ['ReuniaoAgendada', 'reuniao_agendada', 'lead'], 'Venda realizada': ['VendaRealizada', 'close_convert_lead', 'contract'],
  'Perdido': [null, 'close_unconvert_lead', 'none']
};
function demoStages() {
  let s = read(K.stages, null);
  if (!s) {
    s = [['Em análise', '#6AA8FF', 'open'], ['Contato realizado', '#B58CFF', 'open'], ['Ligação', '#4FD1C5', 'open'], ['Qualificado', '#FFAD00', 'open'],
      ['Reunião agendada', '#FF8A3D', 'open'], ['Venda realizada', '#3DDC84', 'won'], ['Perdido', '#6B6B6B', 'lost']]
      .map(([name, color, kind], position) => ({ id: uid(), name, color, kind, position }));
  }
  if (s.some((x) => !('ga4_event' in x))) {
    s = s.map((x) => {
      const d = STAGE_DEFAULTS[x.name] || [null, null, 'none'];
      return { ...x, meta_event: d[0], ga4_event: d[1], meta_value: d[2] };
    });
  }
  write(K.stages, s);
  return s.sort((a, b) => a.position - b.position);
}
function log(leadId, type, body, who = DEMO_ME, at = now()) {
  const a = read(K.act);
  a.unshift({ id: uid(), lead_id: leadId, created_at: at, author_id: who?.id || null, author_name: who?.nome || 'Sistema', type, body });
  write(K.act, a);
}
const fmtBR = (iso) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// ---------- rastreamento (demo) ----------
const DEMO_SETTINGS = {
  id: 1, currency: 'BRL', contract_months: 12, api_version: 'v21.0',
  lead_values: { 'Menos de R$15.000': 50, 'De R$15.000 a R$30.000': 100, 'De R$30.000 a R$50.000': 200, 'De R$50.000 a R$100.000': 400, 'Acima de R$100.000': 800 }
};
const demoSettings = () => ({ ...DEMO_SETTINGS, ...read(K.track, {}) });
function demoPixels() {
  let p = read(K.pixels, null);
  if (!p) {
    p = [['Pixel Tracto 1', '1357841419671798'], ['Pixel Tracto 2', '2142406153298000']].map(([name, pixel_id], i) => ({
      id: uid(), created_at: new Date(Date.now() - (2 - i) * 1000).toISOString(), name, platform: 'meta', pixel_id, access_token: null,
      conversion_label: null, test_event_code: null, enabled: true, mode: 'recommended', events: { ...PIXEL_EVENTS_RECOMMENDED }
    }));
    write(K.pixels, p);
  }
  return p;
}
function demoLeadValue(l, mode) {
  const t = demoSettings();
  if (mode === 'lead') return t.lead_values[l.faturamento] ?? null;
  if (mode === 'contract') return l.valor ? l.valor * t.contract_months : null;
  return null;
}
function demoSend(px, l, event, eventId, value, test = false) {
  const all = read(K.tev);
  if (!test && all.some((e) => e.pixel_ref === px.id && e.event_id === eventId && !e.test)) return 0;
  all.unshift({ id: Date.now() + Math.random(), created_at: now(), platform: px.platform, pixel_ref: px.id, pixel_id: px.pixel_id, lead_id: l.id,
    event_name: event, event_id: eventId, test, status_code: 0, response: 'Modo demo: nada foi enviado',
    payload: { data: [{ event_name: event, event_id: eventId, custom_data: { value, currency: demoSettings().currency } }] } });
  write(K.tev, all.slice(0, 800));
  return 1;
}
function demoTrack(l, kind, st) {
  let n = 0;
  for (const px of demoPixels().filter((p) => p.enabled && p.access_token)) {
    if (kind === 'lead' && px.events.lead !== false && l.form_id !== 'manual' && !l.recovered_from) {
      if (px.platform === 'meta') n += demoSend(px, l, 'Lead', l.lead_event_id || l.id, demoLeadValue(l, 'lead'));
      else if (px.platform === 'ga4' && !l.event_source_url) n += demoSend(px, l, 'generate_lead', l.lead_event_id || l.id, demoLeadValue(l, 'lead'));
    } else if (kind === 'stage' && st && px.events.funnel !== false) {
      if (px.platform === 'meta' && st.meta_event) n += demoSend(px, l, st.meta_event, `${l.id}:${st.id}`, demoLeadValue(l, st.meta_value));
      else if (px.platform === 'ga4' && st.ga4_event) n += demoSend(px, l, st.ga4_event, `${l.id}:${st.id}`, demoLeadValue(l, st.meta_value));
    }
  }
  return n;
}
function demoHook(event, l, only, data) {
  const hooks = read(K.hooks).filter((w) => w.active && (only ? w.id === only : w.events.includes(event)));
  const dels = read(K.dels);
  hooks.forEach((w, i) => dels.unshift({ id: Date.now() + i, created_at: now(), webhook_id: w.id, event, lead_id: l?.id || null, status_code: 0,
    response: 'Modo demo: nada foi enviado', payload: { evento: event, dados: data || { lead: l ? { id: l.id, nome: l.nome, whatsapp: l.whatsapp } : null } } }));
  write(K.dels, dels.slice(0, 500));
  return hooks.length;
}
function demoInsertLead(fields, { silent = false } = {}) {
  const lead = {
    id: uid(), created_at: now(), updated_at: now(), last_activity_at: now(), answers: [], label_ids: [], stage_id: demoStages().find((s) => s.kind === 'open').id,
    assigned_to: null, valor: null, reminder_at: null, reminder_note: null, recovered_from: null, ...fields
  };
  lead.estado = lead.estado || dddUf(lead.whatsapp);
  write(K.leads, [lead, ...read(K.leads)]);
  log(lead.id, lead.recovered_from ? 'recovered' : 'created',
    lead.recovered_from ? 'Recuperado de formulário incompleto: ' + (lead.form_name || lead.form_id)
      : lead.form_id === 'manual' ? 'Lead criado manualmente' : lead.form_id === 'api' ? 'Lead criado pela API' : 'Formulário preenchido: ' + (lead.form_name || lead.form_id),
    lead.form_id === 'manual' || lead.recovered_from ? DEMO_ME : null, lead.created_at);
  if (!silent) {
    demoHook(lead.recovered_from ? 'lead.recovered' : 'lead.created', lead);
    demoTrack(lead, 'lead');
  }
  return lead;
}

const demo = {
  // ---------- formulário ----------
  async submitLead(p) {
    const wpp = normPhone(p.whatsapp);
    if (!p.nome || p.nome.trim().length < 2) throw new Error('nome obrigatório');
    if (!wpp) throw new Error('whatsapp inválido');
    const leads = read(K.leads);
    const dup = leads.find((l) => l.whatsapp === wpp && l.form_id === p.form_id && Date.now() - new Date(l.created_at) < 600000);
    let id;
    if (dup) { Object.assign(dup, { answers: p.answers, nome: p.nome.trim() }); write(K.leads, leads); id = dup.id; }
    else {
      const medium = (p.utm_medium || '').toLowerCase();
      const lead = demoInsertLead({
        created_at: p._created_at || now(), last_activity_at: p._created_at || now(),
        form_id: p.form_id, form_name: p.form_name, answers: p.answers || [],
        nome: p.nome.trim(), whatsapp: wpp, email: p.email ? String(p.email).trim().toLowerCase() : null,
        instagram: (p.instagram || '').replace(/[@\s]/g, '').toLowerCase() || null, faturamento: p.faturamento || null,
        estado: p.estado ? String(p.estado).toUpperCase().slice(0, 2) : null,
        stage_id: p._stage_id || demoStages().find((s) => s.kind === 'open').id, assigned_to: p._assigned_to || null,
        label_ids: p._label_ids || [], valor: p._valor || null,
        source: p.fbclid || p.fbc || p.gclid || ['cpc', 'ppc', 'paid', 'paid_social', 'ads', 'ad', 'pago'].includes(medium) ? 'pago' : 'organico',
        utm_source: p.utm_source || null, utm_medium: p.utm_medium || null, utm_campaign: p.utm_campaign || null, utm_content: p.utm_content || null,
        utm_term: p.utm_term || null, fbclid: p.fbclid || null, gclid: p.gclid || null, referrer: p.referrer || null, user_agent: p.user_agent || null,
        session_id: p.session_id || null, visitor_id: p.visitor_id || null, fbp: p.fbp || null, fbc: p.fbc || null,
        ga_client_id: p.ga_client_id || (p.ga_cookie || '').match(/^GA\d\.\d\.(\d+\.\d+)$/)?.[1] || null, client_ip: null,
        event_source_url: p.event_source_url || null, lead_event_id: p.lead_event_id || null
      }, { silent: !!p._created_at });
      id = lead.id;
    }
    if (p.session_id) write(K.partials, read(K.partials).map((x) => (x.session_id === p.session_id && x.status !== 'recuperado' ? { ...x, status: 'convertido', lead_id: id, updated_at: now() } : x)));
    return id;
  },
  async trackEvent(e) { const ev = read(K.ev); ev.push({ ...e, created_at: e.created_at || now() }); write(K.ev, ev.slice(-20000)); },
  async savePartial(p) {
    if (!p.session_id || p.session_id.length < 8) throw new Error('sessão inválida');
    const all = read(K.partials);
    const i = all.findIndex((x) => x.session_id === p.session_id);
    const email = p.email && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(p.email).trim()) ? String(p.email).trim().toLowerCase() : null;
    const fields = {
      form_id: p.form_id, form_name: p.form_name, answers: p.answers || [], raw: p.raw || {},
      nome: p.nome?.trim() || null, whatsapp: normPhone(p.whatsapp), email, instagram: (p.instagram || '').replace(/[@\s]/g, '').toLowerCase() || null,
      faturamento: p.faturamento || null, estado: p.estado ? String(p.estado).toUpperCase().slice(0, 2) : dddUf(p.whatsapp),
      step_id: p.step_id || null, step_index: p.step_index ?? null, total_steps: p.total_steps ?? null,
      visitor_id: p.visitor_id || null, fbp: p.fbp || null, fbc: p.fbc || null, user_agent: p.user_agent || null, event_source_url: p.event_source_url || null,
      utm_source: p.utm_source || null, utm_medium: p.utm_medium || null, utm_campaign: p.utm_campaign || null, fbclid: p.fbclid || null, gclid: p.gclid || null
    };
    if (i < 0) all.unshift({ id: uid(), session_id: p.session_id, resume_token: uid(), created_at: p._at || now(), updated_at: p._at || now(), status: 'em_andamento', lead_id: null, contacted_at: null, ...fields });
    else {
      const cur = all[i];
      if (!['em_andamento', 'abandonado'].includes(cur.status)) return;
      const keep = (k) => fields[k] ?? cur[k];
      all[i] = { ...cur, ...fields, nome: keep('nome'), whatsapp: keep('whatsapp'), email: keep('email'), instagram: keep('instagram'),
        faturamento: keep('faturamento'), estado: keep('estado'), updated_at: p._at || now(), status: cur.status === 'abandonado' ? 'em_andamento' : cur.status };
    }
    write(K.partials, all);
  },
  async getPartial(token) {
    const p = read(K.partials).find((x) => x.resume_token === token && ['em_andamento', 'abandonado'].includes(x.status));
    return p ? { session_id: p.session_id, form_id: p.form_id, raw: p.raw, step_id: p.step_id } : null;
  },
  async publicTracking() {
    const s = demoSettings();
    return { pixels: demoPixels().filter((p) => p.enabled).map((p) => ({ platform: p.platform, id: p.pixel_id, label: p.conversion_label, events: p.events })), currency: s.currency, lead_values: s.lead_values };
  },

  // ---------- sessão ----------
  async session() { return { user: DEMO_ME }; },
  async signIn() { return { user: DEMO_ME }; },
  async signOut() {},
  async me() { return DEMO_ME; },

  // ---------- leads ----------
  async listLeads() { return read(K.leads).sort((a, b) => b.created_at.localeCompare(a.created_at)); },
  async createLead(l) { return demoInsertLead({ form_id: 'manual', form_name: 'Cadastro manual', source: 'manual', ...l }); },
  async updateLeads(ids, patch) {
    const stages = demoStages();
    const leads = read(K.leads).map((l) => {
      if (!ids.includes(l.id)) return l;
      const nl = { ...l, ...patch, updated_at: now(), last_activity_at: now() };
      if ('stage_id' in patch && patch.stage_id !== l.stage_id) {
        const st = stages.find((s) => s.id === patch.stage_id);
        log(l.id, 'stage', `Estágio: ${stages.find((s) => s.id === l.stage_id)?.name || 'sem estágio'} → ${st?.name || 'sem estágio'}`);
        demoHook('lead.stage_changed', nl);
        if (st?.kind === 'won') demoHook('lead.won', nl);
        if (st?.kind === 'lost') demoHook('lead.lost', nl);
        demoTrack(nl, 'stage', st);
      }
      if ('assigned_to' in patch && patch.assigned_to !== l.assigned_to) log(l.id, 'assign', 'Atribuído a ' + (DEMO_TEAM.find((p) => p.id === patch.assigned_to)?.nome || 'ninguém'));
      if ('reminder_at' in patch && patch.reminder_at !== l.reminder_at) log(l.id, 'reminder', patch.reminder_at ? 'Lembrete para ' + fmtBR(patch.reminder_at) : 'Lembrete removido');
      return nl;
    });
    write(K.leads, leads);
  },
  async deleteLeads(ids) {
    write(K.leads, read(K.leads).filter((l) => !ids.includes(l.id)));
    write(K.act, read(K.act).filter((a) => !ids.includes(a.lead_id)));
  },
  async listActivity(leadId) { return read(K.act).filter((a) => a.lead_id === leadId); },
  async addActivity(leadId, type, body) {
    log(leadId, type, body);
    if (type === 'note') write(K.leads, read(K.leads).map((l) => (l.id === leadId ? { ...l, last_activity_at: now() } : l)));
  },

  // ---------- pipeline e equipe ----------
  async listStages() { return demoStages(); },
  async saveStage(s) {
    const all = demoStages();
    const i = all.findIndex((x) => x.id === s.id);
    const row = i >= 0 ? { ...all[i], ...s } : { id: uid(), color: '#FFAD00', kind: 'open', position: all.length, meta_event: null, ga4_event: null, meta_value: 'none', ...s };
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

  async listEvents(sinceIso) { return read(K.ev).filter((e) => !sinceIso || e.created_at >= sinceIso); },

  // ---------- recuperação ----------
  async listPartials() { return read(K.partials).filter((p) => p.status !== 'convertido').sort((a, b) => b.updated_at.localeCompare(a.updated_at)); },
  async updatePartial(id, patch) { write(K.partials, read(K.partials).map((p) => (p.id === id ? { ...p, ...patch } : p))); },
  async convertPartial(id) {
    const p = read(K.partials).find((x) => x.id === id);
    if (!p) throw new Error('rascunho não encontrado');
    if (p.lead_id) return p.lead_id;
    if (!p.nome || p.nome.length < 2) throw new Error('o rascunho precisa ter pelo menos o nome');
    const lead = demoInsertLead({
      form_id: p.form_id, form_name: p.form_name, answers: p.answers, nome: p.nome, whatsapp: p.whatsapp, email: p.email, instagram: p.instagram,
      faturamento: p.faturamento, estado: p.estado, source: p.fbclid || p.fbc || p.gclid ? 'pago' : 'organico',
      utm_source: p.utm_source, utm_medium: p.utm_medium, utm_campaign: p.utm_campaign, session_id: p.session_id, visitor_id: p.visitor_id,
      fbp: p.fbp, fbc: p.fbc, event_source_url: p.event_source_url, recovered_from: p.id, assigned_to: DEMO_ME.id
    });
    write(K.partials, read(K.partials).map((x) => (x.id === id ? { ...x, status: 'recuperado', lead_id: lead.id, updated_at: now() } : x)));
    return lead.id;
  },
  async sweepPartials() {
    let n = 0;
    const all = read(K.partials).map((p) => {
      if (p.status === 'em_andamento' && Date.now() - new Date(p.updated_at) > 30 * 60000) {
        n++;
        if (p.whatsapp || p.email) demoHook('lead.abandoned', null, null, { formulario_incompleto: { id: p.id, nome: p.nome, whatsapp: p.whatsapp } });
        return { ...p, status: 'abandonado', abandoned_at: now() };
      }
      return p;
    });
    write(K.partials, all);
    return n;
  },

  // ---------- rastreamento ----------
  async getTracking() { return demoSettings(); },
  async saveTracking(patch) { write(K.track, { ...read(K.track, {}), ...patch }); return demoSettings(); },
  async listPixels() { return demoPixels(); },
  async savePixel(p) {
    const all = demoPixels();
    if (all.some((x) => x.platform === p.platform && x.pixel_id === p.pixel_id && x.id !== p.id)) throw new Error('esse pixel já está cadastrado');
    const i = all.findIndex((x) => x.id === p.id);
    const row = i >= 0 ? { ...all[i], ...p, updated_at: now() } : { id: uid(), created_at: now(), enabled: true, mode: 'recommended', events: { ...PIXEL_EVENTS_RECOMMENDED }, access_token: null, conversion_label: null, test_event_code: null, ...p };
    if (i >= 0) all[i] = row; else all.push(row);
    write(K.pixels, all); return row;
  },
  async deletePixel(id) { write(K.pixels, demoPixels().filter((p) => p.id !== id)); },
  async testPixel(id) {
    const px = demoPixels().find((p) => p.id === id);
    if (!px.access_token && px.platform !== 'google_ads') throw new Error('cole o token/API secret do pixel antes de testar');
    if (px.platform === 'google_ads') throw new Error('Google Ads é testado pelo Tag Assistant, direto no formulário');
    if (px.platform === 'meta' && !px.test_event_code) throw new Error('preencha o código de evento de teste do Gerenciador de Eventos');
    const l = read(K.leads).find((x) => x.form_id !== 'manual');
    if (!l) throw new Error('receba ou crie ao menos um lead pra testar');
    return demoSend(px, l, px.platform === 'ga4' ? 'generate_lead' : 'Lead', 'teste-' + uid(), demoLeadValue(l, 'lead'), true);
  },
  async listTrackingEvents({ limit = 100, leadId } = {}) { return read(K.tev).filter((e) => !leadId || e.lead_id === leadId).slice(0, limit); },

  // ---------- integrações ----------
  async listApiKeys() { return read(K.keys); },
  async createApiKey(name) {
    const key = 'trk_' + (uid() + uid()).replace(/-/g, '').slice(0, 48);
    write(K.keys, [{ id: uid(), created_at: now(), name, prefix: key.slice(0, 12), last_used_at: null, revoked: false }, ...read(K.keys)]);
    return key;
  },
  async revokeApiKey(id) { write(K.keys, read(K.keys).map((k) => (k.id === id ? { ...k, revoked: true } : k))); },
  async listWebhooks() { return read(K.hooks); },
  async saveWebhook(w) {
    const all = read(K.hooks);
    const i = all.findIndex((x) => x.id === w.id);
    const row = i >= 0 ? { ...all[i], ...w } : { id: uid(), created_at: now(), active: true, secret: 'whsec_' + uid().replace(/-/g, ''), events: ['lead.created'], ...w };
    if (i >= 0) all[i] = row; else all.push(row);
    write(K.hooks, all); return row;
  },
  async deleteWebhook(id) { write(K.hooks, read(K.hooks).filter((w) => w.id !== id)); },
  async testWebhook(id) { return demoHook('webhook.test', read(K.leads)[0], id); },
  async listDeliveries(limit = 60) { return read(K.dels).slice(0, limit); },
  async refreshIntegrations() {},

  subscribe(cb) {
    window.addEventListener('storage', (e) => {
      if (e.key === K.leads) cb('INSERT', null, 'leads');
      if (e.key === K.partials) cb('UPDATE', null, 'partial_leads');
    });
  },

  // só demo: popula dados realistas
  async seed(forms) {
    const stages = demoStages();
    const nomes = ['Carlos Menezes', 'Juliana Prado', 'Roberto Alves', 'Fernanda Lima', 'Marcos Tavares', 'Patrícia Rocha', 'Eduardo Nunes', 'Sandra Queiroz', 'Thiago Barros', 'Luciana Freitas', 'Anderson Moura', 'Renata Dias', 'Wagner Costa', 'Cláudia Ribeiro', 'Nivaldo Rodrigues', 'Marcelo Moraes', 'Douglas Pereira', 'Simone Araújo', 'Paulo Henrique', 'Kátia Mendes', 'José Carlos', 'Aline Batista', 'Rafael Gomes', 'Vanessa Teles'];
    const lojas = ['casadoconstrutor', 'pradoferragens', 'alvesmateriais', 'limatintas', 'tavaresferragens', 'rochaconstrucao', 'nunesmateriais', 'queirozhome', 'barrosferragista', 'freitasacabamentos', 'mouraconstrucoes', 'diasmateriais', 'costamadeiras', 'ribeirotintas', 'wkferragista', 'moraesdepositos', 'drapservicos', 'araujoeletrica', 'phmateriais', 'mendeshidraulica', 'jcferragens', 'batistapisos', 'gomesconstrucao', 'telesmateriais'];
    const ddds = ['62', '11', '31', '41', '62', '64', '21', '71', '81', '48', '51', '85'];
    const camps = ['diagnostico-ferragistas', 'diagnostico-ferragistas', 'remarketing-30d', 'lookalike-clientes', null];
    const labels = [await this.saveLabel({ name: 'Prioridade', color: '#FF8A3D' }), await this.saveLabel({ name: 'Indicação', color: '#3DDC84' }), await this.saveLabel({ name: 'Retornar', color: '#6AA8FF' })];
    const rnd = (a) => a[Math.floor(Math.random() * a.length)];
    const ev = read(K.ev);
    for (let i = 0; i < nomes.length; i++) {
      const form = forms[i % 3 === 2 ? 1 : 0];
      const at = new Date(Date.now() - Math.random() * 28 * 86400000);
      const fat = form.fields.find((f) => f.id === 'faturamento');
      const exp = form.fields.find((f) => f.id === 'experiencia');
      const wpp = '+55' + ddds[i % ddds.length] + '9' + String(80000000 + i * 104729).slice(0, 8);
      const answers = [
        { id: 'nome', label: 'Qual o seu nome e sobrenome?', value: nomes[i] },
        { id: 'whatsapp', label: 'Qual seu número de Whatsapp?', value: wpp },
        { id: 'instagram', label: 'Qual o @ do instagram da sua empresa?', value: lojas[i] },
        ...(i % 3 ? [] : [{ id: 'email', label: 'Qual é o seu e-mail?', value: lojas[i] + '@gmail.com' }]),
        { id: 'experiencia', label: exp.title, value: rnd(exp.options) },
        { id: 'faturamento', label: 'Qual é o faturamento médio mensal da sua empresa?', value: fat.options[(i * 7) % 5] }
      ];
      const stage = stages[Math.min(stages.length - 1, Math.floor(Math.pow(Math.random(), 1.6) * stages.length))];
      const camp = rnd(camps);
      await this.submitLead({
        form_id: form.id, form_name: form.name, answers, nome: nomes[i], whatsapp: wpp, instagram: lojas[i],
        email: answers.find((a) => a.id === 'email')?.value, faturamento: answers.at(-1).value,
        utm_source: camp ? 'facebook' : 'instagram', utm_medium: camp ? 'paid_social' : 'bio', utm_campaign: camp,
        fbclid: camp ? 'demo' : null, fbp: i % 4 ? 'fb.1.' + at.getTime() + '.' + i : null, fbc: camp && i % 2 ? 'fb.1.' + at.getTime() + '.IwAR' + i : null,
        visitor_id: 'vis-' + i, user_agent: 'Mozilla/5.0', event_source_url: 'https://assessoriatracto.com.br/aplicar/trafego/',
        _created_at: at.toISOString(), _stage_id: stage.id,
        _assigned_to: i % 4 ? rnd(DEMO_TEAM).id : null, _label_ids: i % 5 === 0 ? [rnd(labels).id] : [],
        _valor: stage.kind === 'won' ? 2000 + Math.round(Math.random() * 30) * 100 : null
      });
    }
    // formulários incompletos pra aba Recuperação
    const partials = [
      ['Bruno Esteves', '62991234567', null, 'whatsapp', 2, 190], ['Márcia Lopes', '11987654321', 'marcia@lojadamarcia.com', 'experiencia', 5, 55],
      ['Diego Santana', null, null, 'nome', 1, 8], ['Helena Duarte', '31999887766', null, 'instagram', 3, 1500], ['Otávio Reis', '41988776655', 'otavio@reismateriais.com.br', 'faturamento', 6, 3200]
    ];
    for (const [nome, wpp, email, step, idx, minsAgo] of partials) {
      const at = new Date(Date.now() - minsAgo * 60000).toISOString();
      const raw = { nome, ...(wpp ? { whatsapp: '+55' + wpp } : {}), ...(email ? { email } : {}) };
      await this.savePartial({ session_id: 'demo-partial-' + nome.replace(/\s/g, ''), form_id: 'trafego', form_name: forms[0].name, nome, whatsapp: wpp, email,
        step_id: step, step_index: idx, total_steps: 6, raw, answers: Object.entries(raw).map(([id, value]) => ({ id, label: id, value })),
        utm_source: 'facebook', utm_campaign: 'diagnostico-ferragistas', fbclid: 'demo', _at: at });
    }
    // funil de eventos: views > starts > steps
    for (let s = 0; s < 260; s++) {
      const form = forms[s % 3 === 2 ? 1 : 0];
      const at = new Date(Date.now() - Math.random() * 28 * 86400000).toISOString();
      const sid = 'demo' + s;
      ev.push({ form_id: form.id, session_id: sid, event: 'view', created_at: at });
      if (Math.random() < 0.55) {
        ev.push({ form_id: form.id, session_id: sid, event: 'start', created_at: at });
        for (const q of form.fields.filter((f) => f.type !== 'welcome' && f.type !== 'thankyou')) {
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
    if (['trackEvent', 'subscribe', 'savePartial'].includes(key)) return async () => {};
    if (key === 'session' || key === 'publicTracking' || key === 'getPartial') return async () => null;
    return async () => { throw new Error('Supabase não configurado'); };
  }
});
export const CONFIGURED = LIVE || DEMO_ALLOWED;
export const DB = LIVE ? live : DEMO_ALLOWED ? demo : notConfigured;
