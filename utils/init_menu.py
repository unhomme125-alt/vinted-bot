"""
init_menu.py — Menu d'initialisation interactif du bot Vinted.
"""

import os
import re
import sys
from pathlib import Path

import config
from utils.params_store import load_params, save_params

# ─── ANSI ────────────────────────────────────────────────────────────────────
R     = "\033[0m"
BOLD  = "\033[1m"
DIM   = "\033[2m"
BCYAN = "\033[96m"
BGRN  = "\033[92m"
WHT   = "\033[97m"
GRAY  = "\033[90m"

BG_CYN = "\033[46;30m"   # fond cyan   — logo V
KC_GRN = "\033[92m"      # vert vif    — Entrée / E
KC_YLW = "\033[93m"      # jaune vif   — M
KC_BLU = "\033[94m"      # bleu vif    — R
KC_RED = "\033[91m"      # rouge vif   — Q / T

# ─── Dimensions ──────────────────────────────────────────────────────────────
OW = 56   # largeur interne de la boîte principale (entre ║ et ║)
LW = 22   # largeur de la colonne label dans le tableau paramètres

_ANSI_RE = re.compile(r'\033\[[0-9;]*m')


def _vlen(s: str) -> int:
    """
    Longueur visible (codes ANSI exclus).
    Les emoji et caractères larges comptent 2 colonnes dans le terminal
    mais len() les compte comme 1 — on corrige l'écart.
    """
    clean = _ANSI_RE.sub('', s)
    extra = sum(
        1 for c in clean
        if (0x1F000 <= ord(c) <= 0x1FFFF)   # emoji bloc principal
        or (0x2600  <= ord(c) <= 0x27BF)     # symboles divers / dingbats
    )
    return len(clean) + extra


def _fill(s: str, w: int) -> str:
    """Complète s avec des espaces jusqu'à la largeur visible w."""
    return s + ' ' * max(0, w - _vlen(s))


def _key(color: str, text: str, total: int = 11) -> str:
    """Touche avec bordure colorée, sans fond."""
    return _fill(f"{BOLD}{color}[{R} {BOLD}{WHT}{text}{R} {BOLD}{color}]{R}", total)


# ─── Primitives boîte ────────────────────────────────────────────────────────

def _top():
    print(f"{BCYAN}╔{'═' * OW}╗{R}")

def _bot():
    print(f"{BCYAN}╚{'═' * OW}╝{R}")

def _sep(left='╠', right='╣'):
    print(f"{BCYAN}{left}{'═' * OW}{right}{R}")

def _row(content: str = ''):
    # ║ + espace + contenu(OW-2 visible) + espace + ║
    print(f"{BCYAN}║{R} {_fill(content, OW - 2)} {BCYAN}║{R}")


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _fmt(v, suffix='') -> str:
    if v is None or v == '':
        return '—'
    if isinstance(v, list):
        return ', '.join(str(x) for x in v) if v else 'toutes'
    return f'{v}{suffix}'


def _setup_utf8():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')


def _enable_ansi():
    if os.name == 'nt':
        try:
            import ctypes
            ctypes.windll.kernel32.SetConsoleMode(
                ctypes.windll.kernel32.GetStdHandle(-11), 7
            )
        except Exception:
            pass


def _clear():
    os.system('cls' if os.name == 'nt' else 'clear')


# ─── Blocs d'affichage ───────────────────────────────────────────────────────

def _block_header(subtitle: str = 'Démarrage'):
    logo  = f"{BG_CYN} V {R}"
    title = f"{BOLD}{BGRN}VINTED BOT{R}"
    sub   = f"{WHT}{subtitle}{R}"
    _top()
    _row(f"{logo}  {title}")
    _row(f"      {sub}")


def _block_params(p: dict, first_launch: bool = False):
    label = ('PREMIERS PARAMÈTRES :' if first_launch
             else 'PARAMÈTRES ENREGISTRÉS :')
    section = f"{BOLD}{BCYAN}⚙  {label}{R}"
    rows = [
        ('Mot-clé de recherche', _fmt(p['keyword'])),
        ('Prix minimum',         _fmt(p['price_min'], ' €')),
        ('Prix maximum',         _fmt(p['price_max'], ' €')),
        ('Tailles filtrées',     _fmt(p['sizes']) if p.get('sizes') else 'toutes'),
        ('Max annonces suivies', str(p['max_items'])),
        ('Intervalle search',    f"{p['search_interval']} min"),
        ('Intervalle recheck',   f"{p['recheck_interval']} min"),
    ]
    _sep()
    _row()
    _row(section)
    _row()
    for i, (lbl, val) in enumerate(rows, 1):
        num  = f"{GRAY}{i}.{R}"
        lab  = f"{WHT}{_fill(lbl, LW)}{R}"
        valu = f"{BCYAN}{val}{R}"
        _row(f"   {num}  {lab}  {valu}")
    _row()


def _block_commands():
    section = f"{BOLD}{BCYAN}>_  COMMANDES :{R}"
    arrow   = f"{BCYAN}→{R}"
    cmds = [
        (_key(KC_GRN, 'Entrée', 11), 'Démarrer avec ces paramètres'),
        (_key(KC_YLW, 'M',      11), 'Modifier les paramètres'),
        (_key(KC_BLU, 'R',      11), 'Réinitialiser le fichier Excel'),
        (_key(KC_RED, 'Q',      11), 'Quitter'),
    ]
    _sep()
    _row()
    _row(section)
    _row()
    for k, desc in cmds:
        _row(f"  {k}  {arrow}  {WHT}{desc}{R}")
    _row()


def _block_footer():
    # 🔒 à gauche, 🛒 aligné à droite — _vlen() compte les emoji en 2 colonnes
    left   = f" 🔒  {BCYAN}Trouvez. Suivez. Achetez.{R}"
    right  = f"{BCYAN}🛒 {R}"
    gap    = ' ' * max(0, (OW - 2) - _vlen(left) - _vlen(right))
    credit = f"   {GRAY}Bot Vinted · Créé pour chasser les bonnes affaires.{R}"
    _sep()
    _row(left + gap + right)
    _row(credit)
    _bot()


# ─── Écrans complets ─────────────────────────────────────────────────────────

def _screen_main(params: dict):
    _clear()
    print()
    _block_header()
    _block_params(params, first_launch=params.get('_first_launch', False))
    _block_commands()
    _block_footer()
    print()


def _screen_confirm(params: dict):
    _clear()
    print()
    _block_header()
    _block_params(params)
    _sep()
    _row(f"   {BGRN}Paramètres confirmés — initialisation en cours...{R}")
    _bot()
    print()


def _screen_edit(p: dict) -> dict:
    _clear()
    print()
    _block_header('Modification des paramètres')
    _sep()
    _row(f"   {GRAY}Entrée = conserver  ·  tiret (-) = effacer valeur optionnelle{R}")
    _sep()
    print()

    new_p = dict(p)
    new_p['keyword']          = _ask('Mot-clé de recherche',        p['keyword'])
    new_p['price_min']        = _ask('Prix minimum (€)',            p['price_min'],
                                     cast=lambda x: int(float(x)))
    new_p['price_max']        = _ask('Prix maximum (€, - = aucun)', p['price_max'],
                                     cast=lambda x: int(float(x)))
    new_p['sizes']            = _ask_sizes(p['sizes'])
    new_p['max_items']        = _ask('Max annonces suivies',        p['max_items'],  cast=int)
    new_p['search_interval']  = _ask('Intervalle search (min)',     p['search_interval'],  cast=int)
    new_p['recheck_interval'] = _ask('Intervalle recheck (min)',    p['recheck_interval'], cast=int)
    return new_p


def _screen_clear_excel():
    _clear()
    print()
    _block_header('Réinitialisation Excel')

    excel_path = Path(config.EXCEL_FILE)
    state_path = Path(config.STATE_FILE)
    st_e = f"{BGRN}présent{R}" if excel_path.exists() else f"{GRAY}absent{R}"
    st_s = f"{BGRN}présent{R}" if state_path.exists() else f"{GRAY}absent{R}"

    _sep()
    _row()
    _row(f"   {BCYAN}⚙  FICHIERS CONCERNÉS :{R}")
    _row()
    _row(f"   {WHT}{_fill(config.EXCEL_FILE, 30)}{R}{st_e}")
    _row(f"   {WHT}{_fill(config.STATE_FILE,  30)}{R}{st_s}")
    _row()
    _sep()
    _row()
    arrow = f"{BCYAN}→{R}"
    _row(f"   {_key(KC_GRN, 'E', 5)}  {arrow}  {WHT}Supprimer uniquement le fichier Excel{R}")
    _row(f"   {_key(KC_RED, 'T', 5)}  {arrow}  {WHT}Supprimer Excel + état (repartir de zéro){R}")
    _row(f"   {GRAY}autre   {arrow}  Annuler{R}")
    _row()
    _bot()
    print()

    try:
        choice = input(f"  {BCYAN}Votre choix :{R} ").strip().upper()
    except (KeyboardInterrupt, EOFError):
        print()
        return

    deleted = []
    if choice in ('E', 'T'):
        if excel_path.exists():
            excel_path.unlink()
            deleted.append(config.EXCEL_FILE)
        tmp = Path(config.EXCEL_FILE + '.tmp')
        if tmp.exists():
            tmp.unlink()
    if choice == 'T':
        if state_path.exists():
            state_path.unlink()
            deleted.append(config.STATE_FILE)
        backup = Path(config.STATE_BACKUP_FILE)
        if backup.exists():
            backup.unlink()

    print()
    if deleted:
        for f in deleted:
            print(f"  {BGRN}✓{R}  Supprimé : {f}")
    else:
        print(f"  {GRAY}Annulé — aucun fichier supprimé.{R}")
    print()
    input(f"  {GRAY}Appuyez sur Entrée pour revenir au menu...{R}")


# ─── Saisies utilisateur ─────────────────────────────────────────────────────

def _ask(label: str, current, cast=str):
    cur = _fmt(current)
    prompt = f"  {BCYAN}{label:<28}{R}{GRAY}[{cur}]{R} : "
    try:
        raw = input(prompt).strip()
    except (KeyboardInterrupt, EOFError):
        print()
        return current
    if not raw:
        return current
    if raw == '-':
        return None
    try:
        return cast(raw)
    except (ValueError, TypeError):
        print(f"  {GRAY}⚠  Valeur invalide — conservée : {cur}{R}")
        return current


def _ask_sizes(current: list) -> list:
    cur = ', '.join(current) if current else 'toutes'
    prompt = f"  {BCYAN}{'Tailles (ex: 36,37,38)':<28}{R}{GRAY}[{cur}  ·  vide = toutes]{R} : "
    try:
        raw = input(prompt).strip()
    except (KeyboardInterrupt, EOFError):
        print()
        return current
    if not raw:
        return []
    parts = [s.strip() for s in raw.replace(';', ',').split(',') if s.strip()]
    return parts if parts else []


# ─── Point d'entrée ──────────────────────────────────────────────────────────

def run_init_menu():
    """
    Affiche le menu de configuration, attend confirmation, puis applique
    les paramètres choisis sur le module config avant le démarrage du bot.
    """
    _setup_utf8()
    _enable_ansi()
    params = load_params()

    while True:
        _screen_main(params)

        try:
            choice = input(f"  {BCYAN}Votre choix :{R} ").strip().upper()
        except (KeyboardInterrupt, EOFError):
            print(f"\n  {GRAY}À bientôt.{R}")
            sys.exit(0)

        if choice == '':
            break
        elif choice == 'M':
            params = _screen_edit(params)
            params['_first_launch'] = False
            save_params(params)
        elif choice == 'R':
            _screen_clear_excel()
        elif choice == 'Q':
            print(f"\n  {GRAY}À bientôt.{R}")
            sys.exit(0)

    save_params(params)
    _screen_confirm(params)

    config.SEARCH_KEYWORD           = params['keyword']
    config.PRICE_MIN                = params['price_min']
    config.PRICE_MAX                = params['price_max']
    config.SIZES                    = params['sizes']
    config.MAX_TRACKED_ITEMS        = params['max_items']
    config.SEARCH_INTERVAL_MINUTES  = params['search_interval']
    config.RECHECK_INTERVAL_MINUTES = params['recheck_interval']
