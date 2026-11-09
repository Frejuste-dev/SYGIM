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
    `<th style="background:#1e3a8a; color:#ffffff; font-weight:bold; padding:8px 12px; border:1px solid #1e3a8a; text-align:left;">${escapeHtml(h)}</th>`
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
            <td colspan="${headers.length}" style="font-size:16px; font-weight:bold; color:#1e3a8a; padding:10px 4px;">
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
          border-bottom: 3px solid #1e3a8a;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .brand {
          font-size: 22px;
          font-weight: 900;
          color: #1e3a8a;
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
          background-color: #1e3a8a !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-weight: 700;
          text-align: left;
          padding: 8px 10px;
          border: 1px solid #1e3a8a;
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
 * Génère et imprime un Bordereau / Reçu Officiel de Paiement ou Préfinancement Propriétaire (PDF A4)
 */
export const printOwnerSettlementReceipt = (settlement) => {
  if (!settlement) return;

  const fmtMoney = (val) => `${Number(val || 0).toLocaleString('fr-FR')} FCFA`;
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR') : '—';
  const methodLabels = {
    bank_transfer: 'Virement bancaire',
    mobile_money: 'Mobile Money (MTN/Moov/Wave/OM)',
    cheque: 'Chèque bancaire',
    check: 'Chèque bancaire',
    cash: 'Espèces'
  };

  const ref = settlement.transaction_reference || settlement.payout_reference || `REV-${settlement.id}`;
  const ownerName = settlement.owner_name || settlement.owner_full_name || `Propriétaire #${settlement.owner_id}`;
  const propertyName = settlement.property_name || 'Tous les biens du portefeuille propriétaire';
  const isPrefinanced = Boolean(settlement.is_prefinanced || settlement.payout_mode === 'prefinancing' || settlement.status === 'prefinanced');
  const isReimbursed = String(settlement.status || '').toLowerCase() === 'reimbursed';
  const isInstallment = settlement.payout_mode === 'installment' || (settlement.installments && settlement.installments.length > 1);

  const docTypeTitle = isPrefinanced
    ? (isReimbursed ? 'BORDEREAU DE PRÉFINANCEMENT PROPRIÉTAIRE (RÉGULARISÉ)' : 'BORDEREAU DE PRÉFINANCEMENT PROPRIÉTAIRE (AVANCE AGENCE)')
    : isInstallment
      ? 'BORDEREAU DE REVERSEMENT ÉCHELONNÉ PROPRIÉTAIRE'
      : 'BORDEREAU DE REVERSEMENT MENSUEL PROPRIÉTAIRE';

  const badgeColor = isReimbursed
    ? '#059669'
    : isPrefinanced
      ? '#d97706'
      : (Number(settlement.remaining_to_pay || 0) > 0 ? '#2563eb' : '#059669');

  const statusText = isReimbursed
    ? 'PRÉFINANCEMENT REMBOURSÉ / RÉGULARISÉ'
    : isPrefinanced
      ? 'PRÉFINANCÉ PAR L\'AGENCE'
      : (Number(settlement.remaining_to_pay || 0) > 0 ? 'PAIEMENT PARTIEL / ÉCHELONNÉ' : 'PAYÉ INTÉGRALEMENT');

  const installments = Array.isArray(settlement.installments) && settlement.installments.length > 0
    ? settlement.installments
    : [{
        installment_number: 1,
        payment_date: settlement.payout_date || settlement.created_at,
        amount: settlement.amount_paid || settlement.net_amount,
        payment_method: settlement.payment_method,
        reference: ref,
        notes: settlement.notes || 'Versement initial'
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

  const printWindow = window.open('', '_blank', 'width=900,height=800');
  if (!printWindow) {
    alert('Veuillez autoriser les fenêtres pop-up pour imprimer le bordereau PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8" />
      <title>Bordereau_${escapeHtml(ref)}</title>
      <style>
        @page { size: A4 portrait; margin: 14mm; }
        body {
          font-family: 'Segoe UI', Roboto, Arial, sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 20px;
          font-size: 12px;
          line-height: 1.45;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 3px solid #1e3a8a;
          padding-bottom: 14px;
          margin-bottom: 20px;
        }
        .brand { font-size: 26px; font-weight: 900; color: #1e3a8a; }
        .badge {
          display: inline-block;
          padding: 5px 12px;
          border-radius: 999px;
          background: ${badgeColor};
          color: #fff;
          font-weight: 700;
          font-size: 10.5px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 20px;
        }
        .box {
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          padding: 14px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .box-title {
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 800;
          color: #64748b;
          margin-bottom: 8px;
          letter-spacing: 0.5px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
        }
        th {
          background: #1e3a8a !important;
          color: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          text-align: left;
          padding: 8px 10px;
          font-size: 11px;
          text-transform: uppercase;
        }
        td {
          padding: 8px 10px;
          border: 1px solid #cbd5e1;
          font-size: 11.5px;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          margin-top: 32px;
        }
        .sig-box {
          border: 1px dashed #94a3b8;
          border-radius: 10px;
          padding: 14px;
          min-height: 90px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="brand">SYGIM</div>
          <div style="color:#64748b; font-size:11px;">Système de Gestion Immobilière & Comptabilité Locative</div>
          <div style="margin-top:8px; font-size:15px; font-weight:800; color:#0f172a;">${escapeHtml(docTypeTitle)}</div>
        </div>
        <div style="text-align:right;">
          <div class="badge">${escapeHtml(statusText)}</div>
          <div style="margin-top:8px; font-size:13px; font-weight:700;">Réf : ${escapeHtml(ref)}</div>
          <div style="font-size:11px; color:#64748b;">Date d'édition : ${escapeHtml(new Date().toLocaleDateString('fr-FR'))}</div>
        </div>
      </div>

      <div class="grid-2">
        <div class="box">
          <div class="box-title">Propriétaire Bénéficiaire</div>
          <div style="font-size:15px; font-weight:800; color:#0f172a;">${escapeHtml(ownerName)}</div>
          <div style="margin-top:4px;">Téléphone : <strong>${escapeHtml(settlement.owner_phone || '—')}</strong></div>
          <div>Banque / Compte : <strong>${escapeHtml([settlement.owner_bank_name, settlement.owner_bank_account].filter(Boolean).join(' - ') || '—')}</strong></div>
        </div>
        <div class="box">
          <div class="box-title">Périmètre Locatif & Période</div>
          <div>Bien(s) concerné(s) : <strong>${escapeHtml(propertyName)}</strong></div>
          <div style="margin-top:4px;">Période : <strong>Du ${escapeHtml(fmtDate(settlement.period_start))} au ${escapeHtml(fmtDate(settlement.period_end))}</strong></div>
          <div>Moyen de règlement : <strong>${escapeHtml(methodLabels[settlement.payment_method] || settlement.payment_method || 'Virement')}</strong></div>
        </div>
      </div>

      <div style="font-weight:800; font-size:12px; text-transform:uppercase; color:#1e3a8a; margin-bottom:6px;">
        1. Détail du Décompte Financier Propriétaire
      </div>
      <table>
        <thead>
          <tr>
            <th>Désignation</th>
            <th style="text-align:right;">Montant (FCFA)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Loyer de référence sur la période ${isPrefinanced ? '(Préfinancé par l\'agence en attente du locataire)' : ''}</td>
            <td style="text-align:right; font-weight:600;">${escapeHtml(fmtMoney(settlement.expected_rent || settlement.total_collected || (Number(settlement.net_amount || 0) + Number(settlement.agency_commission || 0))))}</td>
          </tr>
          <tr>
            <td>Loyer encaissé auprès du locataire à ce jour</td>
            <td style="text-align:right;">${escapeHtml(fmtMoney(settlement.total_collected || 0))}</td>
          </tr>
          <tr>
            <td>Commission de gestion Agence SYGIM (${escapeHtml(settlement.commission_rate || 10)}%)</td>
            <td style="text-align:right; color:#dc2626;">- ${escapeHtml(fmtMoney(settlement.agency_commission || 0))}</td>
          </tr>
          <tr>
            <td>Retenues travaux / entretien</td>
            <td style="text-align:right; color:#dc2626;">- ${escapeHtml(fmtMoney(settlement.maintenance_deductions || 0))}</td>
          </tr>
          <tr style="background:#f1f5f9;">
            <td style="font-weight:800;">NET À REVERSER AU PROPRIÉTAIRE</td>
            <td style="text-align:right; font-weight:800; font-size:13px;">${escapeHtml(fmtMoney(settlement.net_amount || settlement.net_owner_payout))}</td>
          </tr>
          <tr style="background:#ecfdf5;">
            <td style="font-weight:800; color:#065f46;">TOTAL CUMULÉ VERSÉ AU PROPRIÉTAIRE</td>
            <td style="text-align:right; font-weight:900; font-size:14px; color:#059669;">${escapeHtml(fmtMoney(settlement.amount_paid || settlement.net_amount))}</td>
          </tr>
          <tr>
            <td style="font-weight:700;">SOLDE RESTANT À VERSER (SI PAIEMENT ÉCHELONNÉ)</td>
            <td style="text-align:right; font-weight:800; color:${Number(settlement.remaining_to_pay || 0) > 0 ? '#dc2626' : '#64748b'};">
              ${escapeHtml(fmtMoney(settlement.remaining_to_pay || 0))}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="font-weight:800; font-size:12px; text-transform:uppercase; color:#1e3a8a; margin-bottom:6px;">
        2. Historique Détaillé des Versements / Tranches
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:110px;">Tranche</th>
            <th style="width:100px;">Date</th>
            <th>Moyen de paiement</th>
            <th>Référence</th>
            <th>Observation</th>
            <th style="text-align:right;">Montant Versé</th>
          </tr>
        </thead>
        <tbody>
          ${installmentsRowsHtml}
        </tbody>
      </table>

      ${settlement.notes ? `
        <div class="box" style="margin-bottom:16px;">
          <div class="box-title">Notes & Observations Comptables</div>
          <div>${escapeHtml(settlement.notes)}</div>
        </div>
      ` : ''}

      <div class="signatures">
        <div class="sig-box">
          <div style="font-weight:700; font-size:11px; color:#475569;">Pour l'Agence SYGIM (La Comptabilité)</div>
          <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Cachet et signature</div>
        </div>
        <div class="sig-box">
          <div style="font-weight:700; font-size:11px; color:#475569;">Le Propriétaire Bénéficiaire (${escapeHtml(ownerName)})</div>
          <div style="font-size:10px; color:#94a3b8; margin-top:4px;">Signature précédée de la mention « Bon pour acquis »</div>
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
