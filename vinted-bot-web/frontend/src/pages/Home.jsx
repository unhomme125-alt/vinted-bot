// Home.jsx — menu d'accueil orbital (cf. menu.png).
// Les planètes sont les sections réelles du site ; cliquer = naviguer.
import { useNavigate } from 'react-router-dom';
import { Search, Users, Share2, History } from 'lucide-react';
import RadialOrbitalTimeline from '@/components/ui/radial-orbital-timeline';

// energy/status/date sont requis par le composant mais non affichés ici
// (onSelect navigue directement, sans ouvrir la carte de détail).
const sections = [
  {
    id: 1, title: 'Recherche', date: '', category: 'nav', icon: Search,
    content: 'Lancer une recherche Vinted.', relatedIds: [2, 4],
    status: 'completed', energy: 100, route: '/dashboard',
  },
  {
    id: 2, title: 'Groupe', date: '', category: 'nav', icon: Users,
    content: 'Gérer tes groupes et invitations.', relatedIds: [1, 3],
    status: 'completed', energy: 100, route: '/groups',
  },
  {
    id: 3, title: 'Partagé', date: '', category: 'nav', icon: Share2,
    content: 'Recherches partagées par tes groupes.', relatedIds: [2, 4],
    status: 'completed', energy: 100, route: '/dashboard?tab=shared',
  },
  {
    id: 4, title: 'Historique', date: '', category: 'nav', icon: History,
    content: 'Tes recherches passées.', relatedIds: [1, 3],
    status: 'completed', energy: 100, route: '/dashboard?tab=history',
  },
];

export default function Home() {
  const navigate = useNavigate();
  return (
    <RadialOrbitalTimeline
      timelineData={sections}
      onSelect={(item) => item.route && navigate(item.route)}
    />
  );
}
