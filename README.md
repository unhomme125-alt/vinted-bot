# Vinted Bot — Tracker d'annonces

## Installation (5 étapes)

```bash
# 1. Créer un environnement virtuel
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# 2. Installer les dépendances
pip install -r requirements.txt

# 3. Installer le navigateur Playwright
playwright install chromium

# 4. (Optionnel) Modifier les paramètres dans config.py

# 5. Lancer le bot
python main.py
```

## Fichiers générés
- `vinted_tracker.xlsx` → Excel avec 3 feuilles (Annonces / Historique / Vendues)
- `state.json`          → état persistant (reprend où il s'est arrêté)
- `vinted_bot.log`      → logs détaillés

## Arrêt
`Ctrl+C` — l'état est sauvegardé automatiquement.

## Modifier les critères
Éditer `config.py` :
```python
SEARCH_KEYWORD = "adidas spezial femme"
PRICE_MIN = 80
SIZES = ["36", "37", "38"]

!! Si PARAMETRE VIDE, paramètre pas pris en compte
```
