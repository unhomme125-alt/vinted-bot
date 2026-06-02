"""
session.py — Gestion de la session Vinted.

Stratégie de capture en cascade (3 méthodes) :
1. Interception des requêtes SORTANTES vers /api/v2/ (headers Authorization)
2. Interception des réponses ENTRANTES (headers de réponse ou corps JSON)
3. Lecture du localStorage du navigateur (token parfois stocké côté client)
Si aucun token trouvé → continue avec les cookies seuls (souvent suffisant)

headless=False : navigateur visible, beaucoup moins bloqué par Vinted.
Token valide ~1h → renouvellement auto si 401 reçu.
"""

import asyncio
from urllib.parse import quote_plus
from playwright.async_api import async_playwright
from loguru import logger
import config
from config import VINTED_DOMAIN

# Script injecté dans chaque page pour masquer les fingerprints Playwright
# Remplace playwright-stealth sans dépendance externe
STEALTH_SCRIPT = """
() => {
    // Masquer webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Simuler un vrai Chrome
    window.chrome = { runtime: {}, loadTimes: () => {}, csi: () => {}, app: {} };

    // Plugins non vides (navigateur réel en a)
    Object.defineProperty(navigator, 'plugins', {
        get: () => [
            { name: 'Chrome PDF Plugin' },
            { name: 'Chrome PDF Viewer' },
            { name: 'Native Client' }
        ]
    });

    // Langues cohérentes
    Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US'] });

    // Permissions réalistes
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);

    // Masquer automation dans user-agent data
    if (navigator.userAgentData) {
        Object.defineProperty(navigator.userAgentData, 'brands', {
            get: () => [
                { brand: 'Google Chrome', version: '124' },
                { brand: 'Chromium', version: '124' },
                { brand: 'Not-A.Brand', version: '99' }
            ]
        });
    }
}
"""


class VintedSession:
    def __init__(self):
        self.token: str | None = None
        self.csrf: str | None = None
        self.cookies: str | None = None

    @property
    def is_valid(self) -> bool:
        # Cookies seuls suffisent si pas de token
        return bool(self.cookies)

    async def refresh(self):
        """
        Lance un navigateur visible, navigue sur Vinted,
        tente de capturer les credentials API via 3 méthodes en cascade.
        Continue avec les cookies seuls si aucun token trouvé.
        """
        logger.info("Démarrage Playwright pour récupérer la session Vinted...")

        captured = {"token": None, "csrf": None, "cookies": None}
        token_found = asyncio.Event()

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,  # visible : moins bloqué par Vinted
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-infobars",
                    "--window-size=1366,768",
                ]
            )
            context = await browser.new_context(
                viewport={"width": 1366, "height": 768},
                locale="fr-FR",
                timezone_id="Europe/Paris",
            )
            page = await context.new_page()
            await page.add_init_script(STEALTH_SCRIPT)

            # ── Méthode 1 : interception des requêtes SORTANTES ────────────
            async def handle_request(request):
                if "/api/v2/" in request.url and not token_found.is_set():
                    auth = request.headers.get("authorization", "")
                    csrf = request.headers.get("x-csrf-token", "")
                    if auth.startswith("Bearer "):
                        captured["token"] = auth.replace("Bearer ", "")
                        if csrf:
                            captured["csrf"] = csrf
                        token_found.set()
                        logger.debug(f"[M1] Token capturé via requête sortante : {captured['token'][:20]}...")

            page.on("request", handle_request)

            # ── Méthode 2 : interception des réponses ENTRANTES ────────────
            async def handle_response(response):
                if "/api/v2/" in response.url and not token_found.is_set():
                    try:
                        # Certaines réponses incluent le token dans les headers
                        auth = response.headers.get("authorization", "")
                        csrf = response.headers.get("x-csrf-token", "")
                        if auth.startswith("Bearer "):
                            captured["token"] = auth.replace("Bearer ", "")
                            if csrf:
                                captured["csrf"] = csrf
                            token_found.set()
                            logger.debug(f"[M2] Token capturé via réponse entrante : {captured['token'][:20]}...")
                            return
                        # Certaines réponses JSON contiennent le token dans le corps
                        if not token_found.is_set():
                            body = await response.json()
                            token = (
                                body.get("access_token")
                                or body.get("token")
                                or (body.get("user") or {}).get("access_token")
                            )
                            if token:
                                captured["token"] = token
                                token_found.set()
                                logger.debug(f"[M2] Token capturé dans le corps JSON : {token[:20]}...")
                    except Exception:
                        pass

            page.on("response", handle_response)

            # Navigation principale
            search_url = f"{VINTED_DOMAIN}/catalog?search_text={quote_plus(config.SEARCH_KEYWORD)}"
            await page.goto(search_url, wait_until="domcontentloaded", timeout=30000)

            # Attendre que le token soit capturé (max 20 secondes)
            try:
                await asyncio.wait_for(token_found.wait(), timeout=20.0)
            except asyncio.TimeoutError:
                logger.warning("[M1/M2] Token non capturé, tentative via localStorage...")

            # ── Méthode 3 : lecture du localStorage ───────────────────────
            if not token_found.is_set():
                try:
                    # Vinted stocke parfois le token dans localStorage sous plusieurs clés
                    for key in ("access_token", "token", "authToken", "vinted_token"):
                        value = await page.evaluate(f"() => localStorage.getItem('{key}')")
                        if value:
                            captured["token"] = value
                            token_found.set()
                            logger.debug(f"[M3] Token capturé dans localStorage['{key}'] : {value[:20]}...")
                            break
                except Exception as e:
                    logger.debug(f"[M3] Erreur lecture localStorage : {e}")

            if not token_found.is_set():
                logger.warning("Aucun token trouvé — session cookies-only (peut être suffisant).")

            # Récupération des cookies de session
            cookies_list = await context.cookies()
            captured["cookies"] = "; ".join(
                f"{c['name']}={c['value']}" for c in cookies_list
            )

            await browser.close()

        if not captured["cookies"]:
            raise RuntimeError("Impossible de récupérer les cookies Vinted. Vérifiez votre connexion.")

        self.token = captured["token"]
        self.csrf = captured["csrf"]
        self.cookies = captured["cookies"]

        if self.token:
            logger.success(f"Session Vinted établie (token + cookies).")
        else:
            logger.success("Session Vinted établie (cookies seuls).")

    async def ensure_valid(self):
        """Rafraîchit la session si elle n'est pas valide."""
        if not self.is_valid:
            await self.refresh()


# Point d'entrée pour test unitaire
if __name__ == "__main__":
    async def test():
        session = VintedSession()
        await session.refresh()
        print(f"Token: {session.token[:30]}...")
        print(f"CSRF: {session.csrf}")
        print(f"Cookies: {session.cookies[:80]}...")
    asyncio.run(test())
