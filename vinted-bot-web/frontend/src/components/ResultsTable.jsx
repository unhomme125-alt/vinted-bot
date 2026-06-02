export default function ResultsTable({ results }) {
  if (!results || results.length === 0) {
    return <p className="muted">Aucun résultat.</p>;
  }

  return (
    <table className="table">
      <thead>
        <tr>
          <th>Titre</th>
          <th>Prix</th>
          <th>Taille</th>
          <th>Vendeur</th>
          <th>Lien</th>
        </tr>
      </thead>
      <tbody>
        {results.map((r, i) => (
          <tr key={r.url || i}>
            <td>{r.title}</td>
            <td>{r.price} €</td>
            <td>{r.size || '—'}</td>
            <td>{r.seller || '—'}</td>
            <td>
              {r.url
                ? <a href={r.url} target="_blank" rel="noreferrer">Voir</a>
                : '—'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
