/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║   SYGIM — Modal Import CSV Drag & Drop                                  ║
 * ║   3 zones de dépôt : Propriétaires / Locataires / Récolteurs            ║
 * ║                                                                          ║
 * ║   INSTALLATION :                                                         ║
 * ║   1. Ajouter dans index.html avant </body> :                            ║
 * ║      <script src="script_import_modal.js"></script>                     ║
 * ║   2. Ajouter un bouton dans votre nav pour ouvrir le modal :            ║
 * ║      <button onclick="openImportModal()">                               ║
 * ║        <i class="fas fa-file-import"></i> Importer CSV                  ║
 * ║      </button>                                                           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

(function () {
    'use strict';

    // ═══════════════════════════════════════════════════════════════════════
    // ÉTAT INTERNE
    // ═══════════════════════════════════════════════════════════════════════
    const state = {
        owners:     { file: null, status: 'idle', data: null },
        clients:    { file: null, status: 'idle', data: null },
        collectors: { file: null, status: 'idle', data: null },
    };

    // ═══════════════════════════════════════════════════════════════════════
    // GÉNÈRE LE HTML D'UNE ZONE (défini en premier — utilisé par injectModal)
    // ═══════════════════════════════════════════════════════════════════════
    function buildZoneHTML(id, num, icon, label, color) {
        const lightColor = color + '18';
        return `
        <div id="zone_${id}" class="sygim-drop-zone" style="
          border:2px dashed var(--border,#e2e8f0);
          border-radius:18px;
          padding:24px 16px;
          text-align:center;
          cursor:pointer;
          transition:all 0.25s;
          position:relative;
          background:var(--light,#fff);
          --zone-color:${color};
          --zone-bg:${lightColor};
          min-height:160px;
          display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;
        "
          ondragover="sygimDragOver(event,'${id}')"
          ondragleave="sygimDragLeave(event,'${id}')"
          ondrop="sygimDrop(event,'${id}')"
          onclick="if(this.dataset.status!=='done')document.getElementById('fileInput_${id}').click()"
          onmouseover="if(this.dataset.status!=='done')this.style.borderColor='${color}'"
          onmouseout="if(this.dataset.status!=='done')this.style.borderColor='var(--border,#e2e8f0)'"
        >
          <div id="zoneContent_${id}">
            <div style="
              width:52px;height:52px;border-radius:15px;
              background:${lightColor};
              display:flex;align-items:center;justify-content:center;
              margin:0 auto 10px;
              font-size:22px;color:${color};
            ">
              <i class="fas ${icon}"></i>
            </div>
            <div style="
              background:${color};color:#fff;
              border-radius:99px;font-size:11px;font-weight:700;
              padding:2px 10px;margin:0 auto 8px;display:inline-block;
            ">Feuille ${num}</div>
            <p style="font-weight:700;font-size:14px;color:var(--dark,#0f172a);margin:0 0 4px;">${label}</p>
            <p style="font-size:12px;color:var(--gray-500,#64748b);margin:0;">
              Glissez votre CSV ici<br>ou cliquez pour parcourir
            </p>
          </div>
          <input type="file" id="fileInput_${id}" accept=".csv" style="display:none;"
            onchange="sygimFileSelected(event,'${id}')">
        </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // INJECTION DU HTML DU MODAL
    // ═══════════════════════════════════════════════════════════════════════
    function injectModal() {
        if (document.getElementById('sygimImportModal')) return;

        const html = `
        <div id="sygimImportModal" style="
            display:none;
            position:fixed;inset:0;z-index:99999;
            background:rgba(15,23,42,0.75);
            backdrop-filter:blur(6px);
            -webkit-backdrop-filter:blur(6px);
            align-items:center;justify-content:center;
            animation:sygimFadeIn 0.25s ease;
        ">
          <div id="sygimImportBox" style="
            background:var(--light,#fff);
            border-radius:24px;
            box-shadow:0 32px 80px rgba(0,0,0,0.25);
            width:min(860px,96vw);
            max-height:90vh;
            overflow-y:auto;
            padding:0;
            position:relative;
            animation:sygimSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1);
          ">

            <!-- En-tête -->
            <div style="
              background:linear-gradient(135deg,var(--primary,#6366f1),var(--primary-dark,#4338ca));
              border-radius:24px 24px 0 0;
              padding:28px 32px 24px;
              position:relative;
            ">
              <div style="display:flex;align-items:center;gap:14px;">
                <div style="
                  background:rgba(255,255,255,0.2);
                  border-radius:14px;
                  width:48px;height:48px;
                  display:flex;align-items:center;justify-content:center;
                  font-size:22px;color:#fff;
                "><i class="fas fa-file-csv"></i></div>
                <div>
                  <h2 style="color:#fff;font-size:20px;font-weight:700;margin:0;">Import CSV</h2>
                  <p style="color:rgba(255,255,255,0.75);font-size:13px;margin:3px 0 0;">Déposez vos 3 fichiers CSV pour alimenter SYGIM</p>
                </div>
              </div>
              <button onclick="closeImportModal()" style="
                position:absolute;top:20px;right:20px;
                background:rgba(255,255,255,0.15);
                border:none;border-radius:10px;
                width:36px;height:36px;cursor:pointer;
                color:#fff;font-size:16px;
                display:flex;align-items:center;justify-content:center;
                transition:all 0.2s;
              " onmouseover="this.style.background='rgba(255,255,255,0.25)'"
                 onmouseout="this.style.background='rgba(255,255,255,0.15)'">
                <i class="fas fa-times"></i>
              </button>
            </div>

            <!-- Corps -->
            <div style="padding:28px 32px;">

              <!-- Ordre conseillé -->
              <div style="
                background:linear-gradient(135deg,rgba(99,102,241,0.07),rgba(16,185,129,0.07));
                border:1px solid rgba(99,102,241,0.2);
                border-radius:14px;
                padding:14px 18px;
                margin-bottom:24px;
                display:flex;align-items:flex-start;gap:12px;
              ">
                <i class="fas fa-lightbulb" style="color:var(--warning,#f59e0b);margin-top:2px;flex-shrink:0;"></i>
                <div style="font-size:13px;color:var(--gray-600,#475569);line-height:1.6;">
                  <strong style="color:var(--dark,#0f172a);">Ordre recommandé :</strong>
                  <span style="margin:0 6px;">①</span>Propriétaires (crée les biens)
                  <span style="margin:0 6px;">→</span>
                  <span style="margin-right:6px;">②</span>Locataires (lie aux biens)
                  <span style="margin:0 6px;">→</span>
                  <span style="margin-right:6px;">③</span>Récolteurs (calcule performances)
                </div>
              </div>

              <!-- 3 zones drag & drop -->
              <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;margin-bottom:24px;">

                ${buildZoneHTML('owners',    '1', 'fa-user-tie',   'Propriétaires', '#6366f1', 'owners')}
                ${buildZoneHTML('clients',   '2', 'fa-users',      'Locataires',    '#10b981', 'clients')}
                ${buildZoneHTML('collectors','3', 'fa-user-shield','Récolteurs',    '#f59e0b', 'collectors')}

              </div>

              <!-- Boutons modèles CSV -->
              <div style="
                background:var(--gray-50,#f8fafc);
                border:1px dashed var(--border,#e2e8f0);
                border-radius:14px;
                padding:16px 18px;
                margin-bottom:24px;
              ">
                <p style="font-size:12px;font-weight:600;color:var(--gray-500,#64748b);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">
                  <i class="fas fa-download" style="margin-right:6px;"></i>Télécharger les modèles CSV
                </p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;">
                  <button onclick="SYGIM_DOWNLOAD_TEMPLATE('owners')" style="
                    background:#fff;border:1px solid #e2e8f0;border-radius:10px;
                    padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;
                    color:#6366f1;display:flex;align-items:center;gap:7px;
                    transition:all 0.2s;
                  " onmouseover="this.style.borderColor='#6366f1';this.style.background='rgba(99,102,241,0.05)'"
                     onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#fff'">
                    <i class="fas fa-file-csv"></i> Modèle Propriétaires
                  </button>
                  <button onclick="SYGIM_DOWNLOAD_TEMPLATE('clients')" style="
                    background:#fff;border:1px solid #e2e8f0;border-radius:10px;
                    padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;
                    color:#10b981;display:flex;align-items:center;gap:7px;
                    transition:all 0.2s;
                  " onmouseover="this.style.borderColor='#10b981';this.style.background='rgba(16,185,129,0.05)'"
                     onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#fff'">
                    <i class="fas fa-file-csv"></i> Modèle Locataires
                  </button>
                  <button onclick="SYGIM_DOWNLOAD_TEMPLATE('collectors')" style="
                    background:#fff;border:1px solid #e2e8f0;border-radius:10px;
                    padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;
                    color:#f59e0b;display:flex;align-items:center;gap:7px;
                    transition:all 0.2s;
                  " onmouseover="this.style.borderColor='#f59e0b';this.style.background='rgba(245,158,11,0.05)'"
                     onmouseout="this.style.borderColor='#e2e8f0';this.style.background='#fff'">
                    <i class="fas fa-file-csv"></i> Modèle Récolteurs
                  </button>
                </div>
              </div>

              <!-- Barre de progression globale (cachée au départ) -->
              <div id="sygimImportProgress" style="display:none;margin-bottom:20px;">
                <div style="
                  background:var(--gray-100,#f1f5f9);
                  border-radius:99px;height:8px;overflow:hidden;
                ">
                  <div id="sygimProgressBar" style="
                    height:100%;
                    background:linear-gradient(90deg,var(--primary,#6366f1),var(--secondary,#10b981));
                    width:0%;transition:width 0.4s ease;border-radius:99px;
                  "></div>
                </div>
                <p id="sygimProgressText" style="font-size:12px;color:var(--gray-500,#64748b);margin-top:6px;text-align:center;"></p>
              </div>

              <!-- Message résultat -->
              <div id="sygimImportResult" style="display:none;"></div>

              <!-- Actions -->
              <div style="display:flex;gap:12px;justify-content:flex-end;padding-top:8px;border-top:1px solid var(--border,#e2e8f0);">
                <button onclick="sygimResetImport()" style="
                  background:var(--gray-100,#f1f5f9);
                  border:none;border-radius:12px;
                  padding:12px 22px;font-size:14px;font-weight:600;
                  cursor:pointer;color:var(--gray-600,#475569);
                  transition:all 0.2s;font-family:inherit;
                " onmouseover="this.style.background='var(--gray-200,#e2e8f0)'"
                   onmouseout="this.style.background='var(--gray-100,#f1f5f9)'">
                  <i class="fas fa-rotate-left" style="margin-right:7px;"></i>Réinitialiser
                </button>
                <button id="sygimImportBtn" onclick="sygimLaunchImport()" disabled style="
                  background:linear-gradient(135deg,var(--primary,#6366f1),var(--primary-dark,#4338ca));
                  border:none;border-radius:12px;
                  padding:12px 28px;font-size:14px;font-weight:700;
                  cursor:pointer;color:#fff;
                  transition:all 0.2s;font-family:inherit;
                  opacity:0.45;
                " onmouseover="if(!this.disabled)this.style.transform='translateY(-1px)'"
                   onmouseout="this.style.transform='translateY(0)'">
                  <i class="fas fa-rocket" style="margin-right:8px;"></i>Lancer l'import
                </button>
              </div>

            </div><!-- /corps -->
          </div><!-- /box -->
        </div><!-- /modal -->

        <style>
          @keyframes sygimFadeIn { from{opacity:0} to{opacity:1} }
          @keyframes sygimSlideUp { from{opacity:0;transform:translateY(30px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
          @keyframes sygimPulse { 0%,100%{box-shadow:0 0 0 0 rgba(99,102,241,0.4)} 50%{box-shadow:0 0 0 8px rgba(99,102,241,0)} }
          #sygimImportModal::-webkit-scrollbar { width:6px; }
          #sygimImportBox::-webkit-scrollbar { width:6px; }
          #sygimImportBox::-webkit-scrollbar-track { background:transparent; }
          #sygimImportBox::-webkit-scrollbar-thumb { background:var(--gray-300,#cbd5e1);border-radius:3px; }
          .sygim-drop-zone.dragover {
            border-color: var(--zone-color) !important;
            background: var(--zone-bg) !important;
            transform: scale(1.02);
          }
        </style>
        `;

        const wrapper = document.createElement('div');
        wrapper.innerHTML = html;
        document.body.appendChild(wrapper.firstElementChild);
        document.body.appendChild(wrapper.querySelector('style'));

        // Initialiser les zones drag & drop
        ['owners','clients','collectors'].forEach(type => initZone(type));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // DRAG & DROP HANDLERS
    // ═══════════════════════════════════════════════════════════════════════
    function initZone(type) {
        // Les events sont inline, rien de supplémentaire
    }

    window.sygimDragOver = function(e, type) {
        e.preventDefault();
        const zone = document.getElementById('zone_' + type);
        if (zone) zone.classList.add('dragover');
    };

    window.sygimDragLeave = function(e, type) {
        const zone = document.getElementById('zone_' + type);
        if (zone) zone.classList.remove('dragover');
    };

    window.sygimDrop = function(e, type) {
        e.preventDefault();
        const zone = document.getElementById('zone_' + type);
        if (zone) zone.classList.remove('dragover');
        const file = e.dataTransfer?.files?.[0];
        if (file) processFile(file, type);
    };

    window.sygimFileSelected = function(e, type) {
        const file = e.target?.files?.[0];
        if (file) processFile(file, type);
    };

    // ═══════════════════════════════════════════════════════════════════════
    // TRAITEMENT D'UN FICHIER
    // ═══════════════════════════════════════════════════════════════════════
    function processFile(file, type) {
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.CSV')) {
            showZoneError(type, 'Fichier CSV uniquement');
            return;
        }

        state[type].file   = file;
        state[type].status = 'loading';
        showZoneLoading(type, file.name);

        // Utiliser le moteur existant via handleFile
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                // Appel direct au parser du script_import_csv.js
                if (typeof window._parseImportFile === 'function') {
                    // Créer un faux File avec le contenu
                    const blob = new Blob([e.target.result], { type: 'text/csv' });
                    const fakeFile = new File([blob], file.name, { type: 'text/csv' });

                    // Intercepter _showPreviewCSV temporairement
                    const origPreview = window._showPreviewCSV;
                    window._showPreviewCSV = function(filename, stats, resolved) {
                        // Restaurer
                        window._showPreviewCSV = origPreview;
                        // Enregistrer les données
                        state[type].data     = { stats, resolved };
                        state[type].status   = 'done';
                        showZoneDone(type, file.name, stats);
                        updateImportButton();
                    };

                    window._parseImportFile(fakeFile);
                } else {
                    // Fallback : parse CSV simple pour afficher le nombre de lignes
                    const lines = e.target.result.split('\n').filter(l => l.trim()).length - 1;
                    state[type].data   = { lines };
                    state[type].status = 'done';
                    showZoneDone(type, file.name, null, lines);
                    updateImportButton();
                }
            } catch(err) {
                state[type].status = 'error';
                showZoneError(type, err.message);
            }
        };
        reader.onerror = () => showZoneError(type, 'Erreur de lecture');
        reader.readAsText(file, 'UTF-8');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // AFFICHAGE DES ÉTATS DES ZONES
    // ═══════════════════════════════════════════════════════════════════════
    const ZONE_COLORS = { owners:'#6366f1', clients:'#10b981', collectors:'#f59e0b' };
    const ZONE_LABELS = { owners:'Propriétaires', clients:'Locataires', collectors:'Récolteurs' };
    const ZONE_ICONS  = { owners:'fa-user-tie', clients:'fa-users', collectors:'fa-user-shield' };
    const ZONE_NUM    = { owners:'1', clients:'2', collectors:'3' };

    function showZoneLoading(type) {
        const c = document.getElementById('zoneContent_' + type);
        const color = ZONE_COLORS[type];
        if (!c) return;
        c.innerHTML = `
          <div style="font-size:28px;color:${color};animation:sygimSpin 1s linear infinite;">
            <i class="fas fa-spinner"></i>
          </div>
          <p style="font-size:13px;color:var(--gray-500,#64748b);margin:8px 0 0;">Analyse en cours…</p>
          <style>@keyframes sygimSpin{from{transform:rotate(0)}to{transform:rotate(360deg)}}</style>
        `;
    }

    function showZoneDone(type, filename, stats, fallbackLines) {
        const c     = document.getElementById('zoneContent_' + type);
        const zone  = document.getElementById('zone_' + type);
        const color = ZONE_COLORS[type];
        const label = ZONE_LABELS[type];
        if (!c) return;

        // Mettre à jour la zone visuellement
        if (zone) {
            zone.dataset.status   = 'done';
            zone.style.borderStyle  = 'solid';
            zone.style.borderColor  = color;
            zone.style.background   = color + '08';
            zone.style.cursor       = 'default';
        }

        // Calculer le résumé selon le type
        let summary = '';
        if (stats) {
            if (type === 'owners')     summary = `${stats.newOwners || 0} proprio${stats.newOwners>1?'s':''} · ${stats.newProperties || 0} bien${stats.newProperties>1?'s':''}`;
            if (type === 'clients')    summary = `${stats.newClients || 0} locataire${stats.newClients>1?'s':''} · ${stats.linkedClients || 0} lié${stats.linkedClients>1?'s':''}`;
            if (type === 'collectors') summary = `${stats.newCollectors || 0} récolteur${stats.newCollectors>1?'s':''}`;
        } else if (fallbackLines) {
            summary = `${fallbackLines} ligne${fallbackLines>1?'s':''}`;
        }

        const shortName = filename.length > 22 ? filename.substring(0,20) + '…' : filename;

        c.innerHTML = `
          <div style="
            width:52px;height:52px;border-radius:15px;
            background:${color}22;
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 10px;font-size:22px;color:${color};
          "><i class="fas fa-check-circle"></i></div>
          <p style="font-weight:700;font-size:14px;color:var(--dark,#0f172a);margin:0 0 4px;">${label}</p>
          <p style="font-size:11px;color:${color};font-weight:600;margin:0 0 6px;">${shortName}</p>
          ${summary ? `<div style="
            background:${color}18;border-radius:8px;
            padding:5px 12px;font-size:12px;font-weight:600;color:${color};
          ">${summary}</div>` : ''}
          <button style="
            margin-top:10px;background:none;border:1px solid var(--danger,#ef4444);
            border-radius:8px;padding:4px 12px;font-size:11px;font-weight:600;
            cursor:pointer;color:var(--danger,#ef4444);transition:all 0.2s;font-family:inherit;
          " onmouseover="this.style.background='rgba(239,68,68,0.08)'"
             onmouseout="this.style.background='none'"
             onclick="event.stopPropagation();sygimRemoveFile('${type}')">
            <i class="fas fa-trash-alt" style="margin-right:4px;"></i>Retirer
          </button>
        `;
    }

    function showZoneError(type, msg) {
        const c    = document.getElementById('zoneContent_' + type);
        const zone = document.getElementById('zone_' + type);
        if (!c) return;
        if (zone) { zone.style.borderColor = 'var(--danger,#ef4444)'; zone.style.background = 'rgba(239,68,68,0.04)'; }
        c.innerHTML = `
          <div style="font-size:28px;color:var(--danger,#ef4444);"><i class="fas fa-exclamation-circle"></i></div>
          <p style="font-size:12px;color:var(--danger,#ef4444);font-weight:600;margin:8px 0 4px;">Erreur</p>
          <p style="font-size:11px;color:var(--gray-500,#64748b);margin:0;">${msg}</p>
          <button onclick="sygimRemoveFile('${type}')" style="
            margin-top:10px;background:none;border:1px solid var(--gray-300,#cbd5e1);
            border-radius:8px;padding:4px 12px;font-size:11px;font-weight:600;
            cursor:pointer;color:var(--gray-600,#475569);font-family:inherit;
          ">Réessayer</button>
        `;
        state[type].status = 'idle';
        state[type].file   = null;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // SUPPRIMER UN FICHIER D'UNE ZONE
    // ═══════════════════════════════════════════════════════════════════════
    window.sygimRemoveFile = function(type) {
        state[type] = { file: null, status: 'idle', data: null };
        const zone = document.getElementById('zone_' + type);
        if (zone) {
            zone.dataset.status   = '';
            zone.style.borderStyle  = 'dashed';
            zone.style.borderColor  = 'var(--border,#e2e8f0)';
            zone.style.background   = 'var(--light,#fff)';
            zone.style.cursor       = 'pointer';
        }
        const color = ZONE_COLORS[type];
        const icon  = ZONE_ICONS[type];
        const label = ZONE_LABELS[type];
        const num   = ZONE_NUM[type];
        const c = document.getElementById('zoneContent_' + type);
        if (c) c.innerHTML = `
          <div style="
            width:52px;height:52px;border-radius:15px;
            background:${color}18;
            display:flex;align-items:center;justify-content:center;
            margin:0 auto 10px;font-size:22px;color:${color};
          "><i class="fas ${icon}"></i></div>
          <div style="background:${color};color:#fff;border-radius:99px;font-size:11px;font-weight:700;padding:2px 10px;margin:0 auto 8px;display:inline-block;">Feuille ${num}</div>
          <p style="font-weight:700;font-size:14px;color:var(--dark,#0f172a);margin:0 0 4px;">${label}</p>
          <p style="font-size:12px;color:var(--gray-500,#64748b);margin:0;">Glissez votre CSV ici<br>ou cliquez pour parcourir</p>
          <input type="file" id="fileInput_${type}" accept=".csv" style="display:none;" onchange="sygimFileSelected(event,'${type}')">
        `;
        updateImportButton();
        hideResult();
    };

    // ═══════════════════════════════════════════════════════════════════════
    // BOUTON IMPORT : ACTIVER QUAND AU MOINS 1 FICHIER PRÊT
    // ═══════════════════════════════════════════════════════════════════════
    function updateImportButton() {
        const btn   = document.getElementById('sygimImportBtn');
        const ready = Object.values(state).some(s => s.status === 'done');
        if (btn) {
            btn.disabled      = !ready;
            btn.style.opacity = ready ? '1' : '0.45';
            btn.style.cursor  = ready ? 'pointer' : 'not-allowed';
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // LANCER L'IMPORT
    // ═══════════════════════════════════════════════════════════════════════
    window.sygimLaunchImport = async function() {
        const btn = document.getElementById('sygimImportBtn');
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right:8px;"></i>Import en cours…'; }

        showProgress(0, 'Préparation…');

        const order  = ['owners','clients','collectors'];
        const toImport = order.filter(t => state[t].status === 'done' && state[t].data);
        let imported = 0;
        const results = [];

        for (let i = 0; i < toImport.length; i++) {
            const type  = toImport[i];
            const pct   = Math.round(((i) / toImport.length) * 80);
            showProgress(pct, `Import ${ZONE_LABELS[type]}…`);

            try {
                const { resolved } = state[type].data;

                // Injecter dans les tableaux globaux selon le type détecté
                if (resolved) {
                    let count = 0;
                    if (resolved.owners     && resolved.owners.length)     { window.ownersData     = resolved.owners;     count += resolved.owners.length; }
                    if (resolved.properties && resolved.properties.length) { window.propertiesData = resolved.properties; count += resolved.properties.length; }
                    if (resolved.clients    && resolved.clients.length)    { window.clientsData    = resolved.clients;    count += resolved.clients.length; }
                    if (resolved.collectors && resolved.collectors.length) { window.collectorsData = resolved.collectors; count += resolved.collectors.length; }
                    imported += count;
                    results.push({ type, count, ok: true });
                }

                // Sauvegarder via SYGIM_DB si disponible
                if (window.SYGIM_DB && typeof window.SYGIM_DB.saveAll === 'function') {
                    await window.SYGIM_DB.saveAll();
                }

                await sleep(300); // UX fluide
            } catch(err) {
                results.push({ type, count: 0, ok: false, error: err.message });
            }
        }

        showProgress(100, 'Finalisation…');
        await sleep(400);

        // Rafraîchir l'interface SYGIM
        refreshSYGIM();

        // Afficher le résultat
        hideProgress();
        showImportResult(results, imported);

        if (btn) {
            btn.disabled  = false;
            btn.innerHTML = '<i class="fas fa-check" style="margin-right:8px;"></i>Import terminé !';
            btn.style.background = 'linear-gradient(135deg,#22c55e,#16a34a)';
            setTimeout(() => {
                btn.innerHTML = '<i class="fas fa-rocket" style="margin-right:8px;"></i>Lancer l\'import';
                btn.style.background = 'linear-gradient(135deg,var(--primary,#6366f1),var(--primary-dark,#4338ca))';
                btn.disabled = false;
            }, 3000);
        }
    };

    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    function showProgress(pct, text) {
        const wrap = document.getElementById('sygimImportProgress');
        const bar  = document.getElementById('sygimProgressBar');
        const txt  = document.getElementById('sygimProgressText');
        if (wrap) wrap.style.display = 'block';
        if (bar)  bar.style.width    = pct + '%';
        if (txt)  txt.textContent    = text;
    }

    function hideProgress() {
        const wrap = document.getElementById('sygimImportProgress');
        if (wrap) wrap.style.display = 'none';
    }

    function hideResult() {
        const r = document.getElementById('sygimImportResult');
        if (r) { r.style.display = 'none'; r.innerHTML = ''; }
    }

    function showImportResult(results, total) {
        const el  = document.getElementById('sygimImportResult');
        if (!el) return;

        const allOk = results.every(r => r.ok);
        const color = allOk ? '#22c55e' : '#f59e0b';
        const icon  = allOk ? 'fa-check-circle' : 'fa-exclamation-triangle';

        let rows = results.map(r => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border,#e2e8f0);">
            <i class="fas ${r.ok ? 'fa-check' : 'fa-times'}" style="color:${r.ok ? '#22c55e' : '#ef4444'};width:16px;"></i>
            <span style="font-weight:600;font-size:13px;flex:1;">${ZONE_LABELS[r.type]}</span>
            <span style="font-size:12px;color:var(--gray-500,#64748b);">${r.ok ? r.count + ' enreg.' : r.error}</span>
          </div>
        `).join('');

        el.style.display = 'block';
        el.innerHTML = `
          <div style="
            background:${color}10;border:1px solid ${color}40;
            border-radius:14px;padding:16px 18px;margin-bottom:16px;
          ">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
              <i class="fas ${icon}" style="font-size:22px;color:${color};"></i>
              <div>
                <p style="font-weight:700;font-size:15px;color:var(--dark,#0f172a);margin:0;">
                  ${allOk ? 'Import réussi !' : 'Import avec avertissements'}
                </p>
                <p style="font-size:12px;color:var(--gray-500,#64748b);margin:2px 0 0;">
                  ${total} enregistrement${total>1?'s':''} importé${total>1?'s':''}
                </p>
              </div>
            </div>
            ${rows}
          </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RAFRAÎCHIR L'UI SYGIM
    // ═══════════════════════════════════════════════════════════════════════
    function refreshSYGIM() {
        const fns = [
            'loadDashboard','loadClientsGrid','loadOwnersList','loadPropertiesGrid',
            'loadCollectorsGrid','loadManagerDashboard','updateManagerStats',
            'adminRefreshDataTab','updatePortfolioStats','loadOwnerPaymentsTable',
            'updateOverdueStatuses','refreshOwnerDropdowns',
        ];
        fns.forEach(fn => { try { if (typeof window[fn] === 'function') window[fn](); } catch(e){} });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // RÉINITIALISER LES ZONES
    // ═══════════════════════════════════════════════════════════════════════
    window.sygimResetImport = function() {
        ['owners','clients','collectors'].forEach(t => window.sygimRemoveFile(t));
        hideResult();
        hideProgress();
        const btn = document.getElementById('sygimImportBtn');
        if (btn) {
            btn.innerHTML = '<i class="fas fa-rocket" style="margin-right:8px;"></i>Lancer l\'import';
            btn.style.background = 'linear-gradient(135deg,var(--primary,#6366f1),var(--primary-dark,#4338ca))';
        }
    };

    // ═══════════════════════════════════════════════════════════════════════
    // OUVRIR / FERMER LE MODAL
    // ═══════════════════════════════════════════════════════════════════════
    window.openImportModal = function() {
        injectModal();
        const m = document.getElementById('sygimImportModal');
        if (m) {
            m.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    };

    window.closeImportModal = function() {
        const m = document.getElementById('sygimImportModal');
        if (m) {
            m.style.animation = 'sygimFadeIn 0.2s ease reverse';
            setTimeout(() => {
                m.style.display = 'none';  // ← 'none' et non '' pour vraiment cacher
                m.style.animation = '';
                document.body.style.overflow = '';
            }, 180);
        }
    };

    // Fermer en cliquant sur le fond (overlay)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.id === 'sygimImportModal') window.closeImportModal();
    });

    // Fermer si clic direct sur le fond (robustesse supplémentaire)
    document.addEventListener('mousedown', function(e) {
        const m = document.getElementById('sygimImportModal');
        if (m && m.style.display === 'flex' && e.target === m) window.closeImportModal();
    });

    // Fermer avec Escape
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.closeImportModal();
    });

    // Pré-injecter au chargement
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectModal);
    } else {
        setTimeout(injectModal, 500);
    }

    console.info('[SYGIM-MODAL] ✅ Modal Import CSV prêt.\n  openImportModal() → ouvre le modal\n  closeImportModal() → ferme le modal');

})();
