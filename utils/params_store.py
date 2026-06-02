"""
params_store.py — Persistance des paramètres utilisateur dans params.json.
"""

import json
from pathlib import Path

PARAMS_FILE = "data/params.json"

DEFAULTS = {
    "keyword": "adidas spezial femme",
    "price_min": 80,
    "price_max": None,
    "sizes": ["36", "37", "38"],
    "max_items": 20,
    "search_interval": 5,
    "recheck_interval": 30,
}


def load_params() -> dict:
    path = Path(PARAMS_FILE)
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                saved = json.load(f)
            params = {**DEFAULTS, **saved}
            params["_first_launch"] = False
            return params
        except Exception:
            pass
    params = dict(DEFAULTS)
    params["_first_launch"] = True
    return params


def save_params(params: dict):
    to_save = {k: v for k, v in params.items() if not k.startswith("_")}
    with open(PARAMS_FILE, "w", encoding="utf-8") as f:
        json.dump(to_save, f, ensure_ascii=False, indent=2)
