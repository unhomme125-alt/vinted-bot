import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Euro, Ruler, Hash, Sparkles, AlertCircle } from 'lucide-react';
import { get } from '../api/client.js';
import { MorphingSquare } from '@/components/ui/morphing-square';

// Champ : carré d'icône turquoise + label + input (input remis à plat par le
// scope .srch défini dans Dashboard ; le conteneur porte tout le style).
function Field({ icon: Icon, label, accent, children }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2.5 transition-colors focus-within:border-[color:var(--vinted)]/50">
      <div
        className="grid size-9 shrink-0 place-items-center rounded-lg"
        style={{ background: 'color-mix(in srgb, var(--vinted) 16%, transparent)', color: 'var(--vinted)' }}
      >
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <span className="block text-[11px] font-medium tracking-wide text-white/40">{label}</span>
        {children}
      </div>
      {accent && <Sparkles size={15} className="shrink-0" style={{ color: 'var(--vinted)' }} />}
    </div>
  );
}

export default function SearchForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    keyword: '', priceMin: '', priceMax: '', size: '', maxResults: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.keyword.trim()) {
      setError('Le mot-clé est requis');
      return;
    }
    setLoading(true);
    try {
      const params = {};
      Object.entries(form).forEach(([k, v]) => {
        if (v !== '' && v !== null) params[k] = v;
      });
      const data = await get('/search', params);
      navigate(`/results/${data.searchId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <>
      {/* Carte de recherche */}
      <form
        onSubmit={handleSubmit}
        className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-5 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.9)] sm:p-6"
        style={{ backgroundImage: 'linear-gradient(180deg, color-mix(in srgb, var(--vinted) 3.5%, transparent), transparent 22%)' }}
      >
        {/* En-tête de carte */}
        <div className="mb-5 flex items-center gap-3">
          <div
            className="grid size-11 place-items-center rounded-xl"
            style={{ background: 'color-mix(in srgb, var(--vinted) 18%, transparent)', color: 'var(--vinted)' }}
          >
            <Search size={20} />
          </div>
          <div>
            <div className="text-[15px] font-semibold text-white">Nouvelle recherche</div>
            <div className="text-[13px] text-white/40">Trouvez les meilleures offres en quelques secondes.</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Field icon={Search} label="Mot-clé" accent>
            <input value={form.keyword} onChange={update('keyword')} placeholder="Ex : ray ban wayfarer" autoFocus />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field icon={Euro} label="Prix minimum (€)">
              <input type="number" value={form.priceMin} onChange={update('priceMin')} placeholder="Ex : 10" />
            </Field>
            <Field icon={Euro} label="Prix maximum (€)">
              <input type="number" value={form.priceMax} onChange={update('priceMax')} placeholder="Ex : 200" />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field icon={Ruler} label="Taille">
              <input value={form.size} onChange={update('size')} placeholder="Ex : 38" />
            </Field>
            <Field icon={Hash} label="Nombre de résultats">
              <input type="number" value={form.maxResults} onChange={update('maxResults')} placeholder="Ex : 20" />
            </Field>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
              <AlertCircle size={15} /> {error}
            </div>
          )}

          <button type="submit" className="btn-primary mt-1">
            <Search size={18} /> Lancer la recherche
          </button>
        </div>
      </form>

      {/* Chargement plein écran pendant la recherche */}
      {loading && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-7 text-white"
          style={{ background: 'radial-gradient(ellipse at center, #08171a 0%, #03070a 60%, #000 100%)' }}
        >
          <MorphingSquare className="!h-12 !w-12" style={{ backgroundColor: 'var(--vinted)' }} />
          <div className="text-center">
            <div className="text-base font-medium">Recherche en cours…</div>
            <div className="mt-1.5 text-sm text-white/40">Le bot ouvre un navigateur — cela peut prendre un moment.</div>
          </div>
        </div>
      )}
    </>
  );
}
