// bot/runner.js — Appelle le script Python en subprocess et parse son JSON stdout.
//
// Contrat (cf. CLAUDE.md « Interface Python ↔ Express ») :
//   python bot/vinted_bot.py --keyword "..." --price-min N --price-max N --size S --max-results N
//   → stdout = JSON strict { success, results, meta } | { success:false, error }
//   → les logs du bot sortent sur stderr (jamais stdout).

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/bot/ → racine du projet web → bot/vinted_bot.py
const SCRIPT = path.resolve(__dirname, '../../bot/vinted_bot.py');
const PYTHON = process.env.PYTHON_BIN || 'python';

export function runSearch({ keyword, priceMin, priceMax, size, maxResults }) {
  return new Promise((resolve, reject) => {
    const args = [SCRIPT, '--keyword', String(keyword)];
    if (priceMin !== undefined && priceMin !== null && priceMin !== '') args.push('--price-min', String(priceMin));
    if (priceMax !== undefined && priceMax !== null && priceMax !== '') args.push('--price-max', String(priceMax));
    if (size !== undefined && size !== null && size !== '') args.push('--size', String(size));
    if (maxResults !== undefined && maxResults !== null && maxResults !== '') args.push('--max-results', String(maxResults));

    console.log('[bot] Lancement subprocess —', PYTHON, args.join(' '));

    const proc = spawn(PYTHON, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('error', (err) => {
      console.error('[bot] Subprocess failed —', err.message);
      reject(new Error(`Impossible de lancer le bot Python : ${err.message}`));
    });

    proc.on('close', (code) => {
      const payload = extractJson(stdout);
      if (!payload) {
        console.error('[bot] Sortie invalide — code:', code, '| stderr:', stderr.slice(0, 500));
        return reject(new Error('Le bot Python n\'a pas renvoyé de JSON exploitable.'));
      }
      try {
        resolve(JSON.parse(payload));
      } catch (e) {
        console.error('[bot] JSON.parse échec —', e.message);
        reject(new Error('Sortie JSON du bot illisible.'));
      }
    });
  });
}

// Le bot écrit normalement uniquement du JSON sur stdout, mais on isole le
// dernier objet JSON par sécurité (au cas où une lib tierce écrirait une ligne).
function extractJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  return trimmed.slice(start, end + 1);
}

export default { runSearch };
