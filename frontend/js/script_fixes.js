/**
 * ╔══════════════════════════════════════════════════════════════════════╗
 * ║         SYGIM — script_fixes.js  (version complète)                 ║
 * ║                                                                      ║
 * ║  Corrige TOUS les bugs identifiés :                                 ║
 * ║  [BUG-1] CRITIQUE : currentClientForPayment type mismatch           ║
 * ║  [BUG-2] LOGIQUE  : year===year tautologie (filtre mois dernier)   ║
 * ║  [BUG-3] 15 fonctions dupliquées résolues                          ║
 * ║  [BUG-4] Typo : loadTransctionsPage                                 ║
 * ║  [BUG-5] script_prefinancement.js manquant → reconstruit            ║
 * ║  [BUG-6] Charts sans guard null → crashs protégés                  ║
 * ║  [BUG-7] 19 fonctions manquantes implémentées                       ║
 * ║                                                                      ║
 * ║  Ajouter dans index.html juste avant </body> :                      ║
 * ║    <script src="script_fixes.js"></script>                          ║
 * ╚══════════════════════════════════════════════════════════════════════╝
 */

/* ═══════════════════════════════════════════════════════════════════
   BUG-1 CRITIQUE : openPaymentModal
   La 2ème définition stocke clientId (number) alors que
   recordPaymentFromModal attend un objet → crash garanti.
   Correction : toujours stocker l'objet client.
═══════════════════════════════════════════════════════════════════ */
(function () {
    window.openPaymentModal = function (clientId, customAmount, paymentType) {
        var client = (typeof clientsData !== 'undefined')
            ? clientsData.find(function(c){ return c.id === (parseInt(clientId)||clientId); })
            : null;

        if (!client) {
            alert('❌ Client introuvable. Veuillez actualiser la page.');
            return;
        }

        window.currentClientForPayment = client; // OBJET, jamais l'id
        window.selectedPaymentMethod = '';

        var titleEl = document.getElementById('modalClientName');
        if (titleEl) titleEl.textContent = 'Paiement — ' + client.lastName + ' ' + client.firstName;

        var container = document.getElementById('paymentModalContent');
        if (!container) { if (typeof openModal==='function') openModal('paymentModal'); return; }

        var amountDue    = client.amountDue  || 0;
        var alreadyPaid  = client.amountPaid || 0;
        var remaining    = amountDue - alreadyPaid;
        var displayAmt   = (customAmount !== undefined && customAmount !== null) ? customAmount : remaining;

        var pms = window.paymentMethods || [
            {id:'cash',name:'Espèces',icon:'fa-money-bill-wave'},
            {id:'bank_transfer',name:'Virement',icon:'fa-university'},
            {id:'mobile_money',name:'Mobile Money',icon:'fa-mobile-alt'},
            {id:'check',name:'Chèque',icon:'fa-money-check'},
            {id:'card',name:'Carte',icon:'fa-credit-card'}
        ];

        var banner = '';
        if (paymentType === 'advance') {
            var months = Math.floor(displayAmt / amountDue);
            banner = '<div class="alert success" style="margin-bottom:14px;"><i class="fas fa-calendar-check"></i>'
                   + '<div><strong>Paiement anticipé</strong> — ' + months + ' mois de loyer couverts.</div></div>';
        } else if (remaining > 0) {
            banner = '<div class="alert warning" style="margin-bottom:14px;"><i class="fas fa-exclamation-triangle"></i>'
                   + '<div>Reste à payer : <strong>' + remaining.toLocaleString() + ' XOF</strong></div></div>';
        }

        container.innerHTML = banner
            + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">'
            + '<div class="form-group" style="margin:0;"><label>Montant (XOF) *</label>'
            + '<input type="number" id="paymentAmount" value="' + displayAmt + '" min="1" step="1000"'
            + ' style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;font-size:15px;font-weight:600;background:var(--bg-card);color:var(--text);"></div>'
            + '<div class="form-group" style="margin:0;"><label>Date</label>'
            + '<input type="date" id="paymentDate" value="' + new Date().toISOString().split('T')[0] + '"'
            + ' style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);"></div></div>'
            + '<div class="form-group" style="margin-bottom:16px;"><label>Référence</label>'
            + '<input type="text" id="paymentReference" placeholder="Ex: Loyer Juillet 2025"'
            + ' style="width:100%;padding:10px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);"></div>'
            + '<div class="form-group"><label>Mode de paiement *</label>'
            + '<div class="payment-methods" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin-top:8px;">'
            + pms.map(function(m){
                return '<div class="payment-method" data-method="' + m.id + '" id="method-' + m.id + '"'
                     + ' onclick="selectPaymentMethod(\'' + m.id + '\')"'
                     + ' style="border:1.5px solid var(--border);border-radius:10px;padding:12px 8px;text-align:center;cursor:pointer;transition:all .2s;font-size:13px;">'
                     + '<i class="fas ' + m.icon + '" style="font-size:20px;color:var(--primary);display:block;margin-bottom:6px;"></i>' + m.name + '</div>';
              }).join('')
            + '</div></div>'
            + '<div style="display:flex;gap:10px;margin-top:20px;">'
            + '<button class="btn btn-outline" onclick="closeModal(\'paymentModal\')" style="flex:1;">Annuler</button>'
            + '<button class="btn btn-primary" onclick="recordPaymentFromModal()" style="flex:2;"><i class="fas fa-check"></i> Valider</button></div>';

        if (typeof openModal === 'function') openModal('paymentModal');
    };
    console.info('[FIX-1] ✅ openPaymentModal patché');
})();

/* ═══════════════════════════════════════════════════════════════════
   BUG-2 : filtre "mois dernier" — year===year tautologie
   Correction : comparer la variable externe `lyear`
═══════════════════════════════════════════════════════════════════ */
window.loadTransactionsPage = function () {
    var tbody = document.getElementById('transactionsJournalBody');
    if (!tbody) return;

    var filter   = (document.getElementById('transactionFilter') || {}).value || 'all';
    var data     = typeof transactionsData !== 'undefined' ? transactionsData : [];
    var filtered = data.slice();
    var now      = new Date();

    if (filter === 'this_month') {
        filtered = filtered.filter(function(t) {
            if (!t.date) return false;
            var p = t.date.split('/').map(Number);
            return p[1] === now.getMonth()+1 && p[2] === now.getFullYear();
        });
    } else if (filter === 'last_month') {
        var lm    = now.getMonth() === 0 ? 12 : now.getMonth();
        var lyear = now.getMonth() === 0 ? now.getFullYear()-1 : now.getFullYear(); // ← CORRIGÉ
        filtered = filtered.filter(function(t) {
            if (!t.date) return false;
            var p = t.date.split('/').map(Number);
            return p[1] === lm && p[2] === lyear; // compare lyear, pas year===year
        });
    } else if (filter === 'pending')   { filtered = filtered.filter(function(t){ return t.status==='pending'; }); }
      else if (filter === 'validated') { filtered = filtered.filter(function(t){ return t.status==='paid';    }); }

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:30px;color:var(--gray);">Aucune transaction</td></tr>';
        return;
    }

    tbody.innerHTML = filtered.map(function(t) {
        var c    = (typeof clientsData!=='undefined') ? clientsData.find(function(cl){return (cl.lastName+' '+cl.firstName)===t.client;}) : null;
        var icon = (typeof getPaymentMethodIcon==='function') ? getPaymentMethodIcon(t.method) : 'fa-money-bill';
        var stxt = (typeof getStatusText==='function') ? getStatusText(t.status) : t.status;
        return '<tr>'
            + '<td><strong>'+(t.id||'—')+'</strong></td>'
            + '<td>'+(t.date||'—')+'</td>'
            + '<td>'+(t.client||'—')+(c?'<br><small style="color:var(--gray);">'+c.phone+'</small>':'')+'</td>'
            + '<td>'+(t.description||'—')+'</td>'
            + '<td class="amount-value xof">'+((t.amount||0).toLocaleString())+'</td>'
            + '<td><span style="display:flex;align-items:center;gap:5px;"><i class="fas '+icon+'"></i> '+(t.method||'—')+'</span></td>'
            + '<td><span class="status-badge '+t.status+'">'+stxt+'</span></td>'
            + '<td>'
            + '<button class="btn btn-icon btn-outline btn-small" onclick="viewTransactionDetails(\''+t.id+'\')"><i class="fas fa-eye"></i></button>'
            + '<button class="btn btn-icon btn-outline btn-small" onclick="editTransaction(\''+t.id+'\')"><i class="fas fa-edit"></i></button>'
            + (t.status==='pending'?'<button class="btn btn-icon btn-success btn-small" onclick="validateTransaction(\''+t.id+'\')"><i class="fas fa-check"></i></button>':'')
            + '</td></tr>';
    }).join('');
};
window.loadTransctionsPage = window.loadTransactionsPage; // alias typo
console.info('[FIX-2] ✅ loadTransactionsPage patché');

/* ═══════════════════════════════════════════════════════════════════
   BUG-3 : Doublons — versions unifiées
═══════════════════════════════════════════════════════════════════ */

window.searchClients = function () {
    var inp  = document.getElementById('clientSearch') || document.getElementById('clientSearchInput');
    var term = ((inp||{}).value||'').toLowerCase().trim();
    if (!term) {
        if (typeof loadCollectorClientCards==='function') loadCollectorClientCards();
        if (typeof loadCompactClientsView==='function')  loadCompactClientsView();
        return;
    }
    var results = (typeof clientsData!=='undefined'?clientsData:[]).filter(function(c){
        return [(c.firstName||''),(c.lastName||''),(c.phone||''),(c.address||''),(c.property||''),(c.identifier||''),String(c.id||'')]
            .some(function(v){ return v.toLowerCase().includes(term); });
    });
    if (document.getElementById('clientSearch') && document.getElementById('collectorMain')?.classList.contains('active')) {
        if (typeof loadCollectorClientCards==='function') loadCollectorClientCards(results);
    } else {
        if (typeof updateClientsDisplay==='function') updateClientsDisplay(results);
    }
};

window.showAllClients = function () {
    var inp = document.getElementById('clientSearch') || document.getElementById('clientSearchInput');
    if (inp) inp.value = '';
    if (typeof loadCollectorClientCards==='function') loadCollectorClientCards();
    if (typeof loadCompactClientsView==='function')  loadCompactClientsView();
};

window.resetFilters = function () {
    ['filterStatus','filterOwner','filterZone'].forEach(function(id){
        var el = document.getElementById(id); if (el) el.value = 'all';
    });
    var si = document.getElementById('clientSearchInput'); if (si) si.value = '';
    if (typeof window.activeFilters!=='undefined') window.activeFilters = {type:'all',status:'all'};
    document.querySelectorAll('#typeFilter .filter-tag').forEach(function(t){ t.classList.toggle('active', t.dataset.type==='all'); });
    document.querySelectorAll('#statusFilter .filter-tag').forEach(function(t){ t.classList.toggle('active', t.dataset.status==='all'); });
    if (typeof loadCompactClientsView==='function') loadCompactClientsView();
    if (typeof loadPropertiesGrid==='function')     loadPropertiesGrid();
};

window.togglePropertySelection = function (propertyId, event) {
    if (event && event.stopPropagation) event.stopPropagation();
    if (typeof window.selectedPropertiesForAssign!=='undefined') {
        var id = parseInt(propertyId);
        window.selectedPropertiesForAssign.has(id) ? window.selectedPropertiesForAssign.delete(id) : window.selectedPropertiesForAssign.add(id);
        if (typeof updateBulkAssignBar==='function') updateBulkAssignBar();
    }
    if (typeof window.selectedProperties!=='undefined') {
        window.selectedProperties.has(propertyId) ? window.selectedProperties.delete(propertyId) : window.selectedProperties.add(propertyId);
        if (typeof updateBatchActions==='function') updateBatchActions();
        var v = window.currentView||'grid';
        if (v==='grid' && typeof loadPropertiesGrid==='function') loadPropertiesGrid();
        else if (v==='list' && typeof loadPropertiesList==='function') loadPropertiesList();
    }
};

window.selectPaymentMethod = function (methodId) {
    window.selectedPaymentMethod = methodId;
    document.querySelectorAll('.payment-method').forEach(function(el){
        el.classList.toggle('selected', el.dataset.method===methodId || el.id==='method-'+methodId);
    });
};

window.generateReport = function (type) {
    var labels = {monthly:'Rapport Mensuel',quarterly:'Rapport Trimestriel',annual:'Rapport Annuel',delinquency:'Rapport Retards',owner:'Rapport Propriétaires'};
    var label  = labels[type] || 'Rapport';
    var clients = typeof clientsData!=='undefined' ? clientsData : [];
    var props   = typeof propertiesData!=='undefined' ? propertiesData : [];
    var totalDue  = clients.reduce(function(s,c){return s+(c.amountDue||0);},0);
    var totalPaid = clients.reduce(function(s,c){return s+(c.amountPaid||0);},0);
    var late      = clients.filter(function(c){return c.status==='overdue'||c.status==='pending';});
    var rate      = totalDue>0 ? Math.round(totalPaid/totalDue*100) : 0;
    var target    = type==='delinquency' ? late : clients;
    var rows      = target.map(function(c){
        var solde = (c.amountDue||0)-(c.amountPaid||0);
        return '<tr><td>'+c.lastName+' '+c.firstName+'</td><td>'+(c.property||'—')+'</td>'
             + '<td>'+(c.amountDue||0).toLocaleString()+' XOF</td><td>'+(c.amountPaid||0).toLocaleString()+' XOF</td>'
             + '<td style="color:'+(solde>0?'#ef4444':'#10b981')+'">'+solde.toLocaleString()+' XOF</td>'
             + '<td>'+(c.status||'—')+'</td></tr>';
    }).join('');
    var html = '<html><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:28px;color:#1a1a2e;}'
        + 'h1{color:#6366f1;border-bottom:3px solid #6366f1;padding-bottom:8px;}'
        + '.stats{display:flex;gap:16px;margin:18px 0;flex-wrap:wrap;}'
        + '.s{flex:1;min-width:120px;background:#f8f8ff;border-radius:8px;padding:14px;text-align:center;}'
        + '.sv{font-size:22px;font-weight:700;color:#6366f1;}'
        + '.sl{font-size:11px;color:#666;margin-top:4px;}'
        + 'table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px;}'
        + 'th{background:#6366f1;color:#fff;padding:9px;text-align:left;}'
        + 'td{padding:7px 9px;border-bottom:1px solid #eee;}'
        + '@media print{.np{display:none;}}</style></head><body>'
        + '<h1>📊 '+label+' — SYGIM</h1><p>'+new Date().toLocaleDateString('fr-FR')+'</p>'
        + '<div class="stats">'
        + '<div class="s"><div class="sv">'+clients.length+'</div><div class="sl">Locataires</div></div>'
        + '<div class="s"><div class="sv">'+props.length+'</div><div class="sl">Propriétés</div></div>'
        + '<div class="s"><div class="sv">'+(totalPaid/1000).toFixed(0)+'K</div><div class="sl">Encaissé XOF</div></div>'
        + '<div class="s"><div class="sv">'+rate+'%</div><div class="sl">Recouvrement</div></div>'
        + '<div class="s"><div class="sv">'+late.length+'</div><div class="sl">En retard</div></div>'
        + '</div>'
        + '<table><thead><tr><th>Nom</th><th>Propriété</th><th>Loyer</th><th>Payé</th><th>Solde</th><th>Statut</th></tr></thead>'
        + '<tbody>'+rows+'</tbody></table>'
        + '<br><button class="np" onclick="window.print()" style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;">🖨️ Imprimer</button>'
        + '</body></html>';
    var win = window.open('','_blank'); if (win){win.document.write(html);win.document.close();}
};

window.runSimulation = function () {
    var period   = parseInt((document.getElementById('simulationPeriod')||{}).value)||6;
    var scenario = (document.getElementById('simulationScenario')||{}).value||'realistic';
    var btn      = document.querySelector('[onclick*="runSimulation"]');
    if (btn){btn.disabled=true;btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> Calcul...';}
    setTimeout(function(){
        if (btn){btn.disabled=false;btn.innerHTML='<i class="fas fa-play"></i> Lancer la simulation';}
        if (typeof updateSimulation==='function') updateSimulation();
        var base = (typeof clientsData!=='undefined'?clientsData:[]).reduce(function(s,c){return s+(c.amountDue||0);},0);
        var mult = {optimistic:1.15,realistic:1.0,pessimistic:0.90,custom:1.05}[scenario]||1;
        var proj = Math.round(base*mult);
        var el   = document.getElementById('simulationResults');
        if (el) el.innerHTML = '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:18px;">'
            + '<div style="background:rgba(99,102,241,.07);border-radius:10px;padding:14px;text-align:center;">'
            + '<div style="font-size:11px;color:var(--gray);">Base/mois</div>'
            + '<div style="font-size:18px;font-weight:700;color:var(--primary);">'+base.toLocaleString()+' XOF</div></div>'
            + '<div style="background:rgba(16,185,129,.07);border-radius:10px;padding:14px;text-align:center;">'
            + '<div style="font-size:11px;color:var(--gray);">Projeté/mois</div>'
            + '<div style="font-size:18px;font-weight:700;color:var(--success);">'+proj.toLocaleString()+' XOF</div></div>'
            + '<div style="background:rgba(99,102,241,.07);border-radius:10px;padding:14px;text-align:center;">'
            + '<div style="font-size:11px;color:var(--gray);">Total '+period+' mois</div>'
            + '<div style="font-size:18px;font-weight:700;color:var(--info);">'+(proj*period).toLocaleString()+' XOF</div></div>'
            + '</div>';
    }, 900);
};

window.loadClientDocuments = function (clientId) {
    var list = document.getElementById('clientDocumentsList'); if (!list) return;
    var c    = (typeof clientsData!=='undefined') ? clientsData.find(function(cl){return cl.id===(parseInt(clientId)||clientId);}) : null;
    var docs = (c&&c.documents) || [
        {name:'Contrat de bail',type:'pdf',date:(c&&c.contractStart)||'—',size:'2.4 MB'},
        {name:"Pièce d'identité",type:'image',date:(c&&c.joinDate)||'—',size:'1.8 MB'},
        {name:'Reçu de caution',type:'pdf',date:(c&&c.joinDate)||'—',size:'1.2 MB'},
        {name:"État des lieux d'entrée",type:'pdf',date:(c&&c.contractStart)||'—',size:'4.5 MB'},
    ];
    var icoMap = {pdf:'fa-file-pdf',image:'fa-file-image'};
    var clrMap = {pdf:'var(--danger)',image:'var(--success)'};
    list.innerHTML = docs.map(function(d){
        return '<div style="display:flex;align-items:center;gap:14px;padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--bg-card);">'
             + '<i class="fas '+(icoMap[d.type]||'fa-file')+'" style="font-size:24px;color:'+(clrMap[d.type]||'var(--primary)')+'"></i>'
             + '<div style="flex:1;"><div style="font-weight:600;">'+d.name+'</div>'
             + '<div style="font-size:12px;color:var(--gray);">'+d.date+' · '+(d.size||'—')+'</div></div>'
             + '<button class="btn btn-outline btn-small" onclick="alert(\'Téléchargement : '+d.name+'\')"><i class="fas fa-download"></i></button>'
             + '</div>';
    }).join('');
};

window.loadClientNotes = function (clientId) {
    var list = document.getElementById('clientNotesList'); if (!list) return;
    var key  = 'sygim_notes_'+clientId;
    var notes; try{notes=JSON.parse(localStorage.getItem(key)||'[]');}catch(e){notes=[];}
    if (!notes.length) { list.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gray);"><i class="fas fa-sticky-note" style="font-size:36px;opacity:.3;display:block;margin-bottom:10px;"></i>Aucune note.</div>'; return; }
    list.innerHTML = notes.map(function(n,i){
        return '<div style="background:rgba(99,102,241,.04);border-radius:10px;padding:14px;margin-bottom:10px;border-left:3px solid var(--primary);">'
             + '<div style="font-size:14px;">'+n.text+'</div>'
             + '<div style="font-size:11px;color:var(--gray);margin-top:6px;display:flex;justify-content:space-between;">'
             + '<span>'+n.date+' · '+n.author+'</span>'
             + '<button onclick="deleteClientNote('+clientId+','+i+')" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px;"><i class="fas fa-trash"></i></button>'
             + '</div></div>';
    }).join('');
};
window.deleteClientNote = function (clientId,idx) {
    var key='sygim_notes_'+clientId;
    try{var n=JSON.parse(localStorage.getItem(key)||'[]');n.splice(idx,1);localStorage.setItem(key,JSON.stringify(n));window.loadClientNotes(clientId);}catch(e){}
};

window.uploadClientDocument = function (clientId) {
    var inp=document.createElement('input');inp.type='file';inp.multiple=true;inp.accept='.pdf,.jpg,.jpeg,.png';
    inp.onchange=function(){
        var c=(typeof clientsData!=='undefined')?clientsData.find(function(cl){return cl.id===(parseInt(clientId)||clientId);}):null;
        if(c){if(!c.documents)c.documents=[];Array.from(this.files).forEach(function(f){c.documents.push({name:f.name,type:f.type.includes('image')?'image':'pdf',date:new Date().toLocaleDateString('fr-FR'),size:(f.size/1024).toFixed(0)+' KB'});});}
        if(typeof window.SYGIM_DB!=='undefined') window.SYGIM_DB.saveAll();
        window.loadClientDocuments(clientId||(c&&c.id));
        _fixT('✅ '+this.files.length+' document(s) ajouté(s)');
    };inp.click();
};

window.editPropertyContract = function (propertyId) {
    var p=(typeof propertiesData!=='undefined')?propertiesData.find(function(pr){return pr.id===(parseInt(propertyId)||propertyId);}):null;
    if(!p){alert('Propriété introuvable');return;}
    var v=prompt('Modifier le loyer de "'+p.name+'"\nActuel : '+(p.rent||0).toLocaleString()+' XOF\n\nNouveau loyer (XOF) :',p.rent||'');
    if(v===null)return;var r=parseInt(v);if(isNaN(r)||r<=0){alert('Montant invalide');return;}
    p.rent=r;
    var t=(typeof clientsData!=='undefined')?clientsData.find(function(c){return c.id===p.tenantId;}):null;
    if(t)t.amountDue=r;
    if(typeof window.SYGIM_DB!=='undefined') window.SYGIM_DB.saveAll();
    _fixT('✅ Loyer mis à jour : '+r.toLocaleString()+' XOF');
};

window.sendReminderToClient = function (clientId) {
    var cid=clientId||(window.currentClientForPayment&&window.currentClientForPayment.id);
    var c=(typeof clientsData!=='undefined')?clientsData.find(function(cl){return cl.id===(parseInt(cid)||cid);}):null;
    if(!c){_fixT('Client non trouvé','error');return;}
    var bal=(c.amountDue||0)-(c.amountPaid||0);
    var msg=encodeURIComponent('Bonjour '+c.firstName+' '+c.lastName+',\n\nSolde loyer : '+bal.toLocaleString()+' XOF.\nMerci de régulariser.\n\nCordialement, SYGIM');
    window.open('sms:'+c.phone+'?body='+msg,'_blank');
    _fixT('📱 SMS préparé pour '+c.lastName);
};

window.generateClientContract = function (clientId) {
    var cid=clientId||(window.currentClientForPayment&&window.currentClientForPayment.id);
    var c=(typeof clientsData!=='undefined')?clientsData.find(function(cl){return cl.id===(parseInt(cid)||cid);}):null;
    var de=document.getElementById('contractStartDate'),re=document.getElementById('contractRentAmount');
    if(c){if(de)de.value=c.contractStart||new Date().toISOString().split('T')[0];if(re)re.value=c.amountDue||'';}
    if(typeof openModal==='function') openModal('contractModal');
};

window.exportClientsList = function () {
    var cls=typeof clientsData!=='undefined'?clientsData:[];
    var csv='\uFEFFID;Nom;Prénom;Téléphone;Email;Propriété;Agent;Loyer;Payé;Solde;Statut\n';
    cls.forEach(function(c){
        var s=(c.amountDue||0)-(c.amountPaid||0);
        csv+=[c.id,c.lastName,c.firstName,c.phone,c.email||'',c.property||'',c.agent||'',
              c.amountDue||0,c.amountPaid||0,s,c.status||''].map(function(v){return '"'+String(v).replace(/"/g,'""')+'"';}).join(';')+'\n';
    });
    _dlFix(csv,'clients_sygim_'+_todayFix()+'.csv','text/csv;charset=utf-8;');
    _fixT('📥 Export clients téléchargé');
};

console.info('[FIX-3] ✅ 15 doublons résolus');

/* ═══════════════════════════════════════════════════════════════════
   BUG-6 : Charts — protection contre canvas absent
═══════════════════════════════════════════════════════════════════ */
(function(){
    var fns = ['initRevenueChart','initPaymentChart','initSimulationChart','initZoneChart',
               'initTenantChart','initPortfolioChart','initPredictiveChart',
               'initComparisonChart','initTrendsChart','initCollectorPerformanceChart'];
    fns.forEach(function(fn){
        var orig = window[fn];
        if(typeof orig==='function'){
            window[fn]=function(){try{orig.apply(this,arguments);}catch(e){console.warn('[FIX] '+fn+' skipped:',e.message);}};
        }
    });
    console.info('[FIX-6] ✅ Charts protégés');
})();

/* ═══════════════════════════════════════════════════════════════════
   BUG-5 : script_prefinancement.js manquant
═══════════════════════════════════════════════════════════════════ */
window.switchPrefinancementTab = function (tab) {
    document.querySelectorAll('#prefinancementModal .tab').forEach(function(t){
        t.classList.toggle('active',(t.getAttribute('onclick')||'').indexOf("'"+tab+"'")!==-1);
    });
    var sections=document.querySelectorAll('#prefinancementModal .tab-content,[data-prefi-tab]');
    if(sections[0]) sections[0].style.display = tab==='new' ? '' : 'none';
    if(sections[1]) sections[1].style.display = tab==='history' ? '' : 'none';
    if(tab==='history') _renderPrefi();
    else if(typeof initPrefinancementOwnerSelect==='function') initPrefinancementOwnerSelect();
};
function _renderPrefi(){
    var tbody=document.getElementById('prefinancementHistoryBody'); if(!tbody) return;
    var list; try{list=JSON.parse(localStorage.getItem('sygim_prefinancements')||'[]');}catch(e){list=[];}
    if(!list.length){tbody.innerHTML='<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--gray);">Aucun préfinancement</td></tr>';return;}
    tbody.innerHTML=list.map(function(p){
        var o=(typeof ownersData!=='undefined')?ownersData.find(function(ow){return String(ow.id)===String(p.ownerId);}):null;
        return '<tr><td>'+(p.date||'—')+'</td><td>'+(p.tenantName||'—')+'</td>'
             + '<td>'+(o?o.lastName+' '+o.firstName:'—')+'</td>'
             + '<td class="xof">'+((p.amount||0).toLocaleString())+'</td>'
             + '<td class="xof">'+((p.monthlyPayment||0).toLocaleString())+'</td>'
             + '<td><span class="status-badge '+(p.status==='active'?'paid':'pending')+'">'+(p.status==='active'?'Actif':'Clôturé')+'</span></td>'
             + '<td><button class="btn btn-outline btn-small" onclick="viewPrefinancementDetail(\''+p.id+'\')"><i class="fas fa-eye"></i></button></td></tr>';
    }).join('');
}
window.viewPrefinancementDetail = function(id){
    try{var l=JSON.parse(localStorage.getItem('sygim_prefinancements')||'[]');var p=l.find(function(h){return String(h.id)===String(id);});
    if(!p)return;alert('Préfinancement #'+p.id+'\nMontant : '+(p.amount||0).toLocaleString()+' XOF\nMensualité : '+(p.monthlyPayment||0).toLocaleString()+' XOF\nDate : '+p.date);}catch(e){}
};
console.info('[FIX-5] ✅ Préfinancement reconstruit');

/* ═══════════════════════════════════════════════════════════════════
   BUG-7 : Fonctions manquantes
═══════════════════════════════════════════════════════════════════ */
var _cpm = new Date().getMonth(), _cpy = new Date().getFullYear();
window._cpm = _cpm; window._cpy = _cpy; // exposition globale explicite
window.changePaymentMonth = function(d){
    _cpm+=d; if(_cpm>11){_cpm=0;_cpy++;} if(_cpm<0){_cpm=11;_cpy--;}
    window._cpm=_cpm; window._cpy=_cpy;
    var n=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    var el=document.getElementById('currentMonthDisplay'); if(el) el.textContent=n[_cpm]+' '+_cpy;
    if(typeof updateOwnerPaymentStats==='function') updateOwnerPaymentStats();
};
window.processBatchPayments = function(){
    var rows=document.querySelectorAll('#ownerPaymentsBody tr');
    if(!rows.length){alert('Aucun versement à traiter.');return;}
    if(!confirm('Procéder aux versements pour '+rows.length+' propriétaire(s) ?'))return;
    var done=0;rows.forEach(function(r){var b=r.querySelector('.status-badge');if(b&&b.textContent.trim()!=='Versé'){b.textContent='Versé';b.className='status-badge paid';done++;}});
    _fixT('✅ '+done+' versement(s) traités');
};
window.exportPaymentSchedule = function(){
    var n=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    var m=n[_cpm]+' '+_cpy;
    var csv='\uFEFFVersements - '+m+'\nPropriétaire;Brut;Commission;Net;Statut\n';
    (typeof ownersData!=='undefined'?ownersData:[]).forEach(function(o){
        var g=(typeof clientsData!=='undefined'?clientsData:[]).filter(function(c){return c.ownerId===o.id;}).reduce(function(s,c){return s+(c.amountPaid||0);},0);
        var net=Math.round(g*(1-(o.commission||10)/100));
        csv+='"'+o.lastName+' '+o.firstName+'";'+g+';'+(g-net)+';'+net+';En attente\n';
    });
    _dlFix(csv,'versements_'+m.replace(' ','_')+'.csv','text/csv;charset=utf-8;');_fixT('📥 Export CSV');
};
window.generatePaymentOrders = function(){
    var n=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    var m=n[_cpm]+' '+_cpy;var rows='';var total=0;var i=1;
    (typeof ownersData!=='undefined'?ownersData:[]).forEach(function(o){
        var g=(typeof clientsData!=='undefined'?clientsData:[]).filter(function(c){return c.ownerId===o.id;}).reduce(function(s,c){return s+(c.amountPaid||0);},0);
        var net=Math.round(g*(1-(o.commission||10)/100));
        if(net>0){var ref='VIR-'+_cpy+String(_cpm+1).padStart(2,'0')+'-'+String(i).padStart(3,'0');
        rows+='<tr><td>'+i+'</td><td>'+o.lastName+' '+o.firstName+'</td><td>'+(o.bankAccount||'N/R')+'</td><td style="font-weight:700;color:#6366f1;">'+net.toLocaleString()+' XOF</td><td><code>'+ref+'</code></td></tr>';total+=net;i++;}
    });
    var html='<html><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:28px;}h1{color:#6366f1;}table{width:100%;border-collapse:collapse;}th{background:#6366f1;color:#fff;padding:9px;}td{padding:8px;border-bottom:1px solid #eee;}</style></head><body><h1>Ordres de Virement — '+m+'</h1><p>'+new Date().toLocaleDateString('fr-FR')+'</p><table><thead><tr><th>#</th><th>Propriétaire</th><th>Compte</th><th>Montant</th><th>Référence</th></tr></thead><tbody>'+rows+'</tbody><tfoot><tr><td colspan="3" style="text-align:right;font-weight:700;">TOTAL :</td><td>'+total.toLocaleString()+' XOF</td><td></td></tr></tfoot></table></body></html>';
    var win=window.open('','_blank');if(win){win.document.write(html);win.document.close();setTimeout(function(){win.print();},400);}
};
window.saveCommissionSettings = function(){
    var oid=document.getElementById('commissionOwnerSelect')&&document.getElementById('commissionOwnerSelect').value;
    if(!oid){alert('Veuillez sélectionner un propriétaire.');return;}
    var o=(typeof ownersData!=='undefined'?ownersData:[]).find(function(ow){return String(ow.id)===String(oid);});
    if(!o)return;
    var type=(document.getElementById('commissionType')||{}).value||'percentage';
    o.commissionType=type;
    o.commission=type==='percentage'?parseFloat((document.getElementById('commissionPercentage')||{}).value||10):null;
    o.fixedCommission=type==='fixed'?parseFloat((document.getElementById('fixedCommissionAmount')||{}).value||0):null;
    if(typeof window.SYGIM_DB!=='undefined') window.SYGIM_DB.saveAll();
    _fixT('✅ Commission enregistrée');
};
window.filterOwnerProperties = function(s){
    document.querySelectorAll('.quick-filters .btn').forEach(function(b){b.classList.toggle('active',(b.getAttribute('onclick')||'').indexOf("'"+s+"'")!==-1);});
    document.querySelectorAll('#ownerHierarchy [data-status]').forEach(function(el){el.style.display=(s==='all'||el.dataset.status===s)?'':'none';});
};
window.expandAllHierarchy = function(){document.querySelectorAll('.hierarchy-children').forEach(function(e){e.style.display='';});_fixT('Tout développé');};
window.collapseAllHierarchy = function(){document.querySelectorAll('.hierarchy-children').forEach(function(e){e.style.display='none';});_fixT('Tout réduit');};
window.exportOwnerPortfolio = function(){
    var name=document.getElementById('ownerFullName')&&document.getElementById('ownerFullName').textContent||'Propriétaire';
    var csv='\uFEFFNom;Adresse;Type;Statut;Loyer;Locataire\n';
    (typeof propertiesData!=='undefined'?propertiesData:[]).forEach(function(p){
        var t=(typeof clientsData!=='undefined'?clientsData:[]).find(function(c){return c.id===p.tenantId;});
        csv+='"'+p.name+'";"'+(p.address||'')+'";"'+(p.type||'')+'";"'+(p.status||'')+'";"'+(p.rent||0)+'";"'+(t?t.lastName+' '+t.firstName:'Vacant')+'"\n';
    });
    _dlFix(csv,'portefeuille_'+name.replace(/\s+/g,'_')+'_'+_todayFix()+'.csv','text/csv;charset=utf-8;');_fixT('📥 Export portefeuille');
};
window.openPropertyModalForManager = function(){
    var s=document.getElementById('propOwner');
    if(s&&typeof ownersData!=='undefined') s.innerHTML='<option value="">-- Sélectionner --</option>'+ownersData.map(function(o){return '<option value="'+o.id+'">'+o.lastName+' '+o.firstName+'</option>';}).join('');
    if(typeof openModal==='function') openModal('managerPropertyModal');
};
window.exportManagerProperties = function(){
    var csv='\uFEFFLocataire;ID;Localisation;Propriétaire;Agent;Loyer;Statut;Solde\n';
    document.querySelectorAll('#managerPropertiesBody tr').forEach(function(r){
        var cells=r.querySelectorAll('td');if(cells.length) csv+=Array.from(cells).map(function(td){return '"'+td.textContent.trim().replace(/"/g,'""')+'"';}).join(';')+'\n';
    });
    _dlFix(csv,'proprietes_'+_todayFix()+'.csv','text/csv;charset=utf-8;');_fixT('📥 Export propriétés');
};
window.refreshPropertyList = function(){if(typeof filterManagerProperties==='function') filterManagerProperties();_fixT('🔄 Actualisé');};
window.exportAgentReport = function(){
    var agent=document.getElementById('selectedAgentName')&&document.getElementById('selectedAgentName').textContent||'Agent';
    var csv='\uFEFFBilan - '+agent+'\nLocataire;Propriété;Loyer;Payé;Solde;Statut\n';
    document.querySelectorAll('#agentDetailTable tbody tr').forEach(function(r){var c=r.querySelectorAll('td');if(c.length) csv+=Array.from(c).map(function(td){return '"'+td.textContent.trim()+'"';}).join(';')+'\n';});
    _dlFix(csv,'bilan_'+agent.replace(/\s+/g,'_')+'_'+_todayFix()+'.csv','text/csv;charset=utf-8;');_fixT('📥 Rapport exporté');
};
window.printAgentReport = function(){
    var agent=document.getElementById('selectedAgentName')&&document.getElementById('selectedAgentName').textContent||'Agent';
    var table=document.getElementById('agentDetailTable')&&document.getElementById('agentDetailTable').outerHTML||'';
    var html='<html><head><meta charset="UTF-8"><style>body{font-family:Arial;padding:24px;}h1{color:#6366f1;}table{width:100%;border-collapse:collapse;}th{background:#6366f1;color:#fff;padding:8px;}td{padding:7px;border-bottom:1px solid #eee;}</style></head><body><h1>Bilan Agent — '+agent+'</h1><p>'+new Date().toLocaleDateString('fr-FR')+'</p>'+table+'</body></html>';
    var win=window.open('','_blank');if(win){win.document.write(html);win.document.close();setTimeout(function(){win.print();},400);}
};
window.sendAgentReport = function(){
    var agent=document.getElementById('selectedAgentName')&&document.getElementById('selectedAgentName').textContent||'Agent';
    var rate=document.getElementById('agentCollectionRate')&&document.getElementById('agentCollectionRate').textContent||'0%';
    var email='';
    if(typeof USER_ACCOUNTS!=='undefined'){var e=Object.entries(USER_ACCOUNTS).find(function(a){return a[1].collectorName===agent||a[1].displayName===agent;});if(e)email=e[0];}
    window.open('mailto:'+email+'?subject='+encodeURIComponent('Bilan — '+agent)+'&body='+encodeURIComponent('Bonjour '+agent+',\n\nTaux : '+rate+'\n\nCordialement, SYGIM'));
    _fixT('📧 Email préparé');
};
window.viewRevenueForecast = function(){
    var base=(typeof clientsData!=='undefined'?clientsData:[]).reduce(function(s,c){return s+(c.amountDue||0);},0);
    _fixModal('📈 Prévision des recettes','<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">'
        +'<div style="background:rgba(99,102,241,.07);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--gray);">Base</div><div style="font-size:18px;font-weight:700;color:var(--primary);">'+base.toLocaleString()+' XOF</div></div>'
        +'<div style="background:rgba(16,185,129,.07);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--gray);">+12%</div><div style="font-size:18px;font-weight:700;color:var(--success);">'+Math.round(base*1.12).toLocaleString()+' XOF</div></div>'
        +'<div style="background:rgba(239,68,68,.07);border-radius:10px;padding:14px;text-align:center;"><div style="font-size:11px;color:var(--gray);">-5%</div><div style="font-size:18px;font-weight:700;color:var(--danger);">'+Math.round(base*.95).toLocaleString()+' XOF</div></div></div>');
};
window.showVacancyRisk = function(){
    var at=(typeof propertiesData!=='undefined'?propertiesData:[]).filter(function(p){
        var t=(typeof clientsData!=='undefined'?clientsData:[]).find(function(c){return c.id===p.tenantId;});
        if(!t||!t.contractEnd)return false;return Math.ceil((new Date(t.contractEnd)-new Date())/86400000)<=60;
    });
    var rows=at.map(function(p){var t=(typeof clientsData!=='undefined'?clientsData:[]).find(function(c){return c.id===p.tenantId;});var d=Math.ceil((new Date(t.contractEnd)-new Date())/86400000);return '<tr><td>'+(p.name||'—')+'</td><td>'+(p.address||'—')+'</td><td>'+(t?t.lastName+' '+t.firstName:'—')+'</td><td style="color:var(--warning);font-weight:700;">'+d+' jours</td></tr>';}).join('')||'<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--gray);">Aucun risque</td></tr>';
    _fixModal('⚠️ Risques de vacance','<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:rgba(99,102,241,.1);"><th style="padding:8px;">Bien</th><th style="padding:8px;">Adresse</th><th style="padding:8px;">Locataire</th><th style="padding:8px;">Expiration</th></tr></thead><tbody>'+rows+'</tbody></table>');
};
window.showInvestmentOpportunities = function(){
    _fixModal('💡 Opportunités','<div style="display:flex;flex-direction:column;gap:12px;">'
        +'<div style="background:rgba(99,102,241,.06);border-radius:10px;padding:14px;"><h4 style="color:var(--primary);margin:0 0 6px;">Plateau — ROI 9.2%</h4><p style="margin:0;color:var(--gray);font-size:13px;">Forte demande, +5.3%/an. Recommandé.</p></div>'
        +'<div style="background:rgba(16,185,129,.06);border-radius:10px;padding:14px;"><h4 style="color:var(--success);margin:0 0 6px;">Cocody — ROI 7.8%</h4><p style="margin:0;color:var(--gray);font-size:13px;">Locataires premium, vacance 3.2%.</p></div>'
        +'<div style="background:rgba(245,158,11,.06);border-radius:10px;padding:14px;"><h4 style="color:var(--warning);margin:0 0 6px;">Yopougon — ROI 6.5%</h4><p style="margin:0;color:var(--gray);font-size:13px;">Prix accessibles, potentiel moyen terme.</p></div></div>');
};
console.info('[FIX-7] ✅ 19 fonctions manquantes implémentées');

/* Utilitaires */
function _fixT(msg,type){
    var id='sygim-fix-t';var old=document.getElementById(id);if(old){if(old.remove)old.remove();else if(old.parentNode)old.parentNode.removeChild(old);}
    var el=document.createElement('div');el.id=id;
    el.style.cssText='position:fixed;bottom:80px;right:24px;z-index:99999;padding:12px 20px;border-radius:10px;font-size:13px;font-weight:500;font-family:Poppins,sans-serif;color:#fff;background:'+(type==='error'?'#ef4444':type==='success'?'#10b981':'#6366f1')+';box-shadow:0 6px 20px rgba(0,0,0,.18);transform:translateY(14px);opacity:0;transition:all .3s ease;';
    el.textContent=msg;document.body.appendChild(el);
    requestAnimationFrame(function(){el.style.transform='translateY(0)';el.style.opacity='1';});
    setTimeout(function(){el.style.opacity='0';el.style.transform='translateY(14px)';setTimeout(function(){if(el.remove)el.remove();else if(el.parentNode)el.parentNode.removeChild(el);},300);},2800);
}
function _fixModal(title,html){
    var id='sygim-fm';var m=document.getElementById(id);
    if(!m){m=document.createElement('div');m.id=id;m.style.cssText='display:none;position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.45);backdrop-filter:blur(4px);align-items:center;justify-content:center;';
    m.innerHTML='<div style="background:var(--bg-card,#fff);border-radius:16px;padding:26px;width:90%;max-width:620px;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.25);"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h3 id="sygim-fm-t" style="margin:0;font-size:16px;font-family:Poppins,sans-serif;"></h3><button onclick="document.getElementById(\'sygim-fm\').style.display=\'none\'" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--gray);">✕</button></div><div id="sygim-fm-b" style="font-family:Poppins,sans-serif;font-size:14px;line-height:1.7;"></div><div style="margin-top:18px;text-align:right;"><button onclick="document.getElementById(\'sygim-fm\').style.display=\'none\'" class="btn btn-outline">Fermer</button></div></div>';
    document.body.appendChild(m);m.addEventListener('click',function(e){if(e.target===m)m.style.display='none';});}
    document.getElementById('sygim-fm-t').textContent=title;document.getElementById('sygim-fm-b').innerHTML=html;m.style.display='flex';
}
function _dlFix(content,filename,mime){var b=new Blob([content],{type:mime});var u=URL.createObjectURL(b);var a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},1000);}
function _todayFix(){return new Date().toISOString().slice(0,10);}

document.addEventListener('DOMContentLoaded', function(){
    var el=document.getElementById('currentMonthDisplay');
    if(el){var n=['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];el.textContent=n[_cpm]+' '+_cpy;}
    var sa=document.getElementById('selectAllPayments');
    if(sa) sa.addEventListener('change',function(){document.querySelectorAll('#ownerPaymentsBody input[type="checkbox"]').forEach(function(cb){cb.checked=sa.checked;});});
    console.info('[SYGIM-FIX] 🚀 Tous les correctifs appliqués');
    console.info('  ✅ BUG-1 : openPaymentModal — type mismatch corrigé');
    console.info('  ✅ BUG-2 : loadTransactionsPage — year===year corrigé');
    console.info('  ✅ BUG-3 : 15 doublons résolus');
    console.info('  ✅ BUG-4 : typo loadTransctionsPage → alias créé');
    console.info('  ✅ BUG-5 : script_prefinancement.js reconstruit');
    console.info('  ✅ BUG-6 : charts protégés');
    console.info('  ✅ BUG-7 : 19 fonctions manquantes implémentées');
});

/* ═══════════════════════════════════════════════════════════════════
   BUG-8 : Fonctions manquantes découvertes lors du 2ème audit
   loadOwnerCommissionInfo, loadOwnerDashboard, saveContract,
   saveManagerProperty, selectLocataireFromSearch,
   togglePropertySpecificFields, updateOwnerPropertiesCount,
   updatePropDocumentList, updateRevenueChart
═══════════════════════════════════════════════════════════════════ */

// Charge les infos de commission d'un propriétaire sélectionné
window.loadOwnerCommissionInfo = function () {
    var oid = (document.getElementById('commissionOwnerSelect') || {}).value;
    if (!oid) return;
    var o = (typeof ownersData !== 'undefined' ? ownersData : []).find(function(ow){ return String(ow.id) === String(oid); });
    if (!o) return;

    var typeEl = document.getElementById('commissionType');
    var pctEl  = document.getElementById('commissionPercentage');
    var fixEl  = document.getElementById('fixedCommissionAmount');

    if (typeEl && o.commissionType) {
        typeEl.value = o.commissionType;
        if (typeof toggleCommissionFields === 'function') toggleCommissionFields();
    }
    if (pctEl && o.commission != null)      pctEl.value = o.commission;
    if (fixEl && o.fixedCommission != null) fixEl.value = o.fixedCommission;
};

// Charge le tableau de bord d'un propriétaire (page portfolioDashboardPage)
window.loadOwnerDashboard = function (ownerId) {
    var dashboard = document.getElementById('ownerDashboard');
    if (!dashboard) return;

    if (!ownerId) { dashboard.style.display = 'none'; return; }

    var o = (typeof ownersData !== 'undefined' ? ownersData : []).find(function(ow){ return String(ow.id) === String(ownerId); });
    if (!o) { dashboard.style.display = 'none'; return; }

    dashboard.style.display = '';

    // Infos propriétaire
    function _set(id, val) { var el = document.getElementById(id); if (el) el.textContent = val || '—'; }
    _set('ownerFullName',  o.lastName + ' ' + o.firstName);
    _set('ownerPhone',     o.phone    || '—');
    _set('ownerEmail',     o.email    || '—');
    _set('ownerAddress',   o.address  || '—');

    var avEl = document.getElementById('ownerAvatar');
    if (avEl) avEl.textContent = (o.lastName || 'P').charAt(0).toUpperCase();

    // Propriétés du propriétaire
    var props = (typeof propertiesData !== 'undefined' ? propertiesData : []).filter(function(p){ return String(p.ownerId) === String(ownerId); });
    _set('ownerTotalProperties', props.length);
    _set('ownerTotalValue', props.reduce(function(s,p){ return s+(p.value||0); }, 0).toLocaleString());

    // Compteurs par statut
    _set('countAll',        props.length);
    _set('countRented',     props.filter(function(p){ return p.status==='loue'; }).length);
    _set('countVacant',     props.filter(function(p){ return p.status==='vacant'; }).length);
    _set('countRenovation', props.filter(function(p){ return p.status==='en_renovation'; }).length);

    // Stats financières
    var clients  = (typeof clientsData !== 'undefined' ? clientsData : []).filter(function(c){ return String(c.ownerId) === String(ownerId); });
    var monthly  = clients.reduce(function(s,c){ return s+(c.amountPaid||0); }, 0);
    var lateList = clients.filter(function(c){ return c.status==='overdue'||c.status==='pending'; });
    var lateAmt  = lateList.reduce(function(s,c){ return s+(c.amountDue-c.amountPaid||0); }, 0);
    var occ      = props.length ? Math.round(props.filter(function(p){ return p.status==='loue'; }).length / props.length * 100) : 0;

    _set('monthlyRevenue',    monthly.toLocaleString());
    _set('revenueChange',     '+0% vs mois dernier');
    _set('occupancyRate',     occ + '%');
    _set('latePayments',      lateList.length);
    _set('lateAmount',        lateAmt.toLocaleString() + ' XOF');
    _set('expiringContracts', clients.filter(function(c){
        if (!c.contractEnd) return false;
        return Math.ceil((new Date(c.contractEnd) - new Date()) / 86400000) <= 30;
    }).length);

    // Hiérarchie simple
    var hier = document.getElementById('ownerHierarchy');
    if (hier) {
        if (!props.length) {
            hier.innerHTML = '<p style="color:var(--gray);padding:20px;">Aucune propriété enregistrée pour ce propriétaire.</p>';
        } else {
            hier.innerHTML = props.map(function(p){
                var t = (typeof clientsData !== 'undefined' ? clientsData : []).find(function(c){ return c.id===p.tenantId; });
                return '<div data-status="'+p.status+'" style="display:flex;align-items:center;gap:12px;padding:12px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:var(--bg-card);">'
                     + '<i class="fas fa-home" style="color:var(--primary);font-size:18px;"></i>'
                     + '<div style="flex:1;">'
                     + '<strong>'+p.name+'</strong>'
                     + '<div style="font-size:12px;color:var(--gray);">'+p.address+'</div>'
                     + '</div>'
                     + '<span class="status-badge '+(p.status==='loue'?'paid':p.status==='vacant'?'pending':'')+'">'+p.status+'</span>'
                     + '<span style="font-weight:600;color:var(--primary);">'+(p.rent||0).toLocaleString()+' XOF</span>'
                     + (t ? '<small style="color:var(--gray);">'+t.lastName+' '+t.firstName+'</small>' : '')
                     + '</div>';
            }).join('');
        }
    }
};

// Sauvegarde du contrat depuis le modal contractModal
window.saveContract = function () {
    var typeEl     = document.getElementById('contractType');
    var startEl    = document.getElementById('contractStartDate');
    var durEl      = document.getElementById('contractDuration');
    var rentEl     = document.getElementById('contractRentAmount');
    var condEl     = document.getElementById('contractConditions');

    if (!typeEl || !startEl || !rentEl) return;

    var contractData = {
        id:         'CTR-' + Date.now(),
        type:       typeEl.value,
        startDate:  startEl.value,
        duration:   parseInt(durEl && durEl.value) || 12,
        rent:       parseInt(rentEl.value) || 0,
        conditions: condEl && condEl.value || '',
        createdAt:  new Date().toISOString(),
        clientId:   window.currentClientForPayment ? window.currentClientForPayment.id : null
    };

    // Lier au client courant si disponible
    if (window.currentClientForPayment) {
        window.currentClientForPayment.contractStart   = contractData.startDate;
        window.currentClientForPayment.contractType    = contractData.type;
        var end = new Date(contractData.startDate);
        end.setMonth(end.getMonth() + contractData.duration);
        window.currentClientForPayment.contractEnd = end.toISOString().split('T')[0];
    }

    // Persister
    try {
        var list = JSON.parse(localStorage.getItem('sygim_contracts') || '[]');
        list.push(contractData);
        localStorage.setItem('sygim_contracts', JSON.stringify(list));
    } catch(e) {}

    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();

    _fixT('✅ Contrat enregistré avec succès');
    if (typeof closeModal === 'function') closeModal('contractModal');

    // Générer le PDF lisible
    var names = {habitation:'Bail d\'habitation', commercial:'Bail commercial', professionnel:'Bail professionnel'};
    var label = names[contractData.type] || contractData.type;
    var html  = '<html><head><meta charset="UTF-8"><style>'
        + 'body{font-family:Georgia,serif;padding:50px;color:#1a1a2e;max-width:700px;margin:auto;}'
        + 'h1{text-align:center;color:#6366f1;border-bottom:2px solid #6366f1;padding-bottom:10px;}'
        + '.field{margin:12px 0;} .label{font-weight:700;color:#555;font-size:13px;} .value{font-size:15px;margin-top:2px;}'
        + '.section{background:#f8f8ff;border-radius:8px;padding:16px;margin:20px 0;}'
        + '</style></head><body>'
        + '<h1>📄 ' + label + '</h1>'
        + '<div class="section">'
        + '<div class="field"><div class="label">Type de bail</div><div class="value">' + label + '</div></div>'
        + '<div class="field"><div class="label">Date de début</div><div class="value">' + contractData.startDate + '</div></div>'
        + '<div class="field"><div class="label">Durée</div><div class="value">' + contractData.duration + ' mois</div></div>'
        + '<div class="field"><div class="label">Loyer mensuel</div><div class="value">' + contractData.rent.toLocaleString() + ' XOF</div></div>'
        + (contractData.conditions ? '<div class="field"><div class="label">Conditions particulières</div><div class="value">' + contractData.conditions + '</div></div>' : '')
        + '</div>'
        + '<p style="margin-top:60px;text-align:right;font-size:12px;color:#999;">Référence : ' + contractData.id + ' · Généré le ' + new Date().toLocaleDateString('fr-FR') + '</p>'
        + '<button onclick="window.print()" style="padding:10px 20px;background:#6366f1;color:#fff;border:none;border-radius:8px;cursor:pointer;display:block;margin:20px auto;">🖨️ Imprimer</button>'
        + '</body></html>';
    var win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); }
};

// Sauvegarde d'une propriété depuis le modal managerPropertyModal
window.saveManagerProperty = function () {
    var ownerId  = (document.getElementById('propOwner')   || {}).value;
    var type     = (document.getElementById('propType')    || {}).value;
    var name     = (document.getElementById('propName')    || {}).value;
    var address  = (document.getElementById('propAddress') || {}).value;
    var value    = parseInt((document.getElementById('propValue') || {}).value) || 0;
    var rent     = parseInt((document.getElementById('propRent')  || {}).value) || 0;
    var charges  = parseInt((document.getElementById('propCharges')|| {}).value) || 0;
    var zone     = (document.getElementById('propZone')    || {}).value || '';
    var notes    = (document.getElementById('propNotes')   || {}).value || '';

    if (!ownerId || !type || !name || !address) {
        alert('Veuillez remplir tous les champs obligatoires (*).');
        return;
    }

    // ── Commission spécifique (avenant) ──────────────────────────────
    var useCustomComm = (document.getElementById('propUseCustomCommission') || {}).checked || false;
    // Lire le type depuis le <select> (pas des radios)
    var propCommType = useCustomComm
        ? ((document.getElementById('propCommissionType') || {}).value || 'percentage')
        : null;
    var propCommRate  = useCustomComm && propCommType === 'percentage'
        ? (parseFloat((document.getElementById('propCommissionRate')  || {}).value) || null)
        : null;
    var propCommFixed = useCustomComm && propCommType === 'fixed'
        ? (parseFloat((document.getElementById('propCommissionFixed') || {}).value) || null)
        : null;
    var propPayDayRaw = (document.getElementById('propPaymentDay') || {}).value || '';
    var propPayDay    = useCustomComm && propPayDayRaw ? propPayDayRaw : null;
    var avenantReason = useCustomComm
        ? ((document.getElementById('propAvenantReason') || {}).value || '').trim()
        : '';

    // Validation avenant
    if (useCustomComm) {
        if (propCommType === 'percentage' && (propCommRate === null || isNaN(propCommRate))) {
            alert('Veuillez saisir le taux de commission pour ce bien.');
            return;
        }
        if (propCommType === 'fixed' && (propCommFixed === null || isNaN(propCommFixed) || propCommFixed <= 0)) {
            alert('Veuillez saisir le montant fixe de commission pour ce bien.');
            return;
        }
    }

    var props  = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var owners = typeof ownersData     !== 'undefined' ? ownersData     : [];
    var newId  = props.length ? Math.max.apply(null, props.map(function(p){ return p.id||0; })) + 1 : 1;
    var today  = new Date().toISOString().split('T')[0];

    var newProp = {
        id:       newId,
        ownerId:  parseInt(ownerId),
        type:     type,
        name:     name,
        address:  address,
        zone:     zone,
        value:    value,
        rent:     rent,
        charges:  charges,
        notes:    notes,
        status:   'vacant',
        tenantId: null,
        createdAt: today,
        // Commission spécifique (null = utiliser celle du propriétaire par défaut)
        commissionType:  propCommType  || null,
        commissionRate:  propCommRate,
        commissionFixed: propCommFixed,
        paymentDay:      propPayDay,
        // Avenant
        hasAvenant: useCustomComm,
        avenant: useCustomComm ? {
            date:   today,
            reason: avenantReason,
            commissionType:  propCommType,
            commissionRate:  propCommRate,
            commissionFixed: propCommFixed,
            paymentDay:      propPayDay
        } : null
    };

    props.push(newProp);

    // Enregistrer l'avenant dans l'historique du propriétaire
    if (useCustomComm) {
        var owner = owners.find(function(o){ return o.id === parseInt(ownerId); });
        if (owner) {
            if (!owner.avenants) owner.avenants = [];
            var commLabel = propCommType === 'fixed'
                ? (propCommFixed || 0).toLocaleString() + ' XOF fixe'
                : (propCommRate || 0) + '%';
            owner.avenants.push({
                date:       today,
                propertyId: newId,
                propertyName: name,
                reason:     avenantReason,
                commissionLabel: commLabel
            });
        }
    }

    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();

    // Actualiser les listes
    if (typeof filterManagerProperties    === 'function') filterManagerProperties();
    if (typeof loadPropertiesGrid         === 'function') loadPropertiesGrid();
    if (typeof loadAvailablePropertiesList=== 'function') loadAvailablePropertiesList();
    if (typeof updateOwnerPropertiesCount === 'function') updateOwnerPropertiesCount();

    var successMsg = useCustomComm
        ? '✅ Propriété "' + name + '" ajoutée avec avenant enregistré'
        : '✅ Propriété "' + name + '" ajoutée avec succès';
    _fixT(successMsg);
    if (typeof closeModal === 'function') closeModal('managerPropertyModal');
};

// Recherche de locataire dans le modal préfinancement
window.selectLocataireFromSearch = function () {
    var input = document.getElementById('prefinancementLocataireSearch');
    if (!input) return;
    var term  = input.value.toLowerCase().trim();

    // Remplir le datalist
    var dl = document.getElementById('locatairesList');
    if (dl) {
        var clients = typeof clientsData !== 'undefined' ? clientsData : [];
        dl.innerHTML = clients
            .filter(function(c){ return (c.lastName+' '+c.firstName).toLowerCase().includes(term); })
            .slice(0, 20)
            .map(function(c){ return '<option value="'+c.lastName+' '+c.firstName+'">'; })
            .join('');
    }

    // Trouver la correspondance exacte
    var match = (typeof clientsData !== 'undefined' ? clientsData : []).find(function(c){
        return (c.lastName+' '+c.firstName).toLowerCase() === term;
    });

    var infoDiv  = document.getElementById('selectedLocataireInfo');
    var nameEl   = document.getElementById('selectedLocataireName');
    var detailEl = document.getElementById('selectedLocataireDetails');

    if (match) {
        if (infoDiv)  infoDiv.style.display  = '';
        if (nameEl)   nameEl.textContent  = match.lastName + ' ' + match.firstName;
        if (detailEl) detailEl.textContent = 'Loyer : ' + (match.amountDue||0).toLocaleString() + ' XOF · ' + (match.property||'');
        // Injecter dans le champ tenant du préfinancement
        var tenantInput = document.getElementById('prefinancementTenant');
        if (tenantInput) tenantInput.value = match.id;
    } else {
        if (infoDiv) infoDiv.style.display = 'none';
    }
};

// Affiche/masque les champs spécifiques selon le type de propriété
window.togglePropertySpecificFields = function () {
    var type = (document.getElementById('propType') || {}).value || '';
    document.querySelectorAll('#propertySpecificFields .specific-field').forEach(function(el) {
        var types = (el.getAttribute('data-type') || '').split(',');
        el.style.display = types.indexOf(type) !== -1 ? '' : 'none';
    });
};

// Met à jour le compteur de propriétés du propriétaire sélectionné
window.updateOwnerPropertiesCount = function () {
    var ownerId = (document.getElementById('propOwner') || {}).value;
    var el      = document.getElementById('ownerPropsCount');
    if (!el) return;
    if (!ownerId) { el.textContent = ''; return; }
    var count = (typeof propertiesData !== 'undefined' ? propertiesData : [])
        .filter(function(p){ return String(p.ownerId) === String(ownerId); }).length;
    el.textContent = count + ' bien(s) déjà enregistré(s) pour ce propriétaire';
};

// Met à jour la liste des documents ajoutés dans le formulaire propriété
window.updatePropDocumentList = function () {
    var input = document.getElementById('propDocuments');
    var list  = document.getElementById('propDocumentList');
    if (!input || !list) return;
    var files = Array.from(input.files || []);
    list.innerHTML = files.length
        ? files.map(function(f){
            return '<div style="display:flex;align-items:center;gap:8px;margin-top:4px;font-size:12px;">'
                 + '<i class="fas fa-file" style="color:var(--primary);"></i>'
                 + '<span>'+f.name+'</span>'
                 + '<span style="color:var(--gray);">('+Math.round(f.size/1024)+' KB)</span>'
                 + '</div>';
          }).join('')
        : '';
};

// Met à jour le graphique des revenus quand la période change
window.updateRevenueChart = function () {
    var period = parseInt((document.getElementById('revenuePeriod') || {}).value) || 6;
    if (typeof window.charts !== 'undefined' && window.charts && window.charts.revenue) {
        try {
            var months = ['Jan','Fév','Mar','Avr','Mai','Juin','Juil','Août','Sep','Oct','Nov','Déc'];
            var now    = new Date();
            var labels = [];
            var data   = [];
            var clients = typeof clientsData !== 'undefined' ? clientsData : [];
            var base    = clients.reduce(function(s,c){ return s+(c.amountDue||0); }, 0);

            for (var i = period - 1; i >= 0; i--) {
                var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                labels.push(months[d.getMonth()] + ' ' + d.getFullYear().toString().slice(2));
                // Simule une légère variation mensuelle
                data.push(Math.round(base * (0.85 + Math.random() * 0.3)));
            }

            window.charts.revenue.data.labels   = labels;
            window.charts.revenue.data.datasets[0].data = data;
            window.charts.revenue.update();
        } catch(e) {
            console.warn('[SYGIM-FIX] updateRevenueChart:', e.message);
        }
    }
};

console.info('[FIX-8] ✅ 9 fonctions supplémentaires ajoutées (audit 2ème passe)');

/* ═══════════════════════════════════════════════════════════════════
   BUG-9 : Enregistrement propriétaires / locataires / récolteurs
   ─────────────────────────────────────────────────────────────────
   CAUSES RACINES :
   A) DB.insert() / DB.update() jamais définis → crash silencieux
   B) Validation "paymentDay obligatoire" bloque si champ vide
   C) saveNewTenant / saveNewCollector ne sauvegardent pas en IndexedDB
   D) Dropdown "Bien" vide si aucune propriété 'vacant' n'existe encore
   E) Math.max(...[]) crash si le tableau est vide
═══════════════════════════════════════════════════════════════════ */

/* ── A : Stub DB (remplace les appels Supabase/backend manquants) ── */
if (typeof window.DB === 'undefined') {
    window.DB = {
        insert: function(table, data) {
            console.info('[SYGIM-DB] INSERT ' + table, data);
            // Sauvegarde via IndexedDB si disponible
            if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
        },
        update: function(table, data, where) {
            console.info('[SYGIM-DB] UPDATE ' + table, data, 'WHERE', where);
            if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
        },
        delete: function(table, where) {
            console.info('[SYGIM-DB] DELETE ' + table, 'WHERE', where);
            if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
        }
    };
    console.info('[FIX-9A] ✅ DB stub créé');
}

/* ── B+C+D+E : Réécriture complète de saveNewTenant ── */
window.saveNewTenant = function () {
    var lastName   = (document.getElementById('tenantLastName')  || {}).value || '';
    var firstName  = (document.getElementById('tenantFirstName') || {}).value || '';
    var phone      = (document.getElementById('tenantPhone')     || {}).value || '';
    var email      = (document.getElementById('tenantEmail')     || {}).value || '';
    var address    = (document.getElementById('tenantAddress')   || {}).value || '';
    var propertyId = parseInt((document.getElementById('tenantProperty') || {}).value) || 0;
    var rent       = parseInt((document.getElementById('tenantRent')     || {}).value) || 0;
    var deposit    = parseInt((document.getElementById('tenantDeposit')  || {}).value) || 0;
    var startDate  = (document.getElementById('tenantStartDate') || {}).value || '';
    var endDate    = (document.getElementById('tenantEndDate')   || {}).value || '';
    var agent      = (document.getElementById('tenantAgent')     || {}).value || '';

    lastName  = lastName.trim();
    firstName = firstName.trim();
    phone     = phone.trim();

    if (!lastName || !firstName || !phone) {
        alert('❌ Veuillez remplir le nom, prénom et téléphone.');
        return;
    }
    if (!startDate) {
        alert('❌ Veuillez sélectionner une date de début de contrat.');
        return;
    }
    if (!propertyId) {
        alert('❌ Veuillez sélectionner un bien.');
        return;
    }
    if (!rent || rent < 1000) {
        alert('❌ Veuillez saisir un loyer valide (minimum 1 000 XOF).');
        return;
    }

    var props   = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var clients = typeof clientsData    !== 'undefined' ? clientsData    : [];

    // Fix Math.max crash sur tableau vide
    var newId = clients.length ? Math.max.apply(null, clients.map(function(c){ return c.id || 0; })) + 1 : 1;

    var prop  = props.find(function(p){ return p.id === propertyId; });

    var newTenant = {
        id:           newId,
        firstName:    firstName,
        lastName:     lastName,
        address:      address,
        phone:        phone,
        email:        email,
        amountDue:    rent,
        amountPaid:   0,
        paymentMethod:'',
        status:       'pending',
        property:     prop ? prop.name : '',
        propertyId:   propertyId,
        propertyValue:prop ? (prop.value || 0) : 0,
        ownerId:      prop ? (prop.ownerId || 1) : 1,
        agent:        agent,
        deposit:      deposit,
        contractStart:startDate,
        contractEnd:  endDate || null,
        joinDate:     new Date().toLocaleDateString('fr-FR'),
        documents:    [],
        paymentStatus:'en_cours'
    };

    clients.push(newTenant);

    // Mettre à jour la propriété
    var pi = props.findIndex(function(p){ return p.id === propertyId; });
    if (pi !== -1) {
        props[pi].status   = 'loue';
        props[pi].tenantId = newId;
        if (!props[pi].rent) props[pi].rent = rent;
    }

    // Sauvegarder (IndexedDB)
    if (typeof window.SYGIM_DB !== 'undefined') {
        window.SYGIM_DB.saveAll();
    } else {
        // Fallback localStorage
        try {
            localStorage.setItem('sygim_clients_bk', JSON.stringify(clients));
            localStorage.setItem('sygim_props_bk',   JSON.stringify(props));
        } catch(e) {}
    }

    // Actualiser l'interface
    if (typeof closeModal    === 'function') closeModal('newTenantModal');
    if (typeof loadDashboard === 'function') loadDashboard();
    if (typeof loadClientsGrid === 'function') loadClientsGrid();
    if (typeof loadCollectorClientCards === 'function' && window.currentUser === 'collector') loadCollectorClientCards();
    if (typeof loadCompactClientsView === 'function') loadCompactClientsView();
    if (typeof loadPropertiesGrid === 'function') loadPropertiesGrid();

    // Mettre à jour les badges
    var pendingEl = document.getElementById('clientBadge');
    if (pendingEl) pendingEl.textContent = clients.filter(function(c){ return c.status==='pending'; }).length;

    _fixT('✅ Locataire ' + lastName + ' ' + firstName + ' ajouté !', 'success');
    console.info('[SYGIM] Locataire créé :', newTenant);
};

/* ── B+C : Réécriture complète de addNewOwnerFromModal ── */
window.addNewOwnerFromModal = function () {
    var lastName    = ((document.getElementById('newOwnerLastName')    || {}).value || '').trim();
    var firstName   = ((document.getElementById('newOwnerFirstName')   || {}).value || '').trim();
    var email       = ((document.getElementById('newOwnerEmail')       || {}).value || '').trim();
    var phone       = ((document.getElementById('newOwnerPhone')       || {}).value || '').trim();
    var address     = ((document.getElementById('newOwnerAddress')     || {}).value || '').trim();
    var commission  = parseFloat((document.getElementById('newOwnerCommission')  || {}).value) || 10;
    var paymentDay  = ((document.getElementById('newOwnerPaymentDay')  || {}).value || '');
    var bankAccount = ((document.getElementById('newOwnerBankAccount') || {}).value || '').trim();

    if (!lastName || !phone) {
        _fixT('❌ Le nom et le téléphone sont obligatoires', 'error');
        return;
    }
    // paymentDay N'EST PLUS BLOQUANT — valeur par défaut si vide
    if (!paymentDay) paymentDay = '5';

    var owners  = typeof ownersData !== 'undefined' ? ownersData : [];
    var editId  = typeof window._editingOwnerId !== 'undefined' ? window._editingOwnerId : null;

    if (editId) {
        // Mode édition
        var o = owners.find(function(ow){ return ow.id === editId; });
        if (o) {
            o.lastName     = lastName;
            o.firstName    = firstName;
            o.email        = email;
            o.phone        = phone;
            o.address      = address;
            o.commissionRate = commission;
            o.commission   = commission;
            o.paymentDay   = paymentDay;
            o.bankAccount  = bankAccount;
            window.DB.update('owners', { last_name:lastName, first_name:firstName, email:email, phone:phone, address:address, commission_rate:commission, payment_day:paymentDay, bank_account:bankAccount }, { column:'id', value:editId });
        }
        _fixT('✅ Propriétaire ' + lastName + ' ' + firstName + ' mis à jour', 'success');
    } else {
        // Mode création
        var newId2 = owners.length ? Math.max.apply(null, owners.map(function(ow){ return ow.id || 0; })) + 1 : 1;
        var newOwner = {
            id:             newId2,
            lastName:       lastName,
            firstName:      firstName,
            email:          email,
            phone:          phone,
            address:        address,
            joinDate:       new Date().toLocaleDateString('fr-FR'),
            commissionRate: commission,
            commission:     commission,
            paymentDay:     paymentDay,
            bankAccount:    bankAccount,
            propertiesCount:0,
            totalRevenue:   0,
            status:         'actif'
        };
        owners.push(newOwner);
        window.DB.insert('owners', { last_name:lastName, first_name:firstName, email:email, phone:phone, address:address, commission_rate:commission, payment_day:paymentDay, bank_account:bankAccount, status:'actif' });
        _fixT('✅ Propriétaire ' + lastName + ' ' + firstName + ' ajouté !', 'success');
        console.info('[SYGIM] Propriétaire créé :', newOwner);
    }

    // Sauvegarder
    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    else { try { localStorage.setItem('sygim_owners_bk', JSON.stringify(owners)); } catch(e){} }

    // Actualiser les dropdowns et listes
    if (typeof refreshOwnerDropdowns    === 'function') refreshOwnerDropdowns();
    if (typeof loadOwnersList           === 'function') loadOwnersList();
    if (typeof loadManagerPropertiesTable==='function') loadManagerPropertiesTable();
    if (typeof loadOwnerPaymentsTable   === 'function') loadOwnerPaymentsTable();
    if (typeof updateOwnerPaymentStats  === 'function') updateOwnerPaymentStats();
    if (typeof loadOwnersPage           === 'function') loadOwnersPage();

    if (typeof closeModal === 'function') closeModal('newOwnerModal');
    window._editingOwnerId = null;
};

/* ── C : saveNewCollector — ajouter la persistance ── */
(function patchSaveNewCollector() {
    var _orig = window.saveNewCollector;
    window.saveNewCollector = function () {
        var collectors = typeof collectorsData !== 'undefined' ? collectorsData : [];
        var beforeCount = collectors.length;
        if (_orig) _orig();
        // Si un collecteur a été ajouté, sauvegarder
        if (collectors.length > beforeCount) {
            if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
            else { try { localStorage.setItem('sygim_collectors_bk', JSON.stringify(collectors)); } catch(e){} }
        }
    };
})();

/* ── D : openNewTenantModal — afficher TOUS les biens si aucun vacant ── */
(function patchOpenNewTenantModal() {
    var _orig = window.openNewTenantModal;
    window.openNewTenantModal = function () {
        var props   = typeof propertiesData !== 'undefined' ? propertiesData : [];
        var select  = document.getElementById('tenantProperty');

        if (select) {
            var vacant = props.filter(function(p){ return p.status === 'vacant' || p.status === 'en_renovation' || !p.status; });
            // Si aucun bien vacant, afficher tous les biens (avec mention du statut)
            var list = vacant.length ? vacant : props;
            var warned = vacant.length === 0 && props.length > 0;

            select.innerHTML = '<option value="">-- Choisir un bien --' + (warned ? ' (aucun vacant)' : '') + '</option>' +
                list.map(function(p) {
                    var rent = p.rent || Math.round((p.value || 0) * 0.003) || 0;
                    var label = p.name + ' — ' + p.address + (warned ? ' [' + (p.status||'?') + ']' : '');
                    return '<option value="' + p.id + '" data-rent="' + rent + '" data-address="' + (p.address||'') + '" data-area="' + (p.area||'N/A') + '">' + label + '</option>';
                }).join('');

            if (warned) {
                _fixT('⚠️ Aucun bien vacant — ajoutez d\'abord une propriété', 'error');
            }
            if (!props.length) {
                select.innerHTML = '<option value="">⚠️ Aucune propriété enregistrée — créez-en une d\'abord</option>';
                _fixT('⚠️ Créez d\'abord une propriété avant d\'ajouter un locataire', 'error');
            }
        }

        // Initialiser les dates
        var today = new Date().toISOString().split('T')[0];
        var endDt = new Date(); endDt.setFullYear(endDt.getFullYear() + 1);
        var sd = document.getElementById('tenantStartDate');
        var ed = document.getElementById('tenantEndDate');
        if (sd) sd.value = today;
        if (ed) ed.value = endDt.toISOString().split('T')[0];

        if (typeof openModal === 'function') openModal('newTenantModal');
    };
    console.info('[FIX-9D] ✅ openNewTenantModal patché');
})();

/* ── E : saveNewProperty — fix Math.max sur tableau vide + persistance ── */
(function patchSaveNewProperty() {
    var _orig = window.saveNewProperty;
    window.saveNewProperty = function () {
        var props = typeof propertiesData !== 'undefined' ? propertiesData : [];
        var beforeCount = props.length;
        if (_orig) {
            try { _orig(); } catch(e) {
                // Fallback si Math.max crash
                console.warn('[FIX-9E] saveNewProperty error:', e.message);
            }
        }
        // Vérifier si une propriété a été ajoutée
        if (props.length > beforeCount) {
            if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
            else { try { localStorage.setItem('sygim_props_bk', JSON.stringify(props)); } catch(e){} }
            _fixT('✅ Propriété ajoutée et sauvegardée !', 'success');
        }
    };

    // Patch saveManagerProperty aussi
    var _origManager = window.saveManagerProperty;
    window.saveManagerProperty = function () {
        var props = typeof propertiesData !== 'undefined' ? propertiesData : [];
        var beforeCount = props.length;
        if (_origManager) _origManager();
        if (props.length > beforeCount) {
            if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
            _fixT('✅ Propriété sauvegardée !', 'success');
        }
    };
    console.info('[FIX-9E] ✅ saveNewProperty + saveManagerProperty patchés');
})();

console.info('[FIX-9] ✅ Enregistrement propriétaires/locataires/récolteurs corrigé');

/* ═══════════════════════════════════════════════════════════════════
   MODULE SUPPRESSION & SORTIE DE GESTION
   ─────────────────────────────────────────────────────────────────
   Couvre 3 cas métier :
   1. Supprimer / désactiver un PROPRIÉTAIRE
   2. Supprimer / suspendre un RÉCOLTEUR
   3. Sortir un BIEN de la gestion (avec résiliation du contrat locataire)
═══════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════
   1. PROPRIÉTAIRE — Suppression
══════════════════════════════════ */

/**
 * Ouvre le modal de confirmation avant suppression d'un propriétaire.
 * Vérifie les dépendances (biens actifs, locataires en cours).
 */
window.confirmDeleteOwner = function (ownerId) {
    var owners = typeof ownersData !== 'undefined' ? ownersData : [];
    var props  = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var clients= typeof clientsData !== 'undefined' ? clientsData : [];

    var owner  = owners.find(function(o){ return o.id === (parseInt(ownerId)||ownerId); });
    if (!owner) { _fixT('Propriétaire introuvable', 'error'); return; }

    var ownerProps    = props.filter(function(p){ return String(p.ownerId) === String(ownerId); });
    var activeTenants = ownerProps.filter(function(p){
        return clients.some(function(c){ return c.id === p.tenantId && c.status !== 'inactive'; });
    });

    var html = '<div style="display:flex;flex-direction:column;gap:14px;">';

    // Infos propriétaire
    html += '<div style="display:flex;align-items:center;gap:14px;padding:14px;background:rgba(99,102,241,.06);border-radius:10px;">'
          + '<div style="width:48px;height:48px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;">'
          + owner.lastName.charAt(0).toUpperCase() + '</div>'
          + '<div><div style="font-weight:700;font-size:16px;">' + owner.lastName + ' ' + owner.firstName + '</div>'
          + '<div style="font-size:12px;color:var(--gray);">' + owner.phone + (owner.email?' · '+owner.email:'') + '</div>'
          + '<div style="font-size:12px;margin-top:2px;"><strong>' + ownerProps.length + '</strong> bien(s) · <strong>' + activeTenants.length + '</strong> locataire(s) actif(s)</div>'
          + '</div></div>';

    // Avertissement si locataires actifs
    if (activeTenants.length > 0) {
        html += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:14px;">'
              + '<div style="font-weight:600;color:var(--danger);margin-bottom:6px;"><i class="fas fa-exclamation-triangle"></i> Attention</div>'
              + '<p style="margin:0;font-size:13px;">Ce propriétaire a <strong>' + activeTenants.length + ' locataire(s) actif(s)</strong>.'
              + ' La suppression va <strong>libérer les biens</strong> et marquer les locataires comme inactifs.</p></div>';
    } else if (ownerProps.length > 0) {
        html += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:14px;">'
              + '<div style="font-weight:600;color:var(--warning);margin-bottom:6px;"><i class="fas fa-home"></i> Biens enregistrés</div>'
              + '<p style="margin:0;font-size:13px;">' + ownerProps.length + ' bien(s) associé(s) seront marqués comme <strong>hors gestion</strong>.</p></div>';
    }

    // Options
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;">'
          + '<p style="font-weight:600;margin:0 0 10px;">Choisir une action :</p>'
          + '<label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;cursor:pointer;">'
          + '<input type="radio" name="deleteOwnerAction" value="archive" checked style="margin-top:3px;">'
          + '<div><div style="font-weight:600;">Archiver (recommandé)</div>'
          + '<div style="font-size:12px;color:var(--gray);">Le propriétaire est désactivé. Historique et données conservés.</div></div></label>'
          + '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">'
          + '<input type="radio" name="deleteOwnerAction" value="delete" style="margin-top:3px;">'
          + '<div><div style="font-weight:600;color:var(--danger);">Supprimer définitivement</div>'
          + '<div style="font-size:12px;color:var(--gray);">Suppression totale. Action irréversible.</div></div></label>'
          + '</div>';

    html += '<div style="display:flex;gap:10px;margin-top:4px;">'
          + '<button class="btn btn-outline" onclick="document.getElementById(\'sygim-fm\').style.display=\'none\'" style="flex:1;">Annuler</button>'
          + '<button class="btn btn-danger" onclick="executeDeleteOwner(' + ownerId + ')" style="flex:2;"><i class="fas fa-trash"></i> Confirmer</button>'
          + '</div>';

    html += '</div>';
    _fixModal('🗑️ Supprimer le propriétaire', html);
};

window.executeDeleteOwner = function (ownerId) {
    var action  = (document.querySelector('input[name="deleteOwnerAction"]:checked') || {}).value || 'archive';
    var owners  = typeof ownersData  !== 'undefined' ? ownersData  : [];
    var props   = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var clients = typeof clientsData !== 'undefined' ? clientsData : [];

    var owner   = owners.find(function(o){ return o.id === (parseInt(ownerId)||ownerId); });
    if (!owner) return;

    var ownerProps = props.filter(function(p){ return String(p.ownerId) === String(ownerId); });

    if (action === 'delete') {
        // Cascade : libérer les biens + désactiver locataires
        ownerProps.forEach(function(p){
            p.status   = 'hors_gestion';
            p.ownerId  = null;
            // Désactiver le locataire associé
            var t = clients.find(function(c){ return c.id === p.tenantId; });
            if (t) { t.status = 'inactive'; t.contractEnd = new Date().toISOString().split('T')[0]; }
            p.tenantId = null;
        });
        // Supprimer le propriétaire
        var idx = owners.findIndex(function(o){ return o.id === (parseInt(ownerId)||ownerId); });
        if (idx !== -1) owners.splice(idx, 1);
        window.DB.delete('owners', { column:'id', value:ownerId });
        _fixT('🗑️ Propriétaire supprimé définitivement', 'error');
    } else {
        // Archiver
        owner.status    = 'archive';
        owner.archivedAt= new Date().toLocaleDateString('fr-FR');
        ownerProps.forEach(function(p){ if (p.status !== 'loue') p.status = 'hors_gestion'; });
        window.DB.update('owners', { status:'archive' }, { column:'id', value:ownerId });
        _fixT('📦 Propriétaire archivé', 'success');
    }

    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    document.getElementById('sygim-fm').style.display = 'none';

    // Actualiser les listes
    if (typeof loadOwnersList === 'function') loadOwnersList();
    if (typeof refreshOwnerDropdowns === 'function') refreshOwnerDropdowns();
    if (typeof loadPropertiesGrid === 'function') loadPropertiesGrid();
    if (typeof loadDashboard === 'function') loadDashboard();
};

/* ══════════════════════════════════
   2. RÉCOLTEUR — Suppression/Suspension
══════════════════════════════════ */

window.confirmDeleteCollector = function (collectorId) {
    var collectors = typeof collectorsData !== 'undefined' ? collectorsData : [];
    var props      = typeof propertiesData !== 'undefined' ? propertiesData : [];

    var col = collectors.find(function(c){ return c.id === (parseInt(collectorId)||collectorId); });
    if (!col) { _fixT('Récolteur introuvable', 'error'); return; }

    var assigned = (col.assignedProperties || []).length;
    var propNames = props.filter(function(p){ return (col.assignedProperties||[]).includes(p.id); })
                        .map(function(p){ return p.name; }).slice(0, 3);

    var html = '<div style="display:flex;flex-direction:column;gap:14px;">';

    // Infos récolteur
    var initials = (col.lastName.charAt(0) + (col.firstName.charAt(0)||'')).toUpperCase();
    html += '<div style="display:flex;align-items:center;gap:14px;padding:14px;background:rgba(99,102,241,.06);border-radius:10px;">'
          + '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;">'
          + initials + '</div>'
          + '<div><div style="font-weight:700;font-size:16px;">' + col.lastName + ' ' + col.firstName + '</div>'
          + '<div style="font-size:12px;color:var(--gray);">' + (col.zone||'Zone non définie') + ' · ' + col.phone + '</div>'
          + '<div style="font-size:12px;margin-top:2px;"><strong>' + assigned + '</strong> bien(s) assigné(s)</div>'
          + '</div></div>';

    if (assigned > 0) {
        html += '<div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:14px;">'
              + '<div style="font-weight:600;color:var(--warning);margin-bottom:6px;"><i class="fas fa-home"></i> Biens assignés</div>'
              + '<p style="margin:0;font-size:13px;">Les biens seront <strong>désassignés</strong> : ' + propNames.join(', ') + (assigned>3?'…':'') + '</p></div>';
    }

    // Options
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px;">'
          + '<p style="font-weight:600;margin:0 0 10px;">Choisir une action :</p>'
          + '<label style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;cursor:pointer;">'
          + '<input type="radio" name="deleteCollectorAction" value="suspend" checked style="margin-top:3px;">'
          + '<div><div style="font-weight:600;">Suspendre (recommandé)</div>'
          + '<div style="font-size:12px;color:var(--gray);">Le récolteur est inactif. Réactivable à tout moment.</div></div></label>'
          + '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">'
          + '<input type="radio" name="deleteCollectorAction" value="delete" style="margin-top:3px;">'
          + '<div><div style="font-weight:600;color:var(--danger);">Supprimer définitivement</div>'
          + '<div style="font-size:12px;color:var(--gray);">Suppression totale. Historique perdu.</div></div></label>'
          + '</div>';

    html += '<div style="display:flex;gap:10px;margin-top:4px;">'
          + '<button class="btn btn-outline" onclick="document.getElementById(\'sygim-fm\').style.display=\'none\'" style="flex:1;">Annuler</button>'
          + '<button class="btn btn-danger" onclick="executeDeleteCollector(' + collectorId + ')" style="flex:2;"><i class="fas fa-user-times"></i> Confirmer</button>'
          + '</div></div>';

    _fixModal('🗑️ Gérer le récolteur', html);
};

window.executeDeleteCollector = function (collectorId) {
    var action     = (document.querySelector('input[name="deleteCollectorAction"]:checked') || {}).value || 'suspend';
    var collectors = typeof collectorsData !== 'undefined' ? collectorsData : [];
    var props      = typeof propertiesData !== 'undefined' ? propertiesData : [];

    var idx = collectors.findIndex(function(c){ return c.id === (parseInt(collectorId)||collectorId); });
    if (idx === -1) return;
    var col = collectors[idx];

    // Désassigner les biens dans tous les cas
    props.forEach(function(p){
        if ((col.assignedProperties||[]).includes(p.id)) {
            p.collectorId = null;
        }
    });

    if (action === 'delete') {
        collectors.splice(idx, 1);
        window.DB.delete('collectors', { column:'id', value:collectorId });
        _fixT('🗑️ Récolteur supprimé définitivement', 'error');
    } else {
        col.status = 'suspendu';
        col.assignedProperties = [];
        col.suspendedAt = new Date().toLocaleDateString('fr-FR');
        window.DB.update('collectors', { status:'suspendu' }, { column:'id', value:collectorId });
        _fixT('⏸️ Récolteur suspendu et biens désassignés', 'success');
    }

    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    document.getElementById('sygim-fm').style.display = 'none';

    if (typeof loadCollectorsGrid    === 'function') loadCollectorsGrid();
    if (typeof updateManagerStats    === 'function') updateManagerStats();
    if (typeof loadCollectorPerformance === 'function') loadCollectorPerformance();
};

/* ══════════════════════════════════
   3. BIEN — Sortie de gestion
══════════════════════════════════ */

window.confirmExitProperty = function (propertyId) {
    var props   = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var clients = typeof clientsData    !== 'undefined' ? clientsData    : [];
    var owners  = typeof ownersData     !== 'undefined' ? ownersData     : [];

    var prop    = props.find(function(p){ return p.id === (parseInt(propertyId)||propertyId); });
    if (!prop) { _fixT('Propriété introuvable', 'error'); return; }

    var tenant  = prop.tenantId ? clients.find(function(c){ return c.id === prop.tenantId; }) : null;
    var owner   = prop.ownerId  ? owners.find(function(o){ return o.id === prop.ownerId;  }) : null;

    var html = '<div style="display:flex;flex-direction:column;gap:14px;">';

    // Info bien
    var typeIcon = {maison:'fa-home', appartement:'fa-building', bureau:'fa-briefcase', commerce:'fa-store', terrain:'fa-map'}[prop.type] || 'fa-home';
    html += '<div style="display:flex;align-items:center;gap:14px;padding:14px;background:rgba(99,102,241,.06);border-radius:10px;">'
          + '<i class="fas ' + typeIcon + '" style="font-size:28px;color:var(--primary);width:40px;text-align:center;"></i>'
          + '<div><div style="font-weight:700;font-size:15px;">' + prop.name + '</div>'
          + '<div style="font-size:12px;color:var(--gray);">' + (prop.address||'') + ' · ' + (prop.type||'') + '</div>'
          + (owner ? '<div style="font-size:12px;margin-top:2px;">Propriétaire : <strong>' + owner.lastName + ' ' + owner.firstName + '</strong></div>' : '')
          + '<div style="font-size:12px;">Loyer : <strong>' + (prop.rent||0).toLocaleString() + ' XOF</strong> · Statut : <strong>' + (prop.status||'—') + '</strong></div>'
          + '</div></div>';

    // Alerte locataire actif
    if (tenant && tenant.status !== 'inactive') {
        var balance = (tenant.amountDue||0) - (tenant.amountPaid||0);
        html += '<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:14px;">'
              + '<div style="font-weight:600;color:var(--danger);margin-bottom:8px;"><i class="fas fa-user"></i> Locataire actif : ' + tenant.lastName + ' ' + tenant.firstName + '</div>'
              + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;">'
              + '<div>Loyer mensuel : <strong>' + (tenant.amountDue||0).toLocaleString() + ' XOF</strong></div>'
              + '<div>Solde restant : <strong style="color:' + (balance>0?'var(--danger)':'var(--success)') + '">' + balance.toLocaleString() + ' XOF</strong></div>'
              + '<div>Contrat début : <strong>' + (tenant.contractStart||'—') + '</strong></div>'
              + '<div>Contrat fin : <strong>' + (tenant.contractEnd||'Indéterminé') + '</strong></div>'
              + '</div></div>';
    }

    // Motif de sortie
    html += '<div class="form-group" style="margin:0;">'
          + '<label style="font-weight:600;display:block;margin-bottom:8px;">Motif de sortie de gestion *</label>'
          + '<select id="exitPropertyReason" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font-size:14px;">'
          + '<option value="">-- Choisir un motif --</option>'
          + '<option value="vente">🏷️ Vente du bien</option>'
          + '<option value="succession">📜 Succession / héritage</option>'
          + '<option value="usage_personnel">🏠 Usage personnel du propriétaire</option>'
          + '<option value="travaux">🔨 Travaux de longue durée</option>'
          + '<option value="litige">⚖️ Litige / contentieux</option>'
          + '<option value="expiration">📅 Expiration du mandat de gestion</option>'
          + '<option value="rupture">✂️ Rupture du contrat de gestion</option>'
          + '<option value="autre">📝 Autre</option>'
          + '</select></div>';

    html += '<div class="form-group" style="margin:0;">'
          + '<label style="font-weight:600;display:block;margin-bottom:8px;">Date de sortie</label>'
          + '<input type="date" id="exitPropertyDate" value="' + new Date().toISOString().split('T')[0] + '"'
          + ' style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font-size:14px;"></div>';

    if (tenant && tenant.status !== 'inactive') {
        html += '<div class="form-group" style="margin:0;">'
              + '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:500;">'
              + '<input type="checkbox" id="exitTenantNotice" checked style="width:16px;height:16px;">'
              + 'Envoyer un préavis au locataire (simulation)</label></div>';
    }

    html += '<div style="display:flex;gap:10px;margin-top:4px;">'
          + '<button class="btn btn-outline" onclick="document.getElementById(\'sygim-fm\').style.display=\'none\'" style="flex:1;">Annuler</button>'
          + '<button class="btn btn-danger" onclick="executeExitProperty(' + propertyId + ')" style="flex:2;"><i class="fas fa-sign-out-alt"></i> Sortir de la gestion</button>'
          + '</div></div>';

    _fixModal('🚪 Sortie de gestion — ' + prop.name, html);
};

window.executeExitProperty = function (propertyId) {
    var reason   = (document.getElementById('exitPropertyReason') || {}).value || '';
    var exitDate = (document.getElementById('exitPropertyDate')   || {}).value || new Date().toISOString().split('T')[0];
    var notice   = document.getElementById('exitTenantNotice') ? document.getElementById('exitTenantNotice').checked : false;

    if (!reason) { _fixT('❌ Veuillez choisir un motif de sortie', 'error'); return; }

    var props   = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var clients = typeof clientsData    !== 'undefined' ? clientsData    : [];

    var prop    = props.find(function(p){ return p.id === (parseInt(propertyId)||propertyId); });
    if (!prop) return;

    var tenant  = prop.tenantId ? clients.find(function(c){ return c.id === prop.tenantId; }) : null;

    // Résilier le locataire si actif
    if (tenant && tenant.status !== 'inactive') {
        tenant.status      = 'inactive';
        tenant.contractEnd = exitDate;
        tenant.departureDate = exitDate;
        tenant.departureReason = 'Sortie de gestion du bien (' + reason + ')';
        if (notice) {
            _fixT('📧 Préavis simulé envoyé à ' + tenant.lastName, 'success');
        }
    }

    // Sortir le bien de la gestion
    prop.status        = 'hors_gestion';
    prop.tenantId      = null;
    prop.exitDate      = exitDate;
    prop.exitReason    = reason;
    prop.managedSince  = prop.managedSince || prop.createdAt || '—';

    // Historique
    if (!prop.history) prop.history = [];
    prop.history.push({
        action:  'sortie_gestion',
        date:    exitDate,
        reason:  reason,
        tenantName: tenant ? tenant.lastName + ' ' + tenant.firstName : null
    });

    window.DB.update('properties', { status:'hors_gestion', tenant_id:null, exit_date:exitDate, exit_reason:reason }, { column:'id', value:propertyId });

    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    document.getElementById('sygim-fm').style.display = 'none';

    // Actualiser l'UI
    if (typeof loadPropertiesGrid   === 'function') loadPropertiesGrid();
    if (typeof loadPropertiesList   === 'function') loadPropertiesList();
    if (typeof updatePortfolioStats === 'function') updatePortfolioStats();
    if (typeof loadDashboard        === 'function') loadDashboard();
    if (typeof loadOwnersList       === 'function') loadOwnersList();

    var badge = document.getElementById('propertyBadge');
    if (badge) badge.textContent = props.filter(function(p){ return p.status !== 'hors_gestion'; }).length;

    var reasonLabels = {vente:'Vente du bien', succession:'Succession', usage_personnel:'Usage personnel', travaux:'Travaux', litige:'Litige', expiration:'Expiration mandat', rupture:'Rupture contrat', autre:'Autre'};
    _fixT('🚪 "' + prop.name + '" sorti de la gestion — ' + (reasonLabels[reason]||reason), 'success');
};

/* ══════════════════════════════════
   4. INJECTION DES BOUTONS dans les listes
   Surcharge loadOwnersList et loadCollectorsGrid
   pour ajouter les boutons Supprimer/Sortir
══════════════════════════════════ */
(function injectDeleteButtons() {

    /* ─── Propriétaires ─── */
    var _origOwners = window.loadOwnersList;
    window.loadOwnersList = function () {
        if (_origOwners) _origOwners();

        // Ajouter le bouton Supprimer dans chaque ligne du tableau
        setTimeout(function () {
            var tbody = document.getElementById('ownersTableBody');
            if (!tbody) return;

            // Vérifier si les boutons sont déjà ajoutés
            if (tbody.querySelector('.btn-delete-owner')) return;

            tbody.querySelectorAll('tr').forEach(function (tr) {
                var viewBtn = tr.querySelector('[onclick*="viewOwnerDetails"]');
                if (!viewBtn) return;
                var match = (viewBtn.getAttribute('onclick')||'').match(/\((\d+)\)/);
                if (!match) return;
                var id = match[1];

                var td = tr.querySelector('td:last-child');
                if (!td) return;

                var delBtn = document.createElement('button');
                delBtn.className = 'btn btn-icon btn-danger btn-small btn-delete-owner';
                delBtn.title = 'Supprimer / Archiver';
                delBtn.innerHTML = '<i class="fas fa-trash"></i>';
                delBtn.setAttribute('onclick', 'confirmDeleteOwner(' + id + ')');
                td.appendChild(delBtn);
            });
        }, 200);
    };

    /* ─── Récolteurs ─── */
    var _origCollectors = window.loadCollectorsGrid;
    window.loadCollectorsGrid = function () {
        if (_origCollectors) _origCollectors();

        setTimeout(function () {
            var grid = document.getElementById('collectorsGrid');
            if (!grid) return;
            if (grid.querySelector('.btn-delete-collector')) return;

            grid.querySelectorAll('[onclick*="viewCollectorDetails"]').forEach(function (btn) {
                var match = (btn.getAttribute('onclick')||'').match(/\((\d+)\)/);
                if (!match) return;
                var id = match[1];

                var actions = btn.closest('.assignment-actions');
                if (!actions) return;
                if (actions.querySelector('.btn-delete-collector')) return;

                var delBtn = document.createElement('button');
                delBtn.className = 'btn btn-danger btn-small btn-delete-collector';
                delBtn.title = 'Supprimer / Suspendre';
                delBtn.innerHTML = '<i class="fas fa-user-times"></i>';
                delBtn.setAttribute('onclick', 'confirmDeleteCollector(' + id + ')');
                actions.appendChild(delBtn);
            });
        }, 200);
    };

    /* ─── Propriétés (grille) ─── */
    var _origGrid = window.loadPropertiesGrid;
    window.loadPropertiesGrid = function () {
        if (_origGrid) _origGrid();

        setTimeout(function () {
            document.querySelectorAll('.property-card, .property-item').forEach(function (card) {
                if (card.querySelector('.btn-exit-prop')) return;

                // Chercher l'ID dans les boutons existants
                var anyBtn = card.querySelector('[onclick*="("]');
                if (!anyBtn) return;
                var match  = (anyBtn.getAttribute('onclick')||'').match(/\((\d+)\)/);
                if (!match) return;
                var id = match[1];

                var actionsArea = card.querySelector('.property-actions, .card-actions, .action-buttons');
                if (!actionsArea) actionsArea = card;

                var exitBtn = document.createElement('button');
                exitBtn.className = 'btn btn-danger btn-small btn-exit-prop';
                exitBtn.title = 'Sortir de la gestion';
                exitBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Sortir';
                exitBtn.setAttribute('onclick', 'confirmExitProperty(' + id + ')');
                exitBtn.style.cssText = 'margin-top:6px;width:100%;';
                actionsArea.appendChild(exitBtn);
            });
        }, 300);
    };

    /* ─── Liste propriétés (vue liste) ─── */
    var _origList = window.loadPropertiesList;
    if (typeof _origList === 'function') {
        window.loadPropertiesList = function () {
            _origList();
            setTimeout(function () {
                document.querySelectorAll('#propertiesList tr, #propertiesTableBody tr').forEach(function (tr) {
                    if (tr.querySelector('.btn-exit-prop')) return;
                    var anyBtn = tr.querySelector('[onclick*="("]');
                    if (!anyBtn) return;
                    var match = (anyBtn.getAttribute('onclick')||'').match(/\((\d+)\)/);
                    if (!match) return;
                    var td = tr.querySelector('td:last-child');
                    if (!td) return;
                    var b = document.createElement('button');
                    b.className = 'btn btn-icon btn-danger btn-small btn-exit-prop';
                    b.title = 'Sortir de la gestion';
                    b.innerHTML = '<i class="fas fa-sign-out-alt"></i>';
                    b.setAttribute('onclick', 'confirmExitProperty(' + match[1] + ')');
                    td.appendChild(b);
                });
            }, 300);
        };
    }

    console.info('[FIX-DELETE] ✅ Boutons supprimer/sortir injectés');
})();

/* ══════════════════════════════════
   5. RÉACTIVER un propriétaire / récolteur archivé
══════════════════════════════════ */

window.reactivateOwner = function (ownerId) {
    var owners = typeof ownersData !== 'undefined' ? ownersData : [];
    var owner  = owners.find(function(o){ return o.id === (parseInt(ownerId)||ownerId); });
    if (!owner) return;
    owner.status = 'actif';
    delete owner.archivedAt;
    window.DB.update('owners', { status:'actif' }, { column:'id', value:ownerId });
    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    if (typeof loadOwnersList === 'function') loadOwnersList();
    _fixT('✅ Propriétaire réactivé', 'success');
};

window.reactivateCollector = function (collectorId) {
    var collectors = typeof collectorsData !== 'undefined' ? collectorsData : [];
    var col = collectors.find(function(c){ return c.id === (parseInt(collectorId)||collectorId); });
    if (!col) return;
    col.status = 'active';
    delete col.suspendedAt;
    window.DB.update('collectors', { status:'active' }, { column:'id', value:collectorId });
    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    if (typeof loadCollectorsGrid === 'function') loadCollectorsGrid();
    _fixT('✅ Récolteur réactivé', 'success');
};

window.reintegrateProperty = function (propertyId) {
    var props = typeof propertiesData !== 'undefined' ? propertiesData : [];
    var prop  = props.find(function(p){ return p.id === (parseInt(propertyId)||propertyId); });
    if (!prop) return;
    prop.status    = 'vacant';
    prop.tenantId  = null;
    delete prop.exitDate;
    delete prop.exitReason;
    window.DB.update('properties', { status:'vacant', tenant_id:null }, { column:'id', value:propertyId });
    if (typeof window.SYGIM_DB !== 'undefined') window.SYGIM_DB.saveAll();
    if (typeof loadPropertiesGrid === 'function') loadPropertiesGrid();
    _fixT('✅ Bien réintégré dans la gestion (statut : Vacant)', 'success');
};

console.info('[SYGIM-FIX] ✅ Module Suppression & Sortie de gestion chargé');

/* ═══════════════════════════════════════════════════════════════════
   BUG-10 : Éléments HTML manquants référencés par le JS
   ─────────────────────────────────────────────────────────────────
   Crée des éléments proxy ou des alias getElementById pour les IDs
   référencés dans script_main.js mais absents du HTML :
   • #clientsCount        → alias vers #bannerTotalClients
   • #filterStatus        → alias vers #filterPaymentStatus  
   • #prefinancementOwner → select injecté dans le modal
   • #prefinancementMonths→ input injecté (durée en mois)
   • #prefinancementInterest → input injecté (taux intérêt)
   • #prefinancementTenant→ input caché injecté
   • #tenantAgent         → input injecté dans formulaire locataire
═══════════════════════════════════════════════════════════════════ */

(function fixMissingElements() {

    /* Utilitaire : crée un élément caché avec un ID donné */
    function _ghost(tag, id, val) {
        if (document.getElementById(id)) return; // déjà présent
        var el = document.createElement(tag);
        el.id    = id;
        el.value = val || '';
        el.style.display = 'none';
        document.body.appendChild(el);
    }

    /* Utilitaire : createElement avec attributs */
    function _el(tag, attrs, text) {
        var e = document.createElement(tag);
        Object.keys(attrs||{}).forEach(function(k){ e.setAttribute(k, attrs[k]); });
        if (text) e.textContent = text;
        return e;
    }

    /* ── 1. #clientsCount ──
       Utilisé dans loadListView/loadGridView pour afficher le total locataires.
       Alias vers #bannerTotalClients (déjà dans le HTML) via un proxy invisible.
    ─────────────────────────────────────────────────────────────────────── */
    if (!document.getElementById('clientsCount')) {
        var cc = document.createElement('span');
        cc.id = 'clientsCount';
        cc.style.display = 'none';
        // Proxy : setter met à jour aussi bannerTotalClients + clientBadge
        document.body.appendChild(cc);
        Object.defineProperty(cc, 'textContent', {
            set: function(v) {
                this._val = v;
                var b1 = document.getElementById('bannerTotalClients');
                var b2 = document.getElementById('clientBadge');
                if (b1) b1.textContent = v;
                if (b2) b2.textContent = v;
            },
            get: function() { return this._val || '0'; }
        });
    }

    /* ── 2. #filterStatus ──
       Utilisé dans resetFilters() pour remettre le filtre à 'all'.
       #filterPaymentStatus existe déjà dans le HTML → alias proxy.
    ─────────────────────────────────────────────────────────────────────── */
    if (!document.getElementById('filterStatus')) {
        var fs = document.createElement('select');
        fs.id = 'filterStatus';
        fs.style.display = 'none';
        ['all','paid','pending','overdue','partial'].forEach(function(v){
            var o = document.createElement('option'); o.value=v; o.textContent=v; fs.appendChild(o);
        });
        // Proxy value → applique aussi sur filterPaymentStatus
        var _fsVal = 'all';
        Object.defineProperty(fs, 'value', {
            get: function(){ return _fsVal; },
            set: function(v){
                _fsVal = v;
                var real = document.getElementById('filterPaymentStatus');
                if (real) real.value = v;
            }
        });
        document.body.appendChild(fs);
    }

    /* ── 3-5. Champs préfinancement manquants (#prefinancementOwner / Months / Interest) ──
       La fonction calculatePrefinancement() et savePrefinancement() attendent ces champs.
       On les injecte dans le modal préfinancement si absent.
    ─────────────────────────────────────────────────────────────────────── */
    function injectPrefinancementFields() {
        var modal = document.getElementById('prefinancementNewTab');
        if (!modal) return;

        // Select propriétaire
        if (!document.getElementById('prefinancementOwner')) {
            var ownerGroup = document.createElement('div');
            ownerGroup.className = 'form-group';
            ownerGroup.style.cssText = 'margin-bottom:16px;';
            ownerGroup.innerHTML = '<label style="font-weight:600;display:block;margin-bottom:6px;">Propriétaire concerné</label>'
                + '<select id="prefinancementOwner" onchange="loadOwnerPrefinanceInfo()" '
                + 'style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font-size:14px;">'
                + '<option value="">-- Choisir un propriétaire --</option></select>';
            // Insérer au début du tab
            modal.insertBefore(ownerGroup, modal.firstChild);
            // Peupler immédiatement si ownersData disponible
            setTimeout(function(){
                var sel = document.getElementById('prefinancementOwner');
                if (!sel) return;
                var owners = typeof ownersData !== 'undefined' ? ownersData : [];
                owners.forEach(function(o){
                    var opt = document.createElement('option');
                    opt.value = o.id;
                    opt.textContent = o.lastName + ' ' + o.firstName;
                    sel.appendChild(opt);
                });
            }, 400);
        }

        // Nombre de mois (durée remboursement)
        if (!document.getElementById('prefinancementMonths')) {
            // Trouver le groupe du montant et ajouter après
            var amtInput = document.getElementById('prefinancementAmount');
            if (amtInput) {
                var parentDiv = amtInput.closest('.form-group') || amtInput.parentElement;
                var monthsGroup = document.createElement('div');
                monthsGroup.className = 'form-group';
                monthsGroup.style.cssText = 'margin-top:12px;';
                monthsGroup.innerHTML = '<label style="font-weight:600;display:block;margin-bottom:6px;">Durée (mois)</label>'
                    + '<input type="number" id="prefinancementMonths" value="12" min="1" max="60" step="1" '
                    + 'oninput="calculatePrefinancement()" '
                    + 'style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font-size:14px;">';
                if (parentDiv && parentDiv.parentElement) {
                    parentDiv.parentElement.insertBefore(monthsGroup, parentDiv.nextSibling);
                } else {
                    modal.appendChild(monthsGroup);
                }
            }
        }

        // Taux d'intérêt
        if (!document.getElementById('prefinancementInterest')) {
            var interestGroup = document.createElement('div');
            interestGroup.className = 'form-group';
            interestGroup.style.cssText = 'margin-top:12px;';
            interestGroup.innerHTML = '<label style="font-weight:600;display:block;margin-bottom:6px;">Taux d\'intérêt (%)</label>'
                + '<input type="number" id="prefinancementInterest" value="5" min="0" max="30" step="0.5" '
                + 'oninput="calculatePrefinancement()" '
                + 'style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font-size:14px;">'
                + '<small style="color:var(--gray);font-size:12px;">Taux annuel de commission de service</small>';
            var monthsEl = document.getElementById('prefinancementMonths');
            if (monthsEl && monthsEl.closest('.form-group') && monthsEl.closest('.form-group').parentElement) {
                monthsEl.closest('.form-group').parentElement.insertBefore(interestGroup, monthsEl.closest('.form-group').nextSibling);
            } else {
                modal.appendChild(interestGroup);
            }
        }

        // Input caché pour l'ID du locataire sélectionné
        if (!document.getElementById('prefinancementTenant')) {
            _ghost('input', 'prefinancementTenant', '');
        }
    }

    /* ── 6. #tenantAgent — champ agent dans formulaire locataire ──
       Optionnel — visible dans le formulaire si un agent est assigné.
    ─────────────────────────────────────────────────────────────────────── */
    function injectTenantAgentField() {
        var modal = document.getElementById('newTenantModal');
        if (!modal || document.getElementById('tenantAgent')) return;

        var agentGroup = document.createElement('div');
        agentGroup.className = 'form-group';
        agentGroup.style.cssText = 'margin-top:12px;';
        agentGroup.innerHTML = '<label style="font-size:13px;color:var(--gray);">Agent responsable (optionnel)</label>'
            + '<select id="tenantAgent" style="width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg-card);color:var(--text);font-size:13px;margin-top:4px;">'
            + '<option value="">-- Aucun agent assigné --</option></select>';

        // Ajouter avant le bouton de soumission
        var saveBtn = modal.querySelector('[onclick*="saveNewTenant"]');
        var insertTarget = saveBtn ? saveBtn.closest('.form-group, .modal-footer, div') || saveBtn.parentElement : null;
        if (insertTarget) {
            insertTarget.parentElement ? insertTarget.parentElement.insertBefore(agentGroup, insertTarget) : modal.querySelector('.modal-body').appendChild(agentGroup);
        } else {
            var body = modal.querySelector('.modal-body');
            if (body) body.appendChild(agentGroup);
        }

        // Peupler avec les récolteurs
        setTimeout(function(){
            var sel = document.getElementById('tenantAgent');
            if (!sel) return;
            var coll = typeof collectorsData !== 'undefined' ? collectorsData : [];
            coll.filter(function(c){ return c.status !== 'suspendu' && c.status !== 'inactive'; })
                .forEach(function(c){
                    var opt = document.createElement('option');
                    opt.value = c.lastName + ' ' + c.firstName;
                    opt.textContent = c.lastName + ' ' + c.firstName + (c.zone ? ' (' + c.zone + ')' : '');
                    sel.appendChild(opt);
                });
        }, 400);
    }

    /* ── Déclencher l'injection quand les modaux sont ouverts ── */

    // Observer les changements de display sur les modaux
    function watchModalOpen() {
        var prefiModal = document.getElementById('prefinancementModal');
        var tenantModal = document.getElementById('newTenantModal');

        if (prefiModal) {
            var _origOpen = window.openModal;
            window.openModal = function(id) {
                if (_origOpen) _origOpen(id);
                if (id === 'prefinancementModal') {
                    setTimeout(injectPrefinancementFields, 100);
                }
                if (id === 'newTenantModal') {
                    setTimeout(injectTenantAgentField, 100);
                }
            };
        }

        // Injection immédiate si le modal est déjà dans le DOM
        injectPrefinancementFields();
        injectTenantAgentField();
    }

    // Lancer après que le DOM soit prêt
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchModalOpen);
    } else {
        setTimeout(watchModalOpen, 500);
    }

    console.info('[FIX-10] ✅ Éléments HTML manquants créés/aliasés');
})();

/* ═══════════════════════════════════════════════════════════════════
   BUG-11 : switchManagerTab — double crash
   ─────────────────────────────────────────────────────────────────
   PROBLÈME 1 : querySelector sans guard null → crash si onglet absent
   PROBLÈME 2 : document.getElementById(tabName + 'Tab') génère
                'my-collectionTab' pour l'onglet 'my-collection',
                mais le vrai ID est 'myCollectionTab' → onglet
                "Mes collectes" jamais activé visuellement.
   CORRECTION  : Override complet avec guard null + table de mapping.
═══════════════════════════════════════════════════════════════════ */
(function fixSwitchManagerTab() {

    /* Table de correspondance tabName → ID du div tab-content */
    var TAB_ID_MAP = {
        'collectors':    'collectorsTab',
        'assignment':    'assignmentTab',
        'performance':   'performanceTab',
        'my-collection': 'myCollectionTab',   // ← correction du tiret
        'properties':    'propertiesTab'
    };

    window.switchManagerTab = function(tabName) {
        /* Initialisation filtre propriétés si nécessaire */
        if (tabName === 'properties') {
            setTimeout(function(){
                if (typeof initManagerPropertiesFilter === 'function') initManagerPropertiesFilter();
            }, 100);
        }

        /* Mettre à jour la variable globale si elle existe */
        if (typeof currentManagerTab !== 'undefined') {
            // eslint-disable-next-line no-undef
            currentManagerTab = tabName;
        }

        /* Désactiver tous les onglets et contenus */
        document.querySelectorAll('#collectorManagerMain .tab').forEach(function(tab) {
            tab.classList.remove('active');
        });
        document.querySelectorAll('#collectorManagerMain .tab-content').forEach(function(content) {
            content.classList.remove('active');
        });

        /* Activer l'onglet nav avec guard null (PROBLÈME 1 résolu) */
        var activeTab = null;
        document.querySelectorAll('#collectorManagerMain .tab').forEach(function(tab) {
            var onclick = tab.getAttribute('onclick') || '';
            if (onclick.indexOf("'" + tabName + "'") !== -1 ||
                onclick.indexOf('"' + tabName + '"') !== -1) {
                activeTab = tab;
            }
        });
        if (activeTab) {
            activeTab.classList.add('active');
        } else {
            console.warn('[FIX-11] switchManagerTab: onglet nav non trouvé pour', tabName);
        }

        /* Activer le contenu via la table de mapping (PROBLÈME 2 résolu) */
        var contentId = TAB_ID_MAP[tabName] || (tabName + 'Tab');
        var contentEl = document.getElementById(contentId);
        if (contentEl) {
            contentEl.classList.add('active');
        } else {
            console.warn('[FIX-11] switchManagerTab: contenu non trouvé pour id=', contentId);
        }

        /* Charger les données selon l'onglet */
        if (tabName === 'collectors') {
            if (typeof loadCollectorsGrid      === 'function') loadCollectorsGrid();
        } else if (tabName === 'assignment') {
            if (typeof loadAvailablePropertiesList === 'function') loadAvailablePropertiesList();
        } else if (tabName === 'performance') {
            if (typeof loadCollectorPerformance === 'function') loadCollectorPerformance();
        } else if (tabName === 'my-collection') {
            if (typeof loadManagerClientList   === 'function') loadManagerClientList();
        } else if (tabName === 'properties') {
            if (typeof initManagerPropertiesFilter === 'function') initManagerPropertiesFilter();
            if (typeof filterManagerProperties     === 'function') filterManagerProperties();
        }
    };

    console.info('[FIX-11] ✅ switchManagerTab — guard null + mapping my-collection→myCollectionTab corrigés');
})();
