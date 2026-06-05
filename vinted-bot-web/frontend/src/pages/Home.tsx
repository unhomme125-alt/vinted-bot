// Home.tsx — hero immersif : le logo Vinted émerge du paysage de particules.
// Couches (du fond vers l'avant) : base atmosphérique → champ de points
// (DottedSurface, teinté turquoise au centre) → rayons volumétriques → halos
// turquoise → reflet du logo → CircleMenu (bouton central + onglets).
import { CircleMenu } from "@/components/ui/circle-menu";
import { DottedSurface } from "@/components/ui/dotted-surface";
import { X, Search, Users, Share2, History } from "lucide-react";

// Mes onglets = les sections réelles du site.
const items = [
  { label: "Recherche", icon: <Search size={22} />, href: "/dashboard" },
  { label: "Groupe", icon: <Users size={22} />, href: "/groups" },
  { label: "Partagé", icon: <Share2 size={22} />, href: "/dashboard?tab=shared" },
  { label: "Historique", icon: <History size={22} />, href: "/dashboard?tab=history" },
];

export default function Home() {
  return (
    <div className="cm-scope dark relative min-h-screen w-full overflow-hidden">
      <style>{`
        .cm-scope { --vinted: #16b5c0; }

        /* styles.css style globalement <button> (non layered) et écrase Tailwind ;
           on rétablit l'apparence du menu dans ce scope. */
        .cm-scope button { padding: 0; border-radius: 9999px; color: inherit; font-weight: 400; }

        /* Bouton central (logo) : disque clair + halo turquoise pour qu'il se
           fonde dans la scène plutôt que d'être posé dessus. */
        .cm-scope button.bg-foreground {
          background: var(--foreground);
          box-shadow:
            0 0 0 6px color-mix(in srgb, var(--vinted) 12%, transparent),
            0 0 46px 10px color-mix(in srgb, var(--vinted) 38%, transparent),
            0 0 120px 30px color-mix(in srgb, var(--vinted) 20%, transparent);
        }

        /* Onglets : agrandis + verre turquoise pour ressortir du fond noir. */
        .cm-scope a.bg-muted { background: transparent; }
        .cm-scope button.bg-muted {
          background: color-mix(in srgb, var(--vinted) 16%, rgba(255,255,255,0.06));
          border: 1px solid color-mix(in srgb, var(--vinted) 50%, transparent);
          box-shadow:
            0 8px 26px -8px rgba(0,0,0,0.75),
            0 0 18px color-mix(in srgb, var(--vinted) 32%, transparent);
          backdrop-filter: blur(6px);
        }
        .cm-scope button.bg-muted:hover {
          background: color-mix(in srgb, var(--vinted) 28%, rgba(255,255,255,0.10));
          border-color: color-mix(in srgb, var(--vinted) 75%, transparent);
        }

        @keyframes cm-rays { to { transform: rotate(360deg); } }
      `}</style>

      {/* Base atmosphérique : noir avec une légère lueur turquoise centrale. */}
      <div
        className="fixed inset-0 -z-10"
        style={{ background: "radial-gradient(ellipse at center, #08171a 0%, #020405 60%, #000 100%)" }}
      />

      {/* Champ de particules, teinté turquoise au centre (sous le logo). */}
      <DottedSurface accent={[0.13, 0.78, 0.83]} />

      {/* Couches lumineuses + menu, superposées au-dessus du fond. */}
      <div className="relative z-10 flex min-h-screen items-center justify-center">
        {/* Rayons volumétriques derrière le logo (rotation lente). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-[720px] rounded-full opacity-40"
          style={{
            background:
              "repeating-conic-gradient(from 0deg at 50% 50%, transparent 0deg 7deg, color-mix(in srgb, var(--vinted) 22%, transparent) 7deg 7.7deg)",
            WebkitMaskImage: "radial-gradient(circle, #000 0%, transparent 62%)",
            maskImage: "radial-gradient(circle, #000 0%, transparent 62%)",
            filter: "blur(2px)",
            animation: "cm-rays 90s linear infinite",
          }}
        />
        {/* Grand halo turquoise diffus. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-[560px] rounded-full"
          style={{
            background: "radial-gradient(circle, color-mix(in srgb, var(--vinted) 26%, transparent) 0%, transparent 60%)",
            filter: "blur(34px)",
          }}
        />
        {/* Cœur de lueur (transition douce, pas de séparation nette). */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute size-[260px] rounded-full"
          style={{
            background: "radial-gradient(circle, color-mix(in srgb, var(--vinted) 42%, transparent) 0%, transparent 68%)",
            filter: "blur(20px)",
          }}
        />
        {/* Reflet du logo sur la surface de particules. */}
        <img
          src="/vinted-logo.png"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute h-14 w-14 rounded-xl opacity-20 blur-[2px]"
          style={{
            transform: "translateY(92px) scaleY(-1)",
            WebkitMaskImage: "linear-gradient(to bottom, #000, transparent)",
            maskImage: "linear-gradient(to bottom, #000, transparent)",
          }}
        />

        <CircleMenu
          items={items}
          triggerSize={96}
          itemSize={64}
          radius={165}
          openIcon={<img src="/vinted-logo.png" alt="Vinted" className="h-14 w-14 rounded-xl" />}
          closeIcon={<X size={28} className="text-background" />}
        />
      </div>
    </div>
  );
}
