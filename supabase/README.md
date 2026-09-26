# Formulários + CRM Tracto

- `assessoriatracto.com.br/aplicar/` formulário geral (réplica do Respondi FOD4RAan)
- `assessoriatracto.com.br/aplicar/trafego/` Tráfego Pago (réplica do KIy9LLMN)
- `assessoriatracto.com.br/aplicar/marketplace/` Marketplace (réplica do OhHOTxzG)
- `assessoriatracto.com.br/aplicar/diagnostico/` modelo com todos os recursos
- `crm.assessoriatracto.com.br` central de leads, dashboard, formulários e ajustes

Sem Supabase configurado, form e CRM rodam em modo demo só no localhost. Em produção o form mostra erro de envio e o CRM avisa que falta configurar.

## Publicar

- Site e formulários: commit e push em `main` deste repo (GitHub Pages).
- CRM: depois do push, rode `tools/publicar-crm.sh`. Ele copia `crm/` pro repo `assessoriatracto/crm`, que serve `crm.assessoriatracto.com.br`. O CRM carrega banco, formulários e config de `assessoriatracto.com.br`, então publique o site antes.
- Formulário novo: adicione em `assets/js/forms.js` com um `slug` e rode `node tools/gerar-slugs.mjs`.
- DNS (GoDaddy): `crm` CNAME `assessoriatracto.github.io`.

## Ligar o Supabase

1. Crie um projeto em supabase.com (região São Paulo).
2. SQL Editor > New query > cole `supabase/schema.sql` > Run. Pode rodar de novo quando atualizar o arquivo.
3. Project Settings > API: copie a Project URL e a anon public key para `assets/js/tracto-config.js`.
4. Authentication > Sign In / Providers: desligue "Allow new users to sign up".
5. Authentication > URL Configuration: Site URL `https://crm.assessoriatracto.com.br`.
6. Authentication > Users > Add user: crie seu login. O primeiro usuário vira ativo automaticamente; os próximos entram inativos e você libera em CRM > Ajustes > Equipe.

## Segurança

- O visitante do site só consegue chamar `submit_lead` (valida e normaliza no servidor) e registrar eventos do form. Não lê nem altera nada.
- Só membros ativos da equipe (`profiles.ativo`) leem e editam leads, estágios, rótulos e histórico.
- A anon key é pública por design; a proteção está nas policies de RLS.

## Editar perguntas

Os formulários ficam em `assets/js/forms.js`. Cada campo tem `type`, `title`, `required`, e opcionalmente:

- `showIf: { field, op, value }` pra só mostrar a pergunta sob uma condição
- `logic: [{ if: condição, jump: 'idDoCampo' }]` pra pular pra outra pergunta ou tela final
- `map: 'nome' | 'whatsapp' | 'email' | 'instagram' | 'faturamento'` pra preencher a coluna do CRM

Operadores: `is`, `is_not`, `in`, `not_in`, `includes`, `excludes`, `gt`, `gte`, `lt`, `lte`, `filled`, `empty`, e combinações com `{ all: [...] }` / `{ any: [...] }`.
