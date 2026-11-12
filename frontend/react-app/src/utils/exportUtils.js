/**
 * SYGIM — Moteur d'Exportation Universel (Excel, CSV & PDF)
 * Prend en charge : Locataires, Propriétés, Propriétaires, Paiements Propriétaires, Transactions, Grand Livre
 */

const escapeHtml = (val) => {
  if (val === null || val === undefined) return '';
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

const resolveField = (row, key) => {
  if (typeof key === 'function') return key(row);
  return key.split('.').reduce((o, k) => (o || {})[k], row);
};

/**
 * Exportation CSV compatible Excel (UTF-8 avec BOM)
 */
export const exportToCSV = (data, filename = 'export.csv', columns = null) => {
  if (!data || !data.length) return;

  let keys = [];
  let headers = [];

  if (columns) {
    keys = Object.keys(columns);
    headers = Object.values(columns);
  } else {
    keys = Object.keys(data[0]);
    headers = keys;
  }

  const formatValue = (value) => {
    if (value === null || value === undefined) return '';
    let stringValue = String(value);
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes(';')) {
      stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const csvRows = [];
  csvRows.push(headers.map(formatValue).join(';'));

  for (const row of data) {
    const values = keys.map(key => formatValue(resolveField(row, key)));
    csvRows.push(values.join(';'));
  }

  const csvString = csvRows.join('\n');
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exportation Excel native (.xls avec mise en forme tableau, en-têtes colorés et encodage UTF-8)
 *
 * @param {Array<Object>} data - Tableau des données à exporter
 * @param {string} filename - Nom du fichier (ex: 'sygim-locataires')
 * @param {Object} columns - Mapping { clé: 'Libellé Colonne' }
 * @param {string} title - Titre du rapport affiché en haut de la feuille Excel
 */
export const exportToExcel = (data, filename = 'export-sygim', columns = null, title = 'Rapport SYGIM') => {
  if (!data || !data.length) return;

  const keys = columns ? Object.keys(columns) : Object.keys(data[0]);
  const headers = columns ? Object.values(columns) : keys;
  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const rowsHtml = data.map((row, idx) => {
    const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
    const cells = keys.map(key => {
      const val = resolveField(row, key);
      const isNum = typeof val === 'number';
      const style = isNum
        ? `background:${bg}; padding:6px 10px; border:1px solid #cbd5e1; text-align:right; font-weight:600;`
        : `background:${bg}; padding:6px 10px; border:1px solid #cbd5e1; text-align:left;`;
      return `<td style="${style}">${escapeHtml(val ?? '')}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const headersHtml = headers.map(h => (
    `<th style="background:#5B5CE2; color:#ffffff; font-weight:bold; padding:8px 12px; border:1px solid #4A4BD8; text-align:left;">${escapeHtml(h)}</th>`
  )).join('');

  const excelTemplate = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="UTF-8" />
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>${escapeHtml(title.slice(0, 30))}</x:Name>
                <x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
      </head>
      <body style="font-family: Arial, sans-serif; font-size: 12px;">
        <table>
          <tr>
            <td colspan="${headers.length}" style="font-size:16px; font-weight:bold; color:#5B5CE2; padding:10px 4px;">
              SYGIM — ${escapeHtml(title)}
            </td>
          </tr>
          <tr>
            <td colspan="${headers.length}" style="font-size:11px; color:#64748b; padding-bottom:10px;">
              Exporté le ${escapeHtml(dateStr)} | Total : ${data.length} enregistrement(s)
            </td>
          </tr>
          <tr>${headersHtml}</tr>
          ${rowsHtml}
        </table>
      </body>
    </html>
  `;

  const blob = new Blob(['\uFEFF' + excelTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  const cleanName = filename.replace(/\.(xls|xlsx|csv)$/i, '');

  link.setAttribute('href', url);
  link.setAttribute('download', `${cleanName}.xls`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Exportation PDF officielle avec en-tête SYGIM, cartes de synthèse et tableau formaté
 *
 * @param {Array<Object>} data - Tableau des données
 * @param {string} filename - Nom du fichier PDF
 * @param {Object} columns - Mapping { clé: 'Libellé Colonne' }
 * @param {Object} options - { title, subtitle, summary: [{ label, value }] }
 */
export const exportToPDF = (data, filename = 'rapport-sygim', columns = null, options = {}) => {
  if (!data || !data.length) return;

  const keys = columns ? Object.keys(columns) : Object.keys(data[0]);
  const headers = columns ? Object.values(columns) : keys;
  const title = options.title || 'Rapport Officiel SYGIM';
  const subtitle = options.subtitle || 'Système de Gestion Immobilière';
  const summary = Array.isArray(options.summary)
    ? options.summary
    : (Array.isArray(options.summaryItems) ? options.summaryItems : []);

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const summaryHtml = summary.length > 0 ? `
    <div style="display:flex; gap:12px; margin-bottom:18px; flex-wrap:wrap;">
      ${summary.map(s => `
        <div style="flex:1; min-width:140px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:10px 14px;">
          <div style="font-size:10px; text-transform:uppercase; color:#64748b; font-weight:700;">${escapeHtml(s.label)}</div>
          <div style="font-size:15px; font-weight:800; color:#0f172a; margin-top:3px;">${escapeHtml(s.value)}</div>
        </div>
      `).join('')}
    </div>
  ` : '';

  const headersHtml = headers.map(h => `<th>${escapeHtml(h)}</th>`).join('');
  const rowsHtml = data.map(row => {
    const cells = keys.map(key => {
      const val = resolveField(row, key);
      const isNum = typeof val === 'number';
      return `<td style="${isNum ? 'text-align:right; font-weight:600;' : ''}">${escapeHtml(val ?? '—')}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=1024,height=768');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour générer le PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>${escapeHtml(filename)}</title>
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body {
          font-family: 'Segoe UI', Roboto, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 16px;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #5B5CE2;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .brand {
          font-size: 22px;
          font-weight: 900;
          color: #5B5CE2;
          letter-spacing: 0.5px;
        }
        .brand-sub {
          font-size: 11px;
          color: #64748b;
          margin-top: 2px;
        }
        .doc-title {
          font-size: 17px;
          font-weight: 800;
          color: #0f172a;
          margin: 0 0 4px 0;
        }
        .meta {
          text-align: right;
          font-size: 11px;
          color: #475569;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 8px;
        }
        th {
          background-color: #5B5CE2 !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-weight: 700;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid #4A4BD8;
          font-size: 10.5px;
          text-transform: uppercase;
        }
        td {
          padding: 7px 10px;
          border: 1px solid #cbd5e1;
          font-size: 11px;
          vertical-align: middle;
        }
        tr:nth-child(even) td {
          background-color: #f8fafc !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .footer {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #cbd5e1;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SYGIM</div>
          <div class="brand-sub">${escapeHtml(subtitle)}</div>
        </div>
        <div class="meta">
          <div class="doc-title">${escapeHtml(title)}</div>
          <div>Édité le ${escapeHtml(dateStr)}</div>
          <div>Total : <strong>${data.length}</strong> ligne(s)</div>
        </div>
      </div>

      ${summaryHtml}

      <table>
        <thead>
          <tr>${headersHtml}</tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <div>Document officiel généré par SYGIM v2.0 — Système de Gestion Immobilière</div>
        <div>Confidentiel — Comptabilité & Direction</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 250);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

/**
 * Génère et imprime un Bordereau / Reçu Officiel de Paiement, Préfinancement ou Reddition de Comptes Propriétaire (PDF A4)
 * Conforme au modèle officiel SYGIM avec :
 * - En-tête institutionnel SYGIM
 * - Deux blocs d'informations côte-à-côte (Propriétaire Bénéficiaire & Périmètre Locatif)
 * - TABLEAU 1 : DÉTAIL DES LOCATAIRES & OCCUPATION DES BIENS (avec Loyer attendu, encaissé, arriérés, préfinancement)
 * - TABLEAU 2 : DÉCOMPTE FINANCIER GLOBAL DU PROPRIÉTAIRE (Loyer de référence, encaissements, commissions, net à reverser)
 * - TABLEAU 3 : HISTORIQUE DÉTAILLÉ DES VERSEMENTS / TRANCHES (le cas échéant)
 * - Notes & Observations
 * - Cadres de signatures officiels (Agence SYGIM & Propriétaire « Bon pour acquis »)
 */
export const printOwnerSettlementReceipt = (settlement, options = {}) => {
  if (!settlement) return;

  const fmtMoney = (val) => `${Number(val || 0).toLocaleString('fr-FR')} FCFA`;
  const fmtDate = (d) => {
    if (!d) return '—';
    try {
      const parts = String(d).split('T')[0].split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
      return new Date(d).toLocaleDateString('fr-FR');
    } catch {
      return String(d);
    }
  };

  const methodLabels = {
    bank_transfer: 'Virement bancaire',
    mobile_money: 'Mobile Money (MTN/Moov/Wave/OM)',
    cheque: 'Chèque bancaire',
    check: 'Chèque bancaire',
    cash: 'Espèces'
  };

  const ref = settlement.transaction_reference || settlement.payout_reference || settlement.reference || (
    settlement.owner_id ? `BR-${settlement.owner_id}-${(options.month || new Date().toISOString().slice(0, 7)).replace('-', '')}` : `REV-${settlement.id || Date.now().toString().slice(-6)}`
  );

  const ownerName = settlement.owner_name || settlement.owner_full_name || (
    settlement.first_name ? `${settlement.first_name} ${settlement.last_name || ''}`.trim() : `Propriétaire #${settlement.owner_id || ''}`
  );

  const ownerPhone = settlement.owner_phone || settlement.phone || '—';
  const ownerBank = [
    settlement.owner_bank_name || settlement.bank_name,
    settlement.owner_bank_account || settlement.bank_account
  ].filter(Boolean).join(' - ') || '—';

  const isPrefinanced = Boolean(settlement.is_prefinanced || settlement.payout_mode === 'prefinancing' || settlement.status === 'prefinanced');
  const isReimbursed = String(settlement.status || '').toLowerCase() === 'reimbursed';
  const isInstallment = settlement.payout_mode === 'installment' || (settlement.installments && settlement.installments.length > 1);
  const isStatement = Boolean(settlement.total_expected_rent !== undefined || options.isStatement);

  const docTypeTitle = isPrefinanced
    ? (isReimbursed ? 'BORDEREAU DE PRÉFINANCEMENT PROPRIÉTAIRE (RÉGULARISÉ)' : 'BORDEREAU DE PRÉFINANCEMENT PROPRIÉTAIRE (AVANCE AGENCE)')
    : isStatement
      ? 'BORDEREAU DE REDDITION DE COMPTES & DÉCOMPTE LOCATIF'
      : isInstallment
        ? 'BORDEREAU DE REVERSEMENT ÉCHELONNÉ PROPRIÉTAIRE'
        : 'BORDEREAU DE REVERSEMENT MENSUEL PROPRIÉTAIRE';

  const badgeColor = isReimbursed
    ? '#059669'
    : isPrefinanced
      ? '#d97706'
      : isStatement
        ? '#5b5ce2'
        : (Number(settlement.remaining_to_pay || 0) > 0 ? '#2563eb' : '#059669');

  const statusText = isReimbursed
    ? 'PRÉFINANCEMENT REMBOURSÉ / RÉGULARISÉ'
    : isPrefinanced
      ? 'PRÉFINANCÉ PAR L\'AGENCE'
      : isStatement
        ? 'REDDITION DE COMPTES OFFICIELLE'
        : (Number(settlement.remaining_to_pay || 0) > 0 ? 'PAIEMENT PARTIEL / ÉCHELONNÉ' : 'PAYÉ INTÉGRALEMENT');

  // Résolution de la période
  let periodText = '—';
  if (settlement.period_start && settlement.period_end) {
    periodText = `Du ${fmtDate(settlement.period_start)} au ${fmtDate(settlement.period_end)}`;
  } else if (options.month) {
    const [y, m] = options.month.split('-');
    const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
    periodText = `Du 01/${m}/${y} au ${lastDay}/${m}/${y}`;
  } else if (settlement.payout_date) {
    const pDate = new Date(settlement.payout_date);
    const m = String(pDate.getMonth() + 1).padStart(2, '0');
    const y = pDate.getFullYear();
    const lastDay = new Date(y, pDate.getMonth() + 1, 0).getDate();
    periodText = `Du 01/${m}/${y} au ${lastDay}/${m}/${y}`;
  }

  // Périmètre des biens
  const propertyName = settlement.property_name || (
    settlement.properties_count ? `${settlement.properties_count} bien(s) sous gestion` : 'Tous les biens du portefeuille'
  );

  const paymentMethod = settlement.preferred_payment_method || settlement.payment_method || 'bank_transfer';

  // ── 1. RÉSOLUTION DE LA LISTE DES LOCATAIRES (UNITS) ──
  let units = Array.isArray(settlement.units) && settlement.units.length > 0
    ? settlement.units
    : [];

  if (units.length === 0 && (settlement.property_name || settlement.tenant_name || settlement.expected_rent)) {
    units = [{
      property_name: settlement.property_name || 'Bien immobilier',
      tenant_name: settlement.tenant_name || settlement.client_name || (isPrefinanced ? 'Locataire (avance agence)' : 'Locataire en place'),
      tenant_phone: settlement.tenant_phone || settlement.client_phone || '—',
      is_vacant: Boolean(settlement.is_vacant),
      expected_rent: Number(settlement.expected_rent || settlement.total_expected_rent || 0),
      collected_rent: Number(settlement.total_collected || settlement.total_collected_rent || 0),
      arrears: Number(settlement.unrecovered_amount || settlement.total_arrears || 0),
      prefinanced_amount: Number(isPrefinanced ? (settlement.amount_paid || settlement.total_prefinanced || 0) : (settlement.total_prefinanced || 0))
    }];
  }

  // Totaux locataires
  let totExpected = 0;
  let totCollected = 0;
  let totArrears = 0;
  let totPrefinanced = 0;

  units.forEach(u => {
    totExpected += Number(u.expected_rent || 0);
    totCollected += Number(u.collected_rent || 0);
    totArrears += Number(u.arrears || 0);
    totPrefinanced += Number(u.prefinanced_amount || 0);
  });

  const unitsRowsHtml = units.map(u => {
    const isVacant = Boolean(u.is_vacant);
    const arrearsVal = Number(u.arrears || 0);
    const prefVal = Number(u.prefinanced_amount || 0);

    let arrearsHtml = '<span style="color:#94a3b8;">—</span>';
    if (!isVacant) {
      if (arrearsVal > 0) {
        arrearsHtml = `<span style="color:#dc2626; font-weight:700;">${escapeHtml(fmtMoney(arrearsVal))}</span>`;
      } else if (arrearsVal < 0) {
        arrearsHtml = `<span style="color:#2563eb; font-weight:600;">-${escapeHtml(fmtMoney(Math.abs(arrearsVal)))} <small style="font-weight:normal;">(Avance)</small></span>`;
      } else {
        arrearsHtml = '<span style="color:#059669; font-weight:600;">0 FCFA</span>';
      }
    }

    const prefHtml = prefVal > 0
      ? `<span style="color:#d97706; font-weight:700; background:#fef3c7; padding:2px 6px; border-radius:4px;">${escapeHtml(fmtMoney(prefVal))}</span>`
      : '<span style="color:#94a3b8;">—</span>';

    return `
      <tr>
        <td style="font-weight:600;">
          ${isVacant
            ? '<span style="font-style:italic; color:#94a3b8;">Logement vacant</span>'
            : `<span>${escapeHtml(u.tenant_name)}</span> ${u.tenant_phone ? `<span style="font-size:10px; color:#64748b; font-weight:normal;">(${escapeHtml(u.tenant_phone)})</span>` : ''}`
          }
        </td>
        <td style="color:#475569;">${escapeHtml(u.property_name || '—')}</td>
        <td style="text-align:right; font-weight:600;">${isVacant ? '—' : escapeHtml(fmtMoney(u.expected_rent))}</td>
        <td style="text-align:right; font-weight:700; color:#059669;">${isVacant ? '—' : (u.collected_rent > 0 ? escapeHtml(fmtMoney(u.collected_rent)) : '0 FCFA')}</td>
        <td style="text-align:right;">${arrearsHtml}</td>
        <td style="text-align:right;">${prefHtml}</td>
      </tr>
    `;
  }).join('');

  // ── 2. DÉCOMPTE FINANCIER GLOBAL ──
  const expectedRent = Number(settlement.total_expected_rent ?? settlement.expected_rent ?? totExpected);
  const totalCollected = Number(settlement.total_collected_rent ?? settlement.total_collected ?? totCollected);
  const agencyCommission = Number(settlement.agency_commission || 0);
  const commissionRate = settlement.commission_rate ?? 10;
  const maintenanceDeductions = Number(settlement.maintenance_deductions || 0);
  const netAmount = Number(
    settlement.net_owner_payout ?? settlement.net_amount ?? (totalCollected - agencyCommission - maintenanceDeductions)
  );
  const amountPaid = Number(
    settlement.amount_paid ?? (isPrefinanced ? (netAmount || totalCollected) : netAmount)
  );
  const remainingToPay = Number(
    settlement.remaining_to_pay ?? (isPrefinanced ? Math.max(0, expectedRent - totalCollected) : Math.max(0, netAmount - amountPaid))
  );

  // ── 3. HISTORIQUE DES TRANCHES ──
  const installments = Array.isArray(settlement.installments) && settlement.installments.length > 0
    ? settlement.installments
    : [{
        installment_number: 1,
        payment_date: settlement.payout_date || settlement.created_at || new Date(),
        amount: amountPaid,
        payment_method: paymentMethod,
        reference: ref,
        notes: settlement.notes || (isPrefinanced ? 'Avance agence - locataire en retard' : 'Règlement propriétaire')
      }];

  const installmentsRowsHtml = installments.map(inst => `
    <tr>
      <td style="text-align:center; font-weight:700;">Tranche N°${escapeHtml(inst.installment_number)}</td>
      <td>${escapeHtml(fmtDate(inst.payment_date || inst.created_at))}</td>
      <td>${escapeHtml(methodLabels[inst.payment_method] || inst.payment_method || 'Virement')}</td>
      <td style="font-family:monospace;">${escapeHtml(inst.reference || '—')}</td>
      <td>${escapeHtml(inst.notes || '—')}</td>
      <td style="text-align:right; font-weight:700; color:#059669;">${escapeHtml(fmtMoney(inst.amount))}</td>
    </tr>
  `).join('');

  const printWindow = window.open('', '_blank', 'width=960,height=850');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer le bordereau.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Bordereau_${escapeHtml(ref)}</title>
      <style>
        @page { size: A4 portrait; margin: 12mm; }
        body {
          font-family: 'Segoe UI', Roboto, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 16px;
          font-size: 11.5px;
          line-height: 1.4;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #5B5CE2;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .brand { font-size: 26px; font-weight: 900; color: #5B5CE2; letter-spacing: -0.5px; }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 999px;
          background: ${badgeColor};
          color: #fff;
          font-weight: 700;
          font-size: 10px;
          letter-spacing: 0.3px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 16px;
        }
        .box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .box-title {
          font-size: 9.5px;
          text-transform: uppercase;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 6px;
          letter-spacing: 0.5px;
        }
        .section-title {
          font-weight: 800;
          font-size: 11.5px;
          text-transform: uppercase;
          color: #5B5CE2;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        th {
          background: #5B5CE2 !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          text-align: left;
          padding: 6px 8px;
          font-size: 10px;
          text-transform: uppercase;
          border: 1px solid #4A4BD8;
        }
        td {
          padding: 6px 8px;
          border: 1px solid #cbd5e1;
          font-size: 11px;
          vertical-align: middle;
        }
        tr:nth-child(even) td {
          background-color: #fafbfd !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        .sig-box {
          border: 1px dashed #94a3b8;
          border-radius: 8px;
          padding: 12px;
          min-height: 80px;
        }
      </style>
    </head>
    <body>
      <!-- EN-TÊTE OFFICIEL SYGIM -->
      <div class="header">
        <div>
          <div class="brand">SYGIM</div>
          <div style="color:#64748b; font-size:11px;">Système de Gestion Immobilière & Comptabilité Locative</div>
          <div style="margin-top:6px; font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(docTypeTitle)}</div>
        </div>
        <div style="text-align:right;">
          <div class="badge">${escapeHtml(statusText)}</div>
          <div style="margin-top:6px; font-size:12px; font-weight:700;">Réf : ${escapeHtml(ref)}</div>
          <div style="font-size:10.5px; color:#64748b;">Date d'édition : ${escapeHtml(new Date().toLocaleDateString('fr-FR'))}</div>
        </div>
      </div>

      <!-- BLOCS PROPRIÉTAIRE & PÉRIMÈTRE -->
      <div class="grid-2">
        <div class="box">
          <div class="box-title">Propriétaire Bénéficiaire</div>
          <div style="font-size:14px; font-weight:800; color:#0f172a;">${escapeHtml(ownerName)}</div>
          <div style="margin-top:4px;">Téléphone : <strong>${escapeHtml(ownerPhone)}</strong></div>
          <div>Banque / Compte : <strong>${escapeHtml(ownerBank)}</strong></div>
        </div>
        <div class="box">
          <div class="box-title">Périmètre Locatif & Période</div>
          <div>Bien(s) concerné(s) : <strong>${escapeHtml(propertyName)}</strong></div>
          <div style="margin-top:4px;">Période : <strong>${escapeHtml(periodText)}</strong></div>
          <div>Moyen de règlement : <strong>${escapeHtml(methodLabels[paymentMethod] || paymentMethod)}</strong></div>
        </div>
      </div>

      <!-- SECTION 1 : TABLEAU DÉTAILLÉ DES LOCATAIRES (CE QUE LE CLIENT DEMANDE) -->
      <div class="section-title">
        <span>1. Détail des Locataires & Biens Immobiliers (${units.length} lot(s))</span>
        <span style="font-size:10px; font-weight:600; color:#64748b; text-transform:none;">État locatif au ${escapeHtml(new Date().toLocaleDateString('fr-FR'))}</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:28%;">Locataire</th>
            <th style="width:24%;">Bien Immobilier</th>
            <th style="text-align:right; width:12%;">Loyer Attendu</th>
            <th style="text-align:right; width:12%;">Loyer Encaissé</th>
            <th style="text-align:right; width:12%;">Reste à Recouvrer</th>
            <th style="text-align:right; width:12%;">Préfinancé</th>
          </tr>
        </thead>
        <tbody>
          ${unitsRowsHtml}
          <!-- LIGNE SOUS-TOTAL DÉTAIL LOCATAIRE -->
          <tr style="background:#f1f5f9 !important; font-weight:800; border-top:2px solid #cbd5e1;">
            <td colspan="2">SOUS-TOTAL DÉTAIL LOCATIF (${units.length} bien(s))</td>
            <td style="text-align:right;">${escapeHtml(fmtMoney(totExpected))}</td>
            <td style="text-align:right; color:#059669;">${escapeHtml(fmtMoney(totCollected))}</td>
            <td style="text-align:right; color:#dc2626;">${escapeHtml(fmtMoney(totArrears))}</td>
            <td style="text-align:right; color:#d97706;">${escapeHtml(fmtMoney(totPrefinanced))}</td>
          </tr>
        </tbody>
      </table>

      <!-- SECTION 2 : SYNTHÈSE DU DÉCOMPTE FINANCIER PROPRIÉTAIRE -->
      <div class="section-title">
        <span>2. Détail du Décompte Financier Propriétaire</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align:right; width:180px;">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Loyer de référence sur la période ${isPrefinanced ? '(Préfinancé par l\'agence en attente du locataire)' : ''}</td>
            <td style="text-align:right; font-weight:600;">${escapeHtml(fmtMoney(expectedRent))}</td>
          </tr>
          <tr>
            <td>Loyer encaissé auprès du locataire à ce jour</td>
            <td style="text-align:right; font-weight:600; color:#059669;">${escapeHtml(fmtMoney(totalCollected))}</td>
          </tr>
          <tr>
            <td>Commission de gestion Agence SYGIM (${escapeHtml(commissionRate)}%)</td>
            <td style="text-align:right; color:#dc2626;">- ${escapeHtml(fmtMoney(agencyCommission))}</td>
          </tr>
          <tr>
            <td>Retenues travaux / entretien</td>
            <td style="text-align:right; color:#dc2626;">- ${escapeHtml(fmtMoney(maintenanceDeductions))}</td>
          </tr>
          <tr style="background:#f1f5f9 !important;">
            <td style="font-weight:800;">NET À REVERSER AU PROPRIÉTAIRE</td>
            <td style="text-align:right; font-weight:800; font-size:12.5px;">${escapeHtml(fmtMoney(netAmount))}</td>
          </tr>
          <tr style="background:#ecfdf5 !important;">
            <td style="font-weight:800; color:#065f46;">TOTAL CUMULÉ VERSÉ AU PROPRIÉTAIRE</td>
            <td style="text-align:right; font-weight:900; font-size:13px; color:#059669;">${escapeHtml(fmtMoney(amountPaid))}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">SOLDE RESTANT À VERSER (SI PAIEMENT ÉCHELONNÉ)</td>
            <td style="text-align:right; font-weight:800; color:${remainingToPay > 0 ? '#dc2626' : '#64748b'};">
              ${escapeHtml(fmtMoney(remainingToPay))}
            </td>
          </tr>
        </tbody>
      </table>

      <!-- SECTION 3 : HISTORIQUE DÉTAILLÉ DES VERSEMENTS / TRANCHES -->
      <div class="section-title">
        <span>3. Historique Détaillé des Versements / Tranches</span>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:100px;">Tranche</th>
            <th style="width:90px;">Date</th>
            <th style="width:130px;">Moyen de paiement</th>
            <th style="width:110px;">Référence</th>
            <th>Observation</th>
            <th style="text-align:right; width:130px;">Montant Versé</th>
          </tr>
        </thead>
        <tbody>
          ${installmentsRowsHtml}
        </tbody>
      </table>

      ${settlement.notes ? `
        <div class="box" style="margin-bottom:14px;">
          <div class="box-title">Notes & Observations Comptables</div>
          <div>${escapeHtml(settlement.notes)}</div>
        </div>
      ` : ''}

      <!-- CADRES DE SIGNATURES OFFICIELS -->
      <div class="signatures">
        <div class="sig-box">
          <div style="font-weight:700; font-size:10.5px; color:#475569;">Pour l'Agence SYGIM (La Comptabilité)</div>
          <div style="font-size:9.5px; color:#94a3b8; margin-top:4px;">Cachet et signature</div>
        </div>
        <div class="sig-box">
          <div style="font-weight:700; font-size:10.5px; color:#475569;">Le Propriétaire Bénéficiaire (${escapeHtml(ownerName)})</div>
          <div style="font-size:9.5px; color:#94a3b8; margin-top:4px;">Signature précédée de la mention « Bon pour acquis »</div>
        </div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 250);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};
