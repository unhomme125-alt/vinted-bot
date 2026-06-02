# ============================================================
#  CONFIG — tous les paramètres à modifier ici uniquement
# ============================================================

from pathlib import Path
Path("data").mkdir(exist_ok=True)
Path("logs").mkdir(exist_ok=True)
Path("output").mkdir(exist_ok=True)

SEARCH_KEYWORD = "adidas spezial femme"

# Filtres
PRICE_MIN = 80          # prix minimum en euros
PRICE_MAX = None        # None = pas de limite haute
SIZES = ["36", "37", "38"]   # tailles recherchées
CONDITION = None  # None = toutes conditions ; "new_with_tags", "very_good", etc. pour filtrer

# Fréquences
SEARCH_INTERVAL_MINUTES = 5        # cycle de recherche de nouvelles annonces
RECHECK_INTERVAL_MINUTES = 30      # re-vérification des annonces actives connues

# Limites
MAX_TRACKED_ITEMS = 20             # nombre max d'annonces suivies simultanément

# Vinted
VINTED_DOMAIN = "https://www.vinted.fr"
VINTED_API_BASE = "https://www.vinted.fr/api/v2"

# Fichiers
STATE_FILE = "data/state.json"
STATE_BACKUP_FILE = "data/state.backup.json"
EXCEL_FILE = "output/vinted_tracker.xlsx"

# Mapping des conditions Vinted (pour référence)
# "new_with_tags"      → Neuf avec étiquettes
# "new_without_tags"   → Neuf sans étiquettes
# "very_good"          → Très bon état
# "good"               → Bon état
# "satisfactory"       → Satisfaisant
