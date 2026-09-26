# Tracto · site, formulários e CRM

Tudo da Tracto fica neste repositório. Push na `main` publica sozinho:

| Endereço | O que é | Pasta |
|---|---|---|
| assessoriatracto.com.br | landing pages | `index.html`, `marketing/`, `marketplace/`, `obrigado/` |
| assessoriatracto.com.br/aplicar/… | formulários (e os criados no construtor) | `aplicar/` |
| assessoriatracto.com.br/privacidade/ | política de privacidade (LGPD) | `privacidade/` |
| crm.assessoriatracto.com.br | CRM | `crm/` |

## Estrutura

```
├── index.html, marketing/, marketplace/, obrigado/   landing pages
├── aplicar/                formulário (motor + páginas por endereço)
├── crm/                    CRM (publicado em crm.assessoriatracto.com.br)
├── assets/
│   ├── css/                estilos compartilhados
│   ├── js/
│   │   ├── tracto-config.js  URL e chave pública do Supabase
│   │   ├── db.js             acesso ao banco (e modo demonstração em localhost)
│   │   ├── forms.js          formulários fixos das landing pages
│   │   ├── form-engine.js    motor do formulário (tipos, lógica, validações)
│   │   └── tracking.js       Meta Pixel, GA4, Google Ads e GTM no navegador
│   ├── fonts/, img/
├── supabase/schema.sql     banco inteiro (rode no SQL Editor; é idempotente)
├── docs/                   guias técnicos (API, webhooks, configuração)
├── tools/                  scripts de publicação e geração de páginas
├── .github/workflows/      publicação automática do CRM
├── 404.html                redireciona /aplicar/<endereço>/ dos formulários do construtor
└── _config.yml             o que não vai pro site principal (crm/, supabase/, docs/, tools/)
```

## Como publica

- **Site e formulários**: GitHub Pages deste repositório, a cada push.
- **CRM**: o GitHub Pages só permite um domínio por repositório, então o GitHub Actions
  (`.github/workflows/publicar-crm.yml`) copia `crm/` para o repositório `assessoriatracto/crm`,
  que existe só como saída publicada em crm.assessoriatracto.com.br. Nunca edite lá.

## Documentação

- [Configurar o Supabase](docs/supabase.md)
- [API de leads](docs/api.md)
- [Webhooks](docs/webhooks.md)
