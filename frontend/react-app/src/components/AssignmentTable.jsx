import React from 'react';

export default function AssignmentTable({
  properties, collectors,
  selectedCollectorId, onCollectorChange,
  searchTerm, onSearchChange,
  onAssign,
  assigningPropertyIds = []
}) {
  const unassigned = properties.filter(p => !(p.collectorId || p.collector_id));
  const selectedCollector = collectors.find(c => Number(c.id) === Number(selectedCollectorId));
  const selectedCollectorName = selectedCollector
    ? `${selectedCollector.lastName || selectedCollector.last_name} ${selectedCollector.firstName || selectedCollector.first_name}`
    : '';
  const selectedCollectorShortName = selectedCollector
    ? selectedCollector.lastName || selectedCollector.last_name
    : '';
  const hasSearch = searchTerm.trim().length > 0;
  const filtered = unassigned.filter(p => {
    const term = searchTerm.toLowerCase();
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.address || '').toLowerCase().includes(term) ||
      (p.type || '').toLowerCase().includes(term)
    );
  });

  const emptyTitle = hasSearch
    ? 'Aucun bien ne correspond à cette recherche.'
    : 'Tous les biens sont déjà attribués.';
  const emptyDetail = hasSearch
    ? 'Modifiez le filtre pour afficher plus de biens disponibles.'
    : 'Les nouveaux biens non attribués apparaîtront ici.';
  const getActionLabel = propertyId => {
    if (assigningPropertyIds.includes(propertyId)) return 'Attribution en cours...';
    if (!selectedCollector) return 'Choisir un récolteur';
    return `Attribuer à ${selectedCollectorShortName}`;
  };

  return (
    <section className="available-properties-section assignment-panel">
      <div className="assignment-header">
        <div>
          <h3>Attribuer des biens</h3>
          <p>Sélectionnez un récolteur, puis choisissez les biens à lui confier.</p>
        </div>
      </div>

      {collectors.length === 0 ? (
        <div className="manager-empty-state">
          <i className="fas fa-user-slash" aria-hidden="true"></i>
          <strong>Aucun récolteur disponible.</strong>
          <span>Ajoutez ou activez un récolteur avant de commencer les attributions.</span>
        </div>
      ) : (
        <>      <div className="assignment-controls">
        <div className="assignment-control-block">
          <label htmlFor="assignmentCollector">Récolteur</label>
          <select id="assignmentCollector" value={selectedCollectorId} onChange={(e) => onCollectorChange(e.target.value)}>
            <option value="">Sélectionner un récolteur</option>
            {collectors.map(c => (
              <option key={c.id} value={c.id}>{c.lastName || c.last_name} {c.firstName || c.first_name}</option>
            ))}
          </select>
          <p>
            {selectedCollector
              ? `Les biens seront attribués à ${selectedCollectorName}.`
              : 'Sélectionnez un récolteur pour activer les actions d’attribution.'}
          </p>
        </div>

        <div className="assignment-control-block">
          <label htmlFor="assignmentSearch">Filtrer les biens</label>
          <input id="assignmentSearch" type="text" placeholder="Nom, adresse ou type"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)} />
        </div>
      </div>

        <div className="overflow-x-auto min-w-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Bien</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Type</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Adresse</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Valeur</th>
                <th className="bg-slate-50 border-y border-slate-200 text-slate-500 text-xs uppercase tracking-wider py-3 px-4 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length > 0 ? filtered.map(p => (
                <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4 text-sm font-medium text-slate-900">{p.name}</td>
                  <td className="py-3 px-4 text-sm">{p.type}</td>
                  <td className="py-3 px-4 text-sm text-slate-600">{p.address}</td>
                  <td className="py-3 px-4 text-sm font-medium text-slate-900">{((p.value || p.val || 0)).toLocaleString()} XOF</td>
                  <td className="py-3 px-4 text-sm">
                    <button className="bg-primary text-white rounded-lg px-3 py-1.5 text-xs hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={() => onAssign(p.id)}
                      disabled={!selectedCollectorId || assigningPropertyIds.includes(p.id)}
                      type="button">
                      {assigningPropertyIds.includes(p.id) && <i className="fas fa-spinner fa-spin mr-1" aria-hidden="true"></i>}
                      {getActionLabel(p.id)}
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="5" className="py-8 px-6 text-center text-slate-500">
                    <strong className="block text-slate-900 mb-1">{emptyTitle}</strong>
                    <span className="text-sm">{emptyDetail}</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      <div className="assignment-mobile-list">
        {filtered.length > 0 ? filtered.map(p => (
          <article key={p.id} className="assignment-mobile-item">
            <div className="assignment-mobile-heading">
              <strong>{p.name}</strong>
              <span>{p.type}</span>
            </div>
            <div className="assignment-mobile-detail">
              <i className="fas fa-map-marker-alt" aria-hidden="true"></i>
              <span>{p.address}</span>
            </div>
            <div className="assignment-mobile-detail">
              <i className="fas fa-coins" aria-hidden="true"></i>
              <span>{((p.value || p.val || 0)).toLocaleString()} XOF</span>
            </div>
            <button className="btn btn-primary btn-full assignment-row-action"
              onClick={() => onAssign(p.id)}
              disabled={!selectedCollectorId || assigningPropertyIds.includes(p.id)}
              type="button"
              aria-label={selectedCollector
                ? `Attribuer ${p.name} à ${selectedCollectorName}`
                : `Sélectionner un récolteur avant d’attribuer ${p.name}`}>
              {assigningPropertyIds.includes(p.id) && <i className="fas fa-spinner fa-spin" aria-hidden="true"></i>}
              {getActionLabel(p.id)}
            </button>
          </article>
        )) : (
          <div className="assignment-mobile-empty">
            <strong>{emptyTitle}</strong>
            <span>{emptyDetail}</span>
          </div>
        )}
      </div>
        </>
      )}
    </section>
  );
}
