/**
 * Script de gestion des téléchargements de rapports
 * Support des 8 types de rapports avec format PDF
 */

/**
 * Afficher le modal de téléchargement des rapports
 */
function openReportsDownloadModal() {
  const modalHtml = `
    <div class="modal" id="reportsDownloadModal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2000;">
      <div class="modal-content" style="background: white; border-radius: 12px; padding: 32px; max-width: 600px; width: 90%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h3 style="margin: 0; font-size: 20px; font-weight: 700;">Télécharger les Rapports</h3>
          <button onclick="closeReportsDownloadModal()" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
        </div>
        
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px;">
          <!-- Rapport Mensuel -->
          <button class="btn btn-outline" onclick="downloadReport('monthly')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-calendar-alt" style="margin-right: 8px;"></i> Rapport Mensuel
          </button>
          
          <!-- Rapport Trimestriel -->
          <button class="btn btn-outline" onclick="downloadReport('quarterly')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-chart-line" style="margin-right: 8px;"></i> Rapport Trimestriel
          </button>
          
          <!-- Rapport Retard -->
          <button class="btn btn-outline" onclick="downloadReport('overdue')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-clock" style="margin-right: 8px;"></i> Rapport Retard
          </button>
          
          <!-- Rapport Locataire -->
          <button class="btn btn-outline" onclick="downloadReportTenant()" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-user" style="margin-right: 8px;"></i> Rapport Locataire
          </button>
          
          <!-- Rapport Propriétaire -->
          <button class="btn btn-outline" onclick="downloadReport('owner')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-building" style="margin-right: 8px;"></i> Rapport Propriétaire
          </button>
          
          <!-- Rapport Biens -->
          <button class="btn btn-outline" onclick="downloadReport('property')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-home" style="margin-right: 8px;"></i> Rapport Biens
          </button>
          
          <!-- Rapport Préfinancements -->
          <button class="btn btn-outline" onclick="downloadReport('prefinancing')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-coins" style="margin-right: 8px;"></i> Rapport Préfinancement
          </button>
          
          <!-- Rapport Agents -->
          <button class="btn btn-outline" onclick="downloadReport('agent')" style="width: 100%; padding: 12px; text-align: center;">
            <i class="fas fa-medal" style="margin-right: 8px;"></i> Rapport Agents
          </button>
        </div>
        
        <button class="btn btn-secondary" onclick="closeReportsDownloadModal()" style="width: 100%;">Fermer</button>
      </div>
    </div>
  `;
  
  // Ajouter le modal au DOM s'it doesn't exist
  if (!document.getElementById('reportsDownloadModal')) {
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  } else {
    document.getElementById('reportsDownloadModal').style.display = 'flex';
  }
}

/**
 * Fermer le modal de téléchargement
 */
function closeReportsDownloadModal() {
  const modal = document.getElementById('reportsDownloadModal');
  if (modal) modal.remove();
}

/**
 * Télécharger un rapport en PDF
 * @param {string} reportType - Type de rapport (monthly, quarterly, overdue, owner, property, prefinancing, agent)
 */
async function downloadReport(reportType) {
  try {
    showLoading('Génération du rapport...');
    
    // Déterminer les paramètres selon le type de rapport
    let url = `/api/reports/${reportType}`;
    let params = { format: 'pdf' };
    
    // Ajouter des filtres spécifiques si nécessaire
    if (reportType === 'monthly') {
      const now = new Date();
      params.year = now.getFullYear();
      params.month = now.getMonth() + 1;
    } else if (reportType === 'quarterly') {
      const now = new Date();
      const quarter = Math.ceil((now.getMonth() + 1) / 3);
      params.year = now.getFullYear();
      params.quarter = quarter;
    } else if (reportType === 'overdue') {
      params.daysOverdue = 15; // Par défaut, clients en retard depuis + 15 jours
    }
    
    // Construire l'URL avec les paramètres
    const queryString = Object.keys(params)
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    url += '?' + queryString;
    
    // Récupérer le PDF
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur téléchargement: ${response.status}`);
    }
    
    // Générer un nom de fichier avec la date
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const reportNames = {
      'monthly': 'Rapport_Mensuel',
      'quarterly': 'Rapport_Trimestriel',
      'overdue': 'Rapport_Retard',
      'owner': 'Rapport_Proprietaires',
      'property': 'Rapport_Biens',
      'prefinancing': 'Rapport_Prefinancements',
      'agent': 'Rapport_Agents'
    };
    
    const filename = `${reportNames[reportType] || 'Rapport'}_${dateStr}.pdf`;
    
    // Télécharger le fichier
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    
    hideLoading();
    showNotification('Rapport téléchargé avec succès!', 'success');
    closeReportsDownloadModal();
  } catch (error) {
    hideLoading();
    console.error('Erreur téléchargement rapport:', error);
    showNotification(`Erreur: ${error.message}`, 'error');
  }
}

/**
 * Télécharger un rapport locataire avec sélection préalable
 */
async function downloadReportTenant() {
  try {
    // Vérifier que les données clients sont disponibles
    if (!window.clientsData || window.clientsData.length === 0) {
      showNotification('Aucun locataire disponible', 'warning');
      return;
    }
    
    // Créer un modal de sélection
    const options = window.clientsData.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name} (${c.property_name})`
    }));
    
    if (options.length === 0) {
      showNotification('Aucun locataire avec propriété assignée', 'warning');
      return;
    }
    
    // Créer un selecteur simple
    const selectHtml = `
      <div class="modal" style="display: flex; align-items: center; justify-content: center; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 2001;">
        <div class="modal-content" style="background: white; border-radius: 12px; padding: 32px; max-width: 400px; width: 90%;">
          <h3 style="margin-bottom: 16px;">Sélectionner un locataire</h3>
          <select id="tenantSelect" style="width: 100%; padding: 8px; margin-bottom: 16px; border: 1px solid var(--border); border-radius: 8px;">
            <option value="">-- Choisir un locataire --</option>
            ${options.map(opt => `<option value="${opt.id}">${opt.name}</option>`).join('')}
          </select>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-primary" onclick="confirmTenantReport()" style="flex: 1;">Télécharger</button>
            <button class="btn btn-outline" onclick="this.closest('.modal').remove()" style="flex: 1;">Annuler</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', selectHtml);
  } catch (error) {
    console.error('Erreur sélection locataire:', error);
    showNotification('Erreur lors de la sélection', 'error');
  }
}

/**
 * Confirmer et télécharger le rapport locataire
 */
async function confirmTenantReport() {
  const select = document.getElementById('tenantSelect');
  const clientId = select.value;
  
  if (!clientId) {
    showNotification('Veuillez sélectionner un locataire', 'warning');
    return;
  }
  
  try {
    showLoading('Génération du rapport...');
    
    const response = await fetch(`/api/reports/tenant/${clientId}?format=pdf`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur téléchargement: ${response.status}`);
    }
    
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const filename = `Rapport_Locataire_${clientId}_${dateStr}.pdf`;
    
    const blob = await response.blob();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    
    hideLoading();
    showNotification('Rapport téléchargé avec succès!', 'success');
    
    // Fermer les modals
    document.querySelectorAll('.modal').forEach(m => m.remove());
  } catch (error) {
    hideLoading();
    console.error('Erreur téléchargement rapport locataire:', error);
    showNotification(`Erreur: ${error.message}`, 'error');
  }
}

/**
 * Afficher les loading
 */
function showLoading(message = 'Chargement...') {
  if (!document.getElementById('globalLoading')) {
    const loadingHtml = `
      <div id="globalLoading" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 32px; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.2); z-index: 3000; text-align: center;">
        <div style="font-size: 14px; margin-bottom: 16px; font-weight: 500;">${message}</div>
        <div style="width: 40px; height: 40px; border: 4px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto;"></div>
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
      </style>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHtml);
  }
}

/**
 * Masquer le loading
 */
function hideLoading() {
  const loading = document.getElementById('globalLoading');
  if (loading) loading.remove();
}

/**
 * Notification
 */
function showNotification(message, type = 'info') {
  const colors = {
    'success': '#10b981',
    'error': '#ef4444',
    'warning': '#f59e0b',
    'info': '#3b82f6'
  };
  
  const notifHtml = `
    <div style="position: fixed; bottom: 20px; right: 20px; background: white; border-left: 4px solid ${colors[type]}; padding: 16px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); z-index: 2999; animation: slideIn 0.3s ease-out; max-width: 300px;">
      ${message}
    </div>
    <style>
      @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    </style>
  `;
  
  const notif = document.createElement('div');
  notif.innerHTML = notifHtml;
  document.body.appendChild(notif.firstElementChild);
  
  setTimeout(() => {
    notif.firstElementChild.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notif.firstElementChild.remove(), 300);
  }, 3000);
}
