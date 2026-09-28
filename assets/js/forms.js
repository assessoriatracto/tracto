// Definições dos formulários. Cada form é uma lista de campos renderizada pelo form-engine.
//
// Tipos: welcome | statement | short_text | long_text | email | phone | number | url | date
//        choice (única) | multi (caixas de seleção) | dropdown | yes_no | rating | scale | consent | thankyou
// Propriedades comuns:
//   id, title (HTML confiável; {{campo}} ou {{campo:first}} insere resposta), desc, required,
//   placeholder, map ('nome' | 'whatsapp' | 'email' | 'instagram' | 'faturamento' | 'estado' | 'cidade' → coluna do CRM)
//   showIf: condição pra exibir o campo (senão é pulado)
//   logic:  [{ if: condição, jump: 'idDoCampo' }] avaliada ao sair do campo (primeira que bater vence)
//   next:   'idDoCampo' pula incondicionalmente
// Condição: { field, op, value } com op = is | is_not | in | not_in | includes | excludes | gt | gte | lt | lte | filled | empty
//           ou { all: [...] } / { any: [...] }

const WA = '5562994759475';
const WA_MSG = 'Olá, tudo bem? Acabei de preencher o formulário e gostaria de saber mais.';
const waLink = (msg = WA_MSG) => `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;

const FATURAMENTO = ['Menos de R$15.000', 'De R$15.000 a R$30.000', 'De R$30.000 a R$50.000', 'De R$50.000 a R$100.000', 'Acima de R$100.000'];
const ALTO = ['De R$50.000 a R$100.000', 'Acima de R$100.000'];

const WELCOME_TITLE = '<strong>Falta pouco para destravar as vendas da sua FERRAGISTA E LOJA DE CONSTRUÇÃO!</strong>';

// campos idênticos nos 3 forms do Respondi
const base = (exp) => [
  { id: 'nome', type: 'short_text', title: 'Qual o seu nome e sobrenome?', required: true, map: 'nome', autocomplete: 'name', maxLength: 120 },
  { id: 'whatsapp', type: 'phone', title: 'Qual seu número de Whatsapp?', required: true, map: 'whatsapp' },
  { id: 'instagram', type: 'short_text', title: 'Qual o @ do instagram da sua empresa?', desc: 'Digite somente o user, <strong>sem o @ e sem espaços</strong>, por favor', required: true, map: 'instagram', transform: 'instagram', maxLength: 60 },
  { id: 'email', type: 'email', title: 'Qual é o seu e-mail?', required: false, map: 'email' },
  { id: 'experiencia', type: 'choice', ...exp, required: true },
  {
    id: 'faturamento', type: 'choice', title: 'Qual é o faturamento <strong>médio mensal</strong> da sua empresa?', options: FATURAMENTO, required: true, map: 'faturamento',
    logic: [{ if: { field: 'faturamento', op: 'in', value: ALTO }, jump: 'obrigado' }]
  },
  {
    id: 'obrigado', type: 'thankyou', title: 'Obrigado por responder!',
    desc: 'Em breve nossa equipe entrará em contato. Você pode falar conosco agora no WhatsApp.',
    cta: { label: 'ENVIAR MENSAGEM', href: waLink() }
  }
];

const EXP_TRAFEGO = { title: 'Já investiu em tráfego pago antes?', options: ['Sim, eu mesmo faço', 'Sim, contratei um pessoal/time', 'Nunca investi'] };

export const FORMS = {
  // réplica de form.respondi.app/KIy9LLMN
  trafego: {
    id: 'trafego',
    slug: 'trafego',
    name: 'Assessoria Tracto - Tráfego Pago',
    fields: [
      {
        id: 'welcome', type: 'welcome', title: WELCOME_TITLE,
        desc: 'Esse formulário nos ajuda a entender o cenário do seu negócio, pra que possamos lhe apresentar um plano realista e eficiente de crescimento com tráfego pago. Leva menos de 2 minutos.\n\n→︎ Exclusivo para empresas que já investem (ou estão dispostas a investir) no mínimo R$800,00/mês nos anúncios',
        button: 'QUERO ESCALAR AS MINHAS VENDAS'
      },
      ...base(EXP_TRAFEGO)
    ]
  },

  // réplica de form.respondi.app/OhHOTxzG
  marketplace: {
    id: 'marketplace',
    slug: 'marketplace',
    name: 'Assessoria Tracto - Marketplace',
    fields: [
      {
        id: 'welcome', type: 'welcome', title: WELCOME_TITLE,
        desc: 'Esse formulário nos ajuda a entender o cenário do seu negócio, pra que possamos lhe apresentar um plano realista e eficiente de crescimento com Marketplace. Leva menos de 2 minutos.\n\n→︎ Exclusivo para empresas que já investem (ou estão dispostas a investir) em vendas no Mercado Livre e Shopee.',
        button: 'QUERO ESCALAR AS MINHAS VENDAS'
      },
      ...base({ title: 'Já trabalhou com marketplace?', options: ['Sim, eu mesmo faço', 'Sim, contratei um pessoal/time', 'Nunca trabalhei'] })
    ]
  },

  // réplica de form.respondi.app/FOD4RAan
  home: {
    id: 'home',
    slug: '', // raiz: /aplicar/
    name: 'Assessoria Tracto - Home',
    fields: [
      {
        id: 'welcome', type: 'welcome', title: WELCOME_TITLE,
        desc: 'Esse formulário nos ajuda a entender o cenário do seu negócio, pra que possamos lhe apresentar um plano realista e eficiente de crescimento com <strong>Tráfego Pago e Marketplace.</strong> Leva menos de 2 minutos.\n\n→︎ Exclusivo para empresas que já investem (ou estão dispostas a investir) no mínimo R$800,00/mês nos anúncios.',
        button: 'QUERO ESCALAR AS MINHAS VENDAS'
      },
      { id: 'servico', type: 'choice', title: 'Quais desses serviços abaixo você tem interesse?', options: ['Tráfego Pago', 'Marketplace', 'Ambos'], required: false },
      ...base(EXP_TRAFEGO)
    ]
  },

  // Modelo com todos os recursos do motor: caixas de seleção, texto longo, condicionais,
  // saltos, dropdown, escala, data, consentimento e duas telas finais.
  completo: {
    id: 'completo',
    slug: 'diagnostico',
    name: 'Diagnóstico completo (modelo)',
    fields: [
      {
        id: 'welcome', type: 'welcome', title: 'Diagnóstico <em>completo</em> da sua loja',
        desc: 'Umas perguntas a mais pra gente chegar na reunião já com um plano desenhado. Leva uns 4 minutos.',
        button: 'COMEÇAR DIAGNÓSTICO'
      },
      { id: 'nome', type: 'short_text', title: 'Pra começar, qual o seu nome e sobrenome?', required: true, map: 'nome', autocomplete: 'name' },
      { id: 'whatsapp', type: 'phone', title: 'Prazer, {{nome:first}}! Qual seu número de Whatsapp?', required: true, map: 'whatsapp' },
      { id: 'email', type: 'email', title: 'E o seu melhor e-mail?', desc: 'Opcional.', required: false, map: 'email' },
      { id: 'loja', type: 'short_text', title: 'Qual o nome da loja?', required: true, placeholder: 'Ex: Casa do Construtor' },
      { id: 'uf', type: 'dropdown', title: 'Em qual estado fica a {{loja}}?', required: true, map: 'estado', options: ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'] },
      { id: 'segmento', type: 'choice', title: 'Qual melhor descreve a {{loja}}?', required: true, options: ['Materiais de construção', 'Ferragista', 'Tintas', 'Elétrica e hidráulica', 'Pisos e acabamentos'], other: true },
      {
        id: 'canais', type: 'multi', title: 'Onde vocês vendem hoje?', required: true, min: 1,
        options: ['Loja física', 'WhatsApp', 'Instagram', 'Mercado Livre', 'Shopee', 'Site próprio']
      },
      {
        id: 'vendas_mkt', type: 'number', title: 'Quantas vendas por mês vocês fazem nos marketplaces, mais ou menos?', required: false, min: 0, placeholder: '0',
        showIf: { field: 'canais', op: 'includes', value: ['Mercado Livre', 'Shopee'] }
      },
      { id: 'investe', type: 'yes_no', title: 'Vocês já investem em anúncios hoje?', required: true },
      {
        id: 'investimento', type: 'choice', title: 'Quanto vocês investem por mês em anúncios?', required: true,
        options: ['Até R$800', 'De R$800 a R$2.000', 'De R$2.000 a R$5.000', 'Acima de R$5.000'],
        showIf: { field: 'investe', op: 'is', value: 'Sim' }
      },
      { id: 'faturamento', type: 'choice', title: 'Qual é o faturamento <strong>médio mensal</strong> da loja?', required: true, options: FATURAMENTO, map: 'faturamento' },
      { id: 'desafio', type: 'long_text', title: 'Qual o maior desafio de vendas da {{loja}} hoje?', desc: 'Fique à vontade pra escrever. Shift + Enter quebra linha.', required: true, maxLength: 1000 },
      { id: 'urgencia', type: 'scale', title: 'De 0 a 10, qual a urgência de resolver isso?', required: true, min: 0, max: 10, labels: ['Sem pressa', 'Pra ontem'] },
      { id: 'data', type: 'date', title: 'Qual o melhor dia pra conversarmos?', required: false },
      {
        id: 'lgpd', type: 'consent', title: 'Posso guardar seus dados pra entrar em contato?', required: true,
        desc: 'Usamos suas respostas só pra preparar o diagnóstico, conforme a LGPD.', label: 'Sim, autorizo o contato',
        logic: [{ if: { any: [{ field: 'faturamento', op: 'in', value: ALTO }, { field: 'urgencia', op: 'gte', value: 8 }] }, jump: 'obrigado_vip' }],
        next: 'obrigado'
      },
      {
        id: 'obrigado_vip', type: 'thankyou', title: '{{nome:first}}, você foi <em>pré-aprovado</em>!',
        desc: 'Seu perfil tem tudo pra escalar com a Tracto. Chama a gente agora no WhatsApp que já agendamos seu diagnóstico.',
        cta: { label: 'AGENDAR NO WHATSAPP', href: waLink('Olá! Acabei de fazer o diagnóstico completo da Tracto e fui pré-aprovado. Quero agendar.') }
      },
      {
        id: 'obrigado', type: 'thankyou', title: 'Obrigado por responder!',
        desc: 'Em breve nossa equipe entrará em contato. Você pode falar conosco agora no WhatsApp.',
        cta: { label: 'ENVIAR MENSAGEM', href: waLink() }
      }
    ]
  }
};

export const DEFAULT_FORM = 'home';

// URL pública de cada formulário: /aplicar/ (home) e /aplicar/<slug>/
export const formPath = (f) => '/aplicar/' + (f.slug ? f.slug + '/' : '');
export const formBySlug = (slug) => Object.values(FORMS).find((f) => f.slug === slug);
