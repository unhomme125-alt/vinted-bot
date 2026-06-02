# Vinted Bot Web

Interface web (React + Express) pour piloter le bot Vinted Python existant.
**Étape 1** : front léger + backend en mémoire (aucune base de données branchée).

## Prérequis

- Node.js 18+ (pour `node --watch` et le proxy Vite)
- Python 3.12 + les dépendances du bot d'origine (à la racine `C:\vinted_bot`) :
  `pip install -r ../requirements.txt && playwright install chromium`

## Démarrage

Deux terminaux.

**Backend** (port 3001) :
```bash
cd backend
npm install
npm run dev
```

**Frontend** (port 5173, proxy `/api` → 3001) :
```bash
cd frontend
npm install
npm run dev
```

Ouvrir http://localhost:5173 — login de démo : **admin / admin**.

## Architecture (étape 1)

```
backend/   Express, JWT, store en mémoire (db/index.js)
           → tout passe par db.query('operation', params)
frontend/  React + React Router, CSS vanilla, fetch wrapper (api/client.js)
bot/       vinted_bot.py — CLI JSON qui réutilise le scraper de ../
```

Flux d'une recherche :
`SearchForm` → `GET /api/search` → `bot/runner.js` lance `bot/vinted_bot.py`
en subprocess → JSON sur stdout → persistance via `db.query` → redirection
vers `/results/:id`.

## Étape 2 (PostgreSQL)

`backend/db/schema.sql` contient le schéma complet. Pour brancher pg, ne
remplacer que le corps de `db/index.js > query()` par des appels `pool.query()`
en SQL brut — les routes restent inchangées (elles n'utilisent que des
opérations nommées).

## Notes

- `bot/vinted_bot.py` ouvre un Chromium **visible** (réutilise la session du
  bot d'origine). Une recherche prend donc quelques secondes et fait apparaître
  le navigateur — comportement hérité du bot existant.
- L'utilisateur `admin` et un groupe `Default` sont recréés à chaque démarrage
  du backend (store en mémoire, non persistant).
