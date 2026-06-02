"""
item.py — Re-vérification individuelle d'une annonce.

Endpoint : GET /api/v2/items/{item_id}

Logique de détection de vente/suppression :
  - HTTP 404       → annonce SUPPRIMÉE (retirée par le vendeur)
  - HTTP 200 avec item["status"] in ["sold", "reserved"] → VENDUE
  - HTTP 200 avec item["status"] == "active" → toujours ACTIVE
  - Prix peut avoir changé → on met à jour prix_actuel et on log dans historique

On retourne un dict avec les champs mis à jour.
"""

import asyncio
import httpx
from datetime import datetime, timezone
from loguru import logger
from config import VINTED_API_BASE
from utils.anti_detect import build_headers, random_delay, backoff_delay
from scraper.session import VintedSession
from scraper.search import extract_price

# Statuts Vinted qui indiquent une vente
SOLD_STATUSES = {"sold", "reserved", "transaction_in_progress"}


async def recheck_item(
    client: httpx.AsyncClient,
    session: VintedSession,
    item_id: int | str
) -> dict:
    """
    Re-vérifie une annonce individuelle.
    
    Retourne un dict avec :
      - statut : "ACTIVE", "VENDUE", "SUPPRIMÉE"
      - prix_actuel : prix actuel (None si supprimée)
      - likes : nombre de favoris actuel
      - dernier_check : timestamp de cette vérification
      - prix_vente : prix final si vendue
    """
    url = f"{VINTED_API_BASE}/items/{item_id}"
    now = datetime.now(timezone.utc).isoformat()

    for attempt in range(4):
        try:
            headers = build_headers(session.token, session.csrf, session.cookies)
            response = await client.get(url, headers=headers, timeout=10.0)

            # 404 = annonce supprimée
            if response.status_code == 404:
                logger.info(f"Annonce {item_id} → SUPPRIMÉE (404)")
                return {
                    "statut": "SUPPRIMÉE",
                    "prix_actuel": None,
                    "prix_vente": None,
                    "likes": None,
                    "dernier_check": now,
                }

            # 401 = token expiré
            if response.status_code == 401:
                logger.warning("Token expiré (401) lors du re-check, renouvellement...")
                await session.refresh()
                continue

            # 429 = rate limit
            if response.status_code == 429:
                await backoff_delay(attempt)
                continue

            response.raise_for_status()
            data = response.json()
            item = data.get("item", {})

            raw_status = item.get("status", "active")
            # Le statut peut être un dict {"id": ..., "title": ...} ou une string
            if isinstance(raw_status, dict):
                raw_status = raw_status.get("id", "active")

            prix = extract_price(item.get("price"))
            likes = item.get("favourite_count", 0)

            if raw_status in SOLD_STATUSES:
                logger.info(f"Annonce {item_id} → VENDUE (statut: {raw_status})")
                return {
                    "statut": "VENDUE",
                    "prix_actuel": prix,
                    "prix_vente": prix,   # dernier prix connu = prix de vente
                    "likes": likes,
                    "dernier_check": now,
                }
            else:
                return {
                    "statut": "ACTIVE",
                    "prix_actuel": prix,
                    "prix_vente": None,
                    "likes": likes,
                    "dernier_check": now,
                }

        except httpx.HTTPStatusError as e:
            logger.error(f"Erreur HTTP {e.response.status_code} pour item {item_id}")
            await backoff_delay(attempt)
        except httpx.RequestError as e:
            logger.error(f"Erreur réseau pour item {item_id} : {e}")
            await backoff_delay(attempt)

    # Si toutes les tentatives échouent, on ne change pas le statut
    logger.warning(f"Impossible de vérifier l'item {item_id} après 4 tentatives")
    return {
        "statut": "INCONNU",
        "prix_actuel": None,
        "prix_vente": None,
        "likes": None,
        "dernier_check": now,
    }


async def recheck_all_active(
    session: VintedSession,
    active_items: list[dict]
) -> list[dict]:
    """
    Re-vérifie toutes les annonces actives passées en paramètre.
    Applique un délai entre chaque vérification pour éviter la détection.
    
    Retourne la liste avec les champs statut/prix/likes mis à jour.
    """
    results = []

    async with httpx.AsyncClient() as client:
        for i, item in enumerate(active_items):
            item_id = item["item_id"]
            update = await recheck_item(client, session, item_id)

            # Fusionner les données mises à jour dans l'item existant
            updated = {**item, **update}

            # Incrémenter le compteur de vérifications
            updated["nb_checks"] = item.get("nb_checks", 0) + 1

            results.append(updated)

            logger.debug(
                f"[{i+1}/{len(active_items)}] Item {item_id} → {update['statut']} "
                f"| Prix: {update.get('prix_actuel', '?')}€ "
                f"| Likes: {update.get('likes', '?')}"
            )

            # Délai court entre re-checks (moins agressif que la recherche)
            if i < len(active_items) - 1:
                await random_delay(0.8, 2.5)

    return results


# Test unitaire
if __name__ == "__main__":
    from scraper.session import VintedSession

    async def test():
        session = VintedSession()
        await session.refresh()

        # Remplacer par un vrai item_id Vinted pour tester
        result = await recheck_item(
            httpx.AsyncClient(),
            session,
            item_id=5000000000  # exemple factice
        )
        print(result)

    asyncio.run(test())
