# Formulários + CRM Tracto

- `/aplicar/?f=trafego` formulário de Tráfego Pago (réplica do Respondi KIy9LLMN)
- `/aplicar/?f=marketplace` formulário de Marketplace (réplica do OhHOTxzG)
- `/aplicar/?f=home` formulário da Home (réplica do FOD4RAan)
- `/aplicar/?f=completo` modelo com todos os recursos (caixas de seleção, texto longo, condicionais, saltos, escala, data, consentimento, duas telas finais)
- `/crm/` central de leads, dashboard, formulários e ajustes

Sem configuração, form e CRM rodam em modo demo (dados só no navegador).

## Ligar o Supabase

1. Crie um projeto em supabase.com (região São Paulo).
2. SQL Editor > New query > cole `supabase/schema.sql` > Run. Pode rodar de novo quando atualizar o arquivo.
3. Project Settings > API: copie a Project URL e a anon public key para `assets/js/tracto-config.js`.
4. Authentication > Sign In / Providers: desligue "Allow new users to sign up".
5. Authentication > Users > Add user: crie seu login. O primeiro usuário vira ativo automaticamente; os próximos entram inativos e você libera em CRM > Ajustes > Equipe.

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
