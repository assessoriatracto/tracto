// Rastreamento no navegador: Meta Pixel + Google (GA4 e Google Ads).
// A lista de pixels e os eventos de cada um vêm do CRM (public_tracking); os tokens ficam só no servidor.
//
// Conversão = SOMENTE o formulário concluído (Meta "Lead", GA4 "generate_lead", conversão do Google Ads).
// Os demais eventos são sinais extras com nomes personalizados, que não contam como conversão.

const FALLBACK = { pixels: [
  { platform: 'meta', id: '1357841419671798', events: { page_view: true, view_content: true, form_start: true, form_step: false, lead: true } },
  { platform: 'meta', id: '2142406153298000', events: { page_view: true, view_content: true, form_start: true, form_step: false, lead: true } }
], currency: 'BRL' };

const on = (px, key) => px.events?.[key] !== false && (key !== 'form_step' || px.events?.form_step === true);

function loadMeta() {
  if (window.fbq) return;
  /* eslint-disable */
  !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
    if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0;
    t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s); }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
}
function loadGtag(firstId) {
  if (window.gtag) return;
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  const s = document.createElement('script');
  s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(firstId);
  document.head.appendChild(s);
  window.gtag('js', new Date());
}

export function createTracker({ form, visitorId, loadConfig, extraGtm = [] }) {
  let cfg = null;
  let userData = {};
  const queue = [];
  const run = (fn) => (cfg ? fn() : queue.push(fn));
  const meta = () => cfg.pixels.filter((p) => p.platform === 'meta');
  const ga4 = () => cfg.pixels.filter((p) => p.platform === 'ga4');
  const ads = () => cfg.pixels.filter((p) => p.platform === 'google_ads');
  const gtm = () => cfg.pixels.filter((p) => p.platform === 'gtm');
  // Google Tag Manager recebe tudo pelo dataLayer (eventos tracto_*); as tags ficam configuradas no GTM
  const dl = (event, data = {}) => { if (gtm().length) (window.dataLayer = window.dataLayer || []).push({ event, form_id: form.id, form_name: form.name, ...data }); };

  const ready = (async () => {
    try { cfg = (await loadConfig()) || FALLBACK; } catch (e) { cfg = FALLBACK; }
    if (!cfg.pixels?.length) cfg = { ...cfg, pixels: [] };
    extraGtm.filter((id) => /^GTM-[A-Z0-9]+$/i.test(id) && !cfg.pixels.some((p) => p.id === id)).forEach((id) => cfg.pixels.push({ platform: 'gtm', id, events: {} }));
    gtm().forEach((p) => {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtm.js?id=' + encodeURIComponent(p.id);
      document.head.appendChild(s);
    });
    if (meta().length) {
      loadMeta();
      // external_id igual ao que o servidor envia (visitante), melhora a correspondência e a deduplicação
      meta().forEach((p) => window.fbq('init', p.id, { external_id: visitorId }));
    }
    const google = [...ga4(), ...ads()];
    if (google.length) {
      loadGtag(google[0].id);
      ga4().forEach((p) => window.gtag('config', p.id, { send_page_view: on(p, 'page_view'), user_id: visitorId }));
      ads().forEach((p) => window.gtag('config', p.id, { allow_enhanced_conversions: true }));
    }
    queue.splice(0).forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
  })();

  const metaEvent = (key, name, params = {}, opts, custom = false) => meta().filter((p) => on(p, key)).forEach((p) =>
    window.fbq(custom ? 'trackSingleCustom' : 'trackSingle', p.id, name, params, opts));
  const gaEvent = (key, name, params = {}) => {
    const ids = ga4().filter((p) => on(p, key)).map((p) => p.id);
    if (ids.length) window.gtag('event', name, { ...params, send_to: ids });
  };

  return {
    ready,
    pageView() { run(() => { metaEvent('page_view', 'PageView'); dl('tracto_page_view'); }); },
    viewContent() {
      run(() => {
        metaEvent('view_content', 'ViewContent', { content_name: form.name, content_category: 'formulario' });
        gaEvent('view_content', 'form_view', { form_name: form.name });
        dl('tracto_form_view');
      });
    },
    formStart() {
      run(() => {
        metaEvent('form_start', 'IniciouFormulario', { content_name: form.name }, undefined, true);
        gaEvent('form_start', 'form_start', { form_name: form.name });
        dl('tracto_form_start');
      });
    },
    formStep(stepId, index, total) {
      run(() => {
        metaEvent('form_step', 'EtapaFormulario', { content_name: form.name, etapa: stepId, etapa_numero: index, etapas: total }, undefined, true);
        gaEvent('form_step', 'form_progress', { form_name: form.name, step: stepId, step_number: index, total_steps: total });
        dl('tracto_form_step', { step: stepId, step_number: index, total_steps: total });
      });
    },
    // correspondência avançada assim que o lead informa os dados (o pixel faz o hash no navegador)
    identify(d) {
      const [fn, ...rest] = String(d.nome || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      const phone = String(d.whatsapp || '').replace(/\D/g, '');
      const next = {
        em: d.email ? String(d.email).trim().toLowerCase() : undefined,
        ph: phone.length >= 12 ? phone : undefined,
        fn, ln: rest.at(-1), st: d.estado ? String(d.estado).toLowerCase() : undefined, country: 'br', external_id: visitorId
      };
      Object.keys(next).forEach((k) => next[k] === undefined && delete next[k]);
      if (JSON.stringify(next) === JSON.stringify(userData)) return;
      userData = next;
      run(() => {
        meta().forEach((p) => window.fbq('init', p.id, userData));
        if (ga4().length || ads().length) {
          window.gtag('set', 'user_data', {
            email: userData.em, phone_number: userData.ph ? '+' + userData.ph : undefined,
            address: { first_name: userData.fn, last_name: userData.ln, region: userData.st, country: 'BR' }
          });
        }
      });
    },
    // CONVERSÃO: formulário concluído. eventId = mesmo ID que o servidor manda pela Conversions API.
    // Lead não leva valor: só a venda confirmada no CRM envia valor (pelo servidor).
    lead({ eventId, faturamento }) {
      run(() => {
        metaEvent('lead', 'Lead', { content_name: form.name, content_category: 'lead' }, { eventID: eventId });
        gaEvent('lead', 'generate_lead', { form_name: form.name, transaction_id: eventId });
        ads().filter((p) => on(p, 'lead') && p.label).forEach((p) =>
          window.gtag('event', 'conversion', { send_to: `${p.id}/${p.label}`, transaction_id: eventId }));
        dl('tracto_lead', { lead_event_id: eventId, faturamento,
          user_data: { email: userData.em, phone_number: userData.ph ? '+' + userData.ph : undefined, address: { first_name: userData.fn, last_name: userData.ln, region: userData.st, country: 'BR' } } });
      });
    }
  };
}
