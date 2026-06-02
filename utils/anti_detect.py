import random
import asyncio
from fake_useragent import UserAgent

_ua = UserAgent(browsers=["chrome", "firefox"])

def random_ua() -> str:
    """Retourne un User-Agent aléatoire réaliste."""
    return _ua.random

def build_headers(token: str | None, csrf: str | None, cookies: str) -> dict:
    """
    Construit les headers HTTP à injecter sur chaque requête API Vinted.
    Ces headers imitent une vraie requête navigateur.
    Le Bearer token et le CSRF sont optionnels — les cookies seuls suffisent souvent.
    """
    headers = {
        "User-Agent": random_ua(),
        "Cookie": cookies,
        "Referer": "https://www.vinted.fr/catalog",
        "Origin": "https://www.vinted.fr",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "Sec-CH-UA-Platform": '"Windows"',
        "DNT": "1",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if csrf:
        headers["X-CSRF-Token"] = csrf
    return headers

async def random_delay(min_s: float = 1.5, max_s: float = 4.0):
    """Délai aléatoire entre deux requêtes pour éviter la détection."""
    delay = random.uniform(min_s, max_s)
    await asyncio.sleep(delay)

async def backoff_delay(attempt: int):
    """
    Backoff exponentiel après une erreur 429 (rate limit).
    Tentative 1 → ~2-6s, tentative 2 → ~4-12s, etc.
    """
    base = (2 ** attempt) * random.uniform(1.0, 3.0)
    capped = min(base, 120.0)  # max 2 minutes
    await asyncio.sleep(capped)
