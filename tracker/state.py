"""
state.py — Gestion de la persistance entre sessions via JSON.

Structure de state.json :
{
    "items": {
        "123456": {  ← item_id comme clé (string)
            "item_id": 123456,
            "statut": "ACTIVE",
            "prix_actuel": 95.0,
            ...tous les champs du modèle...
        }
    },
    "last_search": "2024-01-01T12:00:00+00:00",
    "last_recheck": "2024-01-01T12:30:00+00:00"
}

Sécurité : on sauvegarde toujours une copie backup avant d'écrire,
pour éviter la corruption si le bot est tué pendant l'écriture.
"""

import json
import shutil
from datetime import datetime, timezone
from pathlib import Path
from loguru import logger
from config import STATE_FILE, STATE_BACKUP_FILE


def load_state() -> dict:
    """
    Charge l'état depuis state.json.
    Si le fichier n'existe pas, retourne un état vide.
    Si le fichier est corrompu, tente de charger le backup.
    """
    path = Path(STATE_FILE)
    backup = Path(STATE_BACKUP_FILE)

    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                state = json.load(f)
            logger.info(f"État chargé : {len(state.get('items', {}))} annonces en mémoire")
            return state
        except json.JSONDecodeError:
            logger.warning("state.json corrompu, chargement du backup...")
            if backup.exists():
                with open(backup, "r", encoding="utf-8") as f:
                    return json.load(f)

    # État vide initial
    return {"items": {}, "last_search": None, "last_recheck": None}


def save_state(state: dict):
    """
    Sauvegarde l'état dans state.json.
    Crée d'abord un backup de l'état précédent.
    """
    path = Path(STATE_FILE)
    backup = Path(STATE_BACKUP_FILE)

    # Backup de l'état actuel avant d'écrire le nouveau
    if path.exists():
        shutil.copy2(path, backup)

    with open(path, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, default=str)


def upsert_item(state: dict, item: dict) -> tuple[dict, bool]:
    """
    Insère ou met à jour une annonce dans l'état.
    
    Retourne (state mis à jour, is_new) où is_new=True si c'est une nouvelle annonce.
    
    Règles de fusion :
    - Nouvelle annonce → insertion complète avec premier_vu = maintenant
    - Annonce existante → mise à jour des champs dynamiques uniquement
      (prix, likes, statut, dernier_check, nb_checks)
      Les champs stables (titre, vendeur, date_publication) ne sont pas écrasés
    """
    item_id = str(item["item_id"])
    now = datetime.now(timezone.utc).isoformat()
    is_new = item_id not in state["items"]

    if is_new:
        # Nouvelle annonce : on la stocke complète
        item["premier_vu"] = now
        item["dernier_check"] = now
        item["nb_checks"] = 1
        state["items"][item_id] = item
    else:
        # Annonce existante : mise à jour des champs dynamiques seulement
        existing = state["items"][item_id]
        existing["prix_actuel"] = item.get("prix_actuel", existing["prix_actuel"])
        existing["likes"] = item.get("likes", existing["likes"])
        existing["statut"] = item.get("statut", existing["statut"])
        existing["dernier_check"] = now
        existing["nb_checks"] = existing.get("nb_checks", 0) + 1

        # Prix de vente uniquement si l'item vient d'être marqué vendu
        if item.get("prix_vente") is not None:
            existing["prix_vente"] = item["prix_vente"]

        state["items"][item_id] = existing

    return state, is_new


def get_active_items(state: dict) -> list[dict]:
    """Retourne uniquement les annonces avec statut ACTIVE."""
    return [
        item for item in state["items"].values()
        if item.get("statut") == "ACTIVE"
    ]


def update_timestamps(state: dict, search: bool = False, recheck: bool = False) -> dict:
    """Met à jour les timestamps de dernière action."""
    now = datetime.now(timezone.utc).isoformat()
    if search:
        state["last_search"] = now
    if recheck:
        state["last_recheck"] = now
    return state


def should_recheck(state: dict, interval_minutes: int) -> bool:
    """
    Détermine si un re-check des annonces actives est nécessaire.
    Retourne True si le dernier re-check date de plus de interval_minutes.
    """
    last = state.get("last_recheck")
    if not last:
        return True

    last_dt = datetime.fromisoformat(last)
    now = datetime.now(timezone.utc)
    elapsed = (now - last_dt).total_seconds() / 60

    return elapsed >= interval_minutes
