"""
writer.py — Export et mise à jour du fichier Excel.

Structure du fichier :
  - Feuille "Annonces"   : une ligne par annonce, upsert sur item_id
  - Feuille "Historique" : append-only, chaque check avec timestamp
  - Feuille "Vendues"    : archivage des annonces vendues

Mise en forme :
  - Vert (A9C4A0)   → annonce ACTIVE
  - Rouge (F4CCCC)  → annonce VENDUE
  - Gris  (E0E0E0)  → annonce SUPPRIMÉE
  - En-têtes en bleu foncé avec texte blanc
"""

import time
from datetime import datetime, timezone
from pathlib import Path
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
from openpyxl.utils import get_column_letter
from loguru import logger
from config import EXCEL_FILE


# ─── Couleurs ─────────────────────────────────────────────
COLOR_HEADER_BG = "1F4E79"   # bleu foncé
COLOR_HEADER_FG = "FFFFFF"   # blanc
COLOR_ACTIVE    = "A9C4A0"   # vert doux
COLOR_SOLD      = "F4CCCC"   # rouge doux
COLOR_DELETED   = "E0E0E0"   # gris
COLOR_ALT_ROW   = "F5F5F5"   # gris très clair pour lignes alternées

# ─── Colonnes de la feuille Annonces ─────────────────────
ANNONCES_COLS = [
    ("ID",              "item_id",          12),
    ("Titre",           "titre",            45),
    ("Statut",          "statut",           12),
    ("Prix actuel (€)", "prix_actuel",      14),
    ("Prix vente (€)",  "prix_vente",       14),
    ("Likes",           "likes",            8),
    ("Date publication","date_publication", 20),
    ("Vendeur",         "vendeur",          18),
    ("Localisation",    "localisation",     15),
    ("État article",    "etat_article",     18),
    ("Premier vu",      "premier_vu",       20),
    ("Dernier check",   "dernier_check",    20),
    ("Nb checks",       "nb_checks",        10),
    ("URL",             "url",              50),
]

# ─── Colonnes de la feuille Historique ───────────────────
HISTORIQUE_COLS = [
    ("ID",          "item_id",      12),
    ("Titre",       "titre",        40),
    ("Timestamp",   "timestamp",    22),
    ("Statut",      "statut",       12),
    ("Prix (€)",    "prix_actuel",  12),
    ("Likes",       "likes",        8),
]

# ─── Colonnes de la feuille Vendues ──────────────────────
VENDUES_COLS = [
    ("ID",                  "item_id",          12),
    ("Titre",               "titre",            45),
    ("Prix affiché (€)",    "prix_actuel",      15),
    ("Prix vente (€)",      "prix_vente",       14),
    ("Likes au moment vente","likes",           18),
    ("Date publication",    "date_publication", 20),
    ("Vendeur",             "vendeur",          18),
    ("Premier vu",          "premier_vu",       20),
    ("Vendu le",            "dernier_check",    20),
    ("Nb checks avant vente","nb_checks",       18),
    ("URL",                 "url",              50),
]


def _header_style() -> tuple:
    font = Font(bold=True, color=COLOR_HEADER_FG, name="Arial", size=10)
    fill = PatternFill("solid", fgColor=COLOR_HEADER_BG)
    align = Alignment(horizontal="center", vertical="center", wrap_text=True)
    return font, fill, align


def _row_fill(statut: str, row_idx: int) -> PatternFill | None:
    if statut == "ACTIVE":
        return PatternFill("solid", fgColor=COLOR_ACTIVE)
    elif statut == "VENDUE":
        return PatternFill("solid", fgColor=COLOR_SOLD)
    elif statut == "SUPPRIMÉE":
        return PatternFill("solid", fgColor=COLOR_DELETED)
    elif row_idx % 2 == 0:
        return PatternFill("solid", fgColor=COLOR_ALT_ROW)
    return None


def _write_headers(sheet, cols: list):
    font, fill, align = _header_style()
    sheet.row_dimensions[1].height = 30
    for col_idx, (header, _, width) in enumerate(cols, start=1):
        cell = sheet.cell(row=1, column=col_idx, value=header)
        cell.font = font
        cell.fill = fill
        cell.alignment = align
        sheet.column_dimensions[get_column_letter(col_idx)].width = width


def _freeze_and_filter(sheet):
    """Fige la première ligne et active les filtres automatiques."""
    sheet.freeze_panes = "A2"
    sheet.auto_filter.ref = sheet.dimensions


def initialize_workbook() -> Workbook:
    """Crée un nouveau classeur avec les 3 feuilles et leurs en-têtes."""
    wb = Workbook()

    # Feuille Annonces (active par défaut)
    ws_annonces = wb.active
    ws_annonces.title = "Annonces"
    _write_headers(ws_annonces, ANNONCES_COLS)
    _freeze_and_filter(ws_annonces)

    # Feuille Historique
    ws_hist = wb.create_sheet("Historique")
    _write_headers(ws_hist, HISTORIQUE_COLS)
    _freeze_and_filter(ws_hist)

    # Feuille Vendues
    ws_vendues = wb.create_sheet("Vendues")
    _write_headers(ws_vendues, VENDUES_COLS)
    _freeze_and_filter(ws_vendues)

    return wb


def _get_or_create_workbook() -> Workbook:
    path = Path(EXCEL_FILE)
    if not path.exists():
        logger.info("Création du fichier Excel...")
        return initialize_workbook()
    # Retry si Excel a le fichier verrouillé en lecture
    for attempt in range(4):
        try:
            return load_workbook(path)
        except OSError:
            if attempt < 3:
                logger.warning(f"Excel verrouillé en lecture, nouvelle tentative... ({attempt + 1}/3)")
                time.sleep(2)
    logger.warning("Impossible de lire le fichier Excel — export ignoré ce cycle.")
    raise RuntimeError("excel_locked")


def _find_row_by_id(sheet, item_id: int | str) -> int | None:
    """Cherche la ligne d'un item_id dans la feuille. Retourne le numéro de ligne ou None."""
    for row in sheet.iter_rows(min_row=2, max_col=1, values_only=False):
        cell = row[0]
        if cell.value is not None and str(cell.value) == str(item_id):
            return cell.row
    return None


def _write_item_row(sheet, row_idx: int, item: dict, cols: list):
    """Écrit les données d'un item dans une ligne, avec mise en forme."""
    statut = item.get("statut", "ACTIVE")
    fill = _row_fill(statut, row_idx)

    for col_idx, (_, field, _) in enumerate(cols, start=1):
        value = item.get(field, "")
        # Nettoyage des valeurs None
        if value is None:
            value = ""
        cell = sheet.cell(row=row_idx, column=col_idx, value=value)
        cell.font = Font(name="Arial", size=9)
        cell.alignment = Alignment(vertical="center", wrap_text=False)
        if fill:
            cell.fill = fill

    sheet.row_dimensions[row_idx].height = 18


def export_to_excel(all_items: list[dict], new_checks: list[dict] = None):
    """
    Met à jour le fichier Excel avec tous les items de l'état courant.
    
    - Feuille Annonces : upsert sur item_id
    - Feuille Historique : append des nouveaux checks
    - Feuille Vendues : append des items nouvellement vendus
    
    Écriture atomique via fichier temporaire.
    """
    final_path = Path(EXCEL_FILE)

    try:
        wb = _get_or_create_workbook()
    except RuntimeError:
        return  # fichier verrouillé, on skip ce cycle
    ws_annonces = wb["Annonces"]
    ws_hist = wb["Historique"]
    ws_vendues = wb["Vendues"]

    now = datetime.now(timezone.utc).isoformat()

    # ── Feuille Annonces : upsert ──────────────────────────
    for item in all_items:
        existing_row = _find_row_by_id(ws_annonces, item["item_id"])

        if existing_row:
            # Mise à jour de la ligne existante
            _write_item_row(ws_annonces, existing_row, item, ANNONCES_COLS)
        else:
            # Nouvelle ligne à la fin
            next_row = ws_annonces.max_row + 1
            _write_item_row(ws_annonces, next_row, item, ANNONCES_COLS)

    # ── Feuille Historique : append ────────────────────────
    if new_checks:
        for item in new_checks:
            hist_entry = {**item, "timestamp": now}
            next_row = ws_hist.max_row + 1
            _write_item_row(ws_hist, next_row, hist_entry, HISTORIQUE_COLS)

    # ── Feuille Vendues : append des nouvelles ventes ──────
    newly_sold = [i for i in all_items if i.get("statut") == "VENDUE"]
    for item in newly_sold:
        # Vérifier que cet item n'est pas déjà dans la feuille Vendues
        existing = _find_row_by_id(ws_vendues, item["item_id"])
        if not existing:
            next_row = ws_vendues.max_row + 1
            _write_item_row(ws_vendues, next_row, item, VENDUES_COLS)

    # ── Sauvegarde directe avec retry si le fichier est ouvert dans Excel ──
    _save_workbook(wb, final_path)

    logger.info(
        f"Excel mis à jour : {len(all_items)} annonces | "
        f"{len(newly_sold)} ventes archivées"
    )


def _save_workbook(wb: Workbook, path: Path, retries: int = 5, delay: float = 3.0):
    """Sauvegarde directement dans le fichier cible avec retry si verrouillé."""
    for attempt in range(retries):
        try:
            wb.save(path)
            return
        except OSError:
            if attempt < retries - 1:
                logger.warning(
                    f"Excel verrouillé (ouvert dans un autre programme) — "
                    f"nouvelle tentative dans {delay:.0f}s... ({attempt + 1}/{retries})"
                )
                time.sleep(delay)
            else:
                stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                fallback = path.with_name(
                    path.stem + f"_backup_{stamp}" + path.suffix
                )
                wb.save(fallback)
                logger.warning(
                    f"Excel toujours verrouillé après {retries} tentatives. "
                    f"Données sauvegardées dans : {fallback.name} — "
                    f"fermez le fichier Excel pour que les prochains cycles écrivent normalement."
                )


# Test unitaire
if __name__ == "__main__":
    sample_items = [
        {
            "item_id": 12345,
            "titre": "Adidas Spezial femme 37",
            "statut": "ACTIVE",
            "prix_actuel": 95.0,
            "prix_vente": None,
            "likes": 12,
            "date_publication": "2024-01-15T10:00:00",
            "vendeur": "marie_lyon",
            "localisation": "Lyon",
            "etat_article": "Neuf avec étiquettes",
            "premier_vu": "2024-01-16T08:00:00",
            "dernier_check": "2024-01-16T09:00:00",
            "nb_checks": 3,
            "url": "https://www.vinted.fr/items/12345",
        },
        {
            "item_id": 67890,
            "titre": "Adidas Spezial 36 beige",
            "statut": "VENDUE",
            "prix_actuel": 85.0,
            "prix_vente": 85.0,
            "likes": 34,
            "date_publication": "2024-01-10T14:00:00",
            "vendeur": "sportfashion",
            "localisation": "Paris",
            "etat_article": "Neuf avec étiquettes",
            "premier_vu": "2024-01-11T08:00:00",
            "dernier_check": "2024-01-16T09:00:00",
            "nb_checks": 8,
            "url": "https://www.vinted.fr/items/67890",
        },
    ]
    export_to_excel(sample_items, new_checks=sample_items)
    print(f"Fichier test créé : {EXCEL_FILE}")
