"""
main.py — Point d'entrée du bot Vinted.

Deux tâches planifiées tournent en parallèle :

1. TÂCHE SEARCH (toutes les 5 minutes)
   → Cherche de nouvelles annonces via l'API Vinted
   → Les ajoute à l'état si elles ne sont pas déjà trackées
   → Met à jour l'Excel

2. TÂCHE RECHECK (toutes les 30 minutes)
   → Re-vérifie chaque annonce ACTIVE pour détecter ventes/suppressions
   → Met à jour les prix, likes, statuts
   → Archive les ventes dans la feuille Excel dédiée

Démarrage : python main.py
Arrêt     : Ctrl+C (l'état est sauvegardé automatiquement)
"""

import asyncio
import signal
import sys
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from loguru import logger

import config
from utils.logger import setup_logger
from utils.init_menu import run_init_menu
from scraper.session import VintedSession
from scraper.search import search_all_items
from scraper.item import recheck_all_active
from tracker.state import load_state, save_state, upsert_item, get_active_items, update_timestamps
from excel.writer import export_to_excel

# Initialisation
setup_logger()
session = VintedSession()
scheduler = AsyncIOScheduler()


async def task_search():
    """
    Tâche 1 : Recherche de nouvelles annonces.
    Durée typique : 15-45 secondes selon le nombre de pages.
    """
    logger.info("═══ DÉBUT CYCLE RECHERCHE ═══")

    try:
        # S'assurer que la session est valide (renouvellement auto si besoin)
        await session.ensure_valid()

        # Charger l'état courant
        state = load_state()

        # Recherche des annonces
        new_items = await search_all_items(session, config.SIZES)

        if not new_items:
            logger.warning("Aucune annonce trouvée pour ces critères.")
            return

        # Compteurs pour le log final
        count_new = 0
        count_updated = 0

        for item in new_items:
            state, is_new = upsert_item(state, item)
            if is_new:
                count_new += 1
                logger.info(f"  ✚ Nouvelle annonce : [{item['item_id']}] {item['titre'][:50]} — {item['prix_actuel']}€")
            else:
                count_updated += 1

        # Mise à jour du timestamp de dernière recherche
        state = update_timestamps(state, search=True)

        # Sauvegarde de l'état
        save_state(state)

        # Export Excel
        all_items = list(state["items"].values())
        export_to_excel(all_items, new_checks=new_items)

        logger.success(
            f"Recherche terminée : {count_new} nouvelles, {count_updated} mises à jour "
            f"| Total suivi : {len(state['items'])} annonces"
        )

    except Exception as e:
        logger.error(f"Erreur dans task_search : {e}", exc_info=True)


async def task_recheck():
    """
    Tâche 2 : Re-vérification des annonces actives.
    Détecte les ventes et suppressions.
    Durée typique : 30-90 secondes pour 20 annonces.
    """
    logger.info("═══ DÉBUT CYCLE RE-CHECK ═══")

    try:
        await session.ensure_valid()

        state = load_state()
        active_items = get_active_items(state)

        if not active_items:
            logger.info("Aucune annonce active à re-vérifier.")
            return

        logger.info(f"Re-vérification de {len(active_items)} annonces actives...")

        # Re-check de toutes les annonces actives
        updated_items = await recheck_all_active(session, active_items)

        # Compteurs
        count_sold = 0
        count_deleted = 0
        count_price_change = 0

        for updated in updated_items:
            item_id = str(updated["item_id"])
            old_item = state["items"].get(item_id, {})

            # Détection de changement de prix
            old_price = old_item.get("prix_actuel")
            new_price = updated.get("prix_actuel")
            if old_price and new_price and old_price != new_price:
                count_price_change += 1
                logger.info(
                    f"  💰 Changement de prix [{updated['item_id']}] : "
                    f"{old_price}€ → {new_price}€"
                )

            # Détection vente
            if updated.get("statut") == "VENDUE" and old_item.get("statut") == "ACTIVE":
                count_sold += 1
                logger.info(
                    f"  🎉 VENDUE : [{updated['item_id']}] {updated.get('titre', '')[:50]} "
                    f"— {updated.get('prix_vente', '?')}€"
                )

            # Détection suppression
            if updated.get("statut") == "SUPPRIMÉE" and old_item.get("statut") == "ACTIVE":
                count_deleted += 1
                logger.info(f"  🗑️  SUPPRIMÉE : [{updated['item_id']}]")

            state, _ = upsert_item(state, updated)

        state = update_timestamps(state, recheck=True)
        save_state(state)

        all_items = list(state["items"].values())
        export_to_excel(all_items, new_checks=updated_items)

        logger.success(
            f"Re-check terminé : {count_sold} ventes | "
            f"{count_deleted} suppressions | {count_price_change} changements de prix"
        )

    except Exception as e:
        logger.error(f"Erreur dans task_recheck : {e}", exc_info=True)


def handle_shutdown(sig, frame):
    """Arrêt propre du bot sur Ctrl+C."""
    logger.info("Arrêt du bot (signal reçu). État sauvegardé.")
    scheduler.shutdown(wait=False)
    sys.exit(0)


async def main():
    logger.info("╔══════════════════════════════════╗")
    logger.info("║     VINTED BOT — Démarrage       ║")
    logger.info(f"║  Search  : toutes les {config.SEARCH_INTERVAL_MINUTES} min       ║")
    logger.info(f"║  Recheck : toutes les {config.RECHECK_INTERVAL_MINUTES} min      ║")
    logger.info("╚══════════════════════════════════╝")

    # Récupération de la session initiale
    logger.info("Initialisation de la session Vinted...")
    await session.refresh()

    # Lancement immédiat du premier cycle de recherche
    await task_search()

    # Planification des tâches récurrentes
    scheduler.add_job(
        task_search,
        "interval",
        minutes=config.SEARCH_INTERVAL_MINUTES,
        id="search_job",
        max_instances=1,
        misfire_grace_time=60,
    )
    scheduler.add_job(
        task_recheck,
        "interval",
        minutes=config.RECHECK_INTERVAL_MINUTES,
        id="recheck_job",
        max_instances=1,
        misfire_grace_time=60,
    )

    scheduler.start()
    logger.info(f"Scheduler démarré. Prochain search dans {config.SEARCH_INTERVAL_MINUTES} min.")

    # Boucle infinie jusqu'à Ctrl+C
    try:
        while True:
            await asyncio.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        handle_shutdown(None, None)


if __name__ == "__main__":
    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)
    run_init_menu()
    asyncio.run(main())
