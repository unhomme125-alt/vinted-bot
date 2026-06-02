"""
vinted_bot.py — Interface CLI JSON pour le bot Vinted existant.

Appelé en subprocess par le backend Express (cf. backend/bot/runner.js).
Réutilise les modules du bot Python d'origine (scraper/) situés à la racine
du dépôt, deux niveaux au-dessus de ce fichier.

Usage :
    python vinted_bot.py --keyword "ray ban wayfarer" \
        --price-min 200 --price-max 250 --size 38 --max-results 50

Sortie (stdout, JSON STRICT — rien d'autre n'est écrit sur stdout) :
    { "success": true,
      "results": [ {title, price, size, seller, url, found_at}, ... ],
      "meta": { "total": N, "keyword": "...", "duration_ms": N } }
ou en cas d'échec :
    { "success": false, "error": "message" }

Important : tous les logs (loguru, scraper) sont redirigés sur stderr pour que
stdout ne contienne que le JSON final.
"""

import argparse
import asyncio
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── stdout doit rester pur JSON : on route les logs vers stderr ───────────────
from loguru import logger
logger.remove()
logger.add(sys.stderr, level="WARNING")

# stdout en UTF-8 : sous Windows le défaut est cp1252, ce qui lève un
# UnicodeEncodeError dès qu'un titre/vendeur Vinted contient un caractère
# accentué ou un emoji au moment du json.dumps(ensure_ascii=False).
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ── Réutilisation du bot existant (racine du dépôt = parents[2]) ──────────────
REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT))

import config  # noqa: E402
from scraper.session import VintedSession  # noqa: E402
from scraper.search import search_all_items  # noqa: E402


def _emit(payload: dict):
    """Écrit le JSON final sur stdout et termine."""
    sys.stdout.write(json.dumps(payload, ensure_ascii=False))
    sys.stdout.flush()


def _map_result(item: dict) -> dict:
    """Convertit un item du scraper vers le schéma attendu par l'API web."""
    return {
        "title": item.get("titre", ""),
        "price": item.get("prix_actuel", 0),
        "size": item.get("taille", ""),
        "seller": item.get("vendeur", ""),
        "url": item.get("url", ""),
        "found_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }


async def _run(args) -> dict:
    started = time.monotonic()

    # Le scraper lit ses paramètres depuis le module config (accès via config.X).
    config.SEARCH_KEYWORD = args.keyword
    config.PRICE_MIN = args.price_min
    config.PRICE_MAX = args.price_max
    config.MAX_TRACKED_ITEMS = args.max_results
    config.CONDITION = None

    sizes = [args.size] if args.size else []

    session = VintedSession()
    await session.refresh()  # ouvre Chromium (mode visible) pour capturer la session
    items = await search_all_items(session, sizes)

    results = [_map_result(it) for it in items]
    duration_ms = int((time.monotonic() - started) * 1000)

    if not results:
        return {"success": False, "error": "Aucune annonce trouvée pour ces critères"}

    return {
        "success": True,
        "results": results,
        "meta": {"total": len(results), "keyword": args.keyword, "duration_ms": duration_ms},
    }


def main():
    parser = argparse.ArgumentParser(description="Recherche Vinted — sortie JSON sur stdout")
    parser.add_argument("--keyword", required=True)
    parser.add_argument("--price-min", type=int, default=None, dest="price_min")
    parser.add_argument("--price-max", type=int, default=None, dest="price_max")
    parser.add_argument("--size", default=None)
    parser.add_argument("--max-results", type=int, default=20, dest="max_results")
    args = parser.parse_args()

    try:
        payload = asyncio.run(_run(args))
    except Exception as e:  # tout échec → JSON d'erreur, jamais de traceback sur stdout
        logger.exception("Échec de la recherche")
        payload = {"success": False, "error": str(e)}

    _emit(payload)


if __name__ == "__main__":
    main()
