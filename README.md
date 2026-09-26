# Tracto · site e formulários

Landing pages, formulários e política de privacidade de **assessoriatracto.com.br** (GitHub Pages, push na `main` publica).

O CRM (crm.assessoriatracto.com.br) e o banco (`supabase/schema.sql`) ficam no repositório **assessoriatracto/crm**.

| Endereço | O que é | Pasta |
|---|---|---|
| assessoriatracto.com.br | landing pages | `index.html`, `marketing/`, `marketplace/`, `obrigado/` |
| assessoriatracto.com.br/aplicar/… | formulários (e os criados no construtor do CRM) | `aplicar/` |
| assessoriatracto.com.br/privacidade/ | política de privacidade (LGPD) | `privacidade/` |

## Estrutura

```
├── index.html, marketing/, marketplace/, obrigado/   landing pages
├── aplicar/                formulário (motor + páginas por endereço)
├── privacidade/            política de privacidade
├── assets/
│   ├── css/                estilos
│   ├── js/
│   │   ├── tracto-config.js  URL e chave pública do Supabase (também usado pelo CRM)
│   │   ├── db.js             acesso ao banco (também usado pelo CRM)
│   │   ├── forms.js          formulários fixos das landing pages (também usado pelo CRM)
│   │   ├── form-engine.js    motor do formulário (tipos, lógica, validações)
│   │   └── tracking.js       Meta Pixel, GA4, Google Ads e GTM no navegador
│   ├── fonts/, img/
├── tools/gerar-slugs.mjs   copia aplicar/index.html para cada endereço fixo
├── 404.html                redireciona /aplicar/<endereço>/ dos formulários criados no construtor
└── _config.yml             o que não vai pro site
```

Ao mudar `db.js`, `forms.js` ou `tracto-config.js`, rode `tools/versao.sh` no repositório `crm` e publique,
pra que o CRM carregue a versão nova.
