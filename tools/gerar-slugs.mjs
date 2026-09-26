// Gera /aplicar/<slug>/index.html para cada formulário de assets/js/forms.js.
// Rode sempre que criar um formulário novo:  node tools/gerar-slugs.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { FORMS } from '../assets/js/forms.js';

const root = new URL('../', import.meta.url);
const page = readFileSync(new URL('aplicar/index.html', root), 'utf8');
for (const f of Object.values(FORMS)) {
  if (!f.slug) continue;
  const dir = new URL(`aplicar/${f.slug}/`, root);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('index.html', dir), page);
  console.log(`/aplicar/${f.slug}/  →  ${f.name}`);
}
console.log('/aplicar/  →  ' + Object.values(FORMS).find((f) => !f.slug)?.name);
