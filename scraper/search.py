"""
search.py — Recherche d'annonces via l'API interne Vinted.

Endpoint : GET /api/v2/catalog/items
Params clés :
  - search_text     : mot-clé
  - size_ids        : IDs de tailles (récupérés via /api/v2/catalog/filters)
  - price_from      : prix minimum
  - status_ids      : 6 = neuf avec étiquettes
  - per_page        : nombre de résultats par page (max 96)
  - page            : numéro de page

On s'arrête dès qu'on a MAX_TRACKED_ITEMS résultats ou qu'il n'y a plus de pages.
"""

import asyncio
import httpx
from loguru import logger
import config
from config import VINTED_API_BASE
from utils.anti_detect import build_headers, random_delay, backoff_delay
from scraper.session import VintedSession

# ID de condition Vinted
CONDITION_ID_MAP = {
    "new_with_tags": "6",      # Neuf avec étiquettes
    "new_without_tags": "1",   # Neuf sans étiquettes
    "very_good": "2",
    "good": "3",
    "satisfactory": "4",
}


def extract_price(raw_price) -> float:
    """
    L'API Vinted retourne le prix sous deux formes possibles :
      - dict  : {"amount": "110.0", "currency_code": "EUR"}
      - float : 110.0
    """
    if isinstance(raw_price, dict):
        return float(raw_price.get("amount", 0) or 0)
    if raw_price is None:
        return 0.0
    return float(raw_price)


def build_search_params(page: int = 1) -> dict:
    """Construit les paramètres de recherche pour l'API Vinted."""
    params = {
        "search_text": config.SEARCH_KEYWORD,
        "per_page": "96",
        "page": str(page),
        "order": "newest_first",
    }
    if config.CONDITION and config.CONDITION in CONDITION_ID_MAP:
        params["status_ids[]"] = CONDITION_ID_MAP[config.CONDITION]
    if config.PRICE_MIN:
        params["price_from"] = str(config.PRICE_MIN)
    if config.PRICE_MAX:
        params["price_to"] = str(config.PRICE_MAX)
    return params


def item_matches_sizes(raw: dict, sizes: list[str]) -> bool:
    """
    Filtre côté Python sur le champ size_title retourné par l'API.
    Les SIZE_IDs Vinted varient par catégorie, donc on évite de les envoyer
    à l'API et on filtre sur le libellé texte à la place.
    Accepte l'item si aucune taille n'est configurée, ou si sizes == ["-"].
    """
    if not sizes or sizes == ["-"]:
        return True
    size_title = str(raw.get("size_title") or raw.get("size", {}).get("title", "") or "").strip()
    return any(s in size_title for s in sizes)


def parse_item(raw: dict) -> dict:
    """
    Extrait les champs utiles d'un item brut retourné par l'API.
    Retourne un dict normalisé correspondant au modèle de données du projet.
    """
    price = extract_price(raw.get("price"))
    status_raw = raw.get("status")
    etat = status_raw.get("title", "") if isinstance(status_raw, dict) else str(status_raw or "")
    photo_url = ""
    photos = raw.get("photos")
    if photos:
        photo_url = photos[0].get("url") or photos[0].get("full_size_url", "")

    return {
        "item_id": raw.get("id"),
        "url": raw.get("url", ""),
        "titre": raw.get("title", ""),
        "prix_actuel": price,
        "prix_vente": None,
        "likes": raw.get("favourite_count", 0),
        "taille": raw.get("size_title") or (raw.get("size") or {}).get("title", ""),
        "date_publication": raw.get("created_at_ts", ""),
        "vendeur": (raw.get("user") or {}).get("login", ""),
        "vendeur_url": f"https://www.vinted.fr/member/{(raw.get('user') or {}).get('id', '')}",
        "localisation": raw.get("city", ""),
        "etat_article": etat,
        "statut": "ACTIVE",
        "premier_vu": None,
        "dernier_check": None,
        "nb_checks": 0,
        "photo_url": photo_url,
    }


async def fetch_search_page(
    client: httpx.AsyncClient,
    session: VintedSession,
    sizes: list[str],
    page: int = 1
) -> tuple[list[dict], bool]:
    """
    Récupère une page de résultats de recherche.
    Retourne (liste d'items filtrés par taille, has_more_pages).
    Gère automatiquement les erreurs 401 (renouvellement token) et 429 (rate limit).
    """
    params = build_search_params(page)
    url = f"{VINTED_API_BASE}/catalog/items"

    for attempt in range(5):  # max 5 tentatives
        try:
            headers = build_headers(session.token, session.csrf, session.cookies)
            response = await client.get(url, params=params, headers=headers, timeout=15.0)

            if response.status_code == 401:
                # Token expiré → renouvellement et retry
                logger.warning("Token expiré (401), renouvellement...")
                await session.refresh()
                continue

            if response.status_code == 429:
                # Rate limit → backoff exponentiel
                logger.warning(f"Rate limit (429), tentative {attempt + 1}/5...")
                await backoff_delay(attempt)
                continue

            response.raise_for_status()
            data = response.json()

            items_raw = data.get("items", [])
            # Filtre taille côté Python (les IDs API varient par catégorie)
            items = [parse_item(item) for item in items_raw if item_matches_sizes(item, sizes)]

            # Vinted indique s'il y a d'autres pages via pagination
            pagination = data.get("pagination", {})
            total_pages = pagination.get("total_pages", 1)
            has_more = page < total_pages

            logger.debug(f"Page {page}/{total_pages} → {len(items)} annonces récupérées")
            return items, has_more

        except httpx.HTTPStatusError as e:
            logger.error(f"Erreur HTTP {e.response.status_code} lors de la recherche : {e}")
            await backoff_delay(attempt)
        except httpx.RequestError as e:
            logger.error(f"Erreur réseau : {e}")
            await backoff_delay(attempt)

    logger.error("Échec après 5 tentatives, abandon de cette page.")
    return [], False


async def search_all_items(session: VintedSession, sizes: list[str]) -> list[dict]:
    """
    Récupère toutes les annonces correspondant aux critères,
    dans la limite de MAX_TRACKED_ITEMS.
    """
    all_items = []
    page = 1

    async with httpx.AsyncClient() as client:
        while len(all_items) < config.MAX_TRACKED_ITEMS:
            items, has_more = await fetch_search_page(client, session, sizes, page)

            if not items:
                break

            all_items.extend(items)
            logger.info(f"Total collecté : {len(all_items)} annonces")

            if not has_more or len(all_items) >= config.MAX_TRACKED_ITEMS:
                break

            page += 1
            await random_delay(2.0, 5.0)  # délai entre pages

    # Limiter au max configuré
    result = all_items[:config.MAX_TRACKED_ITEMS]
    logger.info(f"Recherche terminée : {len(result)} annonces retournées")
    return result


# Test unitaire
if __name__ == "__main__":
    from scraper.session import VintedSession

    async def test():
        session = VintedSession()
        await session.refresh()
        items = await search_all_items(session, ["36", "37", "38"])
        for item in items[:3]:
            print(item)

    asyncio.run(test())
