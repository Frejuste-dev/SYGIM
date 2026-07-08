        // ============================================================
        // COMPTES UTILISATEURS
        // Géré depuis le panel Admin (interface graphique)
        // Structure : username (minuscule) → { role, password, displayName, avatar,
        //             active, createdAt, firstName, lastName, collectorName? }
        // Rôles : 'admin' | 'director' | 'accounting' | 'collector_manager' | 'collector'
        // ============================================================
        let USER_ACCOUNTS = {};

        // Journal d'activité admin (en mémoire)
        let adminActivityLog = [];

        // Fonction utilitaire : ajouter une entrée au journal
        function adminLog(type, message) {
            const now = new Date();
            adminActivityLog.unshift({
                type, message,
                time: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                date: now.toLocaleDateString('fr-FR')
            });
            if (adminActivityLog.length > 200) adminActivityLog.pop();
        }

        async function secureSaveAllData() {
            const saveButtons = document.querySelectorAll('[onclick="secureSaveAllData()"]');
            saveButtons.forEach(btn => {
                btn.disabled = true;
                btn.dataset.originalHtml = btn.dataset.originalHtml || btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sauvegarde...';
            });

            try {
                const snapshot = {
                    savedAt: new Date().toISOString(),
                    user: currentUser ? {
                        id: currentUser.id,
                        username: currentUser.username,
                        role: currentUser.role
                    } : null,
                    clients: clientsData || [],
                    owners: ownersData || [],
                    properties: propertiesData || [],
                    collectors: collectorsData || [],
                    transactions: transactionsData || []
                };

                if (window.SYGIM_DB && typeof window.SYGIM_DB.saveAll === 'function') {
                    await window.SYGIM_DB.saveAll();
                }

                if (window.SyncAdapter && typeof window.SyncAdapter.syncAll === 'function') {
                    await window.SyncAdapter.syncAll();
                }

                localStorage.setItem('SYGIM_LAST_SAFE_SAVE', JSON.stringify(snapshot));
                localStorage.setItem('SYGIM_LAST_SAFE_SAVE_AT', snapshot.savedAt);
                adminLog('backup', 'Sauvegarde manuelle securisee effectuee');

                if (typeof showAlert === 'function') {
                    showAlert('Sauvegarde effectuee avec succes.', 'success');
                }
                return true;
            } catch (error) {
                console.error('Erreur sauvegarde securisee:', error);
                if (typeof showAlert === 'function') {
                    showAlert('Erreur pendant la sauvegarde. Verifiez la connexion au serveur.', 'error');
                }
                return false;
            } finally {
                saveButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.innerHTML = btn.dataset.originalHtml || '<i class="fas fa-save"></i> Sauvegarder';
                });
            }
        }

        // DONNÉES
        let currentUser = null;
        let isDarkTheme = false;
        let currentClientForPayment = null;
        let selectedPaymentMethod = "";
        let charts = {};
        let selectedProperties = new Set();
        let currentView = 'grid';
        let currentPage = 1;
        const itemsPerPage = 20;
        let filteredProperties = [];
        let activeFilters = {
            type: 'all',
            status: 'all'
        };

        // Variables pour la signature
        let signatureCanvas = null;
        let signatureCtx = null;
        let isDrawing = false;
        let lastX = 0;
        let lastY = 0;
        let currentSignature = null;

        const clientsData = [
        ];

        const ownersData = [
        ];

        const transactionsData = [];

        const paymentMethods = [
            { id: "cash", name: "Espèces", icon: "fa-money-bill-wave" },
            { id: "bank_transfer", name: "Virement bancaire", icon: "fa-university" },
            { id: "mobile_money", name: "Mobile Money", icon: "fa-mobile-alt" },
            { id: "check", name: "Chèque", icon: "fa-money-check" },
            { id: "card", name: "Carte bancaire", icon: "fa-credit-card" }
        ];

        // NOUVELLES DONNÉES POUR LES PROPRIÉTÉS HIÉRARCHIQUES
        const propertiesData = [
        ];

        // ============================================
// FONCTIONS POUR L'AJOUT DE LOCATAIRE
// ============================================

function openNewTenantModal() {
    // Remplir la liste des biens disponibles
    const propertySelect = document.getElementById('tenantProperty');
    const availableProperties = propertiesData.filter(p => 
        p.status === 'vacant' || p.status === 'en_renovation'
    );
    
    propertySelect.innerHTML = '<option value="">-- Choisir un bien disponible --</option>' +
        availableProperties.map(p => `
            <option value="${p.id}" data-rent="${p.rent || p.value * 0.003}" 
                    data-address="${p.address}" data-area="${p.area || 'N/A'}">
                ${p.name} - ${p.address} (${p.type})
            </option>
        `).join('');
    
    // Initialiser les dates
    const today = new Date().toISOString().split('T')[0];
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);
    
    document.getElementById('tenantStartDate').value = today;
    document.getElementById('tenantEndDate').value = oneYearLater.toISOString().split('T')[0];
    
    // Ouvrir le modal
    openModal('newTenantModal');
}

function updatePropertyDetails() {
    const select = document.getElementById('tenantProperty');
    const selectedOption = select.options[select.selectedIndex];
    const detailsDiv = document.getElementById('propertyDetails');
    
    if (select.value) {
        const rent = selectedOption.getAttribute('data-rent');
        const address = selectedOption.getAttribute('data-address');
        const area = selectedOption.getAttribute('data-area');
        
        document.getElementById('selectedPropertyAddress').textContent = address;
        document.getElementById('selectedPropertyRent').textContent = parseInt(rent).toLocaleString();
        document.getElementById('selectedPropertyArea').textContent = area;
        
        // Mettre à jour le champ loyer
        document.getElementById('tenantRent').value = parseInt(rent);
        
        detailsDiv.style.display = 'block';
    } else {
        detailsDiv.style.display = 'none';
    }
}

function updateDocumentList() {
    const fileInput = document.getElementById('tenantDocuments');
    const documentList = document.getElementById('documentList');
    const files = fileInput.files;
    
    if (files.length > 0) {
        let html = '<div style="text-align: left;">';
        for (let i = 0; i < files.length; i++) {
            html += `<div style="margin: 5px 0; font-size: 11px;">
                        <i class="fas fa-file" style="color: var(--primary);"></i>
                        ${files[i].name} (${(files[i].size / 1024).toFixed(1)} KB)
                     </div>`;
        }
        html += '</div>';
        documentList.innerHTML = html;
    } else {
        documentList.innerHTML = '<div style="color: var(--gray);">Aucun document sélectionné</div>';
    }
}

async function saveNewTenant() {
    // Récupérer les valeurs
    const lastName = document.getElementById('tenantLastName').value.trim();
    const firstName = document.getElementById('tenantFirstName').value.trim();
    const phone = document.getElementById('tenantPhone').value.trim();
    const email = document.getElementById('tenantEmail').value.trim();
    const address = document.getElementById('tenantAddress').value.trim();
    const propertyId = parseInt(document.getElementById('tenantProperty').value);
    const rent = parseInt(document.getElementById('tenantRent').value);
    const deposit = parseInt(document.getElementById('tenantDeposit').value) || 0;
    const startDate = document.getElementById('tenantStartDate').value;
    const endDate = document.getElementById('tenantEndDate').value;
    
    // Validation
    if (!lastName || !firstName || !phone || !propertyId || !rent || !startDate) {
        showAlert('Veuillez remplir tous les champs obligatoires (*)', 'error');
        return;
    }
    
    if (rent < 10000) {
        showAlert('Le loyer doit être d\'au moins 10,000 XOF', 'error');
        return;
    }
    
    try {
        // Préparer les données pour l'API
        const clientData = {
            firstName: firstName,
            lastName: lastName,
            phone: phone,
            email: email || null,
            address: address || null,
            property_id: propertyId,
            amount_due: rent,
            amount_paid: 0,
            status: 'pending',
            deposit: deposit || 0,
            contract_start: startDate,
            contract_end: endDate || null
        };
        
        // Appel API pour créer le client
        const response = await API.Clients.create(clientData);
        
        if (response && response.success) {
            // Créer l'objet locataire avec l'ID retourné par l'API
            const newTenantId = response.data.id || (Math.max(...clientsData.map(c => c.id || 0), 0) + 1);
            const newTenant = {
                id: newTenantId,
                firstName: firstName,
                lastName: lastName,
                address: address,
                amountDue: rent,
                amountPaid: 0,
                paymentMethod: "",
                status: "pending",
                phone: phone,
                email: email || "",
                property: propertiesData.find(p => p.id === propertyId)?.name || "",
                propertyValue: propertiesData.find(p => p.id === propertyId)?.value || 0,
                joinDate: new Date().toLocaleDateString('fr-FR'),
                ownerId: propertiesData.find(p => p.id === propertyId)?.ownerId || 1,
                deposit: deposit,
                contractStart: startDate,
                contractEnd: endDate || null,
                documents: [],
                agent: (currentUser && currentUser.userType === 'collector' && currentUser.collectorName)
                    ? currentUser.collectorName : ""
            };
            
            // Ajouter à la liste des clients
            clientsData.push(newTenant);
            
            // Mettre à jour la propriété
            const propertyIndex = propertiesData.findIndex(p => p.id === propertyId);
            if (propertyIndex !== -1) {
                propertiesData[propertyIndex].status = 'loue';
                propertiesData[propertyIndex].tenantId = newTenantId;
                
                if (!propertiesData[propertyIndex].rent) {
                    propertiesData[propertyIndex].rent = rent;
                }
            }
            
            showAlert(`✓ Locataire "${firstName} ${lastName}" ajouté en BD avec succès!`, 'success');
        } else {
            throw new Error(response?.error || 'Erreur creation client');
        }
    } catch (error) {
        console.error('Erreur création client:', error);
        showAlert('⚠️ Erreur API. Client ajouté localement.', 'warning');
        
        // Fallback: ajouter localement
        const newTenantId = Math.max(...clientsData.map(c => c.id || 0), 0) + 1;
        const newTenant = {
            id: newTenantId,
            firstName: firstName,
            lastName: lastName,
            address: address,
            amountDue: rent,
            amountPaid: 0,
            paymentMethod: "",
            status: "pending",
            phone: phone,
            email: email || "",
            property: propertiesData.find(p => p.id === propertyId)?.name || "",
            propertyValue: propertiesData.find(p => p.id === propertyId)?.value || 0,
            joinDate: new Date().toLocaleDateString('fr-FR'),
            ownerId: propertiesData.find(p => p.id === propertyId)?.ownerId || 1,
            deposit: deposit,
            contractStart: startDate,
            contractEnd: endDate || null,
            documents: [],
            agent: (currentUser && currentUser.userType === 'collector' && currentUser.collectorName)
                ? currentUser.collectorName : ""
        };
        
        clientsData.push(newTenant);
    }
    
    // Fermer le modal et recharger
    closeModal('newTenantModal');
    
    if (currentUser && currentUser.userType === 'collector') {
        loadCollectorClientCards();
    } else {
        loadClientsGrid();
    }
}

// ============================================
// FONCTIONS POUR LE REMPLACEMENT DE LOCATAIRE
// ============================================

function openTenantReplacementModal() {
    // Remplir la liste des locataires actuels
    const tenantSelect = document.getElementById('currentTenantSelect');
    const activeTenants = clientsData.filter(c => c.status !== 'inactive');
    
    tenantSelect.innerHTML = '<option value="">-- Choisir un locataire actuel --</option>' +
        activeTenants.map(c => {
            const property = propertiesData.find(p => p.tenantId === c.id);
            return `<option value="${c.id}" data-rent="${c.amountDue}" 
                    data-property="${property?.name || 'N/A'}" data-start="${c.contractStart || c.joinDate}">
                ${c.lastName} ${c.firstName} - ${property?.name || c.property}
            </option>`;
        }).join('');
    
    // Cacher les sections
    document.getElementById('currentTenantInfo').style.display = 'none';
    document.getElementById('newTenantSection').style.display = 'none';
    document.getElementById('existingTenantForm').style.display = 'none';
    document.getElementById('newTenantForm').style.display = 'none';
    
    // Initialiser la date de fin
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('currentTenantEndDate').value = today;
    
    openModal('tenantReplacementModal');
}

function loadCurrentTenantInfo() {
    const select = document.getElementById('currentTenantSelect');
    if (!select.value) {
        document.getElementById('currentTenantInfo').style.display = 'none';
        document.getElementById('newTenantSection').style.display = 'none';
        return;
    }
    
    const tenantId = parseInt(select.value);
    const tenant = clientsData.find(c => c.id === tenantId);
    const selectedOption = select.options[select.selectedIndex];
    
    if (tenant) {
        // Afficher les informations
        document.getElementById('currentTenantName').textContent = 
            `${tenant.lastName} ${tenant.firstName}`;
        document.getElementById('currentTenantPhone').textContent = tenant.phone;
        document.getElementById('currentTenantProperty').textContent = 
            selectedOption.getAttribute('data-property');
        document.getElementById('currentTenantRent').textContent = 
            tenant.amountDue.toLocaleString();
        document.getElementById('currentTenantStartDate').textContent = 
            selectedOption.getAttribute('data-start');
        
        // Afficher les sections
        document.getElementById('currentTenantInfo').style.display = 'block';
        document.getElementById('newTenantSection').style.display = 'block';
        
        // Remplir la liste des locataires existants (sans contrat actif)
        const existingSelect = document.getElementById('existingTenantSelect');
        const tenantsWithoutProperty = clientsData.filter(c => 
            c.status !== 'inactive' && !propertiesData.some(p => p.tenantId === c.id)
        );
        
        existingSelect.innerHTML = '<option value="">-- Choisir un locataire --</option>' +
            tenantsWithoutProperty.map(c => 
                `<option value="${c.id}">${c.lastName} ${c.firstName} (${c.phone})</option>`
            ).join('');
        
        // Initialiser la date du nouveau contrat
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('newContractStartDate').value = today;
        document.getElementById('newContractRent').value = tenant.amountDue;
    }
}

function showExistingTenantForm() {
    document.getElementById('existingTenantForm').style.display = 'block';
    document.getElementById('newTenantForm').style.display = 'none';
    
    // Mettre à jour les boutons
    document.getElementById('useExistingTenantBtn').classList.add('active');
    document.getElementById('createNewTenantBtn').classList.remove('active');
}

function showNewTenantForm() {
    document.getElementById('existingTenantForm').style.display = 'none';
    document.getElementById('newTenantForm').style.display = 'block';
    
    // Mettre à jour les boutons
    document.getElementById('useExistingTenantBtn').classList.remove('active');
    document.getElementById('createNewTenantBtn').classList.add('active');
}

function processTenantReplacement() {
    // Validation des champs obligatoires
    const currentTenantId = parseInt(document.getElementById('currentTenantSelect').value);
    const departureReason = document.getElementById('departureReason').value;
    const endDate = document.getElementById('currentTenantEndDate').value;
    const newStartDate = document.getElementById('newContractStartDate').value;
    const newRent = parseInt(document.getElementById('newContractRent').value);
    
    if (!currentTenantId || !departureReason || !endDate || !newStartDate || !newRent) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    // Récupérer les informations
    const currentTenant = clientsData.find(c => c.id === currentTenantId);
    const property = propertiesData.find(p => p.tenantId === currentTenantId);
    
    if (!property) {
        alert('Erreur: Aucun bien trouvé pour ce locataire');
        return;
    }
    
    // Déterminer le nouveau locataire
    let newTenantId;
    let newTenantName;
    
    const existingTenantId = parseInt(document.getElementById('existingTenantSelect').value);
    if (existingTenantId && document.getElementById('existingTenantForm').style.display === 'block') {
        // Utiliser un locataire existant
        newTenantId = existingTenantId;
        const existingTenant = clientsData.find(c => c.id === existingTenantId);
        newTenantName = `${existingTenant.lastName} ${existingTenant.firstName}`;
    } else {
        // Créer un nouveau locataire
        const lastName = document.getElementById('replacementLastName').value.trim();
        const firstName = document.getElementById('replacementFirstName').value.trim();
        const phone = document.getElementById('replacementPhone').value.trim();
        const email = document.getElementById('replacementEmail').value.trim();
        
        if (!lastName || !firstName || !phone) {
            alert('Veuillez remplir les informations du nouveau locataire');
            return;
        }
        
        newTenantId = Math.max(...clientsData.map(c => c.id), 0) + 1;
        newTenantName = `${lastName} ${firstName}`;
        
        // Créer le nouveau locataire
        const newTenant = {
            id: newTenantId,
            firstName: firstName,
            lastName: lastName,
            address: property.address,
            amountDue: newRent,
            amountPaid: 0,
            paymentMethod: "",
            status: "pending",
            phone: phone,
            email: email || "",
            property: property.name,
            propertyValue: property.value,
            joinDate: new Date().toLocaleDateString('fr-FR'),
            ownerId: property.ownerId,
            contractStart: newStartDate,
            contractEnd: null,
            // Hériter de l'agent de l'ancien locataire pour maintenir la continuité
            agent: currentTenant ? (currentTenant.agent || "") : ""
        };
        
        clientsData.push(newTenant);
    }
    
    // 1. Marquer l'ancien locataire comme inactif
    const oldTenantIndex = clientsData.findIndex(c => c.id === currentTenantId);
    clientsData[oldTenantIndex].status = 'inactive';
    clientsData[oldTenantIndex].contractEnd = endDate;
    clientsData[oldTenantIndex].departureReason = departureReason;
    clientsData[oldTenantIndex].departureNotes = document.getElementById('departureNotes').value;
    
    // 2. Mettre à jour la propriété avec le nouveau locataire
    property.tenantId = newTenantId;
    property.rent = newRent;
    
    // 3. Mettre à jour le nouveau locataire avec le bien
    const newTenantIndex = clientsData.findIndex(c => c.id === newTenantId);
    if (newTenantIndex !== -1) {
        clientsData[newTenantIndex].property = property.name;
        clientsData[newTenantIndex].propertyValue = property.value;
        clientsData[newTenantIndex].amountDue = newRent;
    }
    
    // 4. Créer une transaction pour le remplacement
    transactionsData.push({
        id: `REPL-${Date.now()}`,
        date: new Date().toLocaleDateString('fr-FR'),
        client: newTenantName,
        description: `Remplacement locataire - ${currentTenant.lastName} ${currentTenant.firstName}`,
        amount: 0,
        method: "replacement",
        reference: `REPL-${currentTenantId}-${newTenantId}`,
        status: "processed"
    });
    
    // Message de confirmation
    alert(`✓ Remplacement effectué avec succès !\n\nAncien locataire: ${currentTenant.lastName} ${currentTenant.firstName}\nNouveau locataire: ${newTenantName}\nBien: ${property.name}`);
    
    // Fermer le modal et recharger
    closeModal('tenantReplacementModal');
    
    if (currentUser && currentUser.userType === 'collector') {
        loadCollectorClientCards();
    }
}

// ============================================
// FONCTIONS POUR LES OPTIONS DE PAIEMENT
// ============================================

function openPaymentOptionsModal() {
    // Remplir les listes de locataires
    const tenantLists = ['advanceTenantSelect', 'installmentTenantSelect', 'customTenantSelect'];
    const activeTenants = clientsData.filter(c => c.status !== 'inactive');
    
    tenantLists.forEach(listId => {
        const select = document.getElementById(listId);
        select.innerHTML = '<option value="">-- Choisir un locataire --</option>' +
            activeTenants.map(c => `
                <option value="${c.id}" data-rent="${c.amountDue}">
                    ${c.lastName} ${c.firstName} - ${c.amountDue.toLocaleString()} XOF/mois
                </option>
            `).join('');
    });
    
    // Initialiser les dates
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('customDueDate').value = today;
    
    // Activer le premier onglet
    switchPaymentTab('advance');
    
    openModal('paymentOptionsModal');
}

function switchPaymentTab(tabName) {
    // Masquer tous les onglets
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Désactiver tous les onglets
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activer l'onglet sélectionné
    document.getElementById(tabName + 'Tab').classList.add('active');
    event.target.classList.add('active');
    
    // Si c'est l'onglet anticipé, mettre à jour l'affichage
    if (tabName === 'advance') {
        updateAdvanceCalculation();
    } else if (tabName === 'installment') {
        loadTenantBalance();
    }
}

function updateAdvanceCalculation() {
    const tenantId = parseInt(document.getElementById('advanceTenantSelect').value);
    const period = parseInt(document.getElementById('advancePeriod').value);
    
    if (tenantId && period) {
        const tenant = clientsData.find(c => c.id === tenantId);
        if (tenant) {
            const monthlyRent = tenant.amountDue;
            const total = monthlyRent * period;
            const discount = period >= 3 ? total * 0.05 : 0;
            const finalTotal = total - discount;
            
            document.getElementById('monthlyRentDisplay').textContent = monthlyRent.toLocaleString();
            document.getElementById('monthsCount').textContent = period;
            document.getElementById('advanceDiscount').textContent = discount.toLocaleString();
            document.getElementById('advanceTotal').textContent = finalTotal.toLocaleString();
        }
    }
}

function loadTenantBalance() {
    const tenantId = parseInt(document.getElementById('installmentTenantSelect').value);
    if (tenantId) {
        const tenant = clientsData.find(c => c.id === tenantId);
        if (tenant) {
            document.getElementById('currentBalance').textContent = 
                (tenant.amountDue - tenant.amountPaid).toLocaleString();
        }
    }
}

function calculateInstallments() {
    const total = parseInt(document.getElementById('installmentTotal').value);
    const count = parseInt(document.getElementById('installmentCount').value);
    const frequency = document.getElementById('installmentFrequency').value;
    
    if (total && count) {
        // Calcul des intérêts (1% par mois)
        const interestRate = 0.01;
        let interest = 0;
        
        if (frequency === 'monthly') {
            interest = total * interestRate * count;
        } else if (frequency === 'biweekly') {
            interest = total * (interestRate / 2) * count;
        } else if (frequency === 'weekly') {
            interest = total * (interestRate / 4) * count;
        }
        
        const totalWithInterest = total + interest;
        const installmentAmount = Math.ceil(totalWithInterest / count);
        
        const detailsDiv = document.getElementById('installmentDetails');
        let html = '<div style="display: flex; flex-direction: column; gap: 5px;">';
        
        const startDate = new Date();
        for (let i = 1; i <= count; i++) {
            let dueDate = new Date(startDate);
            
            if (frequency === 'weekly') {
                dueDate.setDate(dueDate.getDate() + (i * 7));
            } else if (frequency === 'biweekly') {
                dueDate.setDate(dueDate.getDate() + (i * 14));
            } else if (frequency === 'monthly') {
                dueDate.setMonth(dueDate.getMonth() + i);
            }
            
            const formattedDate = dueDate.toLocaleDateString('fr-FR');
            
            html += `
                <div style="display: flex; justify-content: space-between; align-items: center; 
                     padding: 8px; background: rgba(99, 102, 241, 0.05); border-radius: 6px;">
                    <div>
                        <div style="font-weight: 600;">Échéance ${i}</div>
                        <div style="font-size: 11px; color: var(--gray);">${formattedDate}</div>
                    </div>
                    <div class="xof" style="font-weight: 600;">${installmentAmount.toLocaleString()}</div>
                </div>
            `;
        }
        
        html += `
            <div style="display: flex; justify-content: space-between; padding: 10px; 
                 margin-top: 10px; border-top: 2px solid var(--border);">
                <div>
                    <div style="font-weight: 600;">Total avec intérêts</div>
                    <div style="font-size: 11px; color: var(--gray);">Intérêts: ${interest.toLocaleString()} XOF</div>
                </div>
                <div class="xof" style="font-weight: 700; font-size: 16px;">${totalWithInterest.toLocaleString()}</div>
            </div>
        </div>`;
        
        detailsDiv.innerHTML = html;
        document.getElementById('installmentSchedule').style.display = 'block';
    }
}

function processAdvancePayment() {
    const tenantId = parseInt(document.getElementById('advanceTenantSelect').value);
    const period = parseInt(document.getElementById('advancePeriod').value);
    
    if (!tenantId || !period) {
        alert('Veuillez sélectionner un locataire et une période');
        return;
    }
    
    const tenant = clientsData.find(c => c.id === tenantId);
    const monthlyRent = tenant.amountDue;
    const total = monthlyRent * period;
    const discount = period >= 3 ? total * 0.05 : 0;
    const finalTotal = total - discount;
    
    // Ouvrir le modal de paiement standard avec le montant total
    openPaymentModal(tenantId, finalTotal, 'advance');
    closeModal('paymentOptionsModal');
}

function processInstallmentPayment() {
    const tenantId = parseInt(document.getElementById('installmentTenantSelect').value);
    const total = parseInt(document.getElementById('installmentTotal').value);
    const count = parseInt(document.getElementById('installmentCount').value);
    const frequency = document.getElementById('installmentFrequency').value;
    
    if (!tenantId || !total || !count) {
        alert('Veuillez remplir tous les champs');
        return;
    }
    
    const tenant = clientsData.find(c => c.id === tenantId);
    
    // Créer le plan d'échelonnement
    const installmentPlan = {
        id: 'INST-' + Date.now(),
        tenantId: tenantId,
        tenantName: `${tenant.lastName} ${tenant.firstName}`,
        totalAmount: total,
        installmentCount: count,
        frequency: frequency,
        startDate: new Date().toISOString().split('T')[0],
        status: 'active',
        createdDate: new Date().toLocaleDateString('fr-FR'),
        installments: []
    };
    
    // Créer les échéances
    const startDate = new Date();
    for (let i = 1; i <= count; i++) {
        let dueDate = new Date(startDate);
        
        if (frequency === 'weekly') {
            dueDate.setDate(dueDate.getDate() + (i * 7));
        } else if (frequency === 'biweekly') {
            dueDate.setDate(dueDate.getDate() + (i * 14));
        } else if (frequency === 'monthly') {
            dueDate.setMonth(dueDate.getMonth() + i);
        }
        
        installmentPlan.installments.push({
            number: i,
            dueDate: dueDate.toISOString().split('T')[0],
            amount: Math.ceil(total / count),
            status: 'pending'
        });
    }
    
    // Stocker le plan (dans un tableau global)
    if (!window.installmentPlans) window.installmentPlans = [];
    window.installmentPlans.push(installmentPlan);
    
    // Mettre à jour le solde du locataire
    const tenantIndex = clientsData.findIndex(c => c.id === tenantId);
    clientsData[tenantIndex].amountDue += total;
    
    alert(`✓ Plan d'échelonnement créé !\n\n${count} versements de ${Math.ceil(total/count).toLocaleString()} XOF\nTotal: ${total.toLocaleString()} XOF`);
    closeModal('paymentOptionsModal');
}

function processCustomPayment() {
    const tenantId = parseInt(document.getElementById('customTenantSelect').value);
    const paymentType = document.getElementById('paymentType').value;
    const description = document.getElementById('customPaymentDesc').value.trim();
    const amount = parseInt(document.getElementById('customAmount').value);
    const dueDate = document.getElementById('customDueDate').value;
    const notes = document.getElementById('customNotes').value.trim();
    
    if (!tenantId || !description || !amount || !dueDate) {
        alert('Veuillez remplir tous les champs obligatoires');
        return;
    }
    
    if (amount < 1000) {
        alert('Le montant doit être d\'au moins 1,000 XOF');
        return;
    }
    
    const tenant = clientsData.find(c => c.id === tenantId);
    
    // Créer la transaction personnalisée
    const customTransaction = {
        id: 'CUSTOM-' + Date.now(),
        date: new Date().toLocaleDateString('fr-FR'),
        client: `${tenant.lastName} ${tenant.firstName}`,
        description: description,
        amount: amount,
        method: 'custom',
        reference: 'CUSTOM-' + Date.now(),
        status: 'pending',
        dueDate: dueDate,
        paymentType: paymentType,
        notes: notes
    };
    
    // Ajouter aux transactions
    transactionsData.push(customTransaction);
    
    // Mettre à jour le solde du locataire
    const tenantIndex = clientsData.findIndex(c => c.id === tenantId);
    clientsData[tenantIndex].amountDue += amount;
    
    // Si c'est un acompte, réduire le prochain loyer
    if (paymentType === 'acompte') {
        clientsData[tenantIndex].advancePayment = (clientsData[tenantIndex].advancePayment || 0) + amount;
    }
    
    alert(`✓ Paiement personnalisé créé !\n\nType: ${paymentType}\nDescription: ${description}\nMontant: ${amount.toLocaleString()} XOF\nÉchéance: ${new Date(dueDate).toLocaleDateString('fr-FR')}`);
    closeModal('paymentOptionsModal');
}

// ============================================
// INITIALISATION DES ÉVÉNEMENTS
// ============================================

// Ajoutez cette fonction à la fin de votre script JavaScript
function initPaymentOptionsListeners() {
    // Écouteur pour le calcul des avances
    const advanceTenantSelect = document.getElementById('advanceTenantSelect');
    const advancePeriod = document.getElementById('advancePeriod');
    
    if (advanceTenantSelect) {
        advanceTenantSelect.addEventListener('change', updateAdvanceCalculation);
    }
    if (advancePeriod) {
        advancePeriod.addEventListener('change', updateAdvanceCalculation);
    }
    
    // Écouteur pour le calcul des échéances
    const installmentTotal = document.getElementById('installmentTotal');
    const installmentCount = document.getElementById('installmentCount');
    const installmentFrequency = document.getElementById('installmentFrequency');
    
    if (installmentTotal) {
        installmentTotal.addEventListener('input', calculateInstallments);
    }
    if (installmentCount) {
        installmentCount.addEventListener('change', calculateInstallments);
    }
    if (installmentFrequency) {
        installmentFrequency.addEventListener('change', calculateInstallments);
    }
}

// Appelez cette fonction après le chargement de la page
document.addEventListener('DOMContentLoaded', initPaymentOptionsListeners);

        // Variables pour l'IA
        let aiMessages = [];
        let isAIOpen = false;
        let aiConversationContext = {
            lastIntent: null,
            lastEntities: {},
            turnCount: 0,
            sessionStart: new Date(),
            pendingAction: null,
            waitingForConfirm: false
        };

        // ============================================================
        // MOTEUR NLP LOCAL — SYGIA
        // ============================================================

        function aiNormalize(text) {
            return text.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/['']/g, "'")
                .replace(/[^\w\s']/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
        }

        const frSuffixes = ['ments','ment','tions','tion','ements','ement','eux','euse','euses','iste','istes','ique','iques','eur','eurs','age','ages','aire','aires'];
        function aiStem(word) {
            if (word.length < 5) return word;
            for (const s of frSuffixes) {
                if (word.endsWith(s) && word.length - s.length >= 3) return word.slice(0, -s.length);
            }
            return word;
        }

        function aiTokenize(text) {
            const stopWords = new Set(['le','la','les','un','une','des','du','de','et','en','au','aux','ce','se','sa','son','ses','nous','vous','ils','elles','je','tu','il','elle','on','que','qui','quoi','comment','est','sont','avoir','etre','dans','sur','par','pour','avec','sans','plus','moins','pas','ne','ni','si','mais','ou','donc','car','or','puis','alors','cela','ceci','tout','tous','toute','toutes','mon','ma','mes','ton','ta','tes','votre','vos','notre','nos','leur','leurs','moi','toi','lui','eux','y','en','dont','a','d']);
            return aiNormalize(text).split(' ').filter(w => w.length > 1 && !stopWords.has(w));
        }

        function aiSimilarity(tokens, referenceWords) {
            const refSet = referenceWords.map(w => aiStem(aiNormalize(w)));
            let hits = 0;
            for (const t of tokens) {
                if (refSet.some(r => r.includes(aiStem(t)) || aiStem(t).includes(r) || t === r)) hits++;
            }
            return tokens.length > 0 ? hits / Math.max(tokens.length, refSet.length) : 0;
        }

        function aiExtractNumbers(text) {
            const matches = text.match(/\d[\d\s]*/g) || [];
            return matches.map(m => parseInt(m.replace(/\s/g, ''))).filter(n => !isNaN(n));
        }

        function aiExtractNames(text) {
            return (text.match(/\b[A-ZÉÈÊËÀÂÎÃÔÙÛÜ][A-ZÉÈÊËÀÂÎÃÔÙÛÜ]{2,}\b/g) || []);
        }

        const AI_INTENTS = [
            { id: 'greeting',         examples: ['bonjour','salut','hello','coucou','bonsoir','salam','bonne journee'],                        priority: 10 },
            { id: 'goodbye',          examples: ['au revoir','bye','a bientot','ciao','bonne nuit','a plus','ferme'],                          priority: 10 },
            { id: 'merci',            examples: ['merci','super','parfait','tres bien','excellent','bravo','ok merci','top'],                   priority: 9  },
            { id: 'stats_global',     examples: ['statistique','stat','bilan','resume','chiffre','performance','kpi','indicateur','overview','dashboard','tableau de bord'], priority: 5 },
            { id: 'retards',          examples: ['retard','impaye','en retard','paiement en attente','client retard','loyer non paye','debiteur','dette','pending','overdue'], priority: 6 },
            { id: 'revenus',          examples: ['revenu','recette','encaisse','argent','montant','total percu','collecte','income','chiffre affaires','encaissement'], priority: 5 },
            { id: 'recouvrement',     examples: ['taux recouvrement','collecte','encaissement','ratio','pourcentage paye','recouvrement','collection rate'], priority: 6 },
            { id: 'clients',          examples: ['client','locataire','tenant','liste client','nombre client','qui paie','qui sont'],               priority: 5 },
            { id: 'client_search',    examples: ['cherche client','trouver locataire','recherche','info sur','detail de','fiche de','profil'],      priority: 7 },
            { id: 'add_client',       examples: ['ajouter client','nouveau client','creer locataire','enregistrer locataire','nouveau locataire'],     priority: 8 },
            { id: 'proprietaires',    examples: ['proprietaire','owner','bailleur','liste proprietaire','qui possede'],                              priority: 5 },
            { id: 'proprietes',       examples: ['propriete','bien','appartement','maison','villa','immeuble','local','logement','patrimoine','parc','portefeuille'], priority: 5 },
            { id: 'occupation',       examples: ['occupation','vacant','libre','disponible','loue','taux occupation','rempli','vide'],            priority: 6 },
            { id: 'recolteurs',       examples: ['recolteur','agent','collecteur','equipe','zone','responsable zone'],                              priority: 5 },
            { id: 'top_clients',      examples: ['meilleur client','top client','plus ponctuel','plus fiable','bon payeur','meilleur payeur'],       priority: 7 },
            { id: 'top_proprietaires',examples: ['meilleur proprietaire','plus rentable','top proprietaire','propriete rentable','revenu proprietaire'],priority:7},
            { id: 'alertes',          examples: ['alerte','notification','urgent','probleme','anomalie','attention','signalement'],               priority: 8 },
            { id: 'simulation',       examples: ['simulation','simuler','prevision','projection','si','scenario','combien si','estimer','calculer'], priority: 7 },
            { id: 'rapport',          examples: ['rapport','report','generer rapport','export','telecharger','pdf','analyse mensuelle'],           priority: 6 },
            { id: 'paiement',         examples: ['paiement','payer','transaction','enregistrer paiement','recu','quittance','encaisser'],          priority: 6 },
            { id: 'contrats',         examples: ['contrat','bail','renouveler','expiration','echeance','fin contrat','duree contrat'],             priority: 6 },
            { id: 'commission',       examples: ['commission','taux commission','honoraire','frais gestion','part agence','remuneration'],          priority: 6 },
            { id: 'prefinancement',   examples: ['prefinancement','financement','avance','credit','pret','emprunt','dette proprietaire'],         priority: 6 },
            { id: 'navigation',       examples: ['aller','ouvrir','afficher','montrer','page','section','menu','naviguer vers','voir la page'],priority: 6 },
            { id: 'aide',             examples: ['aide','help','comment','tutoriel','guide','documentation','je ne sais pas','expliquer','qu est ce'], priority: 4 }
        ];

        function aiClassifyIntent(text) {
            const tokens = aiTokenize(text);
            let bestIntent = null, bestScore = 0;
            for (const intent of AI_INTENTS) {
                const score = aiSimilarity(tokens, intent.examples) * (intent.priority / 10);
                if (score > bestScore) { bestScore = score; bestIntent = intent.id; }
            }
            return bestScore > 0.08 ? { intent: bestIntent, confidence: bestScore } : { intent: 'unknown', confidence: 0 };
        }

        function aiGenerateResponse(rawText) {
            const text  = aiNormalize(rawText);
            const { intent } = aiClassifyIntent(text);
            const names = aiExtractNames(rawText);
            aiConversationContext.lastIntent = intent;
            aiConversationContext.turnCount++;

            const total     = clientsData.length;
            const paid      = clientsData.filter(c => c.status === 'paid').length;
            const pending   = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue').length;
            const totalPaid = clientsData.reduce((s,c) => s+(c.amountPaid||0), 0);
            const totalDue  = clientsData.reduce((s,c) => s+(c.amountDue||0), 0);
            const rate      = totalDue > 0 ? Math.round(totalPaid/totalDue*100) : 0;
            const owners    = ownersData.length;
            const props     = propertiesData.length;
            const heure     = new Date().getHours();
            const salut     = heure < 12 ? 'Bonjour' : heure < 18 ? 'Bonne après-midi' : 'Bonsoir';
            const fmt = n => Number(n).toLocaleString('fr-FR') + ' XOF';

            switch (intent) {
                case 'greeting':
                    return { text: `${salut} ! 👋 Je suis **SYGIA**, l'assistant IA de SYGIM.\n\nJe peux analyser vos données, répondre à vos questions métier et naviguer dans l'application pour vous.\n\n${total > 0 ? `📊 En ce moment : **${total}** clients · **${pending}** en attente · taux de recouvrement **${rate}%**` : '📊 Aucune donnée chargée. Commencez par ajouter des clients.'}`, actions: [] };

                case 'goodbye':
                    return { text: `À bientôt ! 👋 N'hésitez pas à me solliciter pour toute analyse.`, actions: [] };

                case 'merci':
                    return { text: `Avec plaisir ! 😊 Autre chose que je peux analyser pour vous ?`, actions: [] };

                case 'stats_global': {
                    const scorePerf = rate >= 90 ? 'ðŸŸ¢ Excellente' : rate >= 70 ? 'ðŸŸ¡ Satisfaisante' : '🔴 À améliorer';
                    return { text: `📊 **Vue d'ensemble du portefeuille**\n\n**Financier**\n• Total dû : **${fmt(totalDue)}**\n• Total encaissé : **${fmt(totalPaid)}**\n• Taux de recouvrement : **${rate}%**\n\n**Données**\n• Clients : **${total}** · Propriétaires : **${owners}** · Propriétés : **${props}**\n\n**Performance :** ${scorePerf}${pending > 0 ? `\n\n⚠️ **${pending} paiement(s) en attente** à régulariser.` : '\n\n✓ Aucun retard en cours.'}`, actions: [{ label: '📈 Tableau de bord', fn: () => switchPage('dashboard') }] };
                }

                case 'retards': {
                    const retardClients = clientsData.filter(c => c.status==='pending'||c.status==='overdue');
                    if (!retardClients.length) return { text: `✓ **Aucun retard de paiement !**\n\nTous les clients sont à jour. Excellent taux de recouvrement.`, actions: [] };
                    const totalRet = retardClients.reduce((s,c)=>s+(c.amountDue||0),0);
                    const top5 = retardClients.sort((a,b)=>b.amountDue-a.amountDue).slice(0,5);
                    return { text: `⚠️ **${retardClients.length} client(s) en retard**\n\nMontant impayé : **${fmt(totalRet)}**\n\n**Top retards :**\n`+top5.map((c,i)=>`${i+1}. ${c.lastName} ${c.firstName} — **${fmt(c.amountDue)}**`).join('\n')+`\n\n📣 Prioriser les relances sur les montants les plus élevés.`, actions: [{ label: '👥 Voir clients', fn: ()=>switchPage('clients') }] };
                }

                case 'revenus': {
                    const byAgent = {};
                    clientsData.forEach(c => { const ag=c.agent||'Non assigné'; byAgent[ag]=(byAgent[ag]||0)+(c.amountPaid||0); });
                    const agentLines = Object.entries(byAgent).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([ag,v])=>`• ${ag} : **${fmt(v)}**`).join('\n');
                    return { text: `💰 **Analyse des revenus**\n\n• Total encaissé : **${fmt(totalPaid)}**\n• Total attendu : **${fmt(totalDue)}**\n• Taux de collecte : **${rate}%**\n• Moyenne/client : **${fmt(total>0?Math.round(totalPaid/total):0)}**\n\n${agentLines ? `**Par récolteur :**\n${agentLines}` : ''}`, actions: [{ label: '💳 Transactions', fn: ()=>switchPage('transactions') }] };
                }

                case 'recouvrement': {
                    const grade = rate>=95?'A+ ðŸŒŸ':rate>=85?'A ðŸŸ¢':rate>=70?'B ðŸŸ¡':rate>=50?'C ðŸŸ ':'D 🔴';
                    const conseil = rate<70?'⚠️ Taux critique. Intensifiez les relances et envisagez des procédures de recouvrement.':rate<85?'📣 Contactez les clients en retard sous 48h.':'✓ Bon taux. Maintenez les relances préventives.';
                    return { text: `📈 **Taux de recouvrement : ${rate}% — Note ${grade}**\n\n• Encaissé : **${fmt(totalPaid)}** / **${fmt(totalDue)}**\n• Manque à gagner : **${fmt(totalDue-totalPaid)}**\n• Clients soldés : **${paid}** / ${total}\n\n${conseil}`, actions: [] };
                }

                case 'clients': {
                    const bySt = {}; clientsData.forEach(c=>{bySt[c.status]=(bySt[c.status]||0)+1;});
                    const stLbl = {paid:'✓ Payé',pending:'• En attente',partial:'🟫 Partiel',overdue:'🔴 Retard',inactive:'🚫 Inactif'};
                    return { text: `👥 **Clients (${total} au total)**\n\n**Par statut :**\n`+Object.entries(bySt).map(([s,n])=>`• ${stLbl[s]||s} : **${n}**`).join('\n'), actions: [{ label: '👥 Voir clients', fn: ()=>switchPage('clients') }] };
                }

                case 'client_search': {
                    if (names.length > 0) {
                        const q = names[0].toLowerCase();
                        const found = clientsData.filter(c=>c.lastName.toLowerCase().includes(q)||c.firstName.toLowerCase().includes(q));
                        if (!found.length) return { text: `🔍 Aucun client pour **"${names[0]}"**.`, actions: [{ label: '👥 Liste clients', fn: ()=>switchPage('clients') }] };
                        return { text: `🔍 **${found.length} résultat(s) pour "${names[0]}"**\n\n`+found.slice(0,5).map(c=>`• **${c.lastName} ${c.firstName}** — ${c.property||'N/A'} — ${c.status==='paid'?'✓':'•'} ${fmt(c.amountPaid||0)}`).join('\n'), actions: [{ label: '👥 Voir liste', fn: ()=>switchPage('clients') }] };
                    }
                    return { text: `🔍 Précisez le nom. Ex : *"Infos sur KONAN"*`, actions: [] };
                }

                case 'add_client':
                    return { text: `👤 **Ajouter un nouveau client**\n\nJe vais ouvrir le formulaire de création.\n\n**Informations requises :**\n• Nom et prénom · Propriété · Loyer · Date d'entrée`, actions: [{ label: '➜ Ouvrir formulaire', fn: ()=>{ switchPage('clients'); setTimeout(()=>openModal&&openModal('newClientModal'),300); } }] };

                case 'proprietaires': {
                    if (!owners) return { text: `ðŸ“‹ Aucun propriétaire enregistré.`, actions: [] };
                    const top = [...ownersData].sort((a,b)=>(b.totalRevenue||0)-(a.totalRevenue||0)).slice(0,3);
                    return { text: `ðŸ¢ **${owners} propriétaire(s)**\n\n**Top :**\n`+top.map((o,i)=>`${i+1}. ${o.lastName} ${o.firstName||''} — **${fmt(o.totalRevenue||0)}**`).join('\n'), actions: [{ label: 'ðŸ¢ Propriétaires', fn: ()=>switchPage('owners') }] };
                }

                case 'proprietes': {
                    if (!props) return { text: `ðŸ  Aucune propriété enregistrée.`, actions: [] };
                    const bySt = {}; propertiesData.forEach(p=>{bySt[p.status]=(bySt[p.status]||0)+1;});
                    return { text: `ðŸ  **${props} propriété(s)**\n\n**Par statut :**\n`+Object.entries(bySt).map(([s,n])=>`• ${s} : **${n}**`).join('\n'), actions: [{ label: 'ðŸ  Portefeuille', fn: ()=>switchPage('portfolio') }] };
                }

                case 'occupation': {
                    const loues  = propertiesData.filter(p=>p.status==='loue'||p.status==='actif').length;
                    const vacant = propertiesData.filter(p=>p.status==='vacant').length;
                    const occRate = props > 0 ? Math.round(loues/props*100) : 0;
                    return { text: `ðŸ  **Taux d'occupation : ${occRate}%**\n\n• Occupées : **${loues}** · Vacantes : **${vacant}** · Total : **${props}**\n\n${vacant>0?`📣 **${vacant} bien(s) à louer** — potentiel de revenus supplémentaires.`:'✓ Tout le parc est loué.'}`, actions: [{ label: 'ðŸ  Portefeuille', fn: ()=>switchPage('portfolio') }] };
                }

                case 'recolteurs': {
                    if (!collectorsData.length) return { text: `ðŸ‘· Aucun récolteur enregistré.`, actions: [] };
                    return { text: `ðŸ‘· **${collectorsData.length} récolteur(s)**\n\n`+collectorsData.map(c=>`• **${c.lastName}** — ${clientsData.filter(cl=>cl.agent===c.lastName).length} clients`).join('\n'), actions: [{ label: 'ðŸ‘· Récolteurs', fn: ()=>switchPage('collectors') }] };
                }

                case 'top_clients': {
                    if (!total) return { text: `Aucun client enregistré.`, actions: [] };
                    const top = [...clientsData].filter(c=>c.amountPaid>0).sort((a,b)=>{const ra=a.amountDue>0?a.amountPaid/a.amountDue:0,rb=b.amountDue>0?b.amountPaid/b.amountDue:0;return rb-ra;}).slice(0,5);
                    return { text: `ðŸ† **Top 5 meilleurs payeurs**\n\n`+top.map((c,i)=>{const r=c.amountDue>0?Math.round(c.amountPaid/c.amountDue*100):100;return `${['ðŸ¥‡','ðŸ¥ˆ','ðŸ¥‰','4ï¸âƒ£','5ï¸âƒ£'][i]} **${c.lastName} ${c.firstName}** — ${r}% *(${fmt(c.amountPaid)})*`;}).join('\n'), actions: [] };
                }

                case 'top_proprietaires': {
                    if (!owners) return { text: `Aucun propriétaire enregistré.`, actions: [] };
                    const top = [...ownersData].sort((a,b)=>(b.totalRevenue||0)-(a.totalRevenue||0)).slice(0,5);
                    return { text: `ðŸ† **Top propriétaires**\n\n`+top.map((o,i)=>`${['ðŸ¥‡','ðŸ¥ˆ','ðŸ¥‰','4ï¸âƒ£','5ï¸âƒ£'][i]} **${o.lastName} ${o.firstName||''} ** — **${fmt(o.totalRevenue||0)}**`).join('\n'), actions: [] };
                }

                case 'alertes': {
                    const alerts = [];
                    if (pending > 0) alerts.push(`🔴 **${pending} paiement(s) en retard** — ${fmt(clientsData.filter(c=>c.status==='pending'||c.status==='overdue').reduce((s,c)=>s+c.amountDue,0))} impayés`);
                    const vac = propertiesData.filter(p=>p.status==='vacant').length;
                    if (vac > 0) alerts.push(`ðŸŸ¡ **${vac} bien(s) vacant(s)**`);
                    if (rate < 70 && totalDue > 0) alerts.push(`🔴 **Taux de recouvrement critique : ${rate}%**`);
                    if (!alerts.length) return { text: `✓ **Aucune alerte critique.** Tout est sous contrôle.`, actions: [] };
                    return { text: `ðŸš¨ **${alerts.length} alerte(s) active(s)**\n\n`+alerts.join('\n\n'), actions: [{ label: '📊 Tableau de bord', fn: ()=>switchPage('dashboard') }] };
                }

                case 'simulation': {
                    const avgLoyer = total>0?Math.round(totalDue/total):50000;
                    return { text: `ðŸ”® **Simulation prévisionnelle**\n\n*Loyer moyen actuel : **${fmt(avgLoyer)}***\n\n• Dans **3 mois** : ~**${fmt(Math.round(totalPaid*1.03))}** *(+3%)*\n• Dans **6 mois** : ~**${fmt(Math.round(totalPaid*1.06))}** *(+6%)*\n• Dans **12 mois** : ~**${fmt(Math.round(totalPaid*1.12))}** *(+12%)*\n\n**Si 100% recouvrement :**\n• Gain mensuel : **${fmt(totalDue-totalPaid)}**\n• Sur 12 mois : **${fmt((totalDue-totalPaid)*12)}**`, actions: [{ label: '📈 Analyses', fn: ()=>switchPage('analytics') }] };
                }

                case 'commission': {
                    const totalComm = ownersData.reduce((s,o)=>s+Math.round((o.totalRevenue||0)*(o.commissionRate||0)/100),0);
                    return { text: `ðŸ’¼ **Commissions**\n\n• Total généré : **${fmt(totalComm)}**\n• Propriétaires : **${owners}**\n• Moyenne/propriétaire : **${fmt(owners>0?Math.round(totalComm/owners):0)}**`, actions: [{ label: 'ðŸ¢ Propriétaires', fn: ()=>switchPage('owners') }] };
                }

                case 'prefinancement':
                    return { text: `💳 **Préfinancements**\n\nSuivez les avances faites aux locataires et propriétaires depuis la section dédiée.`, actions: [{ label: '💳 Préfinancements', fn: ()=>switchPage('prefinancement') }] };

                case 'rapport':
                    return { text: `ðŸ“‹ **Génération de rapports**\n\n• 📊 Rapport mensuel\n• 👥 Rapport clients\n• ðŸ¢ Rapport propriétaires\n• ⚠️ Rapport retards\n• ðŸ  Rapport parc immobilier`, actions: [{ label: 'ðŸ“‹ Rapports', fn: ()=>switchPage('reports') }] };

                case 'paiement':
                    return { text: `💳 **Gestion des paiements**\n\nTotal encaissé à ce jour : **${fmt(totalPaid)}**\n\nEnregistrez un paiement depuis la page Transactions.`, actions: [{ label: '💳 Transactions', fn: ()=>switchPage('transactions') }] };

                case 'contrats':
                    return { text: `ðŸ“„ **Contrats de bail**\n\nConsultez et générez les baux depuis la section Clients.\n\n• Clients actifs : **${total}**`, actions: [{ label: 'ðŸ“„ Clients', fn: ()=>switchPage('clients') }] };

                case 'navigation': {
                    const pages = {dashboard:'dashboard',clients:'clients',proprietes:'portfolio',portfolio:'portfolio',proprietaires:'owners',transactions:'transactions',rapports:'reports',recolteurs:'collectors',analytique:'analytics'};
                    for (const [kw, page] of Object.entries(pages)) {
                        if (text.includes(kw)) { setTimeout(()=>switchPage(page),400); return { text: `✓ Navigation vers **${kw}**...`, actions: [] }; }
                    }
                    return { text: `ðŸ—ºï¸ Où aller ? Dites-moi : *tableau de bord, clients, portefeuille, transactions, rapports...*`, actions: [] };
                }

                case 'aide':
                    return { text: `ðŸ†˜ **Aide SYGIA**\n\n**Exemples de questions :**\n• *"Statistiques globales"*\n• *"Clients en retard"*\n• *"Taux de recouvrement"*\n• *"Cherche KONAN"*\n• *"Simulation 12 mois"*\n• *"Alertes actives"*\n• *"Top meilleurs payeurs"*\n• *"Analyse des commissions"*\n• *"Ouvre les rapports"*`, actions: [] };

                default: {
                    if (names.length > 0) {
                        const q = names[0].toLowerCase();
                        const found = clientsData.filter(c=>c.lastName.toLowerCase().includes(q)||c.firstName.toLowerCase().includes(q));
                        if (found.length > 0) {
                            const c = found[0];
                            return { text: `🔍 **${c.lastName} ${c.firstName}**\n\n• Propriété : **${c.property||'N/A'}**\n• Dû : **${fmt(c.amountDue)}** · Payé : **${fmt(c.amountPaid)}**\n• Statut : **${c.status}** · Agent : **${c.agent||'N/A'}**`, actions: [{ label: '👥 Voir liste', fn: ()=>switchPage('clients') }] };
                        }
                    }
                    return { text: `ðŸ¤” Je n'ai pas compris. Essayez :\n• *"Statistiques"*\n• *"Retards"*\n• *"Alertes"*\n\nTapez **"aide"** pour toutes les commandes.`, actions: [] };
                }
            }
        }



        // SYNCHRONISATION DES DONNÉES AVEC LA BD
        async function loadDataFromDatabase() {
            try {
                console.log('ðŸ“¡ Synchronisation des données depuis la BD...');
                
                // Charger les propriétés
                const propsResp = await API.Properties.getAll({ limit: 1000 });
                if (propsResp?.data) {
                    const props = Array.isArray(propsResp.data) ? propsResp.data : propsResp.data.data || [];
                    propertiesData.length = 0;
                    propertiesData.push(...props);
                    console.log(`✓ ${props.length} propriétés chargées`);
                }
                
                // Charger les propriétaires
                const ownersResp = await API.Owners.getAll({ limit: 1000 });
                if (ownersResp?.data) {
                    const owners = Array.isArray(ownersResp.data) ? ownersResp.data : ownersResp.data.data || [];
                    ownersData.length = 0;
                    ownersData.push(...owners);
                    console.log(`✓ ${owners.length} propriétaires chargés`);
                }
                
                // Charger les clients
                const clientsResp = await API.Clients.getAll({ limit: 1000 });
                if (clientsResp?.data) {
                    const clients = Array.isArray(clientsResp.data) ? clientsResp.data : clientsResp.data.data || [];
                    clientsData.length = 0;
                    clientsData.push(...clients);
                    console.log(`✓ ${clients.length} clients chargés`);
                }
                
                // Charger les collecteurs
                const collectorsResp = await API.Collectors.getAll({ limit: 1000 });
                if (collectorsResp?.data) {
                    const collectors = Array.isArray(collectorsResp.data) ? collectorsResp.data : collectorsResp.data.data || [];
                    collectorsData.length = 0;
                    collectorsData.push(...collectors);
                    console.log(`✓ ${collectors.length} collecteurs chargés`);
                }
                
                // Charger les transactions
                const txResp = await API.Transactions.getAll({ limit: 1000 });
                if (txResp?.data) {
                    const txs = Array.isArray(txResp.data) ? txResp.data : txResp.data.data || [];
                    transactionsData.length = 0;
                    transactionsData.push(...txs);
                    console.log(`✓ ${txs.length} transactions chargées`);
                }
                
                console.log('✓ Synchronisation complétée!');
                return true;
            } catch (error) {
                console.warn('⚠️ Erreur synchronisation BD:', error);
                console.log('ðŸ“Œ Utilisation données locales');
                return false;
            }
        }

        // FONCTIONS AUTHENTIFICATION
                async function login() {
            const usernameRaw = (document.getElementById('loginUsername') || document.getElementById('email'))?.value.trim();
            const password    = document.getElementById('loginPassword').value;
            const alertError  = document.getElementById('alertError');

            if (!usernameRaw || !password) {
                alertError.textContent = 'Veuillez entrer votre nom et votre mot de passe.';
                alertError.classList.add('show');
                return;
            }

            try {
                // Appel à l'API d'authentification du backend
                const response = await fetch(CONFIG.API.BASE + '/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username: usernameRaw, password })
                });

                const data = await response.json();

                if (!response.ok || !data.success) {
                    alertError.textContent = data.error || 'Identifiants incorrects.';
                    alertError.classList.add('show');
                    console.error('Erreur auth:', data);
                    return;
                }

                // Stocker le JWT
                localStorage.setItem(CONFIG.STORAGE.JWT_TOKEN, data.token);
                localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, JSON.stringify(data.user));
                
                // Mettre à jour le client HTTP en mémoire
                if (window.httpClient) {
                    window.httpClient.setToken(data.token);
                }

                alertError.classList.remove('show');
                const account = data.user;
                const userType = account.role || account.userType;
                currentUser = {
                    id:            account.id,
                    username:      account.username,
                    role:          userType,
                    userType:      userType,
                    firstName:     account.firstName || account.first_name || '',
                    lastName:      account.lastName || account.last_name || '',
                    displayName:   account.displayName || account.display_name || '',
                    avatar:        account.avatar || '',
                    email:         account.email || '',
                    collectorName: account.collectorName || account.collector_name || '',
                    collectorId:   null // sera résolu ci-dessous si role=collector
                };

                console.log('✓ Connexion réussie:', currentUser.displayName, userType);

                // Cacher l'authentification
                document.getElementById('authContainer').classList.add('hidden');
                
                // ðŸ“¡ Synchroniser les données avec la BD
                await loadDataFromDatabase().catch(err => console.warn('Sync BD non critique:', err));

                // Résoudre le collector_id si l'utilisateur est un récolteur
                if (userType === 'collector' && currentUser.id) {
                    const matchedCollector = collectorsData.find(c => c.user_id === currentUser.id);
                    if (matchedCollector) {
                        currentUser.collectorId = matchedCollector.id;
                        console.log('✓ Collector ID résolu:', matchedCollector.id);
                    }
                }

                // â”€â”€ Administrateur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if (userType === 'admin') {
                    document.getElementById('adminMain').style.display = 'flex';
                    document.getElementById('adminAvatar').textContent = currentUser.avatar || 'ADM';
                    document.getElementById('adminName').textContent   = currentUser.displayName || 'Administrateur';
                    const maintBadge = document.getElementById('adminMaintenanceBadge');
                    if (maintBadge) maintBadge.style.display = SYGIM_SETTINGS?.maintenanceMode ? 'inline-flex' : 'none';
                    adminShowTab('access');
                    adminLoadUsers();  // â† Charger les utilisateurs depuis le backend
                    adminRenderStats();
                    adminLoadSettings();
                }
                // â”€â”€ Récolteur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                else if (userType === 'collector') {
                    const collectorKey = (currentUser.collectorName || '').toUpperCase();
                    const matchedAgent = collectorsData.find(c =>
                        c.lastName.toUpperCase() === collectorKey
                    ) || null;

                    document.getElementById('collectorMain').classList.add('active');

                    if (matchedAgent) {
                        const initials = (matchedAgent.lastName.charAt(0) + (matchedAgent.firstName.charAt(0)||'')).toUpperCase();
                        document.getElementById('collectorAvatar').textContent = initials;
                        document.getElementById('collectorName').textContent = matchedAgent.lastName + ' ' + matchedAgent.firstName;
                        document.getElementById('collectorAgentBadge').textContent = 'Agent récolteur · ' + (matchedAgent.lotsOccupes || 0) + ' locataires';
                        
                        const agentClients = clientsData.filter(c => c.agent === matchedAgent.lastName);
                        const banner = document.getElementById('collectorAgentBanner');
                        if (banner) {
                            banner.style.display = 'flex';
                            document.getElementById('bannerAvatar').textContent = matchedAgent.lastName.charAt(0);
                            document.getElementById('bannerAgentName').textContent = matchedAgent.lastName + ' ' + matchedAgent.firstName;
                            document.getElementById('bannerTotalClients').textContent = agentClients.length;
                            const encaisse = agentClients.reduce((s,c) => s+c.amountPaid,0);
                            const due = agentClients.reduce((s,c) => s+c.amountDue,0);
                            document.getElementById('bannerEncaisse').textContent = encaisse.toLocaleString();
                            document.getElementById('bannerRetard').textContent = agentClients.filter(c => c.status === 'overdue' || c.status === 'pending').length;
                            document.getElementById('bannerTaux').textContent = due > 0 ? Math.round(encaisse/due*100)+'%' : '0%';
                        }
                        document.getElementById('collectorAlertMsg') && (document.getElementById('collectorAlertMsg').textContent = 
                            `Bonjour ${matchedAgent.lastName} ! Vous gérez ${agentClients.length} locataires.`);
                        loadCollectorClientCards(agentClients);
                    } else {
                        document.getElementById('collectorAvatar').textContent = currentUser.avatar || 'RC';
                        document.getElementById('collectorName').textContent = currentUser.collectorName || 'Récolteur de Loyer';
                        loadCollectorClientCards();
                    }
                }
                // â”€â”€ Manager de récolteurs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                else if (userType === 'collector_manager') {
                    document.getElementById('collectorManagerMain').style.display = 'block';
                    document.getElementById('managerAvatar').textContent = currentUser.avatar || 'MGR';
                    document.getElementById('managerName').textContent = currentUser.displayName || 'Responsable des Récolteurs';
                    loadManagerDashboard();
                    setTimeout(buildCollectorDayGrid, 400);
                }
                // â”€â”€ Directeur / Comptable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                else {
                    document.getElementById('appContainer').classList.remove('hidden');
                    
                    if (userType === 'director') {
                        document.getElementById('userAvatar').textContent = currentUser.avatar || 'DIR';
                        document.getElementById('userName').textContent = currentUser.displayName || 'Direction Générale';
                        document.getElementById('pageTitle').textContent = 'Tableau de bord Direction';
                        document.getElementById('ownerMenu').style.display = 'flex';
                        document.getElementById('clientBadge').textContent = clientsData.filter(c => c.status === 'pending').length;
                    } else if (userType === 'accounting') {
                        document.getElementById('userAvatar').textContent = currentUser.avatar || 'CPT';
                        document.getElementById('userName').textContent = currentUser.displayName || 'Service Comptabilité';
                        document.getElementById('pageTitle').textContent = 'Tableau de bord Comptabilité';
                        document.getElementById('ownerMenu').style.display = 'flex';
                        document.getElementById('clientBadge').textContent = clientsData.filter(c => c.status === 'pending').length;
                    }

                    updateOverdueStatuses();
                    loadDashboard();
                    initCharts();
                    updatePortfolioStats();
                }

                if (isDarkTheme) {
                    document.body.classList.add('dark-mode');
                }
            } catch (error) {
                console.error('Erreur connexion:', error);
                const alertError = document.getElementById('alertError');
                alertError.textContent = 'Erreur de connexion. Essayez de nouveau.';
                alertError.classList.add('show');
            }
        }
                // NOUVELLES DONNÉES POUR LES RÉCOLTEURS
        let collectorsData = [
        ];

        // Biens assignables (propriétés sans récolteur)
        let assignableProperties = [];

        // Données de performance des récolteurs
        let collectorPerformance = {
            monthly: []
        };

        // Biens assignés au responsable lui-même
        let managerProperties = [];

        // Variables globales
        let selectedPropertiesForAssign = new Set();
        let currentManagerTab = 'collectors';

        // FONCTIONS POUR LE RESPONSABLE DES RÉCOLTEURS

        function loadManagerDashboard() {
            // Synchroniser assignedProperties depuis les vrais locataires
            collectorsData.forEach(collector => {
                const agentClients = clientsData.filter(c =>
                    (c.agent      || '').toUpperCase() === (collector.lastName || '').toUpperCase() ||
                    (c.collector  || '').toUpperCase() === (collector.lastName || '').toUpperCase() ||
                    c.collectorId === collector.id
                );
                collector.assignedProperties = agentClients.map(c => c.id);
                collector.performance.clients = agentClients.filter(c => (c.statusOccupation||'') === 'Occupé').length;
                collector.performance.collected = agentClients.reduce((s,c) => s + (c.amountPaid||0), 0);
                collector.performance.due = agentClients.reduce((s,c) => s + (c.amountDue||0), 0);
                collector.performance.collectionRate = collector.performance.due > 0 ?
                    Math.round(collector.performance.collected / collector.performance.due * 100) : 0;
                collector.performance.lateClients = agentClients.filter(c => c.status === 'overdue' || c.status === 'pending').length;
            });
            // Initialiser les biens assignables
            assignableProperties = propertiesData.filter(p => 
                !collectorsData.some(c => c.assignedProperties.includes(p.id)) &&
                (p.status === 'loue' || p.status === 'partiel')
            );
            
            loadCollectorsGrid();
            loadAvailablePropertiesList();
            loadCollectorPerformance();
            loadManagerClientList();
            updateManagerStats();
            initCollectorPerformanceChart();
        }


        function filterManagerProperties() {
            const ownerFilter = document.getElementById('propTabOwnerFilter');
            const typeFilter  = document.getElementById('propTabTypeFilter');
            const statusFilter= document.getElementById('propTabStatusFilter');
            const searchEl    = document.getElementById('managerPropertySearch');
            const searchTerm  = searchEl ? searchEl.value.trim().toLowerCase() : '';
            const tbody       = document.getElementById('managerPropertiesBody');
            if (!tbody) return;

            // Construire la liste à partir de propertiesData (les vrais biens)
            let rows = propertiesData.slice();

            // Filtre propriétaire
            if (ownerFilter && ownerFilter.value !== 'all') {
                rows = rows.filter(p => {
                    const ownerName = ownersData.find(o => o.id === p.ownerId);
                    return ownerName && (ownerName.lastName + ' ' + ownerName.firstName) === ownerFilter.value;
                });
            }

            // Filtre type
            if (typeFilter && typeFilter.value !== 'all') {
                rows = rows.filter(p => p.type === typeFilter.value);
            }

            // Filtre statut
            if (statusFilter && statusFilter.value !== 'all') {
                rows = rows.filter(p => p.status === statusFilter.value);
            }

            // Filtre texte (sur name, address, id)
            if (searchTerm) {
                rows = rows.filter(p =>
                    (p.name || '').toLowerCase().includes(searchTerm) ||
                    (p.address || '').toLowerCase().includes(searchTerm) ||
                    (p.id ? p.id.toString() : '').includes(searchTerm) ||
                    ((p.lastName || '') + ' ' + (p.firstName || '')).toLowerCase().includes(searchTerm)
                );
            }

            if (rows.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:30px;color:var(--gray);">Aucun résultat</td></tr>';
                return;
            }

            tbody.innerHTML = rows.map(p => {
                const owner = ownersData.find(o => o.id === p.ownerId);
                const ownerName = owner ? (owner.lastName + ' ' + owner.firstName) : '—';
                
                const statut = p.status === 'loue' ? 
                    '<span class="status-badge paid">Loué</span>' : 
                    p.status === 'vacant' ? '<span class="status-badge pending">Vacant</span>' :
                    p.status === 'en_renovation' ? '<span class="status-badge warning">Rénovation</span>' :
                    '<span class="status-badge">Autre</span>';
                
                const rent = p.rent ? p.rent.toLocaleString() + ' XOF' : '—';
                const value = p.value ? p.value.toLocaleString() + ' XOF' : '—';
                
                return `<tr>
                    <td>${p.name || '—'}</td>
                    <td>${p.id || '—'}</td>
                    <td>${p.address || '—'}</td>
                    <td>${ownerName}</td>
                    <td>${p.collectorId || '—'}</td>
                    <td>${rent}</td>
                    <td>${statut}</td>
                    <td>${value}</td>
                    <td>
                        <button class="btn btn-icon btn-danger btn-small" title="Supprimer cette propriété" 
                                onclick="deleteManagerProperty(${p.id})" style="padding:6px 10px;">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }

        function initManagerPropertiesFilter() {
            const ownerFilter = document.getElementById('propTabOwnerFilter');
            if (!ownerFilter) return;
            // Remplir avec les vraies propriétaires depuis ownersData
            const uniqueOwners = ownersData.slice().sort((a, b) => a.lastName.localeCompare(b.lastName));
            ownerFilter.innerHTML = '<option value="all">Tous les propriétaires</option>' +
                uniqueOwners.map(o => `<option value="${o.lastName} ${o.firstName}">${o.lastName} ${o.firstName}</option>`).join('');
            filterManagerProperties();
        }

        function switchManagerTab(tabName) {
            if (tabName === 'properties') {
                setTimeout(initManagerPropertiesFilter, 100);
            }
            // Mettre à jour la variable globale
            currentManagerTab = tabName;
            
            // Mettre à jour les onglets
            document.querySelectorAll('#collectorManagerMain .tab').forEach(tab => {
                tab.classList.remove('active');
            });
            document.querySelectorAll('#collectorManagerMain .tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Activer l'onglet sélectionné
            document.querySelector(`#collectorManagerMain .tab[onclick*="${tabName}"]`).classList.add('active');
            document.getElementById(tabName + 'Tab').classList.add('active');
            
            // Charger les données selon l'onglet
            if (tabName === 'collectors') {
                loadCollectorsGrid();
            } else if (tabName === 'assignment') {
                loadAvailablePropertiesList();
            } else if (tabName === 'performance') {
                loadCollectorPerformance();
            } else if (tabName === 'my-collection') {
                loadManagerClientList();
            } else if (tabName === 'properties') {
                initManagerPropertiesFilter();
                filterManagerProperties();
            }
        }

        function loadCollectorsGrid() {
            const grid = document.getElementById('collectorsGrid');
            if (!grid) return;

            if (!collectorsData || collectorsData.length === 0) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px 20px;color:var(--gray);">
                    <i class="fas fa-user-slash" style="font-size:36px;opacity:.25;display:block;margin-bottom:14px;"></i>
                    <strong style="display:block;margin-bottom:6px;">Aucun récolteur enregistré</strong>
                    <div style="font-size:13px;">Cliquez sur Â« Ajouter un récolteur Â» pour commencer.</div>
                </div>`;
                return;
            }
            
            const html = collectorsData.map(collector => {
                const assigned = collector.assignedProperties || [];
                const assignedCount = assigned.length;
                const properties = propertiesData.filter(p => assigned.includes(p.id));
                const totalDue = properties.reduce((sum, p) => sum + (p.rent || 0), 0);
                
                return `
                    <div class="collector-assignment-card">
                        <div class="collector-header">
                            <div class="collector-avatar-small">${collector.firstName.charAt(0)}${collector.lastName.charAt(0)}</div>
                            <div class="collector-info">
                                <h4>${collector.lastName} ${collector.firstName}</h4>
                                <p><i class="fas fa-phone"></i> ${collector.phone}</p>
                                <p><i class="fas fa-map-marker-alt"></i> ${collector.zone}</p>
                                <p style="margin-top:4px;">
                                    ${collector.paymentDay
                                        ? `<span style="background:rgba(245,158,11,.12);color:#92400e;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;"><i class="fas fa-calendar-check"></i> ${collector.paymentDay==='dernier'?'Dernier jour':'Le '+collector.paymentDay}</span>`
                                        : `<span style="background:rgba(239,68,68,.1);color:var(--danger);padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;"><i class="fas fa-calendar-times"></i> Jour non fixé</span>`
                                    }
                                </p>
                            </div>
                        </div>
                        
                        <div class="collector-stats">
                            <div class="collector-stat">
                                <div class="collector-stat-value">${assignedCount}</div>
                                <div class="collector-stat-label">Biens</div>
                            </div>
                            <div class="collector-stat">
                                <div class="collector-stat-value xof">${collector.performance.collected.toLocaleString()}</div>
                                <div class="collector-stat-label">Collecté</div>
                            </div>
                            <div class="collector-stat">
                                <div class="collector-stat-value">${collector.performance.collectionRate}%</div>
                                <div class="collector-stat-label">Taux</div>
                            </div>
                        </div>
                        
                        <div class="collector-properties-list">
                            ${properties.map(p => `
                                <div class="property-assignment-item">
                                    <span class="property-assignment-name">${p.name}</span>
                                    <span class="property-assignment-rent xof">${p.rent ? p.rent.toLocaleString() : 'N/A'}</span>
                                </div>
                            `).join('')}
                        </div>
                        
                        <div class="assignment-actions">
                            <button class="btn btn-outline btn-small" onclick="openAssignPropertyModal(${collector.id})">
                                <i class="fas fa-plus"></i> Assigner
                            </button>
                            <button class="btn btn-outline btn-small" onclick="viewCollectorDetails(${collector.id})">
                                <i class="fas fa-eye"></i> Détails
                            </button>
                            <button class="btn btn-outline btn-small" onclick="editCollector(${collector.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            grid.innerHTML = html;
        }

        function loadAvailablePropertiesList() {
            const list = document.getElementById('availablePropertiesList');
            const ownerFilter = document.getElementById('propertyOwnerFilter');
            const typeFilter = document.getElementById('propertyTypeFilter');
            const searchInput = document.getElementById('assignmentSearch');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
            
            // Mettre à jour le filtre des propriétaires (depuis les vrais propriétaires des locataires)
            if (ownerFilter) {
                const currentVal = ownerFilter.value;
                const uniqueOwners = [...new Set(clientsData.map(c => c.property).filter(Boolean))].sort();
                ownerFilter.innerHTML = '<option value="all">Tous les propriétaires</option>' +
                    uniqueOwners.map(name =>
                        `<option value="${name}" ${name === currentVal ? 'selected' : ''}>${name}</option>`
                    ).join('');
            }
            
            // Filtrer les biens assignables
            let filteredProperties = assignableProperties;
            
            if (ownerFilter && ownerFilter.value !== 'all') {
                filteredProperties = filteredProperties.filter(p => p.property === ownerFilter.value || p.owner === ownerFilter.value);
            }
            
            if (typeFilter && typeFilter.value !== 'all') {
                filteredProperties = filteredProperties.filter(p => p.type === typeFilter.value);
            }

            // Filtre texte multi-champs
            if (searchTerm) {
                filteredProperties = filteredProperties.filter(p => {
                    const owner = ownersData.find(o => o.id === p.ownerId);
                    const ownerName = owner ? (owner.lastName + ' ' + owner.firstName).toLowerCase() : '';
                    return (
                        (p.name || '').toLowerCase().includes(searchTerm) ||
                        (p.address || '').toLowerCase().includes(searchTerm) ||
                        (p.type || '').toLowerCase().includes(searchTerm) ||
                        ownerName.includes(searchTerm)
                    );
                });
            }

            // Compteur de résultats
            const countEl = document.getElementById('assignmentResultCount');
            if (countEl) {
                if (searchTerm || (ownerFilter && ownerFilter.value !== 'all') || (typeFilter && typeFilter.value !== 'all')) {
                    countEl.textContent = `${filteredProperties.length} bien(s) trouvé(s) sur ${assignableProperties.length}`;
                } else {
                    countEl.textContent = `${assignableProperties.length} bien(s) disponible(s)`;
                }
            }
            
            if (filteredProperties.length === 0) {
                list.innerHTML = `
                    <div style="text-align:center;padding:40px 20px;color:var(--gray);">
                        <i class="fas fa-search" style="font-size:32px;opacity:.3;display:block;margin-bottom:12px;"></i>
                        <div style="font-size:15px;">Aucun bien trouvé</div>
                        <div style="font-size:13px;margin-top:6px;">Modifiez vos critères de recherche</div>
                    </div>`;
                updateBulkAssignBar();
                return;
            }

            const html = filteredProperties.map(property => {
                const owner = ownersData.find(o => o.id === property.ownerId);
                const isSelected = selectedPropertiesForAssign.has(property.id);
                // Surligner le terme recherché
                const highlight = (text) => {
                    if (!searchTerm || !text) return text || '';
                    const re = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                    return text.replace(re, '<mark style="background:rgba(99,102,241,.18);border-radius:3px;padding:0 2px;">$1</mark>');
                };
                
                return `
                    <div class="property-selector" style="${isSelected ? 'background:rgba(99,102,241,.06);' : ''}">
                        <div>
                            <input type="checkbox" class="property-checkbox" 
                                   value="${property.id}" 
                                   ${isSelected ? 'checked' : ''}
                                   onchange="togglePropertySelection(${property.id})">
                        </div>
                        <div>${highlight(property.name)}</div>
                        <div>${owner ? highlight(owner.lastName + ' ' + owner.firstName) : 'N/A'}</div>
                        <div class="xof">${property.rent ? property.rent.toLocaleString() : 'N/A'}</div>
                        <div>
                            <select class="btn btn-outline btn-small" onchange="quickAssignProperty(${property.id}, this.value)">
                                <option value="">Assigner à...</option>
                                ${collectorsData.map(c => 
                                    `<option value="${c.id}">${c.lastName} ${c.firstName}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                `;
            }).join('');
            
            list.innerHTML = html;
            
            // Mettre à jour la barre d'assignation groupée
            updateBulkAssignBar();
            
            // Mettre à jour le sélecteur groupé
            const bulkSelect = document.getElementById('bulkAssignCollector');
            if (bulkSelect) {
                bulkSelect.innerHTML = '<option value="">Choisir un récolteur</option>' +
                    collectorsData.map(c => 
                        `<option value="${c.id}">${c.lastName} ${c.firstName}</option>`
                    ).join('');
            }
        }

        function filterAvailableProperties() {
            // Gérer le bouton clear
            const searchInput = document.getElementById('assignmentSearch');
            const clearBtn = document.getElementById('assignmentSearchClear');
            if (searchInput && clearBtn) {
                clearBtn.style.display = searchInput.value ? 'block' : 'none';
            }
            loadAvailablePropertiesList();
        }

        function resetAssignmentFilters() {
            const s = document.getElementById('assignmentSearch');
            const o = document.getElementById('propertyOwnerFilter');
            const t = document.getElementById('propertyTypeFilter');
            if (s) s.value = '';
            if (o) o.value = 'all';
            if (t) t.value = 'all';
            const clearBtn = document.getElementById('assignmentSearchClear');
            if (clearBtn) clearBtn.style.display = 'none';
            loadAvailablePropertiesList();
        }

        function togglePropertySelection(propertyId) {
            if (selectedPropertiesForAssign.has(parseInt(propertyId))) {
                selectedPropertiesForAssign.delete(parseInt(propertyId));
            } else {
                selectedPropertiesForAssign.add(parseInt(propertyId));
            }
            
            updateBulkAssignBar();
        }

        function updateBulkAssignBar() {
            const bar = document.getElementById('bulkAssignBar');
            const countSpan = document.getElementById('selectedPropertiesCount');
            
            countSpan.textContent = selectedPropertiesForAssign.size;
            
            if (selectedPropertiesForAssign.size > 0) {
                bar.classList.add('show');
            } else {
                bar.classList.remove('show');
            }
        }

        function clearPropertySelection() {
            selectedPropertiesForAssign.clear();
            updateBulkAssignBar();
            loadAvailablePropertiesList();
        }

        function quickAssignProperty(propertyId, collectorId) {
            if (!collectorId) return;
            
            const collector = collectorsData.find(c => c.id == collectorId);
            if (!collector) return;
            
            if (confirm(`Assigner ce bien à ${collector.lastName} ${collector.firstName} ?`)) {
                // Ajouter le bien au récolteur
                collector.assignedProperties.push(parseInt(propertyId));
                
                // Mettre à jour les performances
                const property = propertiesData.find(p => p.id == propertyId);
                if (property && property.rent) {
                    collector.performance.due += property.rent;
                    collector.performance.clients++;
                    collector.performance.collectionRate = Math.round((collector.performance.collected / collector.performance.due) * 100);
                }
                
                // Retirer des biens assignables
                assignableProperties = assignableProperties.filter(p => p.id !== propertyId);
                
                // Mettre à jour l'affichage
                loadAvailablePropertiesList();
                loadCollectorsGrid();
                updateManagerStats();
                
                showAlert(`✓ Bien assigné à ${collector.lastName} ${collector.firstName}`, 'success');
            }
        }

        function bulkAssignProperties() {
            const collectorId = document.getElementById('bulkAssignCollector').value;
            
            if (!collectorId) {
                showAlert('Veuillez sélectionner un récolteur', 'error');
                return;
            }
            
            if (selectedPropertiesForAssign.size === 0) {
                showAlert('Veuillez sélectionner au moins un bien', 'error');
                return;
            }
            
            const collector = collectorsData.find(c => c.id == collectorId);
            
            if (confirm(`Assigner ${selectedPropertiesForAssign.size} bien(s) à ${collector.lastName} ${collector.firstName} ?`)) {
                // Assigner tous les biens sélectionnés
                let totalRent = 0;
                selectedPropertiesForAssign.forEach(propertyId => {
                    collector.assignedProperties.push(parseInt(propertyId));
                    
                    const property = propertiesData.find(p => p.id == propertyId);
                    if (property && property.rent) {
                        totalRent += property.rent;
                    }
                    
                    assignableProperties = assignableProperties.filter(p => p.id !== propertyId);
                });
                
                // Mettre à jour les performances
                collector.performance.due += totalRent;
                collector.performance.clients += selectedPropertiesForAssign.size;
                collector.performance.collectionRate = Math.round((collector.performance.collected / collector.performance.due) * 100);
                
                const assignedCount = selectedPropertiesForAssign.size;
                // Réinitialiser la sélection
                selectedPropertiesForAssign.clear();
                
                // Mettre à jour l'affichage
                loadAvailablePropertiesList();
                loadCollectorsGrid();
                updateManagerStats();
                updateBulkAssignBar();
                
                showAlert(`✓ ${assignedCount} bien(s) assigné(s) à ${collector.lastName} ${collector.firstName}`, 'success');
            }
        }

        function openAssignPropertyModal(collectorId) {
            const collector = collectorId ? collectorsData.find(c => c.id === collectorId) : null;

            const nameEl = document.getElementById('assignCollectorName');
            if (nameEl) nameEl.value = collector
                ? `${collector.lastName} ${collector.firstName}`
                : 'Sélection multiple';

            const propertySelect = document.getElementById('assignPropertySelect');
            propertySelect.innerHTML = '<option value="">-- Choisir un bien --</option>' +
                assignableProperties.map(p =>
                    `<option value="${p.id}">${p.name} — ${p.address} (${(p.rent||0).toLocaleString()} XOF/mois)</option>`
                ).join('');

            // Stocker l'ID du récolteur
            if (collectorId) propertySelect.dataset.collectorId = collectorId;

            // Date par défaut = aujourd'hui
            const dateEl = document.getElementById('assignDate');
            if (dateEl) dateEl.value = new Date().toISOString().split('T')[0];

            // Aperçu au changement de sélection
            propertySelect.onchange = function() {
                const pid = parseInt(this.value);
                const preview = document.getElementById('assignPropertyPreview');
                if (!pid || !preview) return;
                const prop = propertiesData.find(p => p.id === pid);
                if (!prop) { preview.style.display='none'; return; }
                document.getElementById('assignPropName').textContent    = prop.name;
                document.getElementById('assignPropAddress').textContent = prop.address;
                document.getElementById('assignPropRent').textContent    = (prop.rent||0).toLocaleString();
                preview.style.display = 'block';
            };

            // Reset preview
            const preview = document.getElementById('assignPropertyPreview');
            if (preview) preview.style.display = 'none';

            openModal('assignPropertyModal');
        }

        function confirmPropertyAssignment() {
            const propertySelect = document.getElementById('assignPropertySelect');
            const propertyId = parseInt(propertySelect.value);
            const collectorId = parseInt(propertySelect.dataset.collectorId);
            const assignDate = document.getElementById('assignDate').value;
            
            if (!propertyId) {
                showAlert('Veuillez sélectionner un bien', 'error');
                return;
            }
            
            const collector = collectorsData.find(c => c.id === collectorId);
            if (!collector) {
                showAlert('âŒ Récolteur introuvable. Veuillez sélectionner un récolteur valide.', 'error');
                return;
            }
            
            // Ajouter le bien au récolteur
            collector.assignedProperties.push(propertyId);
            
            // Mettre à jour les performances
            const property = propertiesData.find(p => p.id == propertyId);
            if (property && property.rent) {
                collector.performance.due += property.rent;
                collector.performance.clients++;
                collector.performance.collectionRate = Math.round((collector.performance.collected / collector.performance.due) * 100);
            }
            
            // Retirer des biens assignables
            assignableProperties = assignableProperties.filter(p => p.id !== propertyId);
            
            // Mettre à jour l'affichage
            loadAvailablePropertiesList();
            loadCollectorsGrid();
            
            closeModal('assignPropertyModal');
            showAlert(`Bien assigné à ${collector.lastName} ${collector.firstName}`, 'success');
        }

        function viewCollectorDetails(collectorId) {
            const collector = collectorsData.find(c => c.id === collectorId);
            if (!collector) return;
            
            const properties = propertiesData.filter(p => collector.assignedProperties.includes(p.id));
            const totalDue = properties.reduce((sum, p) => sum + (p.rent || 0), 0);
            
            let html = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <div class="collector-avatar-small" style="width: 80px; height: 80px; font-size: 32px; margin: 0 auto;">
                        ${collector.firstName.charAt(0)}${collector.lastName.charAt(0)}
                    </div>
                    <h3 style="margin-top: 10px;">${collector.lastName} ${collector.firstName}</h3>
                    <p style="color: var(--gray);">${collector.email}</p>
                </div>
                
                <div class="stats-grid" style="grid-template-columns: 1fr 1fr;">
                    <div class="stat-card">
                        <div class="stat-label">Biens assignés</div>
                        <div class="stat-value">${(collector.assignedProperties||[]).length}</div>
                    </div>
                    <div class="stat-card success">
                        <div class="stat-label">Montant dû total</div>
                        <div class="stat-value xof">${totalDue.toLocaleString()}</div>
                    </div>
                    <div class="stat-card info">
                        <div class="stat-label">Collecté ce mois</div>
                        <div class="stat-value xof">${collector.performance.collected.toLocaleString()}</div>
                    </div>
                    <div class="stat-card ${collector.performance.collectionRate > 90 ? 'success' : 'warning'}">
                        <div class="stat-label">Taux de collecte</div>
                        <div class="stat-value">${collector.performance.collectionRate}%</div>
                    </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px;">
                    <div style="background:rgba(245,158,11,.06);border:1.5px solid rgba(245,158,11,.2);border-radius:10px;padding:14px;text-align:center;">
                        <div style="font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;margin-bottom:6px;">Jour de versement</div>
                        <div style="font-size:20px;font-weight:800;color:#92400e;">
                            ${collector.paymentDay ? (collector.paymentDay === 'dernier' ? '📅 Fin de mois' : 'Le ' + collector.paymentDay) : '—'}
                        </div>
                        <div style="font-size:11px;color:var(--gray);margin-top:2px;">${collector.paymentDay ? 'Versement chaque mois' : 'Non configuré'}</div>
                    </div>
                </div>
                
                <h4 style="margin: 20px 0 10px; color: var(--primary);">Biens assignés</h4>
                <div style="max-height: 300px; overflow-y: auto;">
                    <table style="width: 100%;">
                        <thead>
                            <tr>
                                <th>Bien</th>
                                <th>Adresse</th>
                                <th>Locataire</th>
                                <th>Loyer</th>
                                <th>Statut</th>
                            </tr>
                        </thead>
                        <tbody>
            `;
            
            properties.forEach(property => {
                const tenant = clientsData.find(c => c.id === property.tenantId);
                html += `
                    <tr>
                        <td>${property.name}</td>
                        <td>${property.address}</td>
                        <td>${tenant ? tenant.lastName + ' ' + tenant.firstName : 'N/A'}</td>
                        <td class="xof">${property.rent ? property.rent.toLocaleString() : 'N/A'}</td>
                        <td><span class="status-badge ${getPropertyStatusClass(property.status)}">${getPropertyStatusText(property.status)}</span></td>
                    </tr>
                `;
            });
            
            html += `
                        </tbody>
                    </table>
                </div>
                
                <h4 style="margin: 20px 0 10px; color: var(--primary);">Performance mensuelle</h4>
                <div style="height: 200px;">
                    <canvas id="collectorDetailChart"></canvas>
                </div>
            `;
            
            document.getElementById('collectorDetailsContent').innerHTML = html;
            document.getElementById('collectorDetailsName').textContent = `${collector.lastName} ${collector.firstName}`;

            // Câbler le bouton "Modifier"
            const editBtn = document.getElementById('collectorDetailsEditBtn');
            if (editBtn) {
                editBtn.setAttribute('onclick', `closeModal('collectorDetailsModal'); editCollector(${collectorId});`);
            }

            openModal('collectorDetailsModal');

            // Initialiser le graphique de performance
            setTimeout(() => {
                initCollectorDetailChart(collectorId);
            }, 100);
        }

        function initCollectorDetailChart(collectorId) {
            const ctx = document.getElementById('collectorDetailChart')?.getContext('2d');
            if (!ctx) return;
            
            const collectorIndex = collectorsData.findIndex(c => c.id === collectorId);
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: collectorPerformance.monthly.map(m => m.month),
                    datasets: [{
                        label: 'Taux de collecte (%)',
                        data: collectorPerformance.monthly.map(m => m.collectors[collectorIndex]),
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });
        }

        function editCollector(collectorId) {
            const collector = collectorsData.find(c => c.id === collectorId);
            if (!collector) return;

            // Construire la grille d'abord
            buildCollectorDayGrid();

            // Pré-remplir les champs du modal addCollectorModal
            document.getElementById('collectorLastName').value  = collector.lastName  || '';
            document.getElementById('collectorFirstName').value = collector.firstName || '';
            document.getElementById('collectorEmail').value     = collector.email     || '';
            document.getElementById('collectorPhone').value     = collector.phone     || '';
            const statusEl = document.getElementById('collectorStatus');
            if (statusEl) statusEl.value = collector.status || 'active';

            // Changer le titre et le bouton en mode "édition"
            document.getElementById('addCollectorModalTitle').textContent = `Modifier — ${collector.lastName} ${collector.firstName}`;
            const btn = document.getElementById('addCollectorSaveBtn');
            if (btn) {
                btn.setAttribute('onclick', `saveEditCollector(${collectorId})`);
                btn.innerHTML = '<i class="fas fa-save"></i> Enregistrer les modifications';
            }
            openModal('addCollectorModal');
        }

        function saveEditCollector(collectorId) {
            const collector = collectorsData.find(c => c.id === collectorId);
            if (!collector) return;

            const lastName  = document.getElementById('collectorLastName').value.trim();
            const firstName = document.getElementById('collectorFirstName').value.trim();
            const email     = document.getElementById('collectorEmail').value.trim();
            const phone     = document.getElementById('collectorPhone').value.trim();
            const status    = document.getElementById('collectorStatus')?.value || collector.status;

            if (!lastName || !phone) {
                showAlert('Le nom et le téléphone sont obligatoires', 'error');
                return;
            }

            Object.assign(collector, {
                lastName, firstName, email, phone, status
            });

            // Persister via IndexedDB
            if (window.SYGIM_DB) window.SYGIM_DB.saveAll();

            closeModal('addCollectorModal');
            loadCollectorsGrid();
            // Remettre en mode création pour la prochaine fois
            const btn = document.getElementById('addCollectorSaveBtn');
            if (btn) {
                btn.setAttribute('onclick', 'saveNewCollector()');
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Ajouter le récolteur';
                document.getElementById('addCollectorModalTitle').textContent = 'Ajouter un récolteur';
            }
            showAlert(`✓ ${lastName} ${firstName} modifié avec succès`, 'success');
        }

        function loadCollectorPerformance() {
            const tbody = document.getElementById('collectorPerformanceBody');
            
            const html = collectorsData.map(collector => {
                const due = collector.performance.due;
                const collected = collector.performance.collected;
                const rate = collector.performance.collectionRate;
                const lateCount = collector.performance.lateClients;
                
                return `
                    <tr>
                        <td>
                            <strong>${collector.lastName} ${collector.firstName}</strong><br>
                            <small style="color: var(--gray);">${collector.zone}</small>
                        </td>
                        <td>${collector.assignedProperties.length}</td>
                        <td class="xof">${due.toLocaleString()}</td>
                        <td class="xof">${collected.toLocaleString()}</td>
                        <td>
                            ${collector.commissionType === 'fixed'
                                ? `<span style="font-weight:700;color:#065f46;">${(collector.commissionFixed||0).toLocaleString()} XOF</span><br><small style="color:var(--gray);">Fixe</small>`
                                : `<span style="font-weight:700;color:var(--primary);">${collector.commissionRate||0}%</span><br><small style="color:var(--gray);">${Math.round((collector.performance.collected||0)*(collector.commissionRate||0)/100).toLocaleString()} XOF</small>`
                            }
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: ${rate > 90 ? 'var(--success)' : rate > 80 ? 'var(--warning)' : 'var(--danger)'};">
                                    ${rate}%
                                </span>
                                <div style="flex: 1; height: 6px; background: var(--border); border-radius: 3px;">
                                    <div style="width: ${rate}%; height: 100%; background: ${rate > 90 ? 'var(--success)' : rate > 80 ? 'var(--warning)' : 'var(--danger)'}; border-radius: 3px;"></div>
                                </div>
                            </div>
                        </td>
                        <td>
                            <span class="status-badge ${lateCount > 0 ? 'pending' : 'paid'}">
                                ${lateCount} client(s)
                            </span>
                        </td>
                        <td>
                            <span class="status-badge ${rate > 90 ? 'paid' : rate > 80 ? 'info' : 'warning'}">
                                ${rate > 90 ? 'Excellent' : rate > 80 ? 'Bon' : 'À améliorer'}
                            </span>
                        </td>
                        <td>
                            <button class="btn btn-icon btn-outline btn-small" onclick="viewCollectorDetails(${collector.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn btn-icon btn-outline btn-small" onclick="sendReminderToCollector(${collector.id})">
                                <i class="fas fa-bell"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
            
            tbody.innerHTML = html;
            
            // Mettre à jour les statistiques
            updateManagerStats();
        }

        function updateManagerStats() {
            const totalCollectors = collectorsData.length;
            const totalProperties = propertiesData.length;
            const assignedProperties = collectorsData.reduce((sum, c) => sum + c.assignedProperties.length, 0);
            const avgRate = totalCollectors > 0
                ? collectorsData.reduce((sum, c) => sum + c.performance.collectionRate, 0) / totalCollectors
                : 0;
            const totalCollected = collectorsData.reduce((sum, c) => sum + c.performance.collected, 0);
            
            document.getElementById('totalCollectors').textContent = totalCollectors;
            document.getElementById('totalAssignedProperties').textContent = assignedProperties;
            document.getElementById('totalProperties').textContent = totalProperties;
            document.getElementById('avgCollectionRate').textContent = Math.round(avgRate) + '%';
            document.getElementById('totalCollected').textContent = totalCollected.toLocaleString();
        }

        function initCollectorPerformanceChart() {
            const ctx = document.getElementById('collectorPerformanceChart')?.getContext('2d');
            if (!ctx) return;
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: collectorPerformance.monthly.map(m => m.month),
                    datasets: collectorsData.map((collector, index) => ({
                        label: `${collector.lastName} ${collector.firstName}`,
                        data: collectorPerformance.monthly.map(m => m.collectors[index]),
                        backgroundColor: `rgba(${99 + index * 50}, 102, 241, 0.7)`,
                        borderColor: `#6366f1`,
                        borderWidth: 1
                    }))
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'top'
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: {
                                callback: function(value) {
                                    return value + '%';
                                }
                            }
                        }
                    }
                }
            });
        }

        // â”€â”€ Grille jours de versement pour récolteur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function buildCollectorDayGrid() {
            const grid = document.getElementById('cCollDayGrid');
            if (!grid) return;
            grid.innerHTML = '';
            for (let d = 1; d <= 28; d++) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.textContent = d;
                btn.dataset.day = d;
                btn.onclick = () => selectCollectorDay(d);
                btn.style.cssText = 'padding:6px 2px;border:1.5px solid var(--border);border-radius:7px;background:none;color:var(--text);font-size:12px;cursor:pointer;transition:.15s;font-weight:500;';
                btn.onmouseover = () => { if (!btn.classList.contains('active-day')) btn.style.background='rgba(99,102,241,.1)'; };
                btn.onmouseout  = () => { if (!btn.classList.contains('active-day')) btn.style.background='none'; };
                grid.appendChild(btn);
            }
        }

        function selectCollectorDay(day) {
            // Stocker la valeur
            const hiddenEl = document.getElementById('collectorPaymentDay');
            if (hiddenEl) hiddenEl.value = day;

            // Mettre à jour visuel grille
            document.querySelectorAll('#cCollDayGrid button').forEach(btn => {
                const isActive = parseInt(btn.dataset.day) === parseInt(day);
                btn.classList.toggle('active-day', isActive);
                btn.style.cssText = isActive
                    ? 'padding:6px 2px;border:2px solid var(--primary);border-radius:7px;background:var(--primary);color:#fff;font-size:12px;cursor:pointer;font-weight:700;transition:.15s;'
                    : 'padding:6px 2px;border:1.5px solid var(--border);border-radius:7px;background:none;color:var(--text);font-size:12px;cursor:pointer;transition:.15s;font-weight:500;';
            });

            // Bouton "Dernier jour"
            const lastBtn = document.getElementById('cCollDayLastBtn');
            if (lastBtn) {
                const isLast = day === 'dernier';
                lastBtn.style.cssText = isLast
                    ? 'width:100%;padding:9px;border:2px solid var(--primary);border-radius:8px;background:var(--primary);color:#fff;font-size:12px;cursor:pointer;font-weight:700;transition:.2s;'
                    : 'width:100%;padding:9px;border:1.5px solid var(--border);border-radius:8px;background:none;color:var(--text);font-size:12px;cursor:pointer;transition:.2s;font-weight:500;';
            }

            // Label sélectionné
            const selEl = document.getElementById('cCollDaySelected');
            if (selEl) {
                const label = day === 'dernier' ? 'Dernier jour du mois' : `Le ${day}${day==1?'er':'ème'} de chaque mois`;
                selEl.textContent = 'âœ“ ' + label;
                selEl.style.display = 'block';
            }
        }

        function toggleCollectorCommType(type) {
            const percCard   = document.getElementById('cCollPercCard');
            const fixedCard  = document.getElementById('cCollFixedCard');
            const percBlock  = document.getElementById('cCollPercBlock');
            const fixedBlock = document.getElementById('cCollFixedBlock');
            const hiddenEl   = document.getElementById('collectorCommType');

            const ACTIVE = 'border:2px solid var(--primary);border-radius:10px;padding:12px;cursor:pointer;text-align:center;transition:.2s;background:rgba(99,102,241,.08);';
            const IDLE   = 'border:2px solid var(--border);border-radius:10px;padding:12px;cursor:pointer;text-align:center;transition:.2s;background:none;';

            if (percCard)  percCard.style.cssText  = (type === 'percentage') ? ACTIVE : IDLE;
            if (fixedCard) fixedCard.style.cssText = (type === 'fixed')      ? ACTIVE : IDLE;

            // Couleur du grand symbole (1er span/div enfant direct)
            const percSymbol  = document.getElementById('cCollPercSymbol');
            const fixedSymbol = document.getElementById('cCollFixedSymbol');
            if (percSymbol)  percSymbol.style.color = (type === 'percentage') ? 'var(--primary)' : 'var(--gray)';
            if (fixedSymbol) fixedSymbol.style.color= (type === 'fixed')      ? 'var(--primary)' : 'var(--gray)';

            if (percBlock)  percBlock.style.display  = (type === 'percentage') ? '' : 'none';
            if (fixedBlock) fixedBlock.style.display = (type === 'fixed')      ? '' : 'none';
            if (hiddenEl)   hiddenEl.value = type;
        }

        function openAddCollectorModal() {
            // Réinitialiser le formulaire
            ['collectorLastName','collectorFirstName','collectorEmail','collectorPhone'].forEach(id => {
                const el = document.getElementById(id); if (el) el.value = '';
            });
            const statusEl = document.getElementById('collectorStatus');
            if (statusEl) statusEl.value = 'active';

            // Remettre le bouton en mode "création"
            const btn = document.getElementById('addCollectorSaveBtn');
            if (btn) {
                btn.setAttribute('onclick', 'saveNewCollector()');
                btn.innerHTML = '<i class="fas fa-user-plus"></i> Ajouter le récolteur';
            }
            document.getElementById('addCollectorModalTitle').textContent = 'Ajouter un récolteur';
            openModal('addCollectorModal');
        }

        async function saveNewCollector() {
            const lastName  = document.getElementById('collectorLastName').value.trim();
            const firstName = document.getElementById('collectorFirstName').value.trim();
            const email     = document.getElementById('collectorEmail').value.trim();
            const phone     = document.getElementById('collectorPhone').value.trim();
            const status    = document.getElementById('collectorStatus')?.value || 'active';

            if (!lastName || !firstName || !phone) {
                showAlert('Le nom, prénom et téléphone sont obligatoires', 'error');
                return;
            }

            try {
                // Préparer données pour l'API
                const collectorData = {
                    firstName, lastName, email, phone, status
                };
                
                // Appel API pour sauvegarder le collecteur
                const response = await API.Collectors.create(collectorData);
                
                if (response && response.success) {
                    const newCollector = {
                        id: response.data.id || (Math.max(...collectorsData.map(c => c.id || 0), 0) + 1),
                        firstName, lastName, email, phone, status,
                        joinDate: new Date().toLocaleDateString('fr-FR'),
                        assignedProperties: [],
                        performance: { clients: 0, collected: 0, due: 0, collectionRate: 0, lateClients: 0 }
                    };

                    collectorsData.push(newCollector);

                    closeModal('addCollectorModal');
                    loadCollectorsGrid();
                    loadCollectorPerformance();
                    updateManagerStats();
                    setTimeout(initManagerPropertiesFilter, 200);

                    // Vérifier si un compte d'accès existe pour ce récolteur
                    const hasAccount = Object.values(USER_ACCOUNTS).some(acc =>
                        acc.role === 'collector' &&
                        (acc.collectorName || '').toUpperCase() === lastName.toUpperCase()
                    );

                    if (!hasAccount) {
                        showAlert(
                            `✓ Récolteur ${lastName} ${firstName} ajouté en BD. ⚠️ Aucun compte d'accès trouvé — demandez à l'administrateur de créer un compte.`,
                            'warning'
                        );
                    } else {
                        showAlert(`✓ Récolteur ${lastName} ${firstName} ajouté avec succès`, 'success');
                    }
                } else {
                    showAlert('Erreur: ' + (response?.error || 'Impossible de sauvegarder'), 'error');
                }
            } catch (error) {
                console.error('Erreur sauvegarde collecteur:', error);
                showAlert('⚠️ Erreur API. Ajout local sans BD.', 'warning');
                
                // Fallback
                const newCollector = {
                    id: Math.max(...collectorsData.map(c => c.id || 0), 0) + 1,
                    firstName, lastName, email, phone, status,
                    commission: commission,
                    joinDate: new Date().toLocaleDateString('fr-FR'),
                    assignedProperties: [],
                    performance: { clients: 0, collected: 0, due: 0, collectionRate: 0, lateClients: 0 }
                };
                collectorsData.push(newCollector);
                closeModal('addCollectorModal');
                loadCollectorsGrid();
            }
        }

        // Rendu d'une carte client (factorisé, utilisé par load + search)
        function _renderManagerClientCard(client) {
            const amountDue  = client.amountDue  || client.rent || 0;
            const amountPaid = client.amountPaid || 0;
            const remaining  = Math.max(0, amountDue - amountPaid);
            const statusText = typeof getStatusText === 'function' ? getStatusText(client.status) : (client.status || '—');
            const propName   = client.propertyName || client.property || client.address || '—';
            const phone      = client.phone || '—';
            return `
                <div class="client-card ${client.status || ''}">
                    <div class="client-header">
                        <div class="client-name">${client.lastName || ''} ${client.firstName || ''}</div>
                        <div class="client-status ${client.status || ''}">${statusText}</div>
                    </div>
                    <div class="client-details">
                        <div class="client-detail">
                            <i class="fas fa-home"></i>
                            <span>${propName}</span>
                        </div>
                        <div class="client-detail">
                            <i class="fas fa-phone"></i>
                            <span>${phone}</span>
                        </div>
                    </div>
                    <div class="payment-section">
                        <div class="payment-title">
                            <i class="fas fa-money-bill-wave"></i>
                            <span>Paiement du loyer</span>
                        </div>
                        <div class="amount-display">
                            <div class="amount-label">Loyer mensuel :</div>
                            <div class="amount-value xof">${amountDue.toLocaleString()}</div>
                        </div>
                        <div class="amount-display">
                            <div class="amount-label">Déjà payé :</div>
                            <div class="amount-value xof" style="color:var(--success);">${amountPaid.toLocaleString()}</div>
                        </div>
                        <div class="amount-display">
                            <div class="amount-label">Reste dû :</div>
                            <div class="amount-value xof" style="color:${remaining > 0 ? 'var(--danger)' : 'var(--success)'};">${remaining.toLocaleString()}</div>
                        </div>
                        <div style="margin-top:8px;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                            <div style="width:${amountDue > 0 ? Math.min(100, Math.round(amountPaid/amountDue*100)) : 0}%;height:100%;background:var(--success);border-radius:3px;transition:.4s;"></div>
                        </div>
                        <button class="btn btn-primary btn-full" style="margin-top:12px;" onclick="openPaymentModal('${client.id}')">
                            <i class="fas fa-plus-circle"></i> Enregistrer un paiement
                        </button>
                    </div>
                </div>`;
        }

        function _getManagerClients(searchTerm) {
            // Logique unifiée : clients dont le récolteur est le manager connecté,
            // ou tous les clients si managerProperties vide
            const currentAcc = typeof currentUser !== 'undefined' ? currentUser : null;
            const managerName = currentAcc?.displayName || currentAcc?.collectorName || '';

            let list = clientsData.filter(c => c.status !== 'inactive');

            // Si le manager a un nom lié à un récolteur, ne montrer que ses clients
            if (managerName) {
                const byAgent = list.filter(c =>
                    (c.agent || '').toUpperCase() === managerName.toUpperCase() ||
                    (c.collector || '').toUpperCase() === managerName.toUpperCase()
                );
                // Si on trouve des résultats par agent, les utiliser ; sinon montrer tous
                if (byAgent.length > 0) list = byAgent;
            }

            if (searchTerm) {
                const t = searchTerm.toLowerCase();
                list = list.filter(c =>
                    (c.lastName  || '').toLowerCase().includes(t) ||
                    (c.firstName || '').toLowerCase().includes(t) ||
                    (c.phone     || '').includes(t) ||
                    (c.propertyName || c.property || c.address || '').toLowerCase().includes(t) ||
                    (c.identifier || '').toLowerCase().includes(t)
                );
            }
            return list;
        }

        function loadManagerClientList(searchTerm = '') {
            const managerClients = _getManagerClients(searchTerm);
            const clientList     = document.getElementById('managerClientList');
            if (!clientList) return;

            if (managerClients.length === 0) {
                clientList.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray);">
                    <i class="fas fa-users" style="font-size:32px;opacity:.25;display:block;margin-bottom:12px;"></i>
                    <strong>${searchTerm ? 'Aucun client trouvé pour cette recherche.' : 'Aucun client assigné.'}</strong>
                    <div style="font-size:13px;margin-top:6px;">Les clients assignés à vos récolteurs apparaÃ®tront ici.</div>
                </div>`;
            } else {
                clientList.innerHTML = managerClients.map(_renderManagerClientCard).join('');
            }

            // Statistiques
            const totalDue    = managerClients.reduce((s, c) => s + (c.amountDue  || c.rent || 0), 0);
            const totalPaid   = managerClients.reduce((s, c) => s + (c.amountPaid || 0), 0);
            const collRate    = totalDue > 0 ? Math.round(totalPaid / totalDue * 100) : 0;
            const remaining   = Math.max(0, totalDue - totalPaid);

            const safe = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
            safe('managerAssignedClients',  managerClients.length);
            safe('managerCollected',        totalPaid.toLocaleString());
            safe('managerRemaining',        remaining.toLocaleString());
            safe('managerCollectionRate',   collRate + '%');
        }

        function searchManagerClients() {
            const searchTerm = document.getElementById('managerSearch')?.value.trim() || '';
            loadManagerClientList(searchTerm);
        }

        function showAllManagerClients() {
            const el = document.getElementById('managerSearch');
            if (el) el.value = '';
            loadManagerClientList();
        }

        function sendReminderToCollector(collectorId) {
            const collector = collectorsData.find(c => c.id === collectorId);
            if (!collector) return;
            
            if (confirm(`Envoyer un rappel à ${collector.lastName} ${collector.firstName} ?`)) {
                showAlert(`Rappel envoyé à ${collector.lastName} ${collector.firstName}`, 'success');
            }
        }

        function exportCollectorPerformance() {
            if (!collectorsData || collectorsData.length === 0) {
                showAlert('Aucune donnée de récolteur à exporter.', 'error');
                return;
            }
            const headers = ['Nom', 'Prénom', 'Téléphone', 'Zone', 'Biens assignés',
                             'Montant dû (XOF)', 'Collecté (XOF)', 'Taux collecte (%)', 'Clients en retard', 'Statut'];
            const rows = collectorsData.map(c => [
                c.lastName  || '',
                c.firstName || '',
                c.phone     || '',
                c.zone      || '',
                c.assignedProperties.length,
                c.performance.due       || 0,
                c.performance.collected || 0,
                c.performance.collectionRate || 0,
                c.performance.lateClients   || 0,
                c.status || 'active'
            ]);
            const csv  = [headers, ...rows]
                .map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))
                .join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = 'SYGIM_performance_recolteurs_' + new Date().toLocaleDateString('fr-FR').replace(/\//g,'-') + '.csv';
            a.click();
            URL.revokeObjectURL(url);
            typeof adminLog === 'function' && adminLog('export', 'ðŸ“¤ Export performance récolteurs');
            showAlert('✓ Export CSV téléchargé avec succès', 'success');
        }

        function showAlert(message, type = 'info') {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert ${type}`;
            alertDiv.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;max-width:360px;';
            const iconMap = { success: 'fa-check-circle', error: 'fa-exclamation-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
            alertDiv.innerHTML = `<i class="fas ${iconMap[type] || 'fa-info-circle'}"></i><div>${message}</div>`;
            document.body.appendChild(alertDiv);
            setTimeout(() => alertDiv.remove(), type === 'warning' ? 5000 : 3000);
        }


               function logout() {
            adminLog('logout', `ðŸ”“ Déconnexion : ${currentUser ? (currentUser.displayName || currentUser.username || currentUser.email || 'inconnu') : 'inconnu'}`);
            currentUser = null;
            document.getElementById('authContainer').classList.remove('hidden');
            document.getElementById('appContainer').classList.add('hidden');
            document.getElementById('collectorMain').classList.remove('active');
            document.getElementById('collectorManagerMain').style.display = 'none';
            document.getElementById('adminMain').style.display = 'none';
            document.getElementById('email').value = '';
            document.getElementById('loginPassword').value = '';
            closeAllModals();
            
            // Réinitialiser les sélections
            selectedProperties.clear();
            selectedPropertiesForAssign && selectedPropertiesForAssign.clear();
            updateBatchActions && updateBatchActions();
        }

        // FONCTIONS DE NAVIGATION (via sidebar)
        function switchPage(page) {
            // Mettre à jour le menu
            document.querySelectorAll('.menu-item').forEach(item => {
                item.classList.remove('active');
            });
            // Trouver le menu-item correspondant sans dépendre de event
            const allMenuItems = document.querySelectorAll('.menu-item');
            allMenuItems.forEach(item => {
                const onclick = item.getAttribute('onclick') || '';
                if (onclick.includes("'" + page + "'") || onclick.includes('"' + page + '"')) {
                    item.classList.add('active');
                }
            });

            // Mettre à jour le contenu
            document.querySelectorAll('.page-content').forEach(content => {
                content.classList.remove('active');
            });
            document.getElementById(page + 'Page').classList.add('active');

            // Mettre à jour le titre
            const titles = {
                dashboard: 'Tableau de bord',
                portfolio: 'Portefeuille',
                clients: 'Clients & Biens',
                payments: 'Transactions',
                billing: 'Facturation',
                reports: 'Rapports',
                analytics: 'Analyse',
                owners: 'Propriétaires',
                ownerPayments: 'Versements Propriétaires',
                agentReport: 'Bilan Agent',
                settings: 'Paramètres'
            };

            const userTitle = (currentUser && currentUser.userType === 'director') ? 'Direction' : 'Comptabilité';
            document.getElementById('pageTitle').textContent = titles[page];

            // Charger les données spécifiques à la page
            if (page === 'dashboard') loadDashboard();
            else if (page === 'portfolio') {
                loadPortfolioPage();
                updatePortfolioStats();
            }
            else if (page === 'clients') loadClientsGrid();
            else if (page === 'payments') loadTransactionsPage();
            else if (page === 'owners') loadOwnersList();
            else if (page === 'ownerPayments') loadOwnerPaymentsPage();
            else if (page === 'agentReport') loadAgentReport();
            else if (page === 'reports') loadReportsPage();
            else if (page === 'analytics') loadAnalyticsPage();
        }
        // Fonctions pour la page Propriétaires
       function loadOwnersList() {
            // Mettre à jour les statistiques
            document.getElementById('totalOwnersCount').textContent = ownersData.length;
    
           // Calculer le total des biens sous gestion
            const totalPropertiesManaged = propertiesData.length;
            document.getElementById('totalPropertiesManaged').textContent = totalPropertiesManaged;
    
            // Calculer la commission moyenne (éviter division par zéro)
            const avgCommission = ownersData.length > 0
                ? ownersData.reduce((sum, owner) => sum + (owner.commissionRate || 0), 0) / ownersData.length
                : 0;
            document.getElementById('averageCommission').textContent = avgCommission.toFixed(1) + '%';
    
            // Paiements en attente : loyers collectés non encore versés aux propriétaires
            const pendingPayments = ownersData.reduce((sum, owner) => {
                if (owner._paymentStatus === 'paid') return sum;
                const ownerClients = clientsData.filter(c => c.ownerId === owner.id);
                const collected = ownerClients.reduce((s, c) => s + (c.amountPaid || 0), 0);
                const commission = Math.round(collected * ((owner.commissionRate || 0) / 100));
                return sum + (collected - commission);
            }, 0);
            document.getElementById('pendingOwnerPayments').textContent = pendingPayments.toLocaleString();
    
            // Remplir le tableau des propriétaires
            const tbody = document.getElementById('ownersTableBody');
           tbody.innerHTML = ownersData.map(owner => {
               // Calculer les statistiques pour ce propriétaire
              const ownerProperties = propertiesData.filter(p => p.ownerId === owner.id);
              const totalValue = ownerProperties.reduce((sum, p) => sum + p.value, 0);
              const rentedProperties = ownerProperties.filter(p => p.status === 'loue' || p.status === 'partiel').length;
        
               return `
              <tr>
                 <td>
                    <strong>${owner.lastName} ${owner.firstName}</strong><br>
                    <small style="color: var(--gray);">Membre depuis ${owner.joinDate}</small>
                </td>
                <td>
                    <div>${owner.email || '—'}</div>
                    <div>${owner.phone}</div>
                </td>
                <td>
                    <div style="font-weight: 600; color: var(--primary);">${ownerProperties.length} biens</div>
                    <small>${rentedProperties} loués</small>
                </td>
                <td class="amount-value xof">${(totalValue / 1000000).toFixed(1)}M</td>
                <td>
                    ${owner.commissionType === 'fixed'
                        ? `<span class="status-badge paid" style="background:rgba(99,102,241,.1);color:var(--primary);">${(owner.commissionFixed||0).toLocaleString()} XOF</span>
                           <small style="display:block;color:var(--gray);font-size:10px;">Montant fixe</small>`
                        : `<span class="status-badge paid" style="background:rgba(16,185,129,.1);color:var(--success);">${owner.commissionRate || 10}%</span>
                           <small style="display:block;color:var(--gray);font-size:10px;">Pourcentage</small>`}
                    ${owner.avenants && owner.avenants.length
                        ? `<span title="${owner.avenants.length} avenant(s)" style="display:inline-flex;align-items:center;gap:3px;margin-top:3px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);border-radius:10px;padding:1px 7px;font-size:10px;color:#92400e;cursor:pointer;" onclick="viewOwnerAvenants(${owner.id})">
                                <i class="fas fa-file-alt"></i> ${owner.avenants.length} avenant(s)
                           </span>`
                        : ''}
                </td>
                <td>
                    ${owner.paymentDay
                        ? `<span style="font-weight:600;color:var(--primary);">${owner.paymentDay} du mois</span>`
                        : '<span style="color:var(--warning);font-size:12px;"><i class="fas fa-exclamation-triangle"></i> Non fixé</span>'}
                    <br><small style="color:var(--gray);font-size:11px;">${owner.bankAccount ? owner.bankAccount.substring(0,20)+'…' : 'Aucun RIB'}</small>
                </td>
                <td>
                    <span class="status-badge paid">Actif</span>
                </td>
                <td>
                    <button class="btn btn-icon btn-outline btn-small" onclick="viewOwnerDetails(${owner.id})" title="Voir">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="editOwner(${owner.id})" title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="payCommission(${owner.id})" title="Versement">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                </td>
             </tr>
               `;
             }).join('');
    
           // Charger les propriétaires avec grand portefeuille (+100 biens)
          loadLargeOwners();
        }

        function filterOwnersList() {
            const searchInput = document.getElementById('ownersSearch');
            const clearBtn = document.getElementById('ownersSearchClear');
            const infoEl = document.getElementById('ownersSearchInfo');
            const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

            if (clearBtn) clearBtn.style.display = searchTerm ? 'block' : 'none';

            const tbody = document.getElementById('ownersTableBody');
            if (!tbody) return;

            if (!searchTerm) {
                // Tout afficher
                Array.from(tbody.querySelectorAll('tr')).forEach(tr => tr.style.display = '');
                if (infoEl) infoEl.textContent = '';
                return;
            }

            let visible = 0;
            Array.from(tbody.querySelectorAll('tr')).forEach(tr => {
                const text = tr.textContent.toLowerCase();
                if (text.includes(searchTerm)) {
                    tr.style.display = '';
                    visible++;
                } else {
                    tr.style.display = 'none';
                }
            });

            if (infoEl) {
                infoEl.textContent = visible > 0
                    ? `${visible} propriétaire(s) trouvé(s) pour Â« ${searchInput.value.trim()} Â»`
                    : `Aucun propriétaire ne correspond à Â« ${searchInput.value.trim()} Â»`;
                infoEl.style.color = visible === 0 ? 'var(--danger)' : 'var(--gray)';
            }
        }

        function loadLargeOwners() {
          const container = document.getElementById('largeOwnersGrid');
          if (!container) return;

          const largeOwners = ownersData.map(owner => {
              const ownerProperties = propertiesData.filter(p => p.ownerId === owner.id);
              const totalValue = ownerProperties.reduce((sum, p) => sum + (p.value || 0), 0);
              const monthlyRevenue = ownerProperties.reduce((sum, p) => sum + (p.rent || 0), 0);
              const rentedProperties = ownerProperties.filter(p => p.status === 'loue' || p.status === 'partiel').length;
              const occupancyRate = ownerProperties.length
                  ? Math.round((rentedProperties / ownerProperties.length) * 100)
                  : 0;

              return {
                  owner,
                  propertiesCount: ownerProperties.length,
                  totalValue,
                  monthlyRevenue,
                  occupancyRate
              };
          }).filter(item => item.propertiesCount >= 100);

          if (!largeOwners.length) {
              container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--gray);">Aucun grand portefeuille disponible.</div>';
              return;
          }

          const html = largeOwners.map(({ owner, propertiesCount, totalValue, monthlyRevenue, occupancyRate }) => `
          <div class="large-owner-card" onclick="openOwnerPortfolioDashboard(${owner.id})">
            <div class="large-owner-header">
                <div class="large-owner-avatar">${owner.lastName.charAt(0)}${owner.firstName.charAt(0)}</div>
                <div>
                    <div class="large-owner-name">${owner.lastName} ${owner.firstName}</div>
                    <div style="color: var(--gray); font-size: 14px;">Grand portefeuille</div>
                </div>
            </div>
            
            <div class="large-owner-stats">
                <div class="large-owner-stat">
                    <div class="large-owner-stat-label">Biens</div>
                    <div class="large-owner-stat-value">${propertiesCount}</div>
                </div>
                <div class="large-owner-stat">
                    <div class="large-owner-stat-label">Valeur totale</div>
                    <div class="large-owner-stat-value xof">${(totalValue / 1000000000).toFixed(1)}Md</div>
                </div>
                <div class="large-owner-stat">
                    <div class="large-owner-stat-label">Revenu mensuel</div>
                    <div class="large-owner-stat-value xof">${(monthlyRevenue / 1000000).toFixed(1)}M</div>
                </div>
                <div class="large-owner-stat">
                    <div class="large-owner-stat-label">Occupation</div>
                    <div class="large-owner-stat-value">${occupancyRate}%</div>
                </div>
            </div>
            
            <button class="btn btn-primary btn-full" style="margin-top: 15px;" onclick="openOwnerPortfolioDashboard(${owner.id})">
                <i class="fas fa-chart-line"></i> Accéder au tableau de bord
            </button>
          </div>
         `).join('');

            container.innerHTML = html;
        }

        function viewOwnerDetails(ownerId) {
          const owner = ownersData.find(o => o.id === ownerId);
         if (!owner) return;
    
          // Remplir les informations du propriétaire
         document.getElementById('ownerDetailsName').textContent = `${owner.lastName} ${owner.firstName}`;
           document.getElementById('ownerDetailsEmail').textContent = owner.email || '—';
         document.getElementById('ownerDetailsPhone').textContent = owner.phone || '—';
         document.getElementById('ownerDetailsAddress').textContent = owner.address || '—';
    
         // Calculer les statistiques financières
         const ownerProperties = propertiesData.filter(p => p.ownerId === ownerId);
         const rentedProperties = ownerProperties.filter(p => p.status === 'loue' || p.status === 'partiel');
         const monthlyIncome = rentedProperties.reduce((sum, p) => sum + (p.rent || 0), 0);
         const commissionDue = monthlyIncome * (owner.commissionRate / 100);
    
          document.getElementById('ownerMonthlyIncome').textContent = monthlyIncome.toLocaleString();
          document.getElementById('ownerCommissionDue').textContent = commissionDue.toLocaleString();

          const ownerTransactions = transactionsData
              .filter(t => Number(t.ownerId) === Number(ownerId))
              .sort((a, b) => new Date(b.date || b.date_display || 0) - new Date(a.date || a.date_display || 0));
          const lastPayment = ownerTransactions[0];
          document.getElementById('ownerLastPayment').textContent = lastPayment
              ? (lastPayment.date_display || lastPayment.date || '—')
              : '—';
    
           // Afficher la liste des propriétés avec commission spécifique si avenant
           const propertiesList = document.getElementById('ownerPropertiesList');
         propertiesList.innerHTML = ownerProperties.map(property => {
             // Déterminer la commission effective de ce bien
             let commLabel = '';
             if (property.commissionType === 'fixed' && property.commissionFixed != null) {
                 commLabel = `<span style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:1px 8px;font-size:10px;color:#92400e;font-weight:600;"><i class="fas fa-file-alt"></i> Avenant — ${property.commissionFixed.toLocaleString()} XOF fixe</span>`;
             } else if (property.commissionType === 'percentage' && property.commissionRate != null) {
                 const ownerRate = owner.commissionRate || 10;
                 const isDiff = property.commissionRate !== ownerRate;
                 commLabel = isDiff
                     ? `<span style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.35);border-radius:10px;padding:1px 8px;font-size:10px;color:#92400e;font-weight:600;"><i class="fas fa-file-alt"></i> Avenant — ${property.commissionRate}%</span>`
                     : `<span style="background:rgba(16,185,129,.1);border-radius:10px;padding:1px 8px;font-size:10px;color:#065f46;">${property.commissionRate}% (contrat)</span>`;
             } else {
                 const defComm = owner.commissionType === 'fixed'
                     ? `${(owner.commissionFixed||0).toLocaleString()} XOF fixe`
                     : `${owner.commissionRate||10}% (défaut contrat)`;
                 commLabel = `<span style="background:rgba(16,185,129,.1);border-radius:10px;padding:1px 8px;font-size:10px;color:#065f46;">${defComm}</span>`;
             }
             return `
          <div class="property-mini-card" style="${property.hasAvenant ? 'border-left:3px solid rgba(245,158,11,.6);' : ''}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <h5 style="margin:0 0 4px;">${property.name}</h5>
                ${commLabel}
            </div>
            <div class="property-mini-details">
                <span>${property.address}</span>
                <span>Type: ${getPropertyTypeText(property.type)}</span>
                <span>Statut: ${getPropertyStatusText(property.status)}</span>
                <span>Valeur: ${(property.value / 1000000).toFixed(1)}M XOF</span>
                ${property.rent ? `<span>Loyer: ${property.rent.toLocaleString()} XOF</span>` : ''}
                ${property.paymentDay ? `<span>Versement: ${property.paymentDay} du mois</span>` : ''}
                ${property.avenant ? `<div style="margin-top:6px;font-size:11px;color:#92400e;background:rgba(245,158,11,.08);border-radius:6px;padding:6px 8px;"><i class="fas fa-file-alt"></i> Avenant du ${property.avenant.date} — ${property.avenant.reason}</div>` : ''}
            </div>
          </div>`;
         }).join('');

          // Afficher les avenants du propriétaire s'il en a
          const avenants = owner.avenants || [];
          const avenantSection = document.getElementById('ownerAvenantsSection');
          if (avenantSection) {
              if (avenants.length) {
                  avenantSection.style.display = 'block';
                  const avenantList = document.getElementById('ownerAvenantsList');
                  if (avenantList) {
                      avenantList.innerHTML = avenants.map(av => `
                          <div style="display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid rgba(245,158,11,.15);">
                              <div style="background:rgba(245,158,11,.15);border-radius:8px;padding:6px 10px;font-size:11px;font-weight:700;color:#92400e;white-space:nowrap;">${av.date}</div>
                              <div>
                                  <div style="font-size:13px;font-weight:600;color:#1f2937;">${av.propertyName}</div>
                                  <div style="font-size:12px;color:#374151;margin-top:2px;">Commission négociée : <strong>${av.commissionLabel}</strong></div>
                                  <div style="font-size:11px;color:#6b7280;margin-top:3px;font-style:italic;">"${av.reason}"</div>
                              </div>
                          </div>
                      `).join('');
                  }
              } else {
                  avenantSection.style.display = 'none';
              }
          }

            const paymentsBody = document.getElementById('ownerPaymentsBody');
            if (!ownerTransactions.length) {
                paymentsBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--gray);padding:20px;">Aucun paiement enregistré</td></tr>';
            } else {
                paymentsBody.innerHTML = ownerTransactions.slice(0, 10).map(payment => `
                 <tr>
                    <td>${payment.date_display || payment.date || '—'}</td>
                    <td class="amount-value xof">${(payment.amount || 0).toLocaleString()}</td>
                    <td>${payment.method || '—'}</td>
                    <td>${payment.reference || '—'}</td>
                    <td><span class="status-badge paid">${payment.status || 'inconnu'}</span></td>
                 </tr>
                 `).join('');
            }
    
          // Afficher la section détails
          document.getElementById('ownerDetailsContainer').style.display = 'block';
        }

        function closeOwnerDetails() {
          document.getElementById('ownerDetailsContainer').style.display = 'none';
        }

        // Affiche directement la fiche propriétaire sur la tab avenants
        function viewOwnerAvenants(ownerId) {
            viewOwnerDetails(ownerId);
            // Scroll vers la section avenants
            setTimeout(function() {
                const sec = document.getElementById('ownerAvenantsSection');
                if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 200);
        }

        function editOwner(ownerId) {
            openNewOwnerModal(ownerId);
        }

        function payCommission(ownerId) {
            const owner = ownersData.find(o => o.id === ownerId);
            if (!owner) return;

            // Calculer la commission due — respecte le type (fixe ou %)
            const ownerProperties   = propertiesData.filter(p => p.ownerId === ownerId);
            const rentedProperties  = ownerProperties.filter(p => p.status === 'loue' || p.status === 'partiel');
            const monthlyIncome     = rentedProperties.reduce((sum, p) => sum + (p.rent || 0), 0);
            const isFixed           = owner.commissionType === 'fixed';
            const commissionDue     = isFixed
                ? (owner.commissionFixed || 0)
                : Math.round(monthlyIncome * ((owner.commissionRate || 0) / 100));
            const commDesc          = isFixed
                ? `${commissionDue.toLocaleString()} XOF (montant fixe)`
                : `${commissionDue.toLocaleString()} XOF (${owner.commissionRate || 0}% Ã— ${monthlyIncome.toLocaleString()} XOF)`;
            const net               = monthlyIncome - commissionDue;

            if (confirm(`Verser au propriétaire ${owner.lastName} ${owner.firstName} ?\n\nLoyers du mois : ${monthlyIncome.toLocaleString()} XOF\nCommission SYGIM : ${commDesc}\nNet à verser : ${net.toLocaleString()} XOF`)) {
               showAlert && showAlert(`✓ Versement de ${net.toLocaleString()} XOF enregistré pour ${owner.lastName} ${owner.firstName}`, 'success');
        
             // Enregistrer la transaction (simulation)
             const newTransaction = {
              id: 'COM-' + (transactionsData.length + 1).toString().padStart(3, '0'),
              date: new Date().toLocaleDateString('fr-FR'),
              client: `${owner.lastName} ${owner.firstName}`,
              description: `Commission ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
              amount: commissionDue,
              method: 'Virement',
              reference: 'COM' + Date.now().toString().slice(-6),
              status: 'paid'
             };
         
             transactionsData.unshift(newTransaction);
        
              // Mettre à jour l'affichage si nécessaire
              if (currentUser !== 'collector') {
               loadDashboard();
               loadTransactions();
              }
            }
        }

        function exportOwnersList() {
           alert('Exportation de la liste des propriétaires au format CSV - À implémenter');
        }

        function generateOwnerReport() {
         alert('Génération du rapport propriétaires - À implémenter');
        }

        function openOwnerPortfolioDashboard(ownerId) {
           // Pour les propriétaires avec +100 biens, on ouvre le tableau de bord dédié
          alert(`Ouverture du tableau de bord pour le propriétaire ID: ${ownerId}\n\nCette fonctionnalité sera complètement implémentée dans la version finale.`);
    
           // Dans une version complète, on pourrait rediriger vers une page spécifique
          // switchPage('portfolioDashboardPage');
          // loadOwnerDashboard(ownerId);
        }

        // NOUVELLES FONCTIONS POUR LA GESTION DU PORTEFEUILLE
        function loadPortfolioPage() {
            // Réinitialiser la vue par défaut
            switchView('grid');
            
            // Charger les propriétés
            loadPropertiesGrid();
            
            // Mettre à jour les filtres
            setupFilters();
            
            // Mettre à jour la pagination
            updatePagination();
            
            // Mettre à jour le badge dans le menu
            document.getElementById('propertyBadge').textContent = propertiesData.length;
        }

        function switchView(viewType) {
            currentView = viewType;
            
            // Masquer toutes les vues
            document.getElementById('gridView').style.display = 'none';
            document.getElementById('listView').style.display = 'none';
            document.getElementById('hierarchyView').style.display = 'none';
            document.getElementById('mapView').style.display = 'none';
            
            // Activer la vue sélectionnée
            document.getElementById(viewType + 'View').style.display = 'block';
            
            // Mettre à jour les boutons de vue
            document.querySelectorAll('.view-option').forEach(option => {
                option.classList.remove('active');
            });
            document.querySelector(`.view-option[onclick*="${viewType}"]`).classList.add('active');
            
            // Charger les données appropriées
            if (viewType === 'grid') {
                loadPropertiesGrid();
            } else if (viewType === 'list') {
                loadPropertiesList();
            } else if (viewType === 'hierarchy') {
                loadPropertyHierarchy();
            } else if (viewType === 'map') {
                loadPropertyMap();
            }
        }

        function loadPropertiesGrid() {
            const grid = document.getElementById('propertiesGrid');
            const propertiesToDisplay = getPropertiesForCurrentPage();
            
            const html = propertiesToDisplay.map(property => {
                const isSelected = selectedProperties.has(property.id);
                const owner = ownersData.find(o => o.id === property.ownerId);
                const tenant = property.tenantId ? clientsData.find(c => c.id === property.tenantId) : null;
                
                return `
                    <div class="client-manage-card ${isSelected ? 'selected' : ''}" onclick="togglePropertySelection(${property.id}, event)">
                        <div class="client-manage-header">
                            <div class="client-manage-name">${property.name}</div>
                            <div class="client-manage-actions">
                                <span class="status-badge ${getPropertyStatusClass(property.status)}">${getPropertyStatusText(property.status)}</span>
                                <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="togglePropertySelection(${property.id}, event)">
                            </div>
                        </div>
                        
                        <div class="client-details">
                            <div class="client-detail">
                                <i class="fas ${getPropertyIcon(property.type)}"></i>
                                <span>${getPropertyTypeText(property.type)}</span>
                            </div>
                            <div class="client-detail">
                                <i class="fas fa-map-marker-alt"></i>
                                <span>${property.address}</span>
                            </div>
                            <div class="client-detail">
                                <i class="fas fa-user-tie"></i>
                                <span>${owner ? owner.lastName + ' ' + owner.firstName : 'Non assigné'}</span>
                            </div>
                        </div>
                        
                        <div class="client-manage-property">
                            <div class="property-title">Détails</div>
                            <div class="property-details">
                                Valeur: ${(property.value / 1000000).toFixed(1)}M XOF
                                ${property.area ? ` | Surface: ${property.area} m²` : ''}
                                ${property.rooms ? ` | Pièces: ${property.rooms}` : ''}
                            </div>
                            ${property.rent ? `<div class="property-details">Loyer: ${property.rent.toLocaleString()} XOF/mois</div>` : ''}
                            ${tenant ? `<div class="property-details">Locataire: ${tenant.lastName} ${tenant.firstName}</div>` : ''}
                        </div>
                        
                        <div class="payment-section" style="margin-top: 15px;">
                            <div class="amount-display">
                                <div class="amount-label">Tags:</div>
                                <div>
                                    ${property.tags.map(tag => `<span class="filter-tag" style="font-size: 10px; padding: 2px 6px; margin-right: 5px;">${tag}</span>`).join('')}
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
            
            grid.innerHTML = html;
        }

        function loadPropertiesList() {
            const tbody = document.getElementById('propertiesListBody');
            const propertiesToDisplay = getPropertiesForCurrentPage();
            
            const html = propertiesToDisplay.map(property => {
                const isSelected = selectedProperties.has(property.id);
                const owner = ownersData.find(o => o.id === property.ownerId);
                
                return `
                    <div class="list-row ${isSelected ? 'selected' : ''}" onclick="togglePropertySelection(${property.id}, event)">
                        <div class="list-cell">
                            <input type="checkbox" ${isSelected ? 'checked' : ''} onclick="togglePropertySelection(${property.id}, event)">
                            ${property.name}
                        </div>
                        <div class="list-cell">${getPropertyTypeText(property.type)}</div>
                        <div class="list-cell">${property.address}</div>
                        <div class="list-cell amount-value xof">${property.value.toLocaleString()}</div>
                        <div class="list-cell"><span class="status-badge ${getPropertyStatusClass(property.status)}">${getPropertyStatusText(property.status)}</span></div>
                        <div class="list-cell">
                            <button class="btn btn-icon btn-outline btn-small" onclick="editProperty(${property.id})">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-icon btn-outline btn-small" onclick="viewPropertyDetails(${property.id})">
                                <i class="fas fa-eye"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
            
            tbody.innerHTML = html;
        }

        async function loadPropertyHierarchy() {
            const container = document.getElementById('propertyHierarchy');
            if (!container) return;
            
            try {
                // Récupérer les propriétés de l'API
                const response = await API.Properties.getAll({ limit: 1000 });
                let allProperties = [];
                
                if (response && response.data) {
                    allProperties = Array.isArray(response.data) ? response.data : response.data.rows || [];
                } else {
                    allProperties = propertiesData;
                }
                
                // Regrouper les propriétés par hiérarchie ou quartier
                // Si les propriétés ont une structure parentId, utiliser cette structure
                // Sinon, créer une hiérarchie basique par type et localisation
                
                let html = '';
                const topLevelProperties = allProperties.filter(p => !p.parentId);
                
                if (topLevelProperties.length > 0) {
                    // Utiliser la structure parentId existante
                    topLevelProperties.forEach(property => {
                        html += buildHierarchyNode(property, allProperties);
                    });
                } else {
                    // Créer une hiérarchie basique par quartier/localisation
                    const byDistrict = {};
                    
                    allProperties.forEach(prop => {
                        const district = prop.district || prop.area || 'Sans localisation';
                        if (!byDistrict[district]) {
                            byDistrict[district] = [];
                        }
                        byDistrict[district].push(prop);
                    });
                    
                    Object.entries(byDistrict).forEach(([district, properties]) => {
                        html += `
                            <div class="hierarchy-node">
                                <div class="node-header" onclick="toggleNode('district-${district}')">
                                    <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i>
                                    <span style="font-weight: bold;">${district}</span>
                                    <span class="node-badge">${properties.length} bien(s)</span>
                                </div>
                                <div class="node-children" id="children-district-${district}">
                        `;
                        
                        properties.forEach(prop => {
                            const owner = ownersData.find(o => o.id === prop.ownerId);
                            const tenant = prop.tenantId ? clientsData.find(c => c.id === prop.tenantId) : null;
                            
                            html += `
                                <div class="hierarchy-node" style="margin-left: 20px;">
                                    <div class="node-header">
                                        <i class="fas ${getPropertyIcon(prop.type)}"></i>
                                        <span>${prop.name || 'Propriété sans nom'}</span>
                                        <span class="node-badge">${getPropertyTypeText(prop.type)}</span>
                                        <span class="node-badge" style="background: ${prop.status === 'loue' || prop.status === 'paid' ? 'var(--success)' : 'var(--warning)'}; color: white;">${getPropertyStatusText(prop.status)}</span>
                                    </div>
                                    <div class="node-children" style="font-size: 12px; color: var(--gray); margin-left: 30px; margin-top: 8px;">
                                        <div><strong>Adresse:</strong> ${prop.address || 'N/A'}</div>
                                        ${prop.area ? `<div><strong>Surface:</strong> ${prop.area} m²</div>` : ''}
                                        ${prop.rooms ? `<div><strong>Pièces:</strong> ${prop.rooms}</div>` : ''}
                                        <div><strong>Valeur:</strong> ${(prop.value || 0).toLocaleString()} XOF</div>
                                        ${owner ? `<div><strong>Propriétaire:</strong> ${owner.lastName} ${owner.firstName}</div>` : ''}
                                        ${tenant ? `<div><strong>Locataire:</strong> ${tenant.lastName} ${tenant.firstName}</div>` : '<div><strong>Locataire:</strong> Vacant</div>'}
                                        ${prop.rent ? `<div><strong>Loyer:</strong> ${prop.rent.toLocaleString()} XOF/mois</div>` : ''}
                                    </div>
                                </div>
                            `;
                        });
                        
                        html += `
                                </div>
                            </div>
                        `;
                    });
                }
                
                container.innerHTML = html;
                
            } catch (error) {
                console.warn('Erreur chargement hiérarchie API:', error);
                // Fallback sur données en mémoire
                fallbackLoadHierarchy();
            }
        }
        
        function fallbackLoadHierarchy() {
            const container = document.getElementById('propertyHierarchy');
            if (!container) return;
            
            // Créer une hiérarchie basique par quartier
            const byDistrict = {};
            
            propertiesData.forEach(prop => {
                const district = prop.district || prop.area || 'Sans localisation';
                if (!byDistrict[district]) {
                    byDistrict[district] = [];
                }
                byDistrict[district].push(prop);
            });
            
            let html = '';
            Object.entries(byDistrict).forEach(([district, properties]) => {
                html += `
                    <div class="hierarchy-node">
                        <div class="node-header" onclick="toggleNode('district-${district}')">
                            <i class="fas fa-map-marker-alt" style="color: var(--primary);"></i>
                            <span style="font-weight: bold;">${district}</span>
                            <span class="node-badge">${properties.length} bien(s)</span>
                        </div>
                        <div class="node-children" id="children-district-${district}">
                `;
                
                properties.forEach(prop => {
                    const owner = ownersData.find(o => o.id === prop.ownerId);
                    const tenant = prop.tenantId ? clientsData.find(c => c.id === prop.tenantId) : null;
                    
                    html += `
                        <div class="hierarchy-node" style="margin-left: 20px;">
                            <div class="node-header">
                                <i class="fas ${getPropertyIcon(prop.type)}"></i>
                                <span>${prop.name || 'Propriété'}</span>
                                <span class="node-badge">${getPropertyTypeText(prop.type)}</span>
                                <span class="node-badge" style="background: ${prop.status === 'loue' || prop.status === 'paid' ? 'var(--success)' : 'var(--warning)'}; color: white;">${getPropertyStatusText(prop.status)}</span>
                            </div>
                            <div class="node-children" style="font-size: 12px; color: var(--gray); margin-left: 30px; margin-top: 8px;">
                                <div><strong>Adresse:</strong> ${prop.address || 'N/A'}</div>
                                ${prop.area ? `<div><strong>Surface:</strong> ${prop.area} m²</div>` : ''}
                                <div><strong>Valeur:</strong> ${(prop.value || 0).toLocaleString()} XOF</div>
                                ${owner ? `<div><strong>Propriétaire:</strong> ${owner.lastName} ${owner.firstName}</div>` : ''}
                                ${tenant ? `<div><strong>Locataire:</strong> ${tenant.lastName} ${tenant.firstName}</div>` : '<div style="color: var(--warning);"><strong>Locataire:</strong> Vacant</div>'}
                            </div>
                        </div>
                    `;
                });
                
                html += `
                        </div>
                    </div>
                `;
            });
            
            container.innerHTML = html;
        }
        
        function buildHierarchyNode(property, allProperties, level = 0) {
            const children = allProperties.filter(p => p.parentId === property.id);
            const hasChildren = children.length > 0;
            const childCount = children.length;
            const owner = ownersData.find(o => o.id === property.ownerId);
            const tenant = property.tenantId ? clientsData.find(c => c.id === property.tenantId) : null;
            
            let html = `
                <div class="hierarchy-node" style="margin-left: ${level * 20}px;">
                    <div class="node-header" onclick="toggleNode(${property.id})">
                        <i class="fas ${getPropertyIcon(property.type)}"></i>
                        <span>${property.name}</span>
                        <span class="node-badge">${getPropertyTypeText(property.type)}</span>
                        ${hasChildren ? `<span class="node-badge">${childCount} enfants</span>` : ''}
                        <span class="node-badge" style="background: ${property.status === 'loue' || property.status === 'paid' ? 'var(--success)' : 'var(--warning)'}; color: white;">${getPropertyStatusText(property.status)}</span>
                    </div>
                    <div class="node-children" id="children-${property.id}" style="font-size: 12px; color: var(--gray); margin-left: 30px; margin-top: 5px;">
                        ${!hasChildren ? `
                            <div><strong>Adresse:</strong> ${property.address || 'N/A'}</div>
                            ${property.area ? `<div><strong>Surface:</strong> ${property.area} m²</div>` : ''}
                            ${property.rooms ? `<div><strong>Pièces:</strong> ${property.rooms}</div>` : ''}
                            <div><strong>Valeur:</strong> ${(property.value || 0).toLocaleString()} XOF</div>
                            ${owner ? `<div><strong>Propriétaire:</strong> ${owner.lastName} ${owner.firstName}</div>` : ''}
                            ${tenant ? `<div><strong>Locataire:</strong> ${tenant.lastName} ${tenant.firstName}</div>` : '<div style="color: var(--warning);"><strong>Locataire:</strong> Vacant</div>'}
                            ${property.rent ? `<div><strong>Loyer:</strong> ${property.rent.toLocaleString()} XOF/mois</div>` : ''}
                        ` : ''}
            `;
            
            if (hasChildren) {
                children.forEach(child => {
                    html += buildHierarchyNode(child, allProperties, level + 1);
                });
            }
            
            html += '</div></div>';
            return html;
        }

        async function loadPropertyMap() {
            const mapContainer = document.getElementById('propertyMap');
            if (!mapContainer) return;
            
            try {
                // Récupérer les propriétés de l'API
                const response = await API.Properties.getAll({ limit: 500 });
                let properties = [];
                
                if (response && response.data) {
                    properties = Array.isArray(response.data) ? response.data : response.data.rows || [];
                } else {
                    properties = propertiesData;
                }
                
                // Si Leaflet est disponible, utiliser une vraie carte
                if (typeof L !== 'undefined' && document.querySelector('#propertyMap .leaflet-container') === null) {
                    initLeafletMap(properties);
                    return;
                }
                
                // Sinon, afficher une vue en grille avec statuts
                const statusCounts = {
                    'loue': 0,
                    'vacant': 0,
                    'en_renovation': 0,
                    'other': 0
                };
                
                properties.forEach(prop => {
                    if (prop.status === 'loue' || prop.status === 'paid') statusCounts.loue++;
                    else if (prop.status === 'vacant') statusCounts.vacant++;
                    else if (prop.status === 'en_renovation' || prop.status === 'renovation') statusCounts.en_renovation++;
                    else statusCounts.other++;
                });
                
                const html = `
                    <div style="padding: 20px; text-align: center;">
                        <i class="fas fa-map-marked-alt" style="font-size: 48px; color: var(--primary); margin-bottom: 20px; display: block;"></i>
                        <h3 style="margin: 10px 0;">Carte Interactive des Propriétés</h3>
                        <p style="color: var(--gray); margin-bottom: 30px;">Vue d'ensemble du portefeuille</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0;">
                            <div style="background: rgba(52, 168, 83, 0.1); border: 2px solid var(--success); border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: var(--success);">${statusCounts.loue}</div>
                                <div style="color: var(--gray); font-size: 12px;">Loués</div>
                            </div>
                            <div style="background: rgba(255, 171, 0, 0.1); border: 2px solid var(--warning); border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: var(--warning);">${statusCounts.vacant}</div>
                                <div style="color: var(--gray); font-size: 12px;">Vacants</div>
                            </div>
                            <div style="background: rgba(33, 150, 243, 0.1); border: 2px solid var(--info); border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: var(--info);">${statusCounts.en_renovation}</div>
                                <div style="color: var(--gray); font-size: 12px;">En rénovation</div>
                            </div>
                            <div style="background: rgba(156, 39, 176, 0.1); border: 2px solid #9c27b0; border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: #9c27b0;">${statusCounts.other}</div>
                                <div style="color: var(--gray); font-size: 12px;">Autres</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 15px; background: rgba(33, 150, 243, 0.05); border-radius: 8px;">
                            <p style="color: var(--gray); font-size: 13px; margin: 0;">
                                <i class="fas fa-info-circle"></i> Total: <strong>${properties.length}</strong> propriété(s)
                            </p>
                            <p style="color: var(--gray); font-size: 12px; margin: 8px 0 0 0;">
                                Pour une vue géographique détaillée avec géolocalisation, activez le module de cartographie avancée.
                            </p>
                        </div>
                    </div>
                `;
                
                mapContainer.innerHTML = html;
                
            } catch (error) {
                console.warn('Erreur chargement carte:', error);
                
                // Fallback si erreur API
                const statusCounts = {
                    'loue': propertiesData.filter(p => p.status === 'loue' || p.status === 'paid').length,
                    'vacant': propertiesData.filter(p => p.status === 'vacant').length,
                    'en_renovation': propertiesData.filter(p => p.status === 'en_renovation' || p.status === 'renovation').length,
                    'other': propertiesData.filter(p => !['loue', 'vacant', 'en_renovation', 'paid', 'renovation'].includes(p.status)).length
                };
                
                const html = `
                    <div style="padding: 20px; text-align: center;">
                        <i class="fas fa-map-marked-alt" style="font-size: 48px; color: var(--primary); margin-bottom: 20px; display: block;"></i>
                        <h3 style="margin: 10px 0;">Carte Interactive des Propriétés</h3>
                        <p style="color: var(--gray); margin-bottom: 30px;">Vue d'ensemble du portefeuille</p>
                        
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin: 20px 0;">
                            <div style="background: rgba(52, 168, 83, 0.1); border: 2px solid var(--success); border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: var(--success);">${statusCounts.loue}</div>
                                <div style="color: var(--gray); font-size: 12px;">Loués</div>
                            </div>
                            <div style="background: rgba(255, 171, 0, 0.1); border: 2px solid var(--warning); border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: var(--warning);">${statusCounts.vacant}</div>
                                <div style="color: var(--gray); font-size: 12px;">Vacants</div>
                            </div>
                            <div style="background: rgba(33, 150, 243, 0.1); border: 2px solid var(--info); border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: var(--info);">${statusCounts.en_renovation}</div>
                                <div style="color: var(--gray); font-size: 12px;">En rénovation</div>
                            </div>
                            <div style="background: rgba(156, 39, 176, 0.1); border: 2px solid #9c27b0; border-radius: 8px; padding: 15px;">
                                <div style="font-size: 32px; font-weight: bold; color: #9c27b0;">${statusCounts.other}</div>
                                <div style="color: var(--gray); font-size: 12px;">Autres</div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 30px; padding: 15px; background: rgba(33, 150, 243, 0.05); border-radius: 8px;">
                            <p style="color: var(--gray); font-size: 13px; margin: 0;">
                                <i class="fas fa-info-circle"></i> Total: <strong>${propertiesData.length}</strong> propriété(s)
                            </p>
                        </div>
                    </div>
                `;
                
                mapContainer.innerHTML = html;
            }
        }
        
        function initLeafletMap(properties) {
            // Initialiser la carte Leaflet si disponible
            const mapContainer = document.getElementById('propertyMap');
            
            // Centrer sur Burkina Faso par défaut (lat/lng de Ouagadougou)
            const defaultLat = 12.3656;
            const defaultLng = -1.5197;
            const defaultZoom = 12;
            
            const map = L.map(mapContainer).setView([defaultLat, defaultLng], defaultZoom);
            
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: 'Â© OpenStreetMap contributors',
                maxZoom: 19
            }).addTo(map);
            
            // Ajouter des marqueurs pour les propriétés
            properties.slice(0, 50).forEach(property => {
                // Générer des coordonnées pseudo-aléatoires autour du point central
                const lat = defaultLat + (Math.random() - 0.5) * 0.1;
                const lng = defaultLng + (Math.random() - 0.5) * 0.1;
                
                // Couleur selon le statut
                let color = '#FFAB00'; // Défaut orange (vacant)
                if (property.status === 'loue' || property.status === 'paid') color = '#34A853'; // Vert (loué)
                else if (property.status === 'en_renovation' || property.status === 'renovation') color = '#2196F3'; // Bleu
                
                L.circleMarker([lat, lng], {
                    radius: 8,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                }).bindPopup(`
                    <strong>${property.name || 'Propriété'}</strong><br>
                    ${property.address || 'Adresse N/A'}<br>
                    <strong>Statut:</strong> ${getPropertyStatusText(property.status)}<br>
                    <strong>Valeur:</strong> ${(property.value || 0).toLocaleString()} XOF
                `).addTo(map);
            });
        }

        function togglePropertySelection(propertyId, event) {
            event.stopPropagation();
            
            if (selectedProperties.has(propertyId)) {
                selectedProperties.delete(propertyId);
            } else {
                selectedProperties.add(propertyId);
            }
            
            updateBatchActions();
            
            // Recharger la vue courante pour mettre à jour l'affichage
            if (currentView === 'grid') {
                loadPropertiesGrid();
            } else if (currentView === 'list') {
                loadPropertiesList();
            }
        }

        function selectAllProperties() {
            const propertiesToDisplay = getPropertiesForCurrentPage();
            propertiesToDisplay.forEach(property => {
                selectedProperties.add(property.id);
            });
            
            updateBatchActions();
            
            // Recharger la vue courante
            if (currentView === 'grid') {
                loadPropertiesGrid();
            } else if (currentView === 'list') {
                loadPropertiesList();
            }
        }

        function updateBatchActions() {
            const batchActions = document.getElementById('batchActions');
            const selectedCount = document.getElementById('selectedCount');
            
            selectedCount.textContent = selectedProperties.size;
            
            if (selectedProperties.size > 0) {
                batchActions.classList.add('show');
            } else {
                batchActions.classList.remove('show');
            }
        }

        function bulkUpdateStatus(status) {
            if (selectedProperties.size === 0) return;
            
            const statusText = getPropertyStatusText(status);
            if (confirm(`Mettre à jour ${selectedProperties.size} propriété(s) au statut "${statusText}"?`)) {
                selectedProperties.forEach(id => {
                    const property = propertiesData.find(p => p.id === id);
                    if (property) {
                        property.status = status;
                    }
                });
                
                selectedProperties.clear();
                updateBatchActions();
                updatePortfolioStats();
                
                // Recharger la vue courante
                if (currentView === 'grid') {
                    loadPropertiesGrid();
                } else if (currentView === 'list') {
                    loadPropertiesList();
                } else if (currentView === 'hierarchy') {
                    loadPropertyHierarchy();
                }
                
                alert(`${selectedProperties.size} propriété(s) mise(s) à jour avec succès!`);
            }
        }

        // Fonction pour supprimer une propriété depuis la liste du manager
        async function deleteManagerProperty(propertyId) {
            const property = propertiesData.find(p => p.id === propertyId);
            if (!property) return;
            
            if (!confirm(`Êtes-vous sûr de vouloir supprimer la propriété "${property.name}"? Cette action est irréversible.`)) {
                return;
            }
            
            try {
                // Appel API pour supprimer
                const response = await fetch(`/api/properties/${propertyId}`, { method: 'DELETE' });
                const result = await response.json();
                
                if (result.success) {
                    // Supprimer de propertiesData
                    const idx = propertiesData.findIndex(p => p.id === propertyId);
                    if (idx !== -1) propertiesData.splice(idx, 1);
                    
                    // Valider avec le stockage local
                    if (typeof window.SYGIM_DB !== 'undefined') {
                        window.SYGIM_DB.delete('properties', { 'id': propertyId });
                        window.SYGIM_DB.saveAll();
                    } else {
                        try { localStorage.setItem('sygim_props_bk', JSON.stringify(propertiesData)); } catch(e){}
                    }
                    
                    // Recharger la liste
                    filterManagerProperties();
                    showAlert(`✓ Propriété "${property.name}" supprimée avec succès`, 'success');
                } else {
                    showAlert(`âŒ Erreur: ${result.error}`, 'error');
                }
            } catch (err) {
                console.error('Erreur suppression propriété:', err);
                // Supprimer localement en cas d'erreur réseau
                const idx = propertiesData.findIndex(p => p.id === propertyId);
                if (idx !== -1) propertiesData.splice(idx, 1);
                filterManagerProperties();
                showAlert(`✓ Propriété "${property.name}" supprimée localement`, 'warning');
            }
        }

        function deleteSelectedProperties() {
            if (selectedProperties.size === 0) return;
            
            if (confirm(`Êtes-vous sûr de vouloir supprimer ${selectedProperties.size} propriété(s)? Cette action est irréversible.`)) {
                // Filtrer les propriétés à conserver
                const newPropertiesData = propertiesData.filter(p => !selectedProperties.has(p.id));
                
                // Mettre à jour les données (dans une vraie application, ce serait une requête API)
                propertiesData.length = 0;
                propertiesData.push(...newPropertiesData);
                
                selectedProperties.clear();
                updateBatchActions();
                updatePortfolioStats();
                updatePagination();
                
                // Recharger la vue courante
                if (currentView === 'grid') {
                    loadPropertiesGrid();
                } else if (currentView === 'list') {
                    loadPropertiesList();
                } else if (currentView === 'hierarchy') {
                    loadPropertyHierarchy();
                }
                
                // Mettre à jour le badge
                document.getElementById('propertyBadge').textContent = propertiesData.length;
                
                alert(`${selectedProperties.size} propriété(s) supprimée(s) avec succès!`);
            }
        }

        function setupFilters() {
            // Configurer les filtres par type
            document.querySelectorAll('#typeFilter .filter-tag').forEach(tag => {
                tag.addEventListener('click', function() {
                    document.querySelectorAll('#typeFilter .filter-tag').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    activeFilters.type = this.dataset.type;
                });
            });
            
            // Configurer les filtres par statut
            document.querySelectorAll('#statusFilter .filter-tag').forEach(tag => {
                tag.addEventListener('click', function() {
                    document.querySelectorAll('#statusFilter .filter-tag').forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    activeFilters.status = this.dataset.status;
                });
            });
        }

        function applyFilters() {
            // Filtrer les propriétés
            filteredProperties = propertiesData.filter(property => {
                let typeMatch = activeFilters.type === 'all' || property.type === activeFilters.type;
                let statusMatch = activeFilters.status === 'all' || property.status === activeFilters.status;
                return typeMatch && statusMatch;
            });
            
            // Réinitialiser la pagination
            currentPage = 1;
            
            // Recharger la vue courante
            if (currentView === 'grid') {
                loadPropertiesGrid();
            } else if (currentView === 'list') {
                loadPropertiesList();
            }
            
            updatePagination();
            updatePortfolioStats();
        }

        function resetFilters() {
            // Réinitialiser les filtres
            activeFilters = {
                type: 'all',
                status: 'all'
            };
            
            // Réinitialiser l'interface des filtres
            document.querySelectorAll('#typeFilter .filter-tag').forEach(tag => {
                tag.classList.remove('active');
                if (tag.dataset.type === 'all') tag.classList.add('active');
            });
            
            document.querySelectorAll('#statusFilter .filter-tag').forEach(tag => {
                tag.classList.remove('active');
                if (tag.dataset.status === 'all') tag.classList.add('active');
            });
            
            // Réinitialiser les propriétés filtrées
            filteredProperties = [];
            
            // Réinitialiser la pagination
            currentPage = 1;
            
            // Recharger la vue courante
            if (currentView === 'grid') {
                loadPropertiesGrid();
            } else if (currentView === 'list') {
                loadPropertiesList();
            }
            
            updatePagination();
            updatePortfolioStats();
        }

        function getPropertiesForCurrentPage() {
            const properties = filteredProperties.length > 0 ? filteredProperties : propertiesData;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;
            return properties.slice(startIndex, endIndex);
        }

        function updatePagination() {
            const properties = filteredProperties.length > 0 ? filteredProperties : propertiesData;
            const totalPages = Math.ceil(properties.length / itemsPerPage);
            
            document.getElementById('currentPage').textContent = currentPage;
            document.getElementById('totalPages').textContent = totalPages;
            
            // Masquer la pagination si une seule page
            document.getElementById('pagination').style.display = totalPages <= 1 ? 'none' : 'flex';
        }

        function changePage(direction) {
            const properties = filteredProperties.length > 0 ? filteredProperties : propertiesData;
            const totalPages = Math.ceil(properties.length / itemsPerPage);
            
            const newPage = currentPage + direction;
            if (newPage >= 1 && newPage <= totalPages) {
                currentPage = newPage;
                updatePagination();
                
                // Recharger la vue courante
                if (currentView === 'grid') {
                    loadPropertiesGrid();
                } else if (currentView === 'list') {
                    loadPropertiesList();
                }
            }
        }

        function updatePortfolioStats() {
            const properties = filteredProperties.length > 0 ? filteredProperties : propertiesData;
            const total = properties.length;
            const buildings = properties.filter(p => p.type === 'immeuble').length;
            const apartments = properties.filter(p => p.type === 'appartement').length;
            const totalValue = properties.reduce((sum, p) => sum + p.value, 0);
            const occupied = properties.filter(p => p.status === 'loue' || p.status === 'partiel').length;
            const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
            const renovationCount = properties.filter(p => p.status === 'en_renovation').length;
            
            document.getElementById('totalPropertiesCount').textContent = total.toLocaleString();
            document.getElementById('buildingsCount').textContent = buildings.toLocaleString();
            document.getElementById('apartmentsCount').textContent = apartments.toLocaleString();
            document.getElementById('totalValue').textContent = (totalValue / 1000000).toFixed(1) + 'M';
            document.getElementById('occupancyRate').textContent = occupancyRate + '%';
            document.getElementById('renovationCount').textContent = renovationCount.toLocaleString();
        }

        // Fonctions utilitaires pour les propriétés
        function getPropertyIcon(type) {
            const icons = {
                quartier: 'fa-city',
                immeuble: 'fa-building',
                appartement: 'fa-home',
                maison: 'fa-house-user',
                commercial: 'fa-store'
            };
            return icons[type] || 'fa-home';
        }

        function getPropertyTypeText(type) {
            const types = {
                quartier: 'Quartier/Ensemble',
                immeuble: 'Immeuble',
                appartement: 'Appartement',
                maison: 'Maison',
                commercial: 'Local commercial'
            };
            return types[type] || type;
        }

        function getPropertyStatusText(status) {
            const statuses = {
                actif: 'Actif',
                loue: 'Loué',
                vacant: 'Vacant',
                en_renovation: 'En rénovation',
                en_construction: 'En construction',
                partiel: 'Partiellement occupé'
            };
            return statuses[status] || status;
        }

        function getPropertyStatusClass(status) {
            const classes = {
                actif: 'paid',
                loue: 'paid',
                vacant: 'pending',
                en_renovation: 'warning',
                en_construction: 'info',
                partiel: 'partial'
            };
            return classes[status] || 'pending';
        }

        function toggleNode(propertyId) {
            const childrenDiv = document.getElementById(`children-${propertyId}`);
            if (childrenDiv) {
                childrenDiv.style.display = childrenDiv.style.display === 'none' ? 'block' : 'none';
            }
        }

        // FONCTIONS POUR LES MODALS D'OPÉRATIONS EN MASSE
        function openBulkOperationsModal() {
            openModal('bulkOperationsModal');
        }

        function switchBulkTab(tabName) {
            // Masquer tous les onglets
            document.querySelectorAll('.tab-content').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Désactiver tous les onglets
            document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('active');
            });
            
            // Activer l'onglet sélectionné
            document.getElementById(`${tabName}Tab`).classList.add('active');
            event.target.classList.add('active');
            
            // Mettre à jour la liste des propriétés sélectionnées pour l'onglet de mise à jour
            if (tabName === 'update') {
                updateSelectedPropertiesList();
            }
        }

        function updateSelectedPropertiesList() {
            const container = document.getElementById('selectedPropertiesList');
            if (selectedProperties.size === 0) {
                container.innerHTML = '<p>Aucune propriété sélectionnée</p>';
                return;
            }
            
            let html = '<div style="max-height: 150px; overflow-y: auto;">';
            selectedProperties.forEach(id => {
                const property = propertiesData.find(p => p.id === id);
                if (property) {
                    html += `<div style="padding: 5px; border-bottom: 1px solid var(--border);">${property.name}</div>`;
                }
            });
            html += '</div>';
            
            container.innerHTML = html;
        }

        function processBulkImport() {
            const fileInput = document.getElementById('bulkImportFile');
            if (!fileInput.files.length) {
                alert('Veuillez sélectionner un fichier');
                return;
            }
            
            // Simuler l'importation
            alert('Fonctionnalité d\'import en masse - À implémenter dans une version complète');
            closeModal('bulkOperationsModal');
        }

        function executeBulkUpdate() {
            const field = document.getElementById('bulkUpdateField').value;
            const value = document.getElementById('bulkUpdateValue').value;
            
            if (!value) {
                alert('Veuillez saisir une valeur');
                return;
            }
            
            if (selectedProperties.size === 0) {
                alert('Veuillez sélectionner des propriétés');
                return;
            }
            
            // Simuler la mise à jour
            alert(`Mise à jour de ${selectedProperties.size} propriété(s) - Champ: ${field}, Valeur: ${value}`);
            closeModal('bulkOperationsModal');
            
            // Réinitialiser les sélections
            selectedProperties.clear();
            updateBatchActions();
        }

        function addNewProperty() {
            // Remplir la liste des propriétés parentes
            const parentSelect = document.getElementById('parentProperty');
            parentSelect.innerHTML = '<option value="">Aucune (propriété racine)</option>';
            
            // Ajouter les quartiers et immeubles comme options parentes
            propertiesData
                .filter(p => p.type === 'quartier' || p.type === 'immeuble')
                .forEach(property => {
                    const option = document.createElement('option');
                    option.value = property.id;
                    option.textContent = `${property.name} (${getPropertyTypeText(property.type)})`;
                    parentSelect.appendChild(option);
                });
            
            openModal('newPropertyModal');
        }

        function togglePropertyFields() {
            const type = document.getElementById('propertyType').value;
            const parentGroup = document.getElementById('parentPropertyGroup');
            
            // Afficher/masquer le champ parent selon le type
            if (type === 'appartement') {
                parentGroup.style.display = 'block';
            } else {
                parentGroup.style.display = 'none';
            }
        }

        async function saveNewProperty() {
            const type = document.getElementById('propertyType').value;
            const name = document.getElementById('propertyName').value;
            const address = document.getElementById('propertyAddress').value;
            const parentId = document.getElementById('parentProperty').value;
            const value = parseInt(document.getElementById('propertyValue').value) || 0;
            const area = parseInt(document.getElementById('propertyArea').value) || 0;
            const ownerId = parseInt(document.getElementById('propOwner')?.value) || null;
            
            if (!name || !address) {
                showAlert('Veuillez remplir les champs obligatoires', 'error');
                return;
            }
            
            try {
                // Préparer les données pour l'API
                const propertyData = {
                    name: name,
                    address: address,
                    type: type || 'appartement',
                    status: 'vacant',
                    value: value,
                    rent: type === 'appartement' ? 100000 : 0,
                    area: area || null,
                    rooms: type === 'appartement' ? 2 : null,
                    ownerId: ownerId
                };
                
                // Appel API pour sauvegarder la propriété
                const response = await API.Properties.create(propertyData);
                
                if (response && response.success) {
                    // Ajouter la propriété avec l'ID retourné par l'API
                    const newProperty = {
                        id: response.data.id || (Math.max(...propertiesData.map(p => p.id || 0), 0) + 1),
                        ...propertyData,
                        tags: ['nouveau']
                    };
                    
                    propertiesData.push(newProperty);
                    
                    // Mettre à jour l'interface
                    updatePortfolioStats();
                    updatePagination();
                    
                    if (currentView === 'grid') {
                        loadPropertiesGrid();
                    } else if (currentView === 'hierarchy') {
                        loadPropertyHierarchy();
                    }
                    
                    document.getElementById('propertyBadge').textContent = propertiesData.length;
                    
                    showAlert(`✓ Propriété "${name}" ajoutée avec succès!`, 'success');
                    closeModal('newPropertyModal');
                } else {
                    showAlert('Erreur: ' + (response?.error || 'Impossible de sauvegarder la propriété'), 'error');
                }
            } catch (error) {
                console.error('Erreur sauvegarde propriété:', error);
                showAlert('⚠️ Erreur API. La propriété a été ajoutée localement (non sauvegardée en BD)', 'warning');
                
                // Fallback: ajouter localement sans API
                const newProperty = {
                    id: Math.max(...propertiesData.map(p => p.id || 0), 0) + 1,
                    name: name,
                    address: address,
                    type: type,
                    status: 'vacant',
                    value: value,
                    ownerId: ownerId,
                    tags: ['nouveau']
                };
                propertiesData.push(newProperty);
                closeModal('newPropertyModal');
                updatePortfolioStats();
            }
        }

        // FONCTIONS D'AFFICHAGE EXISTANTES (simplifiées pour la longueur)
        function loadDashboard() {
            const now = new Date();
            const thisMonth  = now.getMonth();
            const thisYear   = now.getFullYear();
            const lastMonth  = thisMonth === 0 ? 11 : thisMonth - 1;
            const lastYear   = thisMonth === 0 ? thisYear - 1 : thisYear;

            // Trier les transactions par date pour comparer mois en cours vs mois précédent
            function txMonth(t) { const p = (t.date||'').split('/'); return { m: parseInt(p[1])-1, y: parseInt(p[2]) }; }
            const thisMoTx = transactionsData.filter(t => { const d=txMonth(t); return d.m===thisMonth && d.y===thisYear && t.status==='paid'; });
            const lastMoTx = transactionsData.filter(t => { const d=txMonth(t); return d.m===lastMonth && d.y===lastYear && t.status==='paid'; });

            const totalRevenue  = clientsData.reduce((s, c) => s + (c.amountPaid||0), 0);
            const totalClients  = clientsData.filter(c => c.status !== 'inactive').length;
            const pendingCount  = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue').length;
            const totalDue      = clientsData.reduce((s, c) => s + (c.amountDue||0), 0);
            const collectionRate= totalDue > 0 ? Math.round((totalRevenue / totalDue) * 100) : 0;

            const revThisMo = thisMoTx.reduce((s,t) => s+(t.amount||0), 0);
            const revLastMo = lastMoTx.reduce((s,t) => s+(t.amount||0), 0);
            const revChange = revLastMo > 0 ? (((revThisMo - revLastMo) / revLastMo) * 100).toFixed(1) : null;

            const occupied      = propertiesData.filter(p => p.status === 'loue' || p.status === 'partiel').length;
            const totalProps    = propertiesData.length;
            const occupancyRate = totalProps > 0 ? ((occupied / totalProps) * 100).toFixed(1) : '0.0';

            const statsHtml = `
                <div class="stat-card success" onclick="showRevenueDetails()">
                    <div class="stat-label">Recettes du mois</div>
                    <div class="stat-value xof">${(totalRevenue / 1000000).toFixed(2)}M</div>
                    <div class="stat-change ${revChange >= 0 ? 'positive' : 'negative'}">
                        ${revChange !== null ? (revChange >= 0 ? '↑' : '↓') + ' ' + Math.abs(revChange) + '% vs mois précédent' : 'Aucune donnée précédente'}
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">Clients actifs</div>
                    <div class="stat-value">${totalClients}</div>
                    <div class="stat-change positive">Taux d'occupation: ${occupancyRate}%</div>
                </div>
                <div class="stat-card warning" onclick="showPendingPayments()">
                    <div class="stat-label">Retards de paiement</div>
                    <div class="stat-value">${pendingCount}</div>
                    <div class="stat-change negative">↓ ${(totalDue - totalRevenue).toLocaleString()} XOF</div>
                </div>
                <div class="stat-card info">
                    <div class="stat-label">Taux de recouvrement</div>
                    <div class="stat-value">${collectionRate}%</div>
                    <div class="stat-change ${collectionRate >= 80 ? 'positive' : 'negative'}">
                        ${collectionRate >= 80 ? '✓ Objectif atteint' : '⚠️ Sous l\'objectif 80%'}
                    </div>
                </div>
            `;

            document.getElementById('statsGrid').innerHTML = statsHtml;
            loadTransactions();
        }
        async function loadTransactions() {
            const tbody = document.getElementById('transactionsBody');
            if (!tbody) return;

            try {
                // Récupérer les transactions de l'API
                const response = await API.Transactions.getAll({ limit: 10, page: 1 });
                
                let transactionsToDisplay = [];
                if (response && response.data) {
                    // Si l'API retourne les données
                    transactionsToDisplay = Array.isArray(response.data) ? response.data : response.data.rows || [];
                } else {
                    // Fallback sur les données en mémoire si l'API échoue
                    transactionsToDisplay = transactionsData.slice(0, 8);
                }
        
                const html = transactionsToDisplay.map(transaction => {
                    // Trouver le client correspondant pour avoir plus d'informations
                    const client = clientsData.find(c => 
                        (transaction.clientId && c.id === transaction.clientId) || 
                        (transaction.client && `${c.lastName} ${c.firstName}` === transaction.client)
                    );
            
                    const clientName = transaction.clientName || transaction.client || transaction.client_name || 'Client inconnu';
                    const propertyInfo = client ? client.property : '';
            
                    return `
                    <tr>
                        <td>${transaction.date || transaction.date_display || new Date().toLocaleDateString('fr-FR')}</td>
                        <td>
                            <strong>${clientName}</strong>
                            ${propertyInfo ? `<br><small style="color: var(--gray);">${propertyInfo}</small>` : ''}
                        </td>
                        <td class="amount-value xof">${(transaction.amount || 0).toLocaleString()}</td>
                        <td>
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <i class="fas ${getPaymentMethodIcon(transaction.method)}"></i>
                                ${transaction.method || transaction.payment_method || 'Cash'}
                            </span>
                        </td>
                        <td><code style="background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px;">${transaction.reference || transaction.id || 'N/A'}</code></td>
                        <td><span class="status-badge ${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        <td>
                            <button class="btn btn-icon btn-outline btn-small" onclick="viewTransactionDetails('${transaction.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${transaction.status === 'pending' ? `
                                <button class="btn btn-icon btn-outline btn-small" onclick="validateTransaction('${transaction.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                    `;
                }).join('');
        
                tbody.innerHTML = html;
            } catch (error) {
                console.warn('Erreur chargement transactions API, utilisation données locales:', error);
                // Fallback sur les données locales
                const recentTransactions = transactionsData.slice(0, 8);
        
                const html = recentTransactions.map(transaction => {
                    const client = clientsData.find(c => `${c.lastName} ${c.firstName}` === transaction.client);
            
                    return `
                    <tr>
                        <td>${transaction.date}</td>
                        <td>
                            <strong>${transaction.client}</strong>
                            ${client ? `<br><small style="color: var(--gray);">${client.property}</small>` : ''}
                        </td>
                        <td class="amount-value xof">${transaction.amount.toLocaleString()}</td>
                        <td>
                            <span style="display: flex; align-items: center; gap: 5px;">
                                <i class="fas ${getPaymentMethodIcon(transaction.method)}"></i>
                                ${transaction.method}
                            </span>
                        </td>
                        <td><code style="background: rgba(99, 102, 241, 0.1); padding: 2px 6px; border-radius: 4px;">${transaction.reference}</code></td>
                        <td><span class="status-badge ${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        <td>
                            <button class="btn btn-icon btn-outline btn-small" onclick="viewTransactionDetails('${transaction.id}')">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${transaction.status === 'pending' ? `
                                <button class="btn btn-icon btn-outline btn-small" onclick="validateTransaction('${transaction.id}')">
                                    <i class="fas fa-check"></i>
                                </button>
                            ` : ''}
                        </td>
                    </tr>
                `;
                }).join('');
        
                tbody.innerHTML = html;
            }
        }
         async function loadTransactionsPage() {
            const tbody = document.getElementById('transactionsJournalBody');
             if (!tbody) return;
    
             // Récupérer la valeur du filtre
            const filter = document.getElementById('transactionFilter').value;
            
            try {
                // Préparer les paramètres pour l'API
                let params = { limit: 100, page: 1 };
                
                if (filter === 'pending') {
                    params.status = 'pending';
                } else if (filter === 'validated') {
                    params.status = 'processed';
                } else if (filter === 'this_month') {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    params.dateFrom = firstDay.toISOString().split('T')[0];
                    params.dateTo = lastDay.toISOString().split('T')[0];
                } else if (filter === 'last_month') {
                    const now = new Date();
                    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
                    params.dateFrom = firstDay.toISOString().split('T')[0];
                    params.dateTo = lastDay.toISOString().split('T')[0];
                }
                
                // Récupérer les transactions de l'API
                const response = await API.Transactions.getAll(params);
                
                let filteredTransactions = [];
                if (response && response.data) {
                    filteredTransactions = Array.isArray(response.data) ? response.data : response.data.rows || [];
                } else {
                    // Fallback sur données en mémoire
                    filteredTransactions = [...transactionsData];
                }
                
            } catch (error) {
                console.warn('Erreur chargement transactions API:', error);
                // Fallback sur données en mémoire
                const filter = document.getElementById('transactionFilter').value;
                let filteredTransactions = [...transactionsData];
                
                if (filter === 'this_month') {
                    const currentMonth = new Date().getMonth();
                    const currentYear = new Date().getFullYear();
                    filteredTransactions = transactionsData.filter(t => {
                        const [day, month, year] = t.date.split('/').map(Number);
                        return month === currentMonth + 1 && year === currentYear;
                    });
                } else if (filter === 'last_month') {
                    const lastMonthNum = new Date().getMonth() === 0 ? 12 : new Date().getMonth();
                    const lastMonthYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
                    filteredTransactions = transactionsData.filter(t => {
                        const parts = t.date.split('/').map(Number);
                        const tMonth = parts[1], tYear = parts[2];
                        return tMonth === lastMonthNum && tYear === lastMonthYear;
                    });
                } else if (filter === 'pending') {
                    filteredTransactions = transactionsData.filter(t => t.status === 'pending');
                } else if (filter === 'validated') {
                    filteredTransactions = transactionsData.filter(t => t.status === 'paid');
                }
                
                const html = filteredTransactions.map(transaction => {
                    const client = clientsData.find(c => `${c.lastName} ${c.firstName}` === transaction.client);
                    
                    return `
                    <tr>
                        <td><strong>${transaction.id}</strong></td>
                        <td>${transaction.date}</td>
                        <td>
                            ${transaction.client}
                            ${client ? `<br><small style="color: var(--gray);">${client.phone}</small>` : ''}
                        </td>
                        <td>${transaction.description}</td>
                        <td class="amount-value xof">${transaction.amount.toLocaleString()}</td>
                        <td>
                            <span style="display: flex; align-items: center; gap: 5px;">
                            <i class="fas ${getPaymentMethodIcon(transaction.method)}"></i>
                            ${transaction.method}
                        </span>
                        </td>
                        <td><span class="status-badge ${transaction.status}">${getStatusText(transaction.status)}</span></td>
                        <td>
                        <button class="btn btn-icon btn-outline btn-small" onclick="viewTransactionDetails('${transaction.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-outline btn-small" onclick="editTransaction('${transaction.id}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        ${transaction.status === 'pending' ? `
                            <button class="btn btn-icon btn-success btn-small" onclick="validateTransaction('${transaction.id}')">
                                <i class="fas fa-check"></i>
                            </button>
                        ` : ''}
                        </td>
                    </tr>
                    `;
                }).join('');
                
                tbody.innerHTML = html;
                
                const pendingCount = filteredTransactions.filter(t => t.status === 'pending').length;
                document.querySelectorAll('.stat-card.warning .stat-value').forEach(el => {
                    if (el.textContent.includes('En attente')) {
                        el.textContent = pendingCount;
                    }
                });
                return;
            }
            
            const html = filteredTransactions.map(transaction => {
                const clientName = transaction.clientName || transaction.client || transaction.client_name || 'Client inconnu'; 
                const client = clientsData.find(c => 
                    (transaction.clientId && c.id === transaction.clientId) ||
                    (c.lastName && clientName.includes(c.lastName))
                );
                
                return `
                <tr>
                    <td><strong>${transaction.id}</strong></td>
                    <td>${transaction.date || transaction.date_display || new Date().toLocaleDateString('fr-FR')}</td>
                    <td>
                        ${clientName}
                        ${client ? `<br><small style="color: var(--gray);">${client.phone || client.property || ''}</small>` : ''}
                    </td>
                    <td>${transaction.description || 'Paiement loyer'}</td>
                    <td class="amount-value xof">${(transaction.amount || 0).toLocaleString()}</td>
                    <td>
                        <span style="display: flex; align-items: center; gap: 5px;">
                        <i class="fas ${getPaymentMethodIcon(transaction.method || transaction.payment_method)}"></i>
                        ${transaction.method || transaction.payment_method || 'Cash'}
                    </span>
                    </td>
                    <td><span class="status-badge ${transaction.status}">${getStatusText(transaction.status)}</span></td>
                    <td>
                    <button class="btn btn-icon btn-outline btn-small" onclick="viewTransactionDetails('${transaction.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="editTransaction('${transaction.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${(transaction.status === 'pending' || transaction.status === 'processing') ? `
                        <button class="btn btn-icon btn-success btn-small" onclick="validateTransaction('${transaction.id}')">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    </td>
                </tr>
                `;
            }).join('');
            
            tbody.innerHTML = html;
            
            // Mettre à jour le compteur de transactions
            const pendingCount = filteredTransactions.filter(t => t.status === 'pending' || t.status === 'processing').length;
            document.querySelectorAll('.stat-card.warning .stat-value').forEach(el => {
                if (el.textContent.includes('En attente')) {
                    el.textContent = pendingCount;
                }
            });
        }  

          // Fonction pour éditer une transaction
       function editTransaction(transactionId) {
              const transaction = transactionsData.find(t => t.id === transactionId);
               if (!transaction) return;
    
           // Pour l'instant, on affiche une alerte
           // Dans une version complète, on ouvrirait un modal d'édition
          alert(`Édition de la transaction ${transactionId}\n\nCette fonctionnalité sera implémentée dans la version complète.`);
      } 

         // Fonction utilitaire pour les icônes des méthodes de paiement
        function getPaymentMethodIcon(method) {
             const icons = {
              'Virement': 'fa-university',
              'Mobile Money': 'fa-mobile-alt',
              'Espèces': 'fa-money-bill-wave',
              'Chèque': 'fa-money-check',
               'Carte bancaire': 'fa-credit-card'
             };
           return icons[method] || 'fa-money-bill';
        }

        // Fonction pour afficher les détails d'une transaction
        function viewTransactionDetails(transactionId) {
            const transaction = transactionsData.find(t => t.id === transactionId);
           if (!transaction) return;
    
            let details = `ðŸ“‹ **Détails de la transaction**\n\n`;
           details += `**ID:** ${transaction.id}\n`;
            details += `**Date:** ${transaction.date}\n`;
            details += `**Client:** ${transaction.client}\n`;
            details += `**Description:** ${transaction.description}\n`;
            details += `**Montant:** ${transaction.amount.toLocaleString()} XOF\n`;
            details += `**Mode de paiement:** ${transaction.method}\n`;
            details += `**Référence:** ${transaction.reference}\n`;
            details += `**Statut:** ${getStatusText(transaction.status)}\n`;
    
             if (transaction.signature) {
              details += `\n**Signature électronique:** ✓ Présente\n`;
           }
    
             if (transaction.signedAt) {
             const date = new Date(transaction.signedAt);
               details += `**Signée le:** ${date.toLocaleDateString('fr-FR')} à ${date.toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}\n`;
            }
    
            alert(details);
        }
  
         // Fonction pour valider une transaction en attente
        function validateTransaction(transactionId) {
           if (confirm('Valider cette transaction ?')) {
            const transaction = transactionsData.find(t => t.id === transactionId);
          if (transaction) {
            transaction.status = 'paid';
            
            // Mettre à jour le client correspondant
            const client = clientsData.find(c => `${c.lastName} ${c.firstName}` === transaction.client);
            if (client) {
                client.amountPaid += transaction.amount;
                if (client.amountPaid >= client.amountDue) {
                    client.status = 'paid';
                }
            }
            
            // Recharger les tableaux
            loadTransactions();
            if (document.getElementById('transactionsJournalBody')) {
                loadTransactionsPage();
            }
            
              // Recharger le dashboard pour mettre à jour les statistiques
               if (document.getElementById('statsGrid')) {
                loadDashboard();
              }
            
               alert('Transaction validée avec succès !');
              }
            }
        }

        function loadCollectorClientCards(filteredClients = null) {
            const clientList = document.getElementById('clientList');
            // Si aucun filtre fourni ET que l'utilisateur est un récolteur, filtrer par son périmètre
            let clientsToDisplay = filteredClients;
            if (!clientsToDisplay) {
                if (currentUser && currentUser.userType === 'collector' && currentUser.collectorName) {
                    clientsToDisplay = clientsData.filter(c => c.agent === currentUser.collectorName);
                } else {
                    clientsToDisplay = clientsData;
                }
            }
            
            const html = clientsToDisplay.map(client => `
                <div class="client-card ${client.status}" data-client-id="${client.id}">
                    <div class="client-header">
                        <div class="client-name">${client.lastName} ${client.firstName}</div>
                        <div class="client-status ${client.status}">${getStatusText(client.status)}</div>
                    </div>
                    
                    <div class="client-details">
                        <div class="client-detail">
                            <i class="fas fa-map-marker-alt"></i>
                            <span>${client.address}</span>
                        </div>
                        <div class="client-detail">
                            <i class="fas fa-phone"></i>
                            <span>${client.phone}</span>
                        </div>
                    </div>
                    
                    <div class="payment-section">
                        <div class="payment-title">
                            <i class="fas fa-money-bill-wave"></i>
                            <span>Paiement du loyer</span>
                        </div>
                        
                        <div class="amount-display">
                            <div class="amount-label">Montant à payer:</div>
                            <div class="amount-value xof">${client.amountDue.toLocaleString()}</div>
                        </div>
                        
                        <div class="amount-display">
                            <div class="amount-label">Montant déjà payé:</div>
                            <div class="amount-value xof">${client.amountPaid.toLocaleString()}</div>
                        </div>
                        
                        <div class="amount-display">
                            <div class="amount-label">Reste à payer:</div>
                            <div class="amount-value xof">${(client.amountDue - client.amountPaid).toLocaleString()}</div>
                        </div>
                        
                        <button class="btn btn-primary btn-full" onclick="openPaymentModal(${client.id})">
                            <i class="fas fa-plus-circle"></i> Enregistrer un paiement
                        </button>
                    </div>
                </div>
            `).join('');

            clientList.innerHTML = html;
        }

        // FONCTIONS POUR LA SIGNATURE ÉLECTRONIQUE
        function initSignatureCanvas() {
            signatureCanvas = document.getElementById('signatureCanvas');
            signatureCtx = signatureCanvas.getContext('2d');

            // Éviter d'empiler les listeners à chaque ouverture du modal
            if (signatureCanvas._listenersAttached) {
                signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
                return;
            }
            signatureCanvas._listenersAttached = true;

            // Ajuster la taille du canvas à l'écran
            const container = document.getElementById('signatureContainer');
            if (container) {
                signatureCanvas.width  = container.clientWidth  || 500;
                signatureCanvas.height = container.clientHeight || 150;
            }

            // Configurer le style du dessin
            signatureCtx.lineWidth   = 2;
            signatureCtx.lineCap     = 'round';
            signatureCtx.lineJoin    = 'round';
            signatureCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim() || '#6366f1';

            // Événements souris
            signatureCanvas.addEventListener('mousedown', startDrawing);
            signatureCanvas.addEventListener('mousemove', draw);
            signatureCanvas.addEventListener('mouseup',   stopDrawing);
            signatureCanvas.addEventListener('mouseout',  stopDrawing);

            // Événements tactiles
            signatureCanvas.addEventListener('touchstart', handleTouchStart,  { passive: false });
            signatureCanvas.addEventListener('touchmove',  handleTouchMove,   { passive: false });
            signatureCanvas.addEventListener('touchend',   stopDrawing);
        }

        function startDrawing(e) {
            isDrawing = true;
            const rect = signatureCanvas.getBoundingClientRect();
            lastX = (e.clientX || e.touches[0].clientX) - rect.left;
            lastY = (e.clientY || e.touches[0].clientY) - rect.top;
            
            // Masquer le placeholder
            document.getElementById('signaturePlaceholder').style.display = 'none';
        }

        function handleTouchStart(e) {
            if (e.touches.length === 1) {
                e.preventDefault();
                startDrawing(e);
            }
        }

        function handleTouchMove(e) {
            if (e.touches.length === 1) {
                e.preventDefault();
                draw(e);
            }
        }

        function draw(e) {
            if (!isDrawing) return;
            
            e.preventDefault();
            const rect = signatureCanvas.getBoundingClientRect();
            const currentX = (e.clientX || e.touches[0].clientX) - rect.left;
            const currentY = (e.clientY || e.touches[0].clientY) - rect.top;
            
            signatureCtx.beginPath();
            signatureCtx.moveTo(lastX, lastY);
            signatureCtx.lineTo(currentX, currentY);
            signatureCtx.stroke();
            
            lastX = currentX;
            lastY = currentY;
        }

        function stopDrawing() {
            isDrawing = false;
            // Enregistrer la signature actuelle
            currentSignature = signatureCanvas.toDataURL('image/png');
        }

        function clearSignature() {
            signatureCtx.clearRect(0, 0, signatureCanvas.width, signatureCanvas.height);
            currentSignature = null;
            // Réafficher le placeholder
            document.getElementById('signaturePlaceholder').style.display = 'block';
        }

        function openSignatureModal() {
            openModal('signatureModal');
            // Réinitialiser le canvas
            setTimeout(() => {
                initSignatureCanvas();
                clearSignature();
            }, 100);
        }

        function closeSignatureModal() {
            closeModal('signatureModal');
            currentSignature = null;
        }

        function validateSignature() {
            if (!currentSignature) {
                alert('Veuillez fournir une signature avant de valider.');
                return;
            }
            
            // Ici, dans une application réelle, on enverrait la signature au serveur
            // Pour cette démo, nous allons simplement l'afficher dans une alerte
            alert('Signature validée avec succès! La signature a été enregistrée de manière sécurisée.');
            
            // Fermer le modal
            closeSignatureModal();
            
            // Finaliser le paiement
            finalizePaymentWithSignature();
        }

        function finalizePaymentWithSignature() {
            // Cette fonction est appelée après la validation de la signature
            // Elle complète le processus de paiement
            if (!currentClientForPayment) return;
            
            // Ajouter la signature à la transaction
            const latestTransaction = transactionsData[0];
            if (latestTransaction) {
                latestTransaction.signature = currentSignature;
                latestTransaction.signedAt = new Date().toISOString();
            }
            
            // Message de confirmation final
            alert(`✓ Paiement finalisé avec signature sécurisée!\n\nClient: ${currentClientForPayment.lastName} ${currentClientForPayment.firstName}\nTransaction: ${latestTransaction ? latestTransaction.id : 'N/A'}\nSignature enregistrée: Oui`);
            
            // Réinitialiser
            currentClientForPayment = null;
            selectedPaymentMethod = "";
            currentSignature = null;
        }

        // ============================================
// FONCTION PRINCIPALE DE VALIDATION DE PAIEMENT
// ============================================

function validatePayment(amount, paymentType = 'normal') {
    // Vérifier qu'un mode de paiement est sélectionné
    if (!selectedPaymentMethod) {
        alert('âŒ Veuillez sélectionner un mode de paiement');
        return;
    }
    
    // Vérifier qu'un client est sélectionné
    if (!currentClientForPayment) {
        alert('âŒ Erreur: Aucun client sélectionné');
        return;
    }
    
    const clientId = currentClientForPayment.id;
    const clientIndex = clientsData.findIndex(c => c.id === clientId);
    
    if (clientIndex === -1) {
        alert('âŒ Erreur: Client non trouvé');
        return;
    }
    
    const client = clientsData[clientIndex];
    const reference = document.getElementById('paymentReference')?.value || 
                     `${paymentType.toUpperCase()}-${Date.now()}`;
    
    // Journalisation pour débogage
    console.log(`Validation paiement: Client ${client.id}, Montant: ${amount}, Type: ${paymentType}`);
    
    // Gestion selon le type de paiement
    switch(paymentType) {
        case 'advance':
            // Paiement anticipé : marquer plusieurs mois comme payés
            const monthsPaid = Math.floor(amount / client.amountDue);
            const discount = amount - (monthsPaid * client.amountDue);
            
            // Mettre à jour le paiement du client
            clientsData[clientIndex].amountPaid += amount;
            clientsData[clientIndex].status = 'paid';
            clientsData[clientIndex].advanceMonths = monthsPaid;
            clientsData[clientIndex].advanceBalance = amount;
            
            // Créer une transaction principale
            transactionsData.push({
                id: `ADV-${Date.now()}`,
                date: new Date().toLocaleDateString('fr-FR'),
                client: `${client.lastName} ${client.firstName}`,
                description: `Paiement anticipé ${monthsPaid} mois`,
                amount: amount,
                method: selectedPaymentMethod,
                reference: reference,
                status: 'paid',
                type: 'advance',
                monthsCovered: monthsPaid,
                discount: discount
            });
            
            // Créer des transactions pour chaque mois couvert
            const today = new Date();
            for (let i = 0; i < monthsPaid; i++) {
                const monthDate = new Date(today);
                monthDate.setMonth(monthDate.getMonth() + i);
                
                transactionsData.push({
                    id: `ADV-M${i+1}-${Date.now()}`,
                    date: monthDate.toLocaleDateString('fr-FR'),
                    client: `${client.lastName} ${client.firstName}`,
                    description: `Loyer ${monthDate.toLocaleDateString('fr-FR', {month: 'long', year: 'numeric'})}`,
                    amount: client.amountDue,
                    method: selectedPaymentMethod,
                    reference: `${reference}-M${i+1}`,
                    status: 'paid_advance',
                    advancePaymentId: reference
                });
            }
            
            // Afficher un message spécifique pour les paiements anticipés
            alert(`✓ Paiement anticipé enregistré !\n\n` +
                  `Montant: ${amount.toLocaleString()} XOF\n` +
                  `Mois couverts: ${monthsPaid}\n` +
                  `Remise: ${discount.toLocaleString()} XOF\n` +
                  `Prochain loyer dû dans ${monthsPaid} mois`);
            break;
            
        case 'partial':
            // Paiement partiel
            clientsData[clientIndex].amountPaid += amount;
            clientsData[clientIndex].status = 'partial';
            
            transactionsData.push({
                id: `PART-${Date.now()}`,
                date: new Date().toLocaleDateString('fr-FR'),
                client: `${client.lastName} ${client.firstName}`,
                description: 'Acompte sur loyer',
                amount: amount,
                method: selectedPaymentMethod,
                reference: reference,
                status: 'partial',
                balanceDue: client.amountDue - amount
            });
            
            alert(`✓ Acompte enregistré !\n\n` +
                  `Montant: ${amount.toLocaleString()} XOF\n` +
                  `Reste dû: ${(client.amountDue - amount).toLocaleString()} XOF`);
            break;
            
        case 'custom':
            // Paiement personnalisé
            clientsData[clientIndex].amountPaid += amount;
            clientsData[clientIndex].status = amount >= client.amountDue ? 'paid' : 'partial';
            
            transactionsData.push({
                id: `CUST-${Date.now()}`,
                date: new Date().toLocaleDateString('fr-FR'),
                client: `${client.lastName} ${client.firstName}`,
                description: 'Paiement personnalisé',
                amount: amount,
                method: selectedPaymentMethod,
                reference: reference,
                status: amount >= client.amountDue ? 'paid' : 'partial'
            });
            
            alert(`✓ Paiement personnalisé enregistré !\n\n` +
                  `Montant: ${amount.toLocaleString()} XOF`);
            break;
            
        default:
            // Paiement normal (loyer complet)
            clientsData[clientIndex].amountPaid += amount;
            clientsData[clientIndex].status = 'paid';
            
            transactionsData.push({
                id: `TRX-${Date.now()}`,
                date: new Date().toLocaleDateString('fr-FR'),
                client: `${client.lastName} ${client.firstName}`,
                description: 'Loyer mensuel',
                amount: amount,
                method: selectedPaymentMethod,
                reference: reference,
                status: 'paid'
            });
            
            alert(`✓ Paiement enregistré !\n\n` +
                  `Montant: ${amount.toLocaleString()} XOF\n` +
                  `Client: ${client.lastName} ${client.firstName}`);
            break;
    }
    
     // Réinitialiser la sélection
     selectedPaymentMethod = "";
     currentClientForPayment = null;
    
     // Fermer le modal de paiement
     closeModal('paymentModal');
    
     // Ouvrir le modal de signature
     openSignatureModal();
    
     // Recharger les données affichées
     if (currentUser && currentUser.userType === 'collector') {
        loadCollectorClientCards();
     } else {
        loadDashboard();
        if (document.getElementById('paymentsPage').classList.contains('active')) {
            loadTransactionsPage();
        }
    }
}

// ============================================
// FONCTION POUR SÉLECTIONNER UN MODE DE PAIEMENT
// ============================================

function selectPaymentMethod(methodId) {
    // Retirer la sélection précédente
    document.querySelectorAll('.payment-method').forEach(method => {
        method.classList.remove('selected');
    });
    
     // Ajouter la sélection au nouveau
     const methodElement = document.getElementById(`method-${methodId}`);
     if (methodElement) {
        methodElement.classList.add('selected');
        selectedPaymentMethod = methodId;
        console.log(`Mode de paiement sélectionné: ${methodId}`);
     }
     }

     // ============================================
     // FONCTION POUR OUVRIR LE MODAL DE PAIEMENT
      // ============================================

     function openPaymentModal(clientId, customAmount = null, paymentType = 'normal') {
     const client = clientsData.find(c => c.id === clientId);
     if (!client) {
        alert('âŒ Client non trouvé');
        return;
     }
    
     currentClientForPayment = client; // stocker l'objet, pas juste l'ID
     selectedPaymentMethod = ""; // Réinitialiser la sélection
    
     document.getElementById('modalClientName').textContent = 
        `Paiement - ${client.lastName} ${client.firstName}`;
    
     let modalContent = '';
    
     // En-tête selon le type de paiement
     if (paymentType === 'advance') {
        const monthsPaid = Math.floor(customAmount / client.amountDue);
        modalContent = `
            <div class="alert success">
                <i class="fas fa-calendar-check"></i>
                <div><strong>Paiement anticipé</strong> - Ce paiement couvrira ${monthsPaid} mois de loyer</div>
            </div>
            <div class="form-group">
                <label>Montant total</label>
                <div style="padding: 15px; background: rgba(16, 185, 129, 0.1); border-radius: 10px; font-size: 24px; font-weight: 700; text-align: center;">
                    ${customAmount.toLocaleString()} XOF
                </div>
                <small style="color: var(--gray);">
                    Loyer mensuel: ${client.amountDue.toLocaleString()} XOF Ã— ${monthsPaid} mois = ${(client.amountDue * monthsPaid).toLocaleString()} XOF<br>
                    Remise (5%): ${(customAmount - (client.amountDue * monthsPaid)).toLocaleString()} XOF
                </small>
            </div>`;
     } else if (paymentType === 'partial' || paymentType === 'custom') {
        modalContent = `
            <div class="alert info">
                <i class="fas fa-money-check-alt"></i>
                <div><strong>Paiement ${paymentType === 'partial' ? 'partiel' : 'personnalisé'}</strong></div>
            </div>
            <div class="form-group">
                <label>Montant à payer</label>
                <div style="padding: 15px; background: rgba(59, 130, 246, 0.1); border-radius: 10px; font-size: 24px; font-weight: 700; text-align: center;">
                    ${customAmount.toLocaleString()} XOF
                </div>
                <small style="color: var(--gray);">
                    Loyer mensuel complet: ${client.amountDue.toLocaleString()} XOF<br>
                    Solde restant après paiement: ${(client.amountDue - client.amountPaid - customAmount).toLocaleString()} XOF
                </small>
            </div>`;
     } else {
        // Paiement normal
        const remaining = client.amountDue - client.amountPaid;
        modalContent = `
            <div class="form-group">
                <label>Montant dû</label>
                <div style="padding: 15px; background: rgba(99, 102, 241, 0.1); border-radius: 10px; font-size: 24px; font-weight: 700; text-align: center;">
                    ${remaining.toLocaleString()} XOF
                </div>
                <small style="color: var(--gray);">
                    Loyer mensuel: ${client.amountDue.toLocaleString()} XOF<br>
                    Déjà payé: ${client.amountPaid.toLocaleString()} XOF
                </small>
            </div>`;
        customAmount = remaining; // Pour le paiement normal, utiliser le solde restant
     }
    
     // Section modes de paiement
     modalContent += `
        <div class="form-group">
            <label>Mode de paiement *</label>
            <div class="payment-methods" id="paymentMethods">
                ${paymentMethods.map(method => `
                    <div class="payment-method" id="method-${method.id}" onclick="selectPaymentMethod('${method.id}')">
                        <i class="fas ${method.icon}"></i>
                        <span>${method.name}</span>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="form-group">
            <label>Référence / Notes</label>
            <input type="text" id="paymentReference" placeholder="NÂ° de référence, notes...">
        </div>
        
        <div class="alert warning">
            <i class="fas fa-exclamation-triangle"></i>
            <div>N'oubliez pas de demander la signature du client après le paiement</div>
        </div>
        
        <button class="btn btn-success btn-full" onclick="validatePayment(${customAmount || client.amountDue}, '${paymentType}')">
            <i class="fas fa-check-circle"></i> Valider le paiement
        </button>
     `;
    
     document.getElementById('paymentModalContent').innerHTML = modalContent;
     openModal('paymentModal');
       }


        // selectPaymentMethod est définie globalement plus haut

        async function recordPaymentFromModal() {
            if (!currentClientForPayment) return;
            
            const paymentAmount = parseInt(document.getElementById('paymentAmount').value);
            const paymentDate = document.getElementById('paymentDate').value;
            const paymentReference = document.getElementById('paymentReference').value;
            
            if (!paymentAmount || paymentAmount <= 0) {
                alert('Veuillez saisir un montant valide');
                return;
            }
            
            if (!selectedPaymentMethod) {
                alert('Veuillez sélectionner un mode de paiement');
                return;
            }
            
            // Vérifier si une signature est requise (pour les paiements importants)
            const signatureRequired = paymentAmount >= 50000;
            
            if (signatureRequired && !currentSignature) {
                alert('Une signature électronique est requise pour ce paiement. Veuillez signer avant de finaliser.');
                openSignatureModal();
                return;
            }
            
            try {
                // Préparer les données de transaction pour l'API
                const transactionPayload = {
                    clientId: currentClientForPayment.id,
                    clientName: `${currentClientForPayment.lastName} ${currentClientForPayment.firstName}`,
                    description: `Paiement loyer ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
                    amount: paymentAmount,
                    method: selectedPaymentMethod,
                    reference: paymentReference || `PAY-${Date.now()}`,
                    status: 'processed',
                    signatureData: currentSignature || null,
                    collectorId: currentUser && currentUser.collectorId ? currentUser.collectorId : null
                };
                
                // Envoyer la transaction à l'API
                const transactionResponse = await API.Transactions.create(transactionPayload);
                
                if (!transactionResponse.success) {
                    throw new Error(transactionResponse.error || 'Erreur lors de l\'enregistrement du paiement');
                }
                
                // Mettre à jour le client localement
                const newAmountPaid = currentClientForPayment.amountPaid + paymentAmount;
                const remainingAmount = currentClientForPayment.amountDue - newAmountPaid;
                
                currentClientForPayment.amountPaid = newAmountPaid;
                currentClientForPayment.paymentMethod = selectedPaymentMethod;
                currentClientForPayment.status = remainingAmount <= 0 ? 'paid' : (paymentAmount < currentClientForPayment.amountDue ? 'partial' : 'pending');
                
                // Ajouter la transaction aussi en mémoire pour l'affichage immédiat
                const newTransaction = {
                    id: transactionResponse.data.id || transactionResponse.data.reference,
                    date: new Date().toLocaleDateString('fr-FR'),
                    client: `${currentClientForPayment.lastName} ${currentClientForPayment.firstName}`,
                    description: transactionPayload.description,
                    amount: paymentAmount,
                    method: paymentMethods.find(m => m.id === selectedPaymentMethod).name,
                    reference: transactionPayload.reference,
                    status: 'paid',
                    signature: currentSignature,
                    signedAt: currentSignature ? new Date().toISOString() : null
                };
                
                transactionsData.unshift(newTransaction);
                
                // Sauvegarder les données mises à jour localement
                localStorage.setItem('CLIENTS_DB', JSON.stringify(clientsData));
                localStorage.setItem('TRANSACTIONS_DB', JSON.stringify(transactionsData));
                
                // Mettre à jour l'affichage
                if (currentUser && currentUser.userType === 'collector') {
                    loadCollectorClientCards();
                } else {
                    loadDashboard();
                    loadTransactions();
                    // Mettre à jour le badge
                    const pendingCount = clientsData.filter(c => c.status === 'pending').length;
                    const clientBadge = document.getElementById('clientBadge');
                    if (clientBadge) clientBadge.textContent = pendingCount;
                }
                
                // Message de confirmation
                const methodName = paymentMethods.find(m => m.id === selectedPaymentMethod).name;
                let message = `✓ Paiement enregistré avec succès!\n\nClient: ${currentClientForPayment.lastName} ${currentClientForPayment.firstName}\nMontant: ${paymentAmount.toLocaleString()} XOF\nMode: ${methodName}\nRéférence: ${transactionPayload.reference}`;
                
                if (currentSignature) {
                    message += `\nSignature: Oui (sécurisée)`;
                }
                
                alert(message);
                
                closeModal('paymentModal');
                
                // Réinitialiser la signature pour le prochain paiement
                currentSignature = null;
                
            } catch (error) {
                console.error('Erreur enregistrement paiement:', error);
                alert(`âŒ Erreur lors de l'enregistrement du paiement: ${error.message}`);
            }
        }

        function openModal(modalId) {
            document.getElementById(modalId).classList.add('active');
            
            // Initialiser les sélecteurs selon le modal
            if (modalId === 'prefinancementModal') {
                initPrefinancementOwnerSelect();
            } else if (modalId === 'expenseModal') {
                populateExpenseSelects();
            } else if (modalId === 'newClientModal' || modalId === 'newOwnerModal') {
                // Charger les données nécessaires
            }
        }

        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        function closeAllModals() {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.classList.remove('active');
            });
        }

        // FONCTIONS UTILITAIRES
        function getOwnerName(ownerId) {
            const owner = ownersData.find(o => o.id === ownerId);
            return owner ? `${owner.lastName} ${owner.firstName}` : 'Non assigné';
        }

        function getStatusText(status) {
            switch(status) {
                case 'paid': return 'Payé';
                case 'pending': return 'En attente';
                case 'partial': return 'Partiel';
                case 'overdue': return 'En retard';
                default: return 'Inconnu';
            }
        }

        function toggleTheme() {
            isDarkTheme = !isDarkTheme;
            document.body.classList.toggle('dark-mode');
        }

        // FONCTIONS DE RECHERCHE (RÉCOLTEUR)
        function searchClients() {
            const searchTerm = document.getElementById('clientSearch').value.toLowerCase();

            // Déterminer le périmètre de base : tous les clients ou seulement ceux de l'agent
            let baseClients = clientsData;
            if (currentUser && currentUser.userType === 'collector' && currentUser.collectorName) {
                baseClients = clientsData.filter(c => c.agent === currentUser.collectorName);
            }

            if (!searchTerm) {
                loadCollectorClientCards(baseClients);
                return;
            }

            const filteredClients = baseClients.filter(client =>
                (client.firstName || '').toLowerCase().includes(searchTerm) ||
                (client.lastName  || '').toLowerCase().includes(searchTerm) ||
                (client.address   || '').toLowerCase().includes(searchTerm) ||
                (client.phone     || '').includes(searchTerm)
            );

            loadCollectorClientCards(filteredClients);
        }

        function showAllClients() {
            document.getElementById('clientSearch').value = '';
            // Afficher uniquement les clients de l'agent connecté
            if (currentUser && currentUser.userType === 'collector' && currentUser.collectorName) {
                const agentClients = clientsData.filter(c => c.agent === currentUser.collectorName);
                loadCollectorClientCards(agentClients);
            } else {
                loadCollectorClientCards();
            }
        }

        // FONCTIONS DE GRAPHIQUES (simplifiées)
        function initCharts() {
            setTimeout(() => {
                initRevenueChart();
                initPaymentChart();
                initSimulationChart();
                initZoneChart();
                initTenantChart();
            }, 100);
        }

        function initRevenueChart() {
            const ctx = document.getElementById('revenueChart')?.getContext('2d');
            if (!ctx) return;

            // Calculer les 6 derniers mois réels depuis transactionsData
            const now = new Date();
            const labels = [], dataPoints = [];
            for (let i = 5; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const m = d.getMonth(), y = d.getFullYear();
                labels.push(d.toLocaleDateString('fr-FR', { month: 'short' }));
                const total = transactionsData
                    .filter(t => { const p=(t.date||'').split('/'); return parseInt(p[1])-1===m && parseInt(p[2])===y && t.status==='paid'; })
                    .reduce((s, t) => s + (t.amount||0), 0);
                dataPoints.push(total);
            }

            if (charts.revenue) charts.revenue.destroy();
            charts.revenue = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [{
                        label: 'Recettes (XOF)',
                        data: dataPoints,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: true, position: 'top' } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { callback: v => (v/1000000).toFixed(1)+'M' }
                        }
                    }
                }
            });
        }

        // FONCTIONS DIVERSES (simplifiées pour la longueur)
        // runSimulation est définie complètement plus bas

        function generateTenantReport(clientId = null) {
            alert('Génération de rapport locataire - À implémenter');
        }

        // generateReport est définie complètement plus bas

        function openNewTransactionModal() {
         // Créer le contenu du modal
           const modalContent = `
              <div class="form-group">
                 <label for="newTransactionClient">Client</label>
               <select id="newTransactionClient">
                <option value="">Sélectionnez un client</option>
                ${clientsData.map(client => 
                    `<option value="${client.id}">${client.lastName} ${client.firstName} - ${client.amountDue.toLocaleString()} XOF dû</option>`
                ).join('')}
                </select>
               </div>
        
             <div class="form-group">
               <label for="newTransactionAmount">Montant (XOF)</label>
               <input type="number" id="newTransactionAmount" placeholder="Saisir le montant">
             </div>
        
             <div class="form-group">
             <label for="newTransactionMethod">Mode de paiement</label>
              <select id="newTransactionMethod">
                <option value="">Sélectionnez un mode</option>
                <option value="Virement">Virement bancaire</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Espèces">Espèces</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte bancaire">Carte bancaire</option>
               </select>
            </div>
        
             <div class="form-group">
            <label for="newTransactionDate">Date</label>
            <input type="date" id="newTransactionDate" value="${new Date().toISOString().split('T')[0]}">
              </div>
        
            <div class="form-group">
            <label for="newTransactionDescription">Description</label>
            <textarea id="newTransactionDescription" rows="3" placeholder="Description de la transaction"></textarea>
             </div>
        
             <div style="display: flex; gap: 15px; margin-top: 25px;">
             <button class="btn btn-secondary" style="flex: 1;" onclick="closeModal('newTransactionModal')">
                Annuler
             </button>
             <button class="btn btn-primary" style="flex: 1;" onclick="saveNewTransaction()">
                Enregistrer
               </button>
             </div>
            `;
    
            // Créer le modal dynamiquement s'il n'existe pas
             let modal = document.getElementById('newTransactionModal');
             if (!modal) {
               modal = document.createElement('div');
              modal.className = 'modal';
                modal.id = 'newTransactionModal';
               modal.innerHTML = `
                  <div class="modal-content" style="max-width: 500px;">
                    <div class="modal-header">
                    <h3 class="modal-title">Nouvelle transaction</h3>
                    <button class="modal-close" onclick="closeModal('newTransactionModal')">✕</button>
                    </div>
                      <div class="modal-body" id="newTransactionModalBody">
                        ${modalContent}
                    </div>
                 </div>
                  `;
              document.body.appendChild(modal);
             } else {
              document.getElementById('newTransactionModalBody').innerHTML = modalContent;
              }
    
           openModal('newTransactionModal');
        } 

        function saveNewTransaction() {
           const clientId = document.getElementById('newTransactionClient').value;
           const amount = document.getElementById('newTransactionAmount').value;
           const method = document.getElementById('newTransactionMethod').value;
           const date = document.getElementById('newTransactionDate').value;
           const description = document.getElementById('newTransactionDescription').value;
    
           // Validation
            if (!clientId || !amount || !method || !date) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
            }
    
            const client = clientsData.find(c => c.id === parseInt(clientId));
           if (!client) {
          alert('Client non trouvé');
         return;
         }
    
          // Créer la nouvelle transaction
         const newTransactionId = 'TRX-' + (transactionsData.length + 1).toString().padStart(3, '0');
           const newTransaction = {
         id: newTransactionId,
         date: new Date(date).toLocaleDateString('fr-FR'),
          client: `${client.lastName} ${client.firstName}`,
         description: description || `Paiement ${new Date(date).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
         amount: parseInt(amount),
         method: method,
         reference: 'MAN' + Date.now().toString().slice(-6),
         status: 'paid'
         };
    
         // Ajouter à la liste
          transactionsData.unshift(newTransaction);
    
          // Mettre à jour le client
           client.amountPaid += parseInt(amount);
          if (client.amountPaid >= client.amountDue) {
         client.status = 'paid';
         } else if (client.amountPaid > 0) {
          client.status = 'partial';
          }
    
          // Fermer le modal
          closeModal('newTransactionModal');
    
          // Recharger les tableaux
          if (document.getElementById('transactionsBody')) {
           loadTransactions();
          }
    
           if (document.getElementById('transactionsJournalBody')) {
          loadTransactionsPage();
         }
    
          // Recharger le dashboard
          if (document.getElementById('statsGrid')) {
          loadDashboard();
          }
    
          alert(`Transaction ${newTransactionId} enregistrée avec succès !`);
          }

        // ==========================================
        // UTILS & PLACEHOLDERS (Restore & New)
        // ==========================================

        function addNewClient() {
            // Logique d'ajout de client (Simulée)
            alert('Fonctionnalité d\'ajout de client: Ouvre un modal pour saisir les détails (Nom, Contact, Bien loué).');
            closeModal('newClientModal');
        }

        function addNewOwner() {
            openNewOwnerModal();
        }

        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        //  GESTION PROPRIÉTAIRES — modal unifié comptabilité + manager
        // â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let _editingOwnerId = null; // null = création, id = édition

        function openNewOwnerModal(editOwnerId = null) {
            _editingOwnerId = editOwnerId;
            const titleEl = document.getElementById('newOwnerModalTitle');
            const btnEl   = document.getElementById('newOwnerModalBtnLabel');

            if (editOwnerId) {
                const o = ownersData.find(x => x.id === editOwnerId);
                if (!o) return;
                titleEl.textContent = `Modifier — ${o.lastName} ${o.firstName}`;
                btnEl.textContent   = 'Enregistrer les modifications';
                document.getElementById('newOwnerLastName').value    = o.lastName  || '';
                document.getElementById('newOwnerFirstName').value   = o.firstName || '';
                document.getElementById('newOwnerEmail').value       = o.email     || '';
                document.getElementById('newOwnerPhone').value       = o.phone     || '';
                document.getElementById('newOwnerAddress').value     = o.address   || '';
                document.getElementById('newOwnerPaymentDay').value  = o.paymentDay ?? '';
                document.getElementById('newOwnerBankAccount').value = o.bankAccount   || '';
                // Restaurer le type de commission
                const commType = o.commissionType || 'percentage';
                setNewOwnerCommType(commType);
                if (commType === 'fixed') {
                    document.getElementById('newOwnerCommissionFixed').value = o.commissionFixed || 0;
                } else {
                    document.getElementById('newOwnerCommission').value = o.commissionRate || 10;
                }
            } else {
                titleEl.textContent = 'Ajouter un propriétaire';
                btnEl.textContent   = 'Enregistrer le propriétaire';
                ['newOwnerLastName','newOwnerFirstName','newOwnerEmail','newOwnerPhone',
                 'newOwnerAddress','newOwnerBankAccount'].forEach(id => {
                    const el = document.getElementById(id); if (el) el.value = '';
                });
                setNewOwnerCommType('percentage');
                document.getElementById('newOwnerCommission').value = 10;
                const fixedEl = document.getElementById('newOwnerCommissionFixed');
                if (fixedEl) fixedEl.value = '';
                document.getElementById('newOwnerPaymentDay').value = '';
            }
            openModal('newOwnerModal');
        }

        // Bascule l'affichage % / montant fixe dans le modal propriétaire
        function setNewOwnerCommType(type) {
            document.getElementById('newOwnerCommType').value = type;
            const pctBtn   = document.getElementById('newOwnerCommTypePctBtn');
            const fixedBtn = document.getElementById('newOwnerCommTypeFixedBtn');
            const percW    = document.getElementById('newOwnerPercWrapper');
            const fixedW   = document.getElementById('newOwnerFixedWrapper');
            if (!pctBtn || !fixedBtn) return;
            if (type === 'fixed') {
                pctBtn.style.background   = 'var(--bg-card)';
                pctBtn.style.color        = 'var(--gray)';
                fixedBtn.style.background = 'var(--primary)';
                fixedBtn.style.color      = '#fff';
                if (percW)  percW.style.display  = 'none';
                if (fixedW) fixedW.style.display = 'block';
            } else {
                pctBtn.style.background   = 'var(--primary)';
                pctBtn.style.color        = '#fff';
                fixedBtn.style.background = 'var(--bg-card)';
                fixedBtn.style.color      = 'var(--gray)';
                if (percW)  percW.style.display  = 'block';
                if (fixedW) fixedW.style.display = 'none';
            }
        }

        async function addNewOwnerFromModal() {
            const lastName    = document.getElementById('newOwnerLastName')?.value.trim();
            const firstName   = document.getElementById('newOwnerFirstName')?.value.trim();
            const email       = document.getElementById('newOwnerEmail')?.value.trim();
            const phone       = document.getElementById('newOwnerPhone')?.value.trim();
            const address     = document.getElementById('newOwnerAddress')?.value.trim();
            const commType    = document.getElementById('newOwnerCommType')?.value || 'percentage';
            const commission  = parseFloat(document.getElementById('newOwnerCommission')?.value) || 10;
            const commFixed   = parseFloat(document.getElementById('newOwnerCommissionFixed')?.value) || 0;
            const paymentDay  = document.getElementById('newOwnerPaymentDay')?.value || '';
            const bankAccount = document.getElementById('newOwnerBankAccount')?.value.trim();

            if (!lastName || !phone) {
                showAlert('Le nom et le téléphone sont obligatoires', 'error');
                return;
            }
            if (!paymentDay) {
                showAlert('Veuillez choisir le jour de versement souhaité', 'error');
                return;
            }
            if (commType === 'fixed' && (!commFixed || commFixed <= 0)) {
                showAlert('Veuillez saisir un montant fixe de commission valide', 'error');
                return;
            }
            if (commType === 'percentage' && (commission < 0 || commission > 100)) {
                showAlert('Le taux de commission doit être entre 0 et 100 %', 'error');
                return;
            }

            const commData = {
                commissionType:  commType,
                commissionRate:  commType === 'percentage' ? commission : 0,
                commissionFixed: commType === 'fixed'      ? commFixed  : 0,
            };

            if (_editingOwnerId) {
                // â”€â”€ Mode édition â”€â”€
                try {
                    const updateData = { 
                        firstName, lastName, email, phone, address, 
                        bankAccount: bankAccount || null,
                        ...commData 
                    };
                    const res = await API.Owners.update(_editingOwnerId, updateData);
                    if (res?.success) {
                        const o = ownersData.find(x => x.id === _editingOwnerId);
                        if (o) {
                            Object.assign(o, updateData);
                        }
                        showAlert(`✓ Propriétaire "${lastName} ${firstName}" mis à jour en BD`, 'success');
                    }
                } catch (error) {
                    console.error('Erreur mise à jour propriétaire:', error);
                    const o = ownersData.find(x => x.id === _editingOwnerId);
                    if (o) {
                        Object.assign(o, { lastName, firstName, email, phone, address, paymentDay, bankAccount, ...commData });
                    }
                    showAlert('⚠️ Mise à jour localeûment (pas de connexion BD)', 'warning');
                }
            } else {
                // â”€â”€ Mode création â”€â”€
                try {
                    const ownerData = {
                        firstName: firstName || '',
                        lastName,
                        email: email || '',
                        phone,
                        address: address || '',
                        bankAccount: bankAccount || null
                    };
                    const res = await API.Owners.create(ownerData);
                    if (res?.success) {
                        const newOwner = {
                            id: res.data.id || (Math.max(...ownersData.map(o => o.id || 0), 0) + 1),
                            ...ownerData,
                            joinDate: new Date().toLocaleDateString('fr-FR'),
                            paymentDay, 
                            propertiesCount: 0, 
                            totalRevenue: 0, 
                            status: 'actif',
                            ...commData
                        };
                        ownersData.push(newOwner);
                        showAlert(`✓ Propriétaire "${lastName} ${firstName}" ajouté en BD`, 'success');
                    }
                } catch (error) {
                    console.error('Erreur création propriétaire:', error);
                    const newId = Math.max(...ownersData.map(o => o.id || 0), 0) + 1;
                    const newOwner = {
                        id: newId, lastName, firstName, email: email || '', phone,
                        address: address || '',
                        joinDate: new Date().toLocaleDateString('fr-FR'),
                        paymentDay, bankAccount: bankAccount || '',
                        propertiesCount: 0, totalRevenue: 0, status: 'actif',
                        ...commData
                    };
                    ownersData.push(newOwner);
                    showAlert('✓ Propriétaire ajouté localement', 'info');
                }
            }

            refreshOwnerDropdowns();
            if (typeof loadOwnersList === 'function') loadOwnersList();
            if (typeof loadManagerPropertiesTable === 'function') loadManagerPropertiesTable();
            if (typeof loadOwnerPaymentsTable === 'function') { loadOwnerPaymentsTable(); updateOwnerPaymentStats(); }
            closeModal('newOwnerModal');
            _editingOwnerId = null;
        }

        // RafraÃ®chit tous les <select> propriétaires dans l'app
        function refreshOwnerDropdowns() {
            const ownerOpts = '<option value="">-- Choisir un propriétaire --</option>' +
                ownersData.map(o => `<option value="${o.id}">${o.lastName} ${o.firstName}</option>`).join('');
            const allOpts = '<option value="all">Tous les propriétaires</option>' +
                ownersData.map(o => `<option value="${o.id}">${o.lastName} ${o.firstName}</option>`).join('');

            ['assignOwnerFilter','propertyOwnerFilter'].forEach(id => {
                const el = document.getElementById(id); if (el) el.innerHTML = allOpts;
            });
            ['expenseOwnerSelect','commissionOwnerSelect','propOwner'].forEach(id => {
                const el = document.getElementById(id); if (el) el.innerHTML = ownerOpts;
            });
        }

        function editProperty(propertyId) {
            alert(`Édition de la propriété ${propertyId}: Ouvre le formulaire de modification.`);
        }

        function viewPropertyDetails(propertyId) {
            const property = propertiesData.find(p => p.id === propertyId);
            if (property) {
                alert(`Détails propriété: ${property.name}\nType: ${getPropertyTypeText(property.type)}\nAdresse: ${property.address}\nValeur: ${property.value.toLocaleString()} XOF\nStatut: ${getPropertyStatusText(property.status)}`);
            }
        }

        function exportProperties() {
            const format = document.getElementById('exportFormat') ? document.getElementById('exportFormat').value : 'csv';
            alert(`Exportation des propriétés en format ${format.toUpperCase()} générée.`);
        }

        function zoomToCluster(clusterType) {
            alert(`Zoom sur cluster: ${clusterType} - Interaction cartographique.`);
        }

        function filterByZone() {
            alert('Filtrage par zone appliqué sur la carte.');
        }

        // ==========================================
        // NEW FEATURES IMPLEMENTATION
        // ==========================================

        // 1. Document Management
        function uploadClientDocument(clientId) {
            // Simulation d'upload
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = '.pdf,.jpg,.png,.doc';
            fileInput.onchange = e => {
                const file = e.target.files[0];
                if (file) {
                    alert(`Document "${file.name}" téléchargé avec succès pour le client ID ${clientId}.`);
                    // Ici on ajouterait le fichier à la liste des documents du client
                    loadClientDocuments(clientId); // RafraÃ®chir la liste (simulé)
                }
            };
            fileInput.click();
        }

        function loadClientDocuments(clientId) {
            const list = document.getElementById('clientDocumentsList');
            if(!list) return;

            // Données simulées
            const docs = [
                { name: 'Contrat de Bail.pdf', date: '12/01/2024', size: '2.4 MB' },
                { name: 'État des lieux.pdf', date: '12/01/2024', size: '1.8 MB' },
                { name: 'Pièce d\'identité.jpg', date: '10/01/2024', size: '0.5 MB' }
            ];

            let html = '<ul class="document-list">';
            docs.forEach(doc => {
                html += `
                    <li class="document-item">
                        <div class="doc-icon"><i class="fas fa-file-pdf"></i></div>
                        <div class="doc-info">
                            <div class="doc-name">${doc.name}</div>
                            <div class="doc-meta">${doc.date} • ${doc.size}</div>
                        </div>
                        <div class="doc-actions">
                            <button class="btn btn-icon btn-small"><i class="fas fa-download"></i></button>
                            <button class="btn btn-icon btn-small"><i class="fas fa-trash"></i></button>
                        </div>
                    </li>
                `;
            });
            html += '</ul>';
            html += `
                <button class="btn btn-outline btn-full" style="margin-top:15px;" onclick="uploadClientDocument(${clientId})">
                    <i class="fas fa-cloud-upload-alt"></i> Ajouter un document
                </button>
            `;
            list.innerHTML = html;
        }

        // 2. Contract Generation
        function generateClientContract(clientId) {
            const client = clientsData.find(c => c.id === clientId);
            if(!client) return;
            
            const confirmGen = confirm(`Générer un contrat de bail pour ${client.lastName} ${client.firstName} ?`);
            if(confirmGen) {
                alert(`Contrat généré avec succès ! \n\nLe document "Contrat_Bail_${client.lastName}.pdf" a été créé et ajouté aux documents.`);
                // Simuler l'ajout
                loadClientDocuments(clientId);
            }
        }
        
        function editPropertyContract(propertyId) {
             const property = propertiesData.find(p => p.id === propertyId);
             if(property && property.tenantId) {
                 generateClientContract(property.tenantId);
             } else {
                 alert("Aucun locataire associé à cette propriété pour générer un contrat.");
             }
        }

        // 3. Reminders
        function sendReminderToClient(clientId) {
            const client = clientsData.find(c => c.id === clientId);
            if(!client) return;

            const method = prompt("Choisir la méthode d'envoi (SMS / Email / WhatsApp) :", "Email");
            if(method) {
                alert(`Rappel envoyé à ${client.lastName} ${client.firstName} via ${method}.`);
            }
        }

        // 4. Exports
        function exportClientsList() {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += "ID,Nom,Prénom,Téléphone,Propriété,Statut,Montant Dû\n";
            
            clientsData.forEach(c => {
                const row = `${c.id},${c.lastName},${c.firstName},${c.phone},${c.property},${c.status},${c.amountDue}`;
                csvContent += row + "\r\n";
            });

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "clients_sygim.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        function loadClientNotes(clientId) {
             const list = document.getElementById('clientNotesList');
             if(!list) return;
             list.innerHTML = `<div class="alert info">Fonctionnalité de notes en cours de développement.</div>`;
        }



        function saveSystemSettings() {
            alert('Paramètres système sauvegardés');
        }

        function resetSettings() {
            if (confirm('Réinitialiser tous les paramètres?')) {
                alert('Paramètres réinitialisés');
            }
        }

        function saveAllSettings() {
            alert('Tous les paramètres sauvegardés');
        }

        function openSettingsModal(type) {
            alert(`Paramètres ${type} - À implémenter`);
        }

        function exportPayments() {
            alert('Exportation des paiements - À implémenter');
        }

        function resetPassword() {
            alert('Réinitialisation du mot de passe - À implémenter');
        }

        function showRevenueDetails() {
            const totalRevenue = clientsData.reduce((sum, client) => sum + client.amountPaid, 0);
            const totalDue = clientsData.reduce((sum, client) => sum + client.amountDue, 0);
            const collectionRate = Math.round((totalRevenue / totalDue) * 100);
            
            alert(`Détails des recettes:\n\nTotal encaissé: ${totalRevenue.toLocaleString()} XOF\nTotal attendu: ${totalDue.toLocaleString()} XOF\nTaux de recouvrement: ${collectionRate}%\n\nClients en retard: ${clientsData.filter(c => c.status === 'pending').length}`);
        }

        function showPendingPayments() {
            const pendingClients = clientsData.filter(c => c.status === 'pending');
            let message = 'Clients en attente de paiement:\n\n';
            
            pendingClients.forEach(client => {
                message += `${client.lastName} ${client.firstName}: ${client.amountDue.toLocaleString()} XOF\n`;
            });
            
            message += `\nTotal en attente: ${pendingClients.reduce((sum, c) => sum + c.amountDue, 0).toLocaleString()} XOF`;
            alert(message);
        }

        // FONCTIONS POUR L'ASSISTANT IA
        function toggleAIPanel() {
            const panel = document.getElementById('aiPanel');
            const button = document.querySelector('.ai-button');
            
            isAIOpen = !isAIOpen;
            panel.classList.toggle('active');
            button.classList.toggle('pulse');
            
            if (isAIOpen) {
                // Afficher l'analyse du jour au premier ouverture
                showDailyAnalysis();
                document.getElementById('aiInput').focus();
            }
        }

        function showDailyAnalysis() {
            const analysisDiv = document.getElementById('initialAnalysis');
            const contentDiv  = document.getElementById('analysisContent');
            if (!analysisDiv || !contentDiv) return;
            const pending   = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue').length;
            const totalPaid = clientsData.reduce((s,c) => s+(c.amountPaid||0), 0);
            const totalDue  = clientsData.reduce((s,c) => s+(c.amountDue||0), 0);
            const rate      = totalDue > 0 ? Math.round(totalPaid/totalDue*100) : 0;
            const fmt = n => Number(n).toLocaleString('fr-FR') + ' XOF';
            let lines = [];
            if (pending > 0) lines.push(`⚠️ **${pending} retard(s)** à traiter`);
            if (totalPaid > 0) lines.push(`💰 **${fmt(totalPaid)}** encaissés`);
            lines.push(`📈 Taux de recouvrement : **${rate}%**`);
            if (rate < 70 && totalDue > 0) lines.push(`🔴 Taux critique — relances urgentes`);
            contentDiv.innerHTML = lines.join('<br>');
            analysisDiv.style.display = 'block';
        }

        function sendAIMessage() {
            const input   = document.getElementById('aiInput');
            const message = input.value.trim();
            if (!message) return;
            addAIMessage(message, 'user');
            input.value = '';
            setTimeout(() => processAIResponse(message), 400 + Math.random() * 400);
        }

        function askAI(question) {
            const input = document.getElementById('aiInput');
            input.value = question;
            sendAIMessage();
        }

        function handleAIKeyPress(event) {
            if (event.key === 'Enter') sendAIMessage();
        }

        function addAIMessage(text, sender) {
            const messagesDiv = document.getElementById('aiMessages');
            if (aiMessages.length === 0 && sender === 'user') {
                const ia = document.getElementById('initialAnalysis');
                if (ia) ia.style.display = 'none';
                const sg = document.getElementById('aiSuggestions');
                if (sg) sg.style.display = 'none';
            }

            const div = document.createElement('div');
            div.className = `ai-message ${sender}`;

            // Rendu markdown léger : **gras**, *italique*, \n â†’ <br>
            let html = text
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/\n/g, '<br>');
            div.innerHTML = html;
            messagesDiv.appendChild(div);
            aiMessages.push({ text, sender, timestamp: new Date() });
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function addAIActionButtons(actions) {
            if (!actions || !actions.length) return;
            const messagesDiv = document.getElementById('aiMessages');
            const wrapper = document.createElement('div');
            wrapper.className = 'ai-action-btns';
            actions.forEach(a => {
                const btn = document.createElement('button');
                btn.className = 'ai-action-btn';
                btn.textContent = a.label;
                btn.onclick = () => {
                    a.fn();
                    wrapper.style.opacity = '0.5';
                    wrapper.style.pointerEvents = 'none';
                };
                wrapper.appendChild(btn);
            });
            messagesDiv.appendChild(wrapper);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function showTypingIndicator() {
            const messagesDiv = document.getElementById('aiMessages');
            const typingDiv   = document.createElement('div');
            typingDiv.className = 'ai-typing';
            typingDiv.id = 'aiTyping';
            typingDiv.innerHTML = '<span></span><span></span><span></span>';
            messagesDiv.appendChild(typingDiv);
            messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        function hideTypingIndicator() {
            const t = document.getElementById('aiTyping');
            if (t) t.remove();
        }

        function processAIResponse(userMessage) {
            showTypingIndicator();
            const delay = 600 + Math.random() * 800;
            setTimeout(() => {
                hideTypingIndicator();
                const result = aiGenerateResponse(userMessage);
                addAIMessage(result.text, 'bot');
                if (result.actions && result.actions.length) {
                    addAIActionButtons(result.actions);
                }
            }, delay);
        }

                // Intégration avec les raccourcis clavier
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.key === 'i') {
                e.preventDefault();
                if (!isAIOpen) {
                    toggleAIPanel();
                }
                document.getElementById('aiInput').focus();
            }
            
            if (e.key === 'Escape' && isAIOpen) {
                toggleAIPanel();
            }
            
            if (e.key === 'Escape') {
                closeAllModals();
            }
            if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                const searchBar = document.querySelector('.search-bar input');
                if (searchBar) searchBar.focus();
            }
        });

        // INITIALISATION
        document.addEventListener('DOMContentLoaded', function() {
            // Initialiser les données
            if (document.getElementById('clientList')) {
                loadCollectorClientCards();
            }
            
            // Initialiser les statistiques du portefeuille
            updatePortfolioStats();
            
            // Charger le dashboard au démarrage
            loadDashboard();
            
            // Initialiser l'assistant IA
            setTimeout(showDailyAnalysis, 1000);
            
            // Raccourci global pour l'IA
            console.log('Assistant IA activé. Raccourci: Ctrl + I');
        });
        // Fonctions pour la page Rapports
         function loadReportsPage() {
           // Remplir le tableau des rapports
        loadReportsTable();
    
           // Afficher un aperçu par défaut
          refreshReportPreview();
          // Dans loadReportsPage, après avoir chargé le tableau, ajoutez :
         document.getElementById('prefinancementEnCours').textContent = prefinancementsData.filter(p => p.statut === 'en_cours').length;
         document.getElementById('prefinancementTotal').textContent = prefinancementsData.reduce((s,p) => s + p.montant, 0).toLocaleString();
        }

        function loadReportsTable() {
            const tbody = document.getElementById('reportsBody');
    
           const reports = [];
    
          tbody.innerHTML = reports.length ? reports.map(report => `
         <tr>
            <td>
                <strong>${report.name}</strong>
                <br><small style="color: var(--gray);">ID: REP-${Math.floor(Math.random() * 10000)}</small>
            </td>
            <td><span class="status-badge paid">${report.type}</span></td>
            <td>${report.period}</td>
            <td>${report.date}</td>
            <td>${report.size}</td>
            <td><span class="status-badge info">${report.format}</span></td>
            <td>
                <button class="btn btn-icon btn-outline btn-small" onclick="viewReport('${report.name}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-icon btn-outline btn-small" onclick="downloadReport('${report.name}')">
                    <i class="fas fa-download"></i>
                </button>
                <button class="btn btn-icon btn-outline btn-small" onclick="shareReport('${report.name}')">
                    <i class="fas fa-share-alt"></i>
                </button>
            </td>
          </tr>
           `    ).join('') : '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:28px;">Aucun rapport enregistre en base de donnees.</td></tr>';
        }

        function refreshReportPreview() {
            const content = document.getElementById('reportPreviewContent');
    
           // Calculer les statistiques pour l'aperçu
          const totalRevenue = clientsData.reduce((sum, client) => sum + client.amountPaid, 0);
         const totalDue = clientsData.reduce((sum, client) => sum + client.amountDue, 0);
           const pendingClients = clientsData.filter(c => c.status === 'pending');
          const collectionRate = totalDue > 0 ? Math.round((totalRevenue / totalDue) * 100) : 0;
          const occupancyRate = propertiesData.length > 0 ? Math.round((propertiesData.filter(p => p.status === 'loue').length / propertiesData.length) * 100) : 0;
    
          content.innerHTML = `
           <div class="report-section">
              <div class="report-section-title">
                <i class="fas fa-chart-bar"></i>
                Résumé exécutif - Juin 2025
            </div>
            <p style="color: var(--gray); margin-bottom: 15px;">
                Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}
            </p>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                <div style="text-align: center; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
                    <div style="font-size: 12px; color: var(--gray);">Recettes totales</div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--success);" class="xof">${(totalRevenue / 1000000).toFixed(2)}M</div>
                </div>
                <div style="text-align: center; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
                    <div style="font-size: 12px; color: var(--gray);">Taux de recouvrement</div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--success);">${collectionRate}%</div>
                </div>
                <div style="text-align: center; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
                    <div style="font-size: 12px; color: var(--gray);">Retards en cours</div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--warning);">${pendingClients.length}</div>
                 </div>
                  <div style="text-align: center; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px;">
                    <div style="font-size: 12px; color: var(--gray);">Occupation</div>
                    <div style="font-size: 24px; font-weight: 700; color: var(--success);">${occupancyRate}%</div>
                 </div>
            </div>
         </div>
        
         <div class="report-section">
            <div class="report-section-title">
                <i class="fas fa-exclamation-triangle"></i>
                Analyse des retards de paiement
            </div>
            <table class="report-data-table">
                <thead>
                    <tr>
                        <th>Client</th>
                        <th>Montant dû</th>
                        <th>Jours de retard</th>
                        <th>Dernier contact</th>
                        <th>Actions recommandées</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendingClients.map(client => `
                        <tr>
                            <td><strong>${client.lastName} ${client.firstName}</strong></td>
                            <td class="xof">${client.amountDue.toLocaleString()}</td>
                            <td>${Math.floor(Math.random() * 30) + 1} jours</td>
                            <td>${Math.floor(Math.random() * 7) + 1} jours</td>
                            <td>${client.amountDue > 200000 ? 'Contact téléphonique urgent' : 'Email de rappel'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            <div class="report-total">
                <div class="report-total-label">Total retards:</div>
                <div class="report-total-value xof">${pendingClients.reduce((sum, c) => sum + c.amountDue, 0).toLocaleString()}</div>
            </div>
         </div>
        
          <div class="report-section">
            <div class="report-section-title">
                <i class="fas fa-building"></i>
                Performance des biens immobiliers
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
                <div>
                    <h4 style="margin-bottom: 10px; color: var(--primary);">Répartition par type</h4>
                    <div class="report-chart-mini">
                        <canvas id="reportChart1"></canvas>
                    </div>
                </div>
                <div>
                    <h4 style="margin-bottom: 10px; color: var(--primary);">Répartition par statut</h4>
                    <div class="report-chart-mini">
                        <canvas id="reportChart2"></canvas>
                    </div>
                </div>
            </div>
         </div>
        
         <div style="margin-top: 20px; padding: 15px; background: rgba(99, 102, 241, 0.05); border-radius: 8px; border-left: 4px solid var(--primary);">
            <h4 style="color: var(--primary); margin-bottom: 10px;"><i class="fas fa-lightbulb"></i> Recommandations</h4>
            <ul style="color: var(--gray); padding-left: 20px; margin: 0;">
                <li>Mettre en place un système de relance automatique pour les retards</li>
                <li>Réviser les loyers des biens vacants depuis plus de 60 jours</li>
                <li>Étudier l'acquisition dans les zones à fort ROI (Plateau, Cocody)</li>
                <li>Automatiser la facturation pour réduire les erreurs humaines</li>
            </ul>
          </div>
         `;
    
          // Initialiser les mini graphiques
          setTimeout(() => {
          initReportCharts();
         }, 100);
        }

        function initReportCharts() {
           // Graphique 1 : Répartition par type
           const ctx1 = document.getElementById('reportChart1')?.getContext('2d');
           if (ctx1) {
            new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Appartements', 'Maisons', 'Immeubles', 'Commerciaux', 'Quartiers'],
                datasets: [{
                    data: [
                        propertiesData.filter(p => p.type === 'appartement').length,
                        propertiesData.filter(p => p.type === 'maison').length,
                        propertiesData.filter(p => p.type === 'immeuble').length,
                        propertiesData.filter(p => p.type === 'commercial').length,
                        propertiesData.filter(p => p.type === 'quartier').length
                    ],
                    backgroundColor: [
                        '#6366f1',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444',
                        '#3b82f6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
          });
         }
    
         // Graphique 2 : Répartition par statut
           const ctx2 = document.getElementById('reportChart2')?.getContext('2d');
          if (ctx2) {
         new Chart(ctx2, {
            type: 'pie',
            data: {
                labels: ['Loué', 'Vacant', 'En rénovation', 'En construction'],
                datasets: [{
                    data: [
                        propertiesData.filter(p => p.status === 'loue' || p.status === 'partiel').length,
                        propertiesData.filter(p => p.status === 'vacant').length,
                        propertiesData.filter(p => p.status === 'en_renovation').length,
                        propertiesData.filter(p => p.status === 'en_construction').length
                    ],
                    backgroundColor: [
                        '#10b981',
                        '#f59e0b',
                        '#6366f1',
                        '#3b82f6'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
          });
         }
        }

        function generateReport(type) {
         let reportName = '';
          let message = '';
    
          switch(type) {
          case 'monthly':
            reportName = 'Rapport Mensuel';
            message = 'Génération du rapport mensuel en cours...';
            break;
         case 'quarterly':
          reportName = 'Rapport Trimestriel';
            message = 'Génération du rapport trimestriel en cours...';
            break;
         case 'delinquency':
            reportName = 'Rapport Retards de Paiement';
            message = 'Analyse des retards de paiement en cours...';
            break;
          case 'tenant':
            reportName = 'Rapport Profils Locataires';
            message = 'Analyse des profils locataires en cours...';
            break;
         case 'owner':
            reportName = 'Rapport Performance Propriétaires';
            message = 'Analyse des performances propriétaires en cours...';
            break;
         case 'property':
            reportName = 'Rapport État du Parc Immobilier';
            message = 'Analyse du parc immobilier en cours...';
            break;
         case 'prefinancement':
            reportName = 'Rapport de Préfinancement';
            message = 'Génération du rapport de préfinancement en cours...';
            break;
         default:
            reportName = 'Rapport Personnalisé';
            message = 'Génération du rapport en cours...';
         }
    
          // Simuler la génération
          alert(`${message}\n\nLe rapport "${reportName}" sera disponible dans quelques secondes.`);
    
          // Ajouter à l'historique
           setTimeout(() => {
           const newReport = {
            name: reportName,
            type: type,
            period: new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
            date: new Date().toLocaleDateString('fr-FR'),
            size: `${(Math.random() * 5 + 1).toFixed(1)} MB`,
            format: 'PDF'
          };
        
           // Ajouter en haut du tableau
          const tbody = document.getElementById('reportsBody');
           const newRow = `
            <tr>
                <td>
                    <strong>${newReport.name}</strong>
                    <br><small style="color: var(--gray);">ID: REP-${Date.now().toString().slice(-6)}</small>
                </td>
                <td><span class="status-badge paid">${newReport.type}</span></td>
                <td>${newReport.period}</td>
                <td>${newReport.date}</td>
                <td>${newReport.size}</td>
                <td><span class="status-badge info">${newReport.format}</span></td>
                <td>
                    <button class="btn btn-icon btn-outline btn-small" onclick="viewReport('${newReport.name}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="downloadReport('${newReport.name}')">
                        <i class="fas fa-download"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="shareReport('${newReport.name}')">
                        <i class="fas fa-share-alt"></i>
                    </button>
                </td>
            </tr>
           `;
        
          tbody.innerHTML = newRow + tbody.innerHTML;
        
         alert(`✓ Rapport "${reportName}" généré avec succès !\n\nIl a été ajouté à votre historique.`);
         
         // RafraÃ®chir l'aperçu
          refreshReportPreview();
          }, 2000);
        }

        function generateCustomReport() {
          const type = document.getElementById('reportType').value;
          const period = document.getElementById('reportPeriod').value;
         const format = document.getElementById('reportFormat').value;
    
           alert(`Génération d'un rapport personnalisé:\n\n• Type: ${type}\n• Période: ${period}\n• Format: ${format}\n\nLe rapport sera disponible dans quelques instants.`);
    
           // Simuler la génération
            setTimeout(() => {
         generateReport(type);
          }, 1000);
        }

        function scheduleReport() {
           alert('Fonctionnalité de planification des rapports - À implémenter dans la version complète');
        }

        function exportAllReports() {
          if (confirm('Exporter tous les rapports disponibles ?\n\nCette opération peut prendre quelques minutes.')) {
          alert('Exportation de tous les rapports en cours...\n\nUn fichier ZIP contenant tous les rapports sera téléchargé.');
          }
        }

        function clearReportHistory() {
          if (confirm('Êtes-vous sûr de vouloir effacer tout l\'historique des rapports ?\n\nCette action est irréversible.')) {
          document.getElementById('reportsBody').innerHTML = '';
          alert('Historique des rapports effacé.');
         }
        }

        function openCustomReportModal() {
           alert('Modal de création de rapport personnalisé - À implémenter dans la version complète');
        }

        function viewReport(reportName) {
           alert(`Affichage du rapport: ${reportName}\n\nCette fonctionnalité ouvrirait le rapport dans une nouvelle fenêtre ou dans un visualiseur PDF.`);
        }

        function downloadReport(reportName) {
           alert(`Téléchargement du rapport: ${reportName}\n\nLe rapport sera téléchargé dans votre dossier de téléchargements.`);
        }
        function shareReport(reportName) {
          alert(`Partage du rapport: ${reportName}\n\nCette fonctionnalité permettrait de partager le rapport par email ou lien sécurisé.`);
        }

        function updateReportFilters() {
           const type = document.getElementById('reportType').value;
          const periodSelect = document.getElementById('reportPeriod');
    
            // Mettre à jour les options de période selon le type
          if (type === 'monthly') {
         periodSelect.innerHTML = `
            <option value="current">Mois en cours</option>
            <option value="last">Mois dernier</option>
            <option value="january">Janvier 2025</option>
            <option value="february">Février 2025</option>
            <option value="march">Mars 2025</option>
            <option value="april">Avril 2025</option>
            <option value="may">Mai 2025</option>
            <option value="june" selected>Juin 2025</option>
         `;
         }  else if (type === 'quarterly') {
         periodSelect.innerHTML = `
            <option value="q1">T1 2025</option>
            <option value="q2" selected>T2 2025</option>
            <option value="q3">T3 2025</option>
            <option value="q4">T4 2025</option>
            <option value="q1_2024">T1 2024</option>
            <option value="q2_2024">T2 2024</option>
         `;
          } else if (type === 'annual') {
         periodSelect.innerHTML = `
            <option value="year_2025" selected>Année 2025</option>
            <option value="year_2024">Année 2024</option>
            <option value="year_2023">Année 2023</option>
         `;
         } else if (type === 'prefinancement') {
         periodSelect.innerHTML = `
            <option value="current">Mois en cours</option>
            <option value="last">Mois dernier</option>
            <option value="q2" selected>T2 2025</option>
            <option value="q1">T1 2025</option>
            <option value="year_2025">Année 2025</option>
         `;
         }
       }
        // Fonctions pour la page Analyse
         function loadAnalyticsPage() {
          // Initialiser les graphiques
         setTimeout(() => {
         initSimulationChart();
         initComparisonChart();
         initTrendsChart();
         initZoneChart();
         initTenantChart();
         initPortfolioChart();
         initPredictiveChart();
         }, 100);
    
          // Charger les résultats de simulation par défaut
         updateSimulation();
        }

        function switchAnalyticsTab(tabName) {
         // Masquer tous les onglets
           document.querySelectorAll('.analytics-tab-content').forEach(tab => {
          tab.classList.remove('active');
         });
    
         // Désactiver tous les onglets
         document.querySelectorAll('.analytics-tab').forEach(tab => {
         tab.classList.remove('active');
          });
    
         // Activer l'onglet sélectionné
         document.getElementById(tabName + 'Tab').classList.add('active');
          event.target.classList.add('active');
    
            // Initialiser les graphiques de l'onglet si nécessaire
           if (tabName === 'simulation') {
           updateSimulation();
          }
        }

        function initSimulationChart() {
          const ctx = document.getElementById('simulationChart')?.getContext('2d');
         if (!ctx) return;
    
          const months = ['Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
             charts.simulation = new Chart(ctx, {
             type: 'line',
              data: {
             labels: months,
             datasets: [
                 {
                    label: 'Scénario Optimiste',
                    data: [4500000, 4800000, 5200000, 5600000, 6000000, 6400000],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                 },
                 {
                    label: 'Scénario Réaliste',
                    data: [4250000, 4400000, 4600000, 4800000, 5000000, 5200000],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                 },
                 {
                    label: 'Scénario Pessimiste',
                    data: [4000000, 4100000, 4200000, 4300000, 4400000, 4500000],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                 }
                 ]
                  },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${(context.raw / 1000000).toFixed(2)}M XOF`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return (value / 1000000).toFixed(1) + 'M';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Recettes mensuelles (XOF)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Mois'
                    }
                }
            }
           }
         });
        }

        function initComparisonChart() {
          const ctx = document.getElementById('comparisonChart')?.getContext('2d');
         if (!ctx) return;
    
          charts.comparison = new Chart(ctx, {
         type: 'bar',
         data: {
            labels: ['Taux occupation', 'Loyer/m²', 'Délai location', 'Satisfaction', 'ROI'],
            datasets: [
                {
                    label: 'Votre performance',
                    data: [85.7, 1250, 82, 88, 6.8],
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderColor: '#6366f1',
                    borderWidth: 1
                },
                {
                    label: 'Moyenne marché',
                    data: [83.6, 1187, 78, 85, 5.2],
                    backgroundColor: 'rgba(156, 163, 175, 0.8)',
                    borderColor: '#9ca3af',
                    borderWidth: 1
                }
            ]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
          }
         });
        }

        function initTrendsChart() {
          const ctx = document.getElementById('trendsChart')?.getContext('2d');
          if (!ctx) return;
    
          const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    
         charts.trends = new Chart(ctx, {
         type: 'line',
         data: {
            labels: months,
            datasets: [
                {
                    label: 'Recettes 2024',
                    data: [3800000, 3900000, 4000000, 4100000, 4200000, 4300000, 4400000, 4500000, 4600000, 4700000, 4800000, 4900000],
                    borderColor: '#9ca3af',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    tension: 0.4
                },
                {
                    label: 'Recettes 2025',
                    data: [4100000, 4200000, 4300000, 4400000, 4500000, 4600000, 4700000, 4800000, 4900000, 5000000, 5100000, 5200000],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }
            ]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${(context.raw / 1000000).toFixed(2)}M XOF`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return (value / 1000000).toFixed(1) + 'M';
                        }
                    }
                }
            }
         }
         });
        }

        function initZoneChart() {
          const ctx = document.getElementById('zoneChart')?.getContext('2d');
           if (!ctx) return;
    
            charts.zone = new Chart(ctx, {
         type: 'radar',
         data: {
            labels: ['ROI', 'Occupation', 'Stabilité', 'Croissance', 'Demande', 'Prix/m²'],
            datasets: [
                {
                    label: 'Plateau',
                    data: [9.2, 92, 95, 88, 90, 1500],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderWidth: 2
                },
                {
                    label: 'Cocody',
                    data: [8.5, 89, 92, 85, 88, 1350],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.2)',
                    borderWidth: 2
                },
                {
                    label: 'Marcory',
                    data: [7.8, 85, 88, 82, 85, 1200],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    borderWidth: 2
                },
                {
                    label: 'Yopougon',
                    data: [6.5, 82, 85, 78, 80, 950],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    borderWidth: 2
                }
            ]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
         }
         });
        } 
        

        function initTenantChart() {
          const ctx = document.getElementById('tenantChart')?.getContext('2d');
          if (!ctx) return;
    
         charts.tenant = new Chart(ctx, {
         type: 'bar',
         data: {
            labels: clientsData.slice(0, 8).map(c => c.lastName.substring(0, 3) + '.'),
            datasets: [
                {
                    label: 'Fiabilité paiement',
                    data: clientsData.slice(0, 8).map(() => Math.floor(Math.random() * 30) + 70),
                    backgroundColor: 'rgba(99, 102, 241, 0.7)',
                    borderColor: '#6366f1',
                    borderWidth: 1
                },
                {
                    label: 'Durée occupation',
                    data: clientsData.slice(0, 8).map(() => Math.floor(Math.random() * 24) + 6),
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1
                },
                {
                    label: 'Satisfaction',
                    data: clientsData.slice(0, 8).map(() => Math.floor(Math.random() * 30) + 65),
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: '#f59e0b',
                    borderWidth: 1
                }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    ticks: {
                        callback: function(value) {
                            return value + '%';
                        }
                    }
                }
            }
         }
         });
        }

        function initPortfolioChart() {
            const ctx = document.getElementById('portfolioChart')?.getContext('2d');
          if (!ctx) return;
    
            const years = ['2020', '2021', '2022', '2023', '2024', '2025'];
    
          charts.portfolio = new Chart(ctx, {
         type: 'line',
         data: {
            labels: years,
            datasets: [
                {
                    label: 'Nombre de biens',
                    data: [45, 68, 92, 120, 156, 210],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Valeur totale (Mds XOF)',
                    data: [1.2, 2.1, 3.5, 5.2, 7.8, 12.5],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Nombre de biens'
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Valeur (Mds XOF)'
                    },
                    grid: {
                        drawOnChartArea: false
                    }
                }
            }
         }
         });
        }

        function initPredictiveChart() {
         const ctx = document.getElementById('predictiveChart')?.getContext('2d');
           if (!ctx) return;
    
          const months = ['Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
    
         charts.predictive = new Chart(ctx, {
         type: 'line',
         data: {
            labels: months,
            datasets: [
                {
                    label: 'Prévision basse',
                    data: [4600000, 4700000, 4800000, 4900000, 5000000, 5100000, 5200000, 5300000, 5400000, 5500000, 5600000, 5700000],
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Prévision moyenne',
                    data: [4800000, 4950000, 5100000, 5250000, 5400000, 5550000, 5700000, 5850000, 6000000, 6150000, 6300000, 6450000],
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Prévision haute',
                    data: [5000000, 5200000, 5400000, 5600000, 5800000, 6000000, 6200000, 6400000, 6600000, 6800000, 7000000, 7200000],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    fill: true,
                    tension: 0.4
                }
            ]
         },
         options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${(context.raw / 1000000).toFixed(2)}M XOF`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return (value / 1000000).toFixed(1) + 'M';
                        }
                    },
                    title: {
                        display: true,
                        text: 'Recettes mensuelles (XOF)'
                    }
                }
            }
         }
         });
        }

        function updateSimulation() {
           const period = parseInt(document.getElementById('simulationPeriod').value);
           const scenario = document.getElementById('simulationScenario').value;
    
            let months = [];
         let optimisticData = [];
          let realisticData = [];
          let pessimisticData = [];
    
            // Générer les données selon la période
          if (period === 3) {
         months = ['Mois 1', 'Mois 2', 'Mois 3'];
         optimisticData = [4500000, 4950000, 5400000];
         realisticData = [4250000, 4400000, 4550000];
         pessimisticData = [4000000, 4100000, 4200000];
          } else if (period === 6) {
         months = ['Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
         optimisticData = [4500000, 4800000, 5200000, 5600000, 6000000, 6400000];
         realisticData = [4250000, 4400000, 4600000, 4800000, 5000000, 5200000];
         pessimisticData = [4000000, 4100000, 4200000, 4300000, 4400000, 4500000];
          } else if (period === 12) {
         months = ['Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc', 'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'];
         optimisticData = [4500000, 4800000, 5200000, 5600000, 6000000, 6400000, 6800000, 7200000, 7600000, 8000000, 8400000, 8800000];
         realisticData = [4250000, 4400000, 4600000, 4800000, 5000000, 5200000, 5400000, 5600000, 5800000, 6000000, 6200000, 6400000];
         pessimisticData = [4000000, 4100000, 4200000, 4300000, 4400000, 4500000, 4600000, 4700000, 4800000, 4900000, 5000000, 5100000];
         }
    
         // Mettre à jour le graphique si il existe
          if (charts.simulation) {
         charts.simulation.data.labels = months;
         charts.simulation.data.datasets[0].data = optimisticData;
         charts.simulation.data.datasets[1].data = realisticData;
         charts.simulation.data.datasets[2].data = pessimisticData;
         charts.simulation.update();
         }
    
            // Mettre à jour les résultats
          updateSimulationResults(scenario, period);
        }

        function updateSimulationResults(scenario, period) {
           const resultsDiv = document.getElementById('simulationResults');
    
         let totalRevenue = 0;
          let averageMonthly = 0;
          let growthRate = 0;
           let recommendation = '';
    
          if (scenario === 'optimistic') {
         totalRevenue = period === 3 ? 14850000 : period === 6 ? 32500000 : 78000000;
         averageMonthly = period === 3 ? 4950000 : period === 6 ? 5416667 : 6500000;
         growthRate = 15;
         recommendation = 'Investissement recommandé: expansion du portefeuille';
         } else if (scenario === 'realistic') {
         totalRevenue = period === 3 ? 13200000 : period === 6 ? 28250000 : 64800000;
         averageMonthly = period === 3 ? 4400000 : period === 6 ? 4708333 : 5400000;
         growthRate = 8;
          recommendation = 'Maintenir la stratégie actuelle avec optimisations progressives';
          } else {
         totalRevenue = period === 3 ? 12300000 : period === 6 ? 25500000 : 55200000;
         averageMonthly = period === 3 ? 4100000 : period === 6 ? 4250000 : 4600000;
         growthRate = -5;
         recommendation = 'Prudence recommandée: focus sur la rétention et réduction des coûts';
         }
    
          resultsDiv.innerHTML = `
         <div class="simulation-result">
            <div class="simulation-label">Revenus totaux</div>
            <div class="simulation-value xof">${(totalRevenue / 1000000).toFixed(1)}M</div>
            <small>Sur ${period} mois</small>
         </div>
         <div class="simulation-result">
            <div class="simulation-label">Moyenne mensuelle</div>
            <div class="simulation-value xof">${(averageMonthly / 1000000).toFixed(1)}M</div>
            <small>Par mois</small>
         </div>
         <div class="simulation-result">
            <div class="simulation-label">Taux de croissance</div>
            <div class="simulation-value" style="color: ${growthRate > 0 ? 'var(--success)' : 'var(--danger)'}">
                ${growthRate > 0 ? '+' : ''}${growthRate}%
            </div>
            <small>vs période actuelle</small>
         <div class="simulation-result">
            <div class="simulation-label">Recommandation</div>
            <div class="simulation-value" style="font-size: 16px; color: var(--primary);">${scenario === 'optimistic' ? 'âš¡' : scenario === 'realistic' ? 'âš–ï¸' : 'ðŸ›¡ï¸'}</div>
            <small style="font-size: 12px; line-height: 1.2;">${recommendation}</small>
         </div>
         `;
        }

        function runSimulation() {
           const period = parseInt(document.getElementById('simulationPeriod').value);
         const scenario = document.getElementById('simulationScenario').value;
          const variable = document.getElementById('simulationVariable').value;
    
           // Mettre à jour l'interface pour montrer que la simulation est en cours
         const simulationBtn = document.querySelector('#simulationTab .btn-primary');
         const originalText = simulationBtn.innerHTML;
          simulationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Simulation en cours...';
          simulationBtn.disabled = true;
    
           // Simuler un calcul
           setTimeout(() => {
         updateSimulation();
        
         // Restaurer le bouton
         simulationBtn.innerHTML = originalText;
         simulationBtn.disabled = false;
        
         // Afficher les résultats détaillés
         showSimulationDetails(scenario, period, variable);
          }, 1500);
        }

        function showSimulationDetails(scenario, period, variable) {
          let details = `📊 **Détails de la simulation**\n\n`;
          details += `**Scénario:** ${scenario === 'optimistic' ? 'Optimiste' : scenario === 'realistic' ? 'Réaliste' : 'Pessimiste'}\n`;
         details += `**Période:** ${period} mois\n`;
         details += `**Variable analysée:** ${variable === 'revenue' ? 'Recettes' : variable === 'occupancy' ? 'Taux d\'occupation' : variable === 'collection' ? 'Taux de recouvrement' : 'Croissance'}\n\n`;
    
          if (scenario === 'optimistic') {
         details += `**Projections:**\n`;
         details += `• Augmentation moyenne: +15% par mois\n`;
         details += `• ROI attendu: 9.2%\n`;
         details += `• Point d'équilibre: Mois ${Math.floor(period * 0.4)}\n\n`;
         details += `**Recommandations:**\n`;
         details += `âœ“ Augmenter les investissements\n`;
         details += `âœ“ Accélérer l'acquisition de nouveaux biens\n`;
         details += `âœ“ Renforcer l'équipe commerciale\n`;
          } else if (scenario === 'realistic') {
         details += `**Projections:**\n`;
         details += `• Croissance moyenne: +8% par mois\n`;
         details += `• ROI attendu: 6.8%\n`;
         details += `• Point d'équilibre: Mois ${Math.floor(period * 0.6)}\n\n`;
         details += `**Recommandations:**\n`;
         details += `âœ“ Maintenir la stratégie actuelle\n`;
         details += `âœ“ Optimiser les processus existants\n`;
         details += `âœ“ Focus sur la rétention locative\n`;
           } else {
         details += `**Projections:**\n`;
         details += `• Baisse moyenne: -5% par mois\n`;
         details += `• ROI attendu: 4.2%\n`;
         details += `• Point d'équilibre: Mois ${Math.floor(period * 0.8)}\n\n`;
         details += `**Recommandations:**\n`;
         details += `âœ“ Réduire les coûts opérationnels\n`;
         details += `âœ“ Renforcer les recouvrements\n`;
         details += `âœ“ Différer les nouveaux investissements\n`;
         }
    
          alert(details);
        }

        function updateTrendsChart() {
           // Dans une version complète, on mettrait à jour le graphique des tendances
          alert('Mise à jour du graphique des tendances - À implémenter');
        }

        function updateTenantChart() {
          // Régénérer des données aléatoires pour le graphique des locataires
          if (charts.tenant) {
         charts.tenant.data.datasets.forEach(dataset => {
            dataset.data = dataset.data.map(() => Math.floor(Math.random() * 30) + 65);
         });
         charts.tenant.update();
         alert('Graphique des locataires actualisé avec de nouvelles données');
           }
        }

        function viewRevenueForecast() {
          alert('Affichage des prévisions de recettes détaillées - À implémenter');
        }

        function showVacancyRisk() {
           const riskyProperties = propertiesData.filter(p => 
          p.status === 'vacant' || Math.random() > 0.7
          ).slice(0, 3);
    
          let message = 'ðŸš¨ **Propriétés à risque de vacance**\n\n';
         message += 'Ces propriétés nécessitent une attention particulière:\n\n';
    
          riskyProperties.forEach((property, index) => {
         const owner = ownersData.find(o => o.id === property.ownerId);
         message += `   ðŸ“ ${property.address}\n`;
         message += `   👤 Propriétaire: ${owner ? owner.lastName + ' ' + owner.firstName : 'Inconnu'}\n`;
          message += `   💰 Loyer: ${property.rent ? property.rent.toLocaleString() + ' XOF' : 'Non défini'}\n`;
         message += `   â° Dernier locataire: ${Math.floor(Math.random() * 90) + 30} jours\n\n`;
         });
    
         message += '**Actions recommandées:**\n';
          message += '• Contacter les propriétaires\n';
          message += '• Réviser les prix de location\n';
          message += '• Programmer des visites\n';
          message += '• Offrir des incitations\n';
    
            alert(message);
        }

        function showInvestmentOpportunities() {
           alert('Affichage des opportunités d\'investissement - À implémenter');
        }

        function runAIAnalysis() {
         const frequency = document.getElementById('aiAnalysisFrequency').value;
    
          // Simuler l'analyse IA
           const resultsDiv = document.getElementById('aiAnalysisResults');
             resultsDiv.innerHTML = `
         <div style="text-align: center; padding: 20px;">
            <i class="fas fa-robot" style="font-size: 48px; color: var(--primary); margin-bottom: 20px;"></i>
            <div class="ai-typing" style="justify-content: center;">
                <span></span><span></span><span></span>
            </div>
            <p style="color: var(--gray); margin-top: 15px;">Analyse IA en cours...</p>
          </div>
          `;
    
          setTimeout(() => {
          const analysis = generateAIAnalysis(level);
         resultsDiv.innerHTML = analysis;
          }, 3000);
        }

        function generateAIAnalysis(level) {
           const insights = [
         {
            type: 'success',
            icon: 'fa-bolt',
            title: 'Optimisation des prix détectée',
            content: 'L\'IA a identifié 12 biens dont le loyer pourrait être augmenté de 5-8% sans affecter l\'occupation, générant +625,000 XOF/mois.',
            confidence: '92%'
         },
         {
            type: 'warning',
            icon: 'fa-exclamation-triangle',
            title: 'Risque de concentration',
            content: '45% de vos revenus proviennent de seulement 3 propriétaires. L\'IA recommande de diversifier le portefeuille.',
            confidence: '88%'
         },
         {
            type: 'success',
            icon: 'fa-chart-line',
            title: 'Opportunité saisonnière',
            content: 'L\'analyse prédictive indique une augmentation de 12% de la demande dans la zone "Plateau" pour le T3 2025.',
            confidence: '85%'
         },
         {
            type: 'danger',
            icon: 'fa-user-clock',
            title: 'Turnover élevé détecté',
            content: 'Le taux de renouvellement des locataires est de 42%, supérieur à la moyenne du marché (28%). Actions de rétention recommandées.',
            confidence: '79%'
         }
         ];
    
          let html = `
         <div style="margin-bottom: 20px; padding: 15px; background: rgba(99, 102, 241, 0.1); border-radius: 10px; border-left: 4px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong style="color: var(--primary);">Analyse IA complétée</strong>
                    <div style="font-size: 14px; color: var(--gray);">Niveau: ${level} | Confiance moyenne: 86%</div>
                </div>
                <span class="status-badge paid">${new Date().toLocaleTimeString('fr-FR', {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
         </div>
        
         <div style="color: var(--gray); margin-bottom: 20px; font-size: 14px;">
            <i class="fas fa-info-circle"></i> Analyse générée par l'intelligence artificielle basée sur ${level === 'basic' ? '100+' : level === 'standard' ? '500+' : level === 'advanced' ? '1000+' : '5000+'} points de données.
         </div>
           `;
    
           insights.forEach(insight => {
         html += `
            <div class="insight-item ${insight.type}">
                <div class="insight-icon" style="background: ${insight.type === 'success' ? 'var(--success)' : insight.type === 'warning' ? 'var(--warning)' : 'var(--danger)'};">
                    <i class="fas ${insight.icon}"></i>
                </div>
                <div class="insight-content">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                        <h4 style="margin: 0;">${insight.title}</h4>
                        <span class="status-badge paid" style="font-size: 11px; padding: 2px 6px;">Confiance: ${insight.confidence}</span>
                    </div>
                    <p>${insight.content}</p>
                    <div class="insight-actions">
                        <button class="btn btn-outline btn-small" onclick="viewInsightDetails('${insight.title}')">
                            Détails
                        </button>
                        <button class="btn btn-primary btn-small" onclick="applyInsight('${insight.title}')">
                            Appliquer
                        </button>
                    </div>
                </div>
            </div>
         `;
          });
    
         html += `
         <div style="margin-top: 25px; padding: 20px; background: rgba(16, 185, 129, 0.1); border-radius: 10px; border-left: 4px solid var(--success);">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <i class="fas fa-lightbulb" style="color: var(--success);"></i>
                <strong style="color: var(--success);">Impact potentiel</strong>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--gray);">Gain mensuel potentiel</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--success);" class="xof">+2.1M</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--gray);">Réduction des coûts</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--success);" class="xof">-450K</div>
                </div>
                <div style="text-align: center;">
                    <div style="font-size: 12px; color: var(--gray);">Amélioration ROI</div>
                    <div style="font-size: 20px; font-weight: 700; color: var(--success);">+1.8%</div>
                </div>
            </div>
          </div>
          `;
    
          return html;
        }

        function viewInsightDetails(title) {
           alert(`Détails de l'insight: ${title}\n\nCette fonctionnalité afficherait l'analyse complète avec méthodologie et données sources.`);
        }

        function applyInsight(title) {
           alert(`Application de l'insight: ${title}\n\nCette fonctionnalité mettrait automatiquement en œuvre les recommandations de l'IA.`);
        }
         // Fonctions pour la page Clients & Biens
let currentClientView = 'compact'; // 'compact' ou 'grid'

function loadClientsGrid() {
    // Remplir le filtre agents
    const collectorSel = document.getElementById('filterCollector');
    if (collectorSel) {
        const agents = [...new Set(clientsData.map(c => c.agent).filter(Boolean))].sort();
        collectorSel.innerHTML = '<option value="all">Tous agents</option>' +
            agents.map(a => `<option value="${a}">${a}</option>`).join('');
    }
    // Remplir le filtre zones depuis les localisations réelles
    const zoneSel = document.getElementById('filterZone');
    if (zoneSel) {
        const zones = [...new Set(clientsData.map(c => (c.property||'').split(' ')[0]).filter(Boolean))].sort().slice(0,15);
        zoneSel.innerHTML = '<option value="all">Toutes zones</option>' +
            zones.map(z => `<option value="${z}">${z}</option>`).join('');
    }

    // Charger la vue compacte par défaut
    loadCompactClientsView();
    
    // Charger le tableau récapitulatif des paiements
    loadPaymentsSummary();
    
    // Mettre à jour le compteur
    updateClientsCount();
}

function loadCompactClientsView() {
    const container = document.getElementById('clientsListContainer');
    
    const html = clientsData.map(client => {
        const balance = client.amountDue - client.amountPaid;
        const statusClass = getStatusClass(client.status);
        const statusText = getStatusText(client.status);
        
        return `
            <div class="compact-client-row" onclick="viewClientDetail(${client.id})">
                <div class="compact-client-avatar">
                    ${client.firstName.charAt(0)}${client.lastName.charAt(0)}
                </div>
                <div class="compact-client-info">
                    <h4>${client.lastName} ${client.firstName}</h4>
                    <p>${client.property}</p>
                </div>
                <div>
                    <div><strong>${client.phone}</strong></div>
                    <div style="font-size: 12px; color: var(--gray);">${client.email || 'Non renseigné'}</div>
                </div>
                <div class="compact-client-amount xof">${client.amountDue.toLocaleString()}</div>
                <div class="compact-client-amount xof" style="color: ${balance > 0 ? 'var(--warning)' : 'var(--success)'}">
                    ${balance.toLocaleString()}
                </div>
                <div>
                    <span class="compact-client-status ${statusClass}">${statusText}</span>
                </div>
                <div class="compact-client-actions">
                    <button class="btn btn-icon btn-outline btn-small" onclick="viewClientDetail(${client.id}); event.stopPropagation()">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="editClient(${client.id}); event.stopPropagation()">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-icon btn-outline btn-small" onclick="recordPayment(${client.id}); event.stopPropagation()">
                        <i class="fas fa-money-bill-wave"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
    
    // Mettre à jour le compteur
    document.getElementById('clientsCount').textContent = clientsData.length;
}

function loadGridView() {
    const container = document.getElementById('clientsGridView');
    
    const html = clientsData.map(client => {
        const balance = client.amountDue - client.amountPaid;
        const statusClass = getStatusClass(client.status);
        const statusText = getStatusText(client.status);
        
        return `
            <div class="client-manage-card" onclick="viewClientDetail(${client.id})">
                <div class="client-manage-header">
                    <div class="client-manage-name">${client.lastName} ${client.firstName}</div>
                    <div class="client-manage-actions">
                        <span class="status-badge ${statusClass}">${statusText}</span>
                    </div>
                </div>
                
                <div class="client-details">
                    <div class="client-detail">
                        <i class="fas fa-phone"></i>
                        <span>${client.phone}</span>
                    </div>
                    <div class="client-detail">
                        <i class="fas fa-envelope"></i>
                        <span>${client.email || 'Non renseigné'}</span>
                    </div>
                    <div class="client-detail">
                        <i class="fas fa-map-marker-alt"></i>
                        <span>${client.address}</span>
                    </div>
                </div>
                
                <div class="client-manage-property">
                    <div class="property-title">Bien loué</div>
                    <div class="property-details">${client.property}</div>
                    <div class="property-details">Valeur: ${(client.propertyValue / 1000000).toFixed(1)}M XOF</div>
                </div>
                
                <div class="payment-section">
                    <div class="amount-display">
                        <div class="amount-label">Loyer mensuel:</div>
                        <div class="amount-value xof">${client.amountDue.toLocaleString()}</div>
                    </div>
                    <div class="amount-display">
                        <div class="amount-label">Solde actuel:</div>
                        <div class="amount-value xof" style="color: ${balance > 0 ? 'var(--warning)' : 'var(--success)'}">
                            ${balance.toLocaleString()}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-full" onclick="recordPayment(${client.id}); event.stopPropagation()">
                        <i class="fas fa-plus-circle"></i> Enregistrer paiement
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}

function toggleClientView() {
    const compactView = document.getElementById('clientsCompactView');
    const gridView = document.getElementById('clientsGridView');
    
    if (currentClientView === 'compact') {
        // Passer à la vue cartes
        compactView.style.display = 'none';
        gridView.style.display = 'grid';
        currentClientView = 'grid';
        loadGridView();
        
        // Mettre à jour le bouton
        event.target.innerHTML = '<i class="fas fa-list"></i> Vue liste';
    } else {
        // Passer à la vue liste
        compactView.style.display = 'block';
        gridView.style.display = 'none';
        currentClientView = 'compact';
        loadCompactClientsView();
        
        // Mettre à jour le bouton
        event.target.innerHTML = '<i class="fas fa-th-large"></i> Vue cartes';
    }
}

function viewClientDetail(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    
    // Afficher la vue détaillée
    const detailView = document.getElementById('clientDetailView');
    detailView.style.display = 'block';
    
    // Mettre à jour les informations du client
    document.getElementById('detailClientAvatar').textContent = 
        `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`;
    
    document.getElementById('detailClientName').textContent = 
        `${client.lastName} ${client.firstName}`;
    
    // Mettre à jour les contacts
    const contactHtml = `
        <div class="contact-item">
            <i class="fas fa-phone"></i>
            <span>${client.phone}</span>
        </div>
        ${client.email ? `
            <div class="contact-item">
                <i class="fas fa-envelope"></i>
                <span>${client.email}</span>
            </div>
        ` : ''}
        <div class="contact-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>${client.address}</span>
        </div>
    `;
    document.getElementById('detailClientContact').innerHTML = contactHtml;
    
    // Mettre à jour les statistiques
    const balance = client.amountDue - client.amountPaid;
    document.getElementById('detailClientBalance').textContent = balance.toLocaleString();
    
    if (balance > 0) {
        document.getElementById('detailClientBalanceStatus').innerHTML = 
            `<span class="stat-change negative">À régler</span>`;
    } else {
        document.getElementById('detailClientBalanceStatus').innerHTML = 
            `<span class="stat-change positive">À jour</span>`;
    }
    
    // Calculer la durée de location (simulation)
    const startDate = new Date(client.joinDate.split('/').reverse().join('-'));
    const now = new Date();
    const monthsDiff = (now.getFullYear() - startDate.getFullYear()) * 12 + 
                      (now.getMonth() - startDate.getMonth());
    
    document.getElementById('detailClientTenure').textContent = `${monthsDiff} mois`;
    document.getElementById('detailClientStartDate').textContent = client.joinDate;
    
    // Simuler des retards
    const delays = client.status === 'pending' ? 1 : 0;
    document.getElementById('detailClientDelays').textContent = delays;
    document.getElementById('detailClientAvgDelay').textContent = delays > 0 ? '15' : '0';
    
    // Calculer la fiabilité (simulation)
    const reliability = client.status === 'paid' ? 100 : client.status === 'partial' ? 75 : 50;
    document.getElementById('detailClientReliability').textContent = `${reliability}%`;
    
    // Charger les onglets
    loadClientProperties(clientId);
    loadClientPaymentHistory(clientId);
    loadClientDocuments(clientId);
    loadClientNotes(clientId);
    
    // S'assurer que le premier onglet est actif
    switchClientTab('properties');
    
    // Faire défiler jusqu'à la vue détaillée
    detailView.scrollIntoView({ behavior: 'smooth' });
}

function closeClientDetail() {
    document.getElementById('clientDetailView').style.display = 'none';
}

function switchClientTab(tabName) {
    // Masquer tous les onglets
    document.querySelectorAll('.client-tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Désactiver tous les onglets
    document.querySelectorAll('.client-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activer l'onglet sélectionné
    document.getElementById('client' + capitalizeFirstLetter(tabName) + 'Tab').classList.add('active');
    event.target.classList.add('active');
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function loadClientProperties(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    
    const propertiesList = document.getElementById('clientPropertiesList');
    
    // Trouver la propriété correspondante
    const property = propertiesData.find(p => p.tenantId === clientId);
    
    if (property) {
        propertiesList.innerHTML = `
            <div class="client-property-card">
                <div class="client-property-header">
                    <div class="client-property-name">${property.name}</div>
                    <span class="status-badge ${getPropertyStatusClass(property.status)}">
                        ${getPropertyStatusText(property.status)}
                    </span>
                </div>
                <div class="property-details">
                    <div><strong>Adresse:</strong> ${property.address}</div>
                    <div><strong>Type:</strong> ${getPropertyTypeText(property.type)}</div>
                    <div><strong>Surface:</strong> ${property.area || 'N/A'} m²</div>
                    <div><strong>Pièces:</strong> ${property.rooms || 'N/A'}</div>
                    <div><strong>Loyer:</strong> ${property.rent ? property.rent.toLocaleString() + ' XOF/mois' : 'Non défini'}</div>
                    <div><strong>Propriétaire:</strong> ${getOwnerName(property.ownerId)}</div>
                </div>
                <div style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-outline btn-small" onclick="viewPropertyDetails(${property.id})">
                        <i class="fas fa-eye"></i> Voir le bien
                    </button>
                    <button class="btn btn-outline btn-small" onclick="editPropertyContract(${property.id})">
                        <i class="fas fa-file-contract"></i> Contrat
                    </button>
                    <button class="btn btn-outline btn-small" onclick="reportPropertyIssue(${property.id})">
                        <i class="fas fa-tools"></i> Signaler problème
                    </button>
                </div>
            </div>
        `;
    } else {
        propertiesList.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray);">
                <i class="fas fa-home" style="font-size: 48px; margin-bottom: 15px;"></i>
                <h4>Aucun bien attribué</h4>
                <p>Ce client n'a pas encore de bien immobilier attribué.</p>
                <button class="btn btn-primary" onclick="assignPropertyToClient(${clientId})">
                    <i class="fas fa-link"></i> Attribuer un bien
                </button>
            </div>
        `;
    }
}

function loadClientPaymentHistory(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    
    const paymentHistory = document.getElementById('clientPaymentHistory');
    
    // Filtrer les transactions de ce client
    const clientTransactions = transactionsData.filter(t => {
        const clientName = `${client.lastName} ${client.firstName}`;
        return t.client === clientName;
    }).slice(0, 10); // Limiter à 10 transactions
    
    if (clientTransactions.length > 0) {
        const html = clientTransactions.map(transaction => {
            return `
                <div class="payment-history-item">
                    <div>
                        <strong>${transaction.id}</strong>
                        <div style="font-size: 12px; color: var(--gray);">${transaction.description}</div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: var(--gray);">${transaction.date}</div>
                        <div class="amount-value xof">${transaction.amount.toLocaleString()}</div>
                    </div>
                    <div>
                        <span class="payment-status-cell payment-status-${transaction.status}">
                            ${getStatusText(transaction.status)}
                        </span>
                    </div>
                    <div>
                        <button class="btn btn-icon btn-outline btn-small" onclick="viewTransactionDetails('${transaction.id}')">
                            <i class="fas fa-eye"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        paymentHistory.innerHTML = html;
    } else {
        paymentHistory.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray);">
                <i class="fas fa-money-bill-wave" style="font-size: 48px; margin-bottom: 15px;"></i>
                <h4>Aucun historique de paiement</h4>
                <p>Aucune transaction enregistrée pour ce client.</p>
                <button class="btn btn-primary" onclick="recordPayment(${clientId})">
                    <i class="fas fa-plus-circle"></i> Enregistrer un paiement
                </button>
            </div>
        `;
    }
}

function loadClientDocuments(clientId) {
    const documentsList = document.getElementById('clientDocumentsList');
    const client = clientsData.find(c => c.id === clientId);
    const documents = client?.documents || [];

    if (!documents.length) {
        documentsList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray);">Aucun document disponible.</div>';
        return;
    }

    const html = documents.map(doc => {
        const icon = doc.type === 'pdf' ? 'fa-file-pdf' : doc.type === 'image' ? 'fa-file-image' : 'fa-file';
        const color = doc.type === 'pdf' ? 'var(--danger)' : doc.type === 'image' ? 'var(--success)' : 'var(--primary)';
        
        return `
            <div class="document-card" onclick="viewDocument('${doc.name}')">
                <div class="document-icon" style="background: rgba(${doc.type === 'pdf' ? '239, 68, 68' : doc.type === 'image' ? '16, 185, 129' : '99, 102, 241'}, 0.1); color: ${color};">
                    <i class="fas ${icon}"></i>
                </div>
                <div class="document-name">${doc.name}</div>
                <div class="document-details">
                    <div style="font-size: 12px; color: var(--gray);">Ajouté le ${doc.date}</div>
                    <div style="font-size: 11px; color: var(--gray);">${doc.size}</div>
                </div>
            </div>
        `;
    }).join('');
    
    documentsList.innerHTML = html;
}

function loadClientNotes(clientId) {
    const notesList = document.getElementById('clientNotesList');
    const client = clientsData.find(c => c.id === clientId);
    const notes = client?.notes || [];

    if (!notes.length) {
        notesList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--gray);">Aucune note disponible.</div>';
        return;
    }

    const html = notes.map(note => {
        return `
            <div class="note-item">
                <div>${note.text}</div>
                <div class="note-date">${note.date} - ${note.author}</div>
            </div>
        `;
    }).join('');
    
    notesList.innerHTML = html;
}

function searchClients() {
    const searchTerm = document.getElementById('clientSearchInput').value.toLowerCase();
    
    if (!searchTerm) {
        loadCompactClientsView();
        return;
    }
    
    const filteredClients = clientsData.filter(client => 
        client.firstName.toLowerCase().includes(searchTerm) ||
        client.lastName.toLowerCase().includes(searchTerm) ||
        client.phone.includes(searchTerm) ||
        client.address.toLowerCase().includes(searchTerm) ||
        client.property.toLowerCase().includes(searchTerm)
    );
    
    // Mettre à jour l'affichage avec les clients filtrés
    updateClientsDisplay(filteredClients);
}

function filterClients() {
    // Lire tous les filtres disponibles
    const paymentStatusEl  = document.getElementById('filterPaymentStatus');
    const contractStatusEl = document.getElementById('filterContractStatus');
    const zoneEl           = document.getElementById('filterZone');
    const collectorEl      = document.getElementById('filterCollector');
    const searchEl         = document.getElementById('clientSearchInput');

    const paymentStatus  = paymentStatusEl  ? paymentStatusEl.value  : 'all';
    const contractStatus = contractStatusEl ? contractStatusEl.value : 'all';
    const zone           = zoneEl           ? zoneEl.value           : 'all';
    const collector      = collectorEl      ? collectorEl.value      : 'all';
    const searchTerm     = searchEl         ? searchEl.value.trim().toLowerCase() : '';

    let filteredClients = [...clientsData];

    // Filtre statut paiement
    if (paymentStatus !== 'all') {
        filteredClients = filteredClients.filter(c => {
            if (paymentStatus === 'paid')    return c.amountDue > 0 && c.amountPaid >= c.amountDue;
            if (paymentStatus === 'pending') return c.amountPaid === 0 && c.amountDue > 0;
            if (paymentStatus === 'partial') return c.amountPaid > 0 && c.amountPaid < c.amountDue;
            if (paymentStatus === 'overdue') return typeof c.balance === 'number' && c.balance < 0;
            if (paymentStatus === 'very_late') return typeof c.balance === 'number' && c.balance < -(c.amountDue * 2);
            return c.status === paymentStatus;
        });
    }

    // Filtre statut contrat
    if (contractStatus !== 'all') {
        filteredClients = filteredClients.filter(c => {
            if (contractStatus === 'active')        return (c.statusOccupation || '') === 'Occupé';
            if (contractStatus === 'expired')       return (c.statusOccupation || '') === 'Vide';
            if (contractStatus === 'prefinancement')return c.prefinancement && c.prefinancement > 0;
            return true;
        });
    }

    // Filtre zone géographique (sur location ou address)
    if (zone !== 'all') {
        filteredClients = filteredClients.filter(c =>
            (c.location || c.address || '').toLowerCase().includes(zone.toLowerCase()) ||
            (c.property || '').toLowerCase().includes(zone.toLowerCase())
        );
    }

    // Filtre agent récolteur
    if (collector !== 'all') {
        filteredClients = filteredClients.filter(c => c.agent === collector);
    }

    // Filtre texte
    if (searchTerm) {
        filteredClients = filteredClients.filter(c =>
            (c.lastName + ' ' + c.firstName).toLowerCase().includes(searchTerm) ||
            (c.property || '').toLowerCase().includes(searchTerm) ||
            (c.identifier || '').toLowerCase().includes(searchTerm) ||
            (c.agent || '').toLowerCase().includes(searchTerm)
        );
    }

    updateClientsDisplay(filteredClients);
}

function applyAdvancedFilters() {
    filterClients();
}

function resetFilters() {
    document.getElementById('filterStatus').value = 'all';
    document.getElementById('filterOwner').value = 'all';
    document.getElementById('filterZone').value = 'all';
    document.getElementById('clientSearchInput').value = '';
    
    loadCompactClientsView();
}

function updateClientsDisplay(clients) {
    const container = document.getElementById('clientsListContainer');
    
    if (clients.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--gray);">
                <i class="fas fa-user-slash" style="font-size: 48px; margin-bottom: 15px;"></i>
                <h4>Aucun client trouvé</h4>
                <p>Aucun client ne correspond à vos critères de recherche.</p>
                <button class="btn btn-outline" onclick="resetFilters()">
                    <i class="fas fa-undo"></i> Réinitialiser les filtres
                </button>
            </div>
        `;
    } else {
        // Reconstruire la vue avec les clients filtrés
        const html = clients.map(client => {
            const balance = client.amountDue - client.amountPaid;
            const statusClass = getStatusClass(client.status);
            const statusText = getStatusText(client.status);
            
            return `
                <div class="compact-client-row" onclick="viewClientDetail(${client.id})">
                    <div class="compact-client-avatar">
                        ${client.firstName.charAt(0)}${client.lastName.charAt(0)}
                    </div>
                    <div class="compact-client-info">
                        <h4>${client.lastName} ${client.firstName}</h4>
                        <p>${client.property}</p>
                    </div>
                    <div>
                        <div><strong>${client.phone}</strong></div>
                        <div style="font-size: 12px; color: var(--gray);">${client.email || 'Non renseigné'}</div>
                    </div>
                    <div class="compact-client-amount xof">${client.amountDue.toLocaleString()}</div>
                    <div class="compact-client-amount xof" style="color: ${balance > 0 ? 'var(--warning)' : 'var(--success)'}">
                        ${balance.toLocaleString()}
                    </div>
                    <div>
                        <span class="compact-client-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="compact-client-actions">
                        <button class="btn btn-icon btn-outline btn-small" onclick="viewClientDetail(${client.id}); event.stopPropagation()">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-outline btn-small" onclick="editClient(${client.id}); event.stopPropagation()">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon btn-outline btn-small" onclick="recordPayment(${client.id}); event.stopPropagation()">
                            <i class="fas fa-money-bill-wave"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
    }
    
    // Mettre à jour le compteur
    document.getElementById('clientsCount').textContent = clients.length;
}

function updateClientsCount() {
    document.getElementById('clientsCount').textContent = clientsData.length;
}

function loadPaymentsSummary() {
    const tbody = document.getElementById('paymentsSummaryBody');
    
    const html = clientsData.map(client => {
        // Simuler les paiements des 6 derniers mois
        const payments = Array.from({length: 6}, () => {
            if (client.status === 'paid') return {status: 'paid', amount: client.amountDue};
            if (client.status === 'partial') return {status: 'partial', amount: client.amountPaid};
            if (client.status === 'pending') return {status: 'pending', amount: 0};
            return {status: 'paid', amount: client.amountDue};
        });
        
        const totalPaid = payments.reduce((sum, p) => sum + (p.status === 'paid' ? p.amount : 0), 0);
        const totalDue = client.amountDue * 6;
        const balance = totalDue - totalPaid;
        
        return `
            <tr>
                <td style="text-align: left;">
                    <strong>${client.lastName} ${client.firstName}</strong><br>
                    <small style="color: var(--gray);">${client.property}</small>
                </td>
                ${payments.map(payment => `
                    <td>
                        ${payment.status === 'paid' ? 
                            `<span class="payment-status-cell payment-status-paid">${payment.amount.toLocaleString()}</span>` :
                         payment.status === 'partial' ?
                            `<span class="payment-status-cell payment-status-pending">${payment.amount.toLocaleString()}</span>` :
                            `<span class="payment-status-cell payment-status-overdue">-</span>`
                        }
                    </td>
                `).join('')}
                <td class="amount-value xof">${totalPaid.toLocaleString()}</td>
                <td class="amount-value xof" style="color: ${balance > 0 ? 'var(--warning)' : 'var(--success)'}">
                    ${balance.toLocaleString()}
                </td>
                <td>
                    <span class="payment-status-cell payment-status-${client.status}">
                        ${getStatusText(client.status)}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
    
    tbody.innerHTML = html;
}

// Fonctions d'action pour les clients
function editClient(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    
    alert(`Édition du client: ${client.lastName} ${client.firstName}\n\nCette fonctionnalité ouvrirait un formulaire d'édition.`);
}

function recordPayment(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    
    currentClientForPayment = client;
    openPaymentModal(clientId);
}

function assignPropertyToClient(clientId) {
    const client = clientsData.find(c => c.id === clientId);
    if (!client) return;
    
    alert(`Attribution d'un bien au client: ${client.lastName} ${client.firstName}\n\nCette fonctionnalité ouvrirait une liste des biens disponibles.`);
}

function uploadClientDocument() {
    alert('Fonctionnalité d\'ajout de document - À implémenter');
}

function addClientNote() {
    const note = prompt('Ajouter une note sur le client:');
    if (note) {
        alert('Note ajoutée avec succès!');
        // Dans une version complète, on ajouterait la note à la base de données
    }
}

function viewDocument(docName) {
    alert(`Visualisation du document: ${docName}\n\nCette fonctionnalité ouvrirait le document dans une nouvelle fenêtre.`);
 }

 function editPropertyContract(propertyId) {
    alert(`Édition du contrat pour la propriété ID: ${propertyId}\n\nCette fonctionnalité ouvrirait l'éditeur de contrat.`);
 }

 function reportPropertyIssue(propertyId) {
    alert(`Signalement d'un problème pour la propriété ID: ${propertyId}\n\nCette fonctionnalité ouvrirait un formulaire de signalement.`);
 }

 function recordPaymentForClient() {
    alert('Enregistrement d\'un paiement - À implémenter');
 }

 function sendReminderToClient() {
    alert('Envoi d\'un rappel - À implémenter');
 }

 function generateClientContract() {
    alert('Génération d\'un contrat - À implémenter');
 }

 function scheduleVisitWithClient() {
    alert('Planification d\'une visite - À implémenter');
 }

 function contactClient() {
    alert('Contact du client - À implémenter');
}

 function editClientInfo() {
    alert('Modification des informations client - À implémenter');
 }

 function sendBulkReminders() {
    const pendingClients = clientsData.filter(c => c.status === 'pending');
    
    if (pendingClients.length === 0) {
        alert('Aucun client en retard de paiement. Aucun rappel à envoyer.');
        return;
    }
    
    if (confirm(`Envoyer des rappels à ${pendingClients.length} client(s) en retard?`)) {
        alert(`${pendingClients.length} rappel(s) envoyé(s) avec succès!`);
    }
 }

 function exportClientsList() {
    alert('Exportation de la liste des clients au format Excel - À implémenter');
 }

 function generatePaymentReport() {
    alert('Génération d\'un rapport de paiement détaillé - À implémenter');
 }

 function showAllClients() {
    resetFilters();
    loadCompactClientsView();
    alert('Liste des clients actualisée!');
 }

// Fonction utilitaire pour les classes de statut
function getStatusClass(status) {
    switch(status) {
        case 'paid': return 'paid';
        case 'pending': return 'pending';
        case 'partial': return 'partial';
        case 'overdue': return 'overdue';
        default: return 'pending';
    }
 }
 // Ajouter ces fonctions dans la section <script> après les autres fonctions

 function openExpenseModal() {
    loadExpenseModalData();
    openModal('expenseModal');
 }

 function loadExpenseModalData() {
    // Remplir la liste des biens
    const propertySelect = document.getElementById('expensePropertySelect');
    propertySelect.innerHTML = '<option value="">-- Choisir un bien --</option>';
    
    // Remplir avec les biens de la base de données
    propertiesData.forEach(property => {
        const option = document.createElement('option');
        option.value = property.id;
        option.textContent = `${property.name} - ${property.address}`;
        propertySelect.appendChild(option);
    });
    
    // Remplir la liste des propriétaires
    const ownerSelect = document.getElementById('expenseOwnerSelect');
    ownerSelect.innerHTML = '<option value="">-- Choisir un propriétaire --</option>';
    
    ownersData.forEach(owner => {
        const option = document.createElement('option');
        option.value = owner.id;
        option.textContent = `${owner.lastName} ${owner.firstName}`;
        ownerSelect.appendChild(option);
    });
    
    // Définir la date d'aujourd'hui par défaut
    document.getElementById('expenseDate').valueAsDate = new Date();
 }

 function updatePropertyOwnerInfo() {
    const propertyId = document.getElementById('expensePropertySelect').value;
    const property = propertiesData.find(p => p.id == propertyId);
    
    if (property) {
        const owner = ownersData.find(o => o.id == property.ownerId);
        if (owner) {
            document.getElementById('expenseOwnerName').textContent = 
                `${owner.lastName} ${owner.firstName}`;
            document.getElementById('expensePropertyAddress').textContent = property.address;
            document.getElementById('propertyOwnerInfo').style.display = 'block';
        }
    } else {
        document.getElementById('propertyOwnerInfo').style.display = 'none';
    }
 }

 function switchExpenseTab(tabName) {
    // Gérer les onglets
    document.querySelectorAll('#expenseModal .tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('#expenseModal .tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    document.querySelector(`#expenseModal .tab[onclick*="${tabName}"]`).classList.add('active');
    document.getElementById(`${tabName}ExpenseTab`).classList.add('active');
 }

 function updateExpenseFilesList() {
    const files = document.getElementById('expenseProofs').files;
    const fileList = document.getElementById('expenseFilesList');
    fileList.innerHTML = '';
    
    if (files.length > 0) {
        for (let i = 0; i < files.length; i++) {
            const fileItem = document.createElement('div');
            fileItem.style.cssText = 'display: flex; justify-content: space-between; align-items: center; padding: 5px 0;';
            fileItem.innerHTML = `
                <span>${files[i].name}</span>
                <button class="btn btn-outline btn-small" onclick="removeExpenseFile(${i})">
                    <i class="fas fa-times"></i>
                </button>
            `;
            fileList.appendChild(fileItem);
        }
    }
 }

 function removeExpenseFile(index) {
    const input = document.getElementById('expenseProofs');
    const files = Array.from(input.files);
    files.splice(index, 1);
    
    // Créer un nouveau DataTransfer pour mettre à jour les fichiers
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    input.files = dataTransfer.files;
    
    updateExpenseFilesList();
 }

 function updateExpenseShares() {
    const ownerShare = parseInt(document.getElementById('ownerShare').value) || 0;
    const tenantShare = parseInt(document.getElementById('tenantShare').value) || 0;
    const totalAmount = parseFloat(document.getElementById('expenseAmount').value) || 0;
    
    // Ajuster pour que la somme fasse 100%
    if (ownerShare + tenantShare !== 100) {
        document.getElementById('tenantShare').value = 100 - ownerShare;
    }
    
    const ownerAmount = (totalAmount * ownerShare / 100).toFixed(0);
    const tenantAmount = (totalAmount * (100 - ownerShare) / 100).toFixed(0);
    
    document.getElementById('ownerAmount').textContent = formatNumber(ownerAmount);
    document.getElementById('tenantAmount').textContent = formatNumber(tenantAmount);
 } 

 function saveExpense() {
    const propertyId = document.getElementById('expensePropertySelect').value;
    const ownerId = document.getElementById('expenseOwnerSelect').value;
    const expenseType = document.getElementById('expenseType').value;
    const description = document.getElementById('expenseDescription').value;
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const expenseDate = document.getElementById('expenseDate').value;
    const ownerShare = parseInt(document.getElementById('ownerShare').value);
    const tenantShare = 100 - ownerShare;
    const recoverFromRent = document.getElementById('recoverFromRent').checked;
    
    // Validation
    if (!propertyId && !ownerId) {
        showAlert('Veuillez sélectionner un bien ou un propriétaire', 'error');
        return;
    }
    
    if (!expenseType || !description || !amount || !expenseDate) {
        showAlert('Veuillez remplir tous les champs obligatoires', 'error');
        return;
    }
    
    // Créer l'objet dépense
    const expense = {
        id: Date.now(),
        propertyId: propertyId || null,
        ownerId: ownerId || getOwnerIdFromProperty(propertyId),
        type: expenseType,
        description: description,
        amount: amount,
        date: expenseDate,
        ownerShare: ownerShare,
        tenantShare: tenantShare,
        ownerAmount: (amount * ownerShare / 100),
        tenantAmount: (amount * tenantShare / 100),
        recoverFromRent: recoverFromRent,
        status: 'pending',
        createdAt: new Date().toISOString(),
        recordedBy: currentUser ? (currentUser.email || currentUser.displayName || 'collector') : 'collector'
    };
    
    // Sauvegarder dans localStorage (ou envoyer au serveur)
    saveExpenseToStorage(expense);
    
    // Gérer les fichiers
    const files = document.getElementById('expenseProofs').files;
    if (files.length > 0) {
        saveExpenseFiles(expense.id, files);
    }
    
    // Si récupération sur loyer, créer une transaction
    if (recoverFromRent && tenantShare > 0) {
        createRentRecoveryTransaction(expense);
    }
    
    showAlert('Dépense enregistrée avec succès', 'success');
    closeModal('expenseModal');
    
    // Recharger les données si nécessaire
    if (currentUser && currentUser.userType === 'collector') {
        loadCollectorClientCards();
    }
       }

       function saveExpenseToStorage(expense) {
     // Persister dans IndexedDB (cohérent avec le reste de l'app)
     if (window.SYGIM_DB && typeof window.SYGIM_DB._putExpense === 'function') {
         window.SYGIM_DB._putExpense(expense);
     } else {
         // Fallback localStorage uniquement si IndexedDB indisponible
         let expenses = JSON.parse(localStorage.getItem('property_expenses')) || [];
         expenses.push(expense);
         localStorage.setItem('property_expenses', JSON.stringify(expenses));
     }
     }

      function getOwnerIdFromProperty(propertyId) {
     const property = propertiesData.find(p => p.id == propertyId);
     return property ? property.ownerId : null;
       }

       function createRentRecoveryTransaction(expense) {
     // Créer une transaction de récupération sur le prochain loyer
       const transaction = {
        id: Date.now(),
        expenseId: expense.id,
        propertyId: expense.propertyId,
        ownerId: expense.ownerId,
        type: 'rent_recovery',
        amount: expense.tenantAmount,
        description: `Récupération travaux: ${expense.description}`,
        date: new Date().toISOString().split('T')[0],
        status: 'pending'
     };

     // Sauvegarder dans transactionsData (synchronisé avec IndexedDB)
     transactionsData.push(transaction);
     // La sauvegarde IndexedDB sera déclenchée par la prochaine auto-save ou manuellement
     if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
       }
 
     // Fonctions pour commission fixe
       function toggleCommissionFields() {
     const type = document.getElementById('commissionType').value;
     document.getElementById('percentageField').style.display = type === 'percentage' ? 'block' : 'none';
     document.getElementById('fixedField').style.display = type === 'fixed' ? 'block' : 'none';
      }

      // Fonction préfinancement
     function calculatePrefinancement() {
     const amount = parseFloat(document.getElementById('prefinancementAmount').value) || 0;
     const months = parseInt(document.getElementById('prefinancementMonths').value) || 12;
     const interestRate = parseFloat(document.getElementById('prefinancementInterest').value) || 0;
    
     const monthly = amount / months;
     const totalInterest = amount * (interestRate / 100) * (months / 12);
     const totalToAdvance = amount + totalInterest;
    
     document.getElementById('calculatedMonthly').textContent = monthly.toLocaleString();
     document.getElementById('calculatedInterest').textContent = totalInterest.toLocaleString();
     document.getElementById('totalToAdvance').textContent = totalToAdvance.toLocaleString();
      }

       // Fonction pour détecter retards
      function checkLatePayments() {
        // Utiliser clientsData (source de vérité en mémoire, synchronisée avec IndexedDB)
        const lateClients = clientsData.filter(client => {
            const lateMonths = calculateLateMonths(client);
            return lateMonths >= 2;
        });
        return lateClients;
      }

      function calculateLateMonths(client) {
        if (!client.contractStart) return 0;
        const start = new Date(client.contractStart);
        const now   = new Date();
        // Nombre de mois écoulés depuis le début du contrat
        const monthsElapsed = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
        // Loyers attendus vs loyers encaissés (arrondi)
        const expectedPayments = Math.max(0, monthsElapsed);
        const paidPayments     = client.amountDue > 0 ? Math.floor(client.amountPaid / client.amountDue) : 0;
        return Math.max(0, expectedPayments - paidPayments);
      }

        // Fonctions pour le préfinancement
        function loadOwnerPrefinanceInfo() {
            const ownerId = document.getElementById('prefinancementOwner').value;
            if (!ownerId) return;
            
            const owner = ownersData.find(o => o.id == ownerId);
            if (owner) {
                document.getElementById('prefinancementDate').valueAsDate = new Date();
            }
        }

        function savePrefinancement() {
            const ownerId = document.getElementById('prefinancementOwner').value;
            const amount = parseFloat(document.getElementById('prefinancementAmount').value);
            const months = parseInt(document.getElementById('prefinancementMonths').value);
            const interest = parseFloat(document.getElementById('prefinancementInterest').value);
            const date = document.getElementById('prefinancementDate').value;
            const reason = document.getElementById('prefinancementReason').value;

            if (!ownerId || !amount || !date) {
                showAlert('Veuillez remplir tous les champs obligatoires', 'error');
                return;
            }

            const prefinance = {
                id: Date.now(),
                ownerId: ownerId,
                amount: amount,
                months: months,
                interestRate: interest,
                date: date,
                reason: reason,
                status: 'active',
                monthlyPayment: (amount / months),
                createdAt: new Date().toISOString()
            };

            // Sauvegarder le préfinancement dans transactionsData pour cohérence
            const prefinanceTransaction = {
                ...prefinance,
                type: 'prefinancement',
                description: reason || 'Préfinancement propriétaire'
            };
            transactionsData.push(prefinanceTransaction);
            if (window.SYGIM_DB) window.SYGIM_DB.saveAll();

            showAlert('Préfinancement enregistré avec succès', 'success');
            closeModal('prefinancementModal');
        }

        // Initier les données des sélecteurs de propriétaires
        function initPrefinancementOwnerSelect() {
            const select = document.getElementById('prefinancementOwner');
            if (!select) return;
            
            select.innerHTML = '<option value="">-- Choisir un propriétaire --</option>';
            ownersData.forEach(owner => {
                const option = document.createElement('option');
                option.value = owner.id;
                option.textContent = `${owner.lastName} ${owner.firstName}`;
                select.appendChild(option);
            });
        }

        // Fonction pour charger la page Versements Propriétaires
        function loadOwnerPaymentsPage() {
            // Initialiser les sélecteurs de commission
            const commissionSelect = document.getElementById('commissionOwnerSelect');
            if (commissionSelect) {
                commissionSelect.innerHTML = '<option value="">-- Choisir un propriétaire --</option>';
                ownersData.forEach(owner => {
                    const option = document.createElement('option');
                    option.value = owner.id;
                    option.textContent = `${owner.lastName} ${owner.firstName}`;
                    commissionSelect.appendChild(option);
                });
            }
            
            // Mettre à jour les statistiques de versement
            updateOwnerPaymentStats();
            
            // Charger le tableau des versements
            loadOwnerPaymentsTable();
        }

        function updateOwnerPaymentStats() {
            let totalToPay = 0;
            let totalCommission = 0;

            ownersData.forEach(owner => {
                const ownerClients = clientsData.filter(c => c.ownerId === owner.id);
                const collected    = ownerClients.reduce((s, c) => s + (c.amountPaid || 0), 0);
                const commission   = Math.round(collected * ((owner.commissionRate || 0) / 100));
                totalCommission += commission;
                totalToPay      += (collected - commission);
            });

            if (document.getElementById('totalToPay')) {
                document.getElementById('totalToPay').textContent      = totalToPay.toLocaleString() + ' XOF';
                document.getElementById('ownersCount').textContent      = ownersData.length;
                document.getElementById('totalCommission').textContent  = totalCommission.toLocaleString() + ' XOF';
                document.getElementById('totalDeductions').textContent  = '0 XOF';
                document.getElementById('totalPaid').textContent        = '0 XOF';
            }
        }

        function loadOwnerPaymentsTable(filterStatus = 'all') {
            const tbody = document.getElementById('ownerPaymentsBody');
            if (!tbody) return;

            const today = new Date();
            const rows = ownersData.map(owner => {
                const ownerClients  = clientsData.filter(c => c.ownerId === owner.id);
                const rentCollected = ownerClients.reduce((s, c) => s + c.amountPaid, 0);
                const commission    = Math.round(rentCollected * (owner.commissionRate / 100));
                const net           = rentCollected - commission;
                const status        = owner._paymentStatus || 'pending';
                if (filterStatus !== 'all' && status !== filterStatus) return '';

                // Calculer l'échéance du versement ce mois
                let echeance = '—';
                let echeanceAlert = false;
                if (owner.paymentDay) {
                    if (owner.paymentDay === 'dernier') {
                        const lastDay = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
                        echeance = `${lastDay}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
                        echeanceAlert = today.getDate() >= lastDay - 2;
                    } else {
                        const day = parseInt(owner.paymentDay);
                        echeance = `${String(day).padStart(2,'0')}/${String(today.getMonth()+1).padStart(2,'0')}/${today.getFullYear()}`;
                        echeanceAlert = today.getDate() >= day - 2;
                    }
                }

                const statusMap = { pending:'pending', paid:'paid', partial:'partial' };
                const statusLbl = { pending:'En attente', paid:'Versé', partial:'Partiel' };

                return `<tr id="ownerPayRow_${owner.id}">
                    <td><input type="checkbox" class="owner-pay-check" value="${owner.id}"></td>
                    <td>
                        <strong>${owner.lastName} ${owner.firstName}</strong>
                        <br><small style="color:var(--gray);">${owner.email || ''}</small>
                    </td>
                    <td class="xof">${rentCollected.toLocaleString()}</td>
                    <td class="xof">${commission.toLocaleString()}
                        <small style="color:var(--gray);"> (${owner.commissionRate}%)</small>
                    </td>
                    <td class="xof">0</td>
                    <td class="xof" style="font-weight:700;color:var(--success);">${net.toLocaleString()}</td>
                    <td>
                        ${owner.paymentDay
                            ? `<span style="font-weight:600;color:var(--primary);">${owner.paymentDay === 'dernier' ? 'Dernier jour' : owner.paymentDay + (owner.paymentDay == 1 ? 'er' : 'ème')}</span>`
                            : `<span style="color:var(--warning);font-size:11px;" onclick="editOwner(${owner.id})" style="cursor:pointer;">
                                <i class="fas fa-exclamation-triangle"></i> Non défini
                               </span>`}
                        <br>
                        <small style="color:${echeanceAlert ? 'var(--danger)' : 'var(--gray)'};">
                            ${echeance !== '—' ? `Échéance : ${echeance}` : ''}
                        </small>
                    </td>
                    <td style="font-size:12px;">
                        ${owner.bankAccount
                            ? `<span title="${owner.bankAccount}">${owner.bankAccount.substring(0,18)}…</span>`
                            : `<span style="color:var(--warning);">Non renseigné</span>`}
                    </td>
                    <td><span class="status-badge ${statusMap[status]}">${statusLbl[status]}</span></td>
                    <td>
                        <button class="btn btn-icon btn-success btn-small" title="Marquer versé"
                                onclick="markOwnerPaid(${owner.id})">
                            <i class="fas fa-check"></i>
                        </button>
                        <button class="btn btn-icon btn-outline btn-small" title="Voir détail"
                                onclick="viewOwnerPaymentDetail(${owner.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-outline btn-small" title="Modifier"
                                onclick="editOwner(${owner.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-icon btn-outline btn-small" title="Générer reçu"
                                onclick="generateOwnerReceipt(${owner.id})">
                            <i class="fas fa-file-invoice"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');

            tbody.innerHTML = rows || '<tr><td colspan="10" style="text-align:center;color:var(--gray);">Aucun propriétaire</td></tr>';
        }

        // â”€â”€â”€ Bilan Agent : dropdown searchable â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function initAgentDropdown() {
            const listEl = document.getElementById('agentDropdownList');
            if (!listEl) return;
            renderAgentDropdownItems('');
        }

        function renderAgentDropdownItems(term) {
            const listEl = document.getElementById('agentDropdownList');
            if (!listEl) return;
            const t = (term || '').toLowerCase();
            const agents = collectorsData;
            const filtered = t ? agents.filter(a =>
                (a.lastName + ' ' + a.firstName).toLowerCase().includes(t) ||
                (a.firstName + ' ' + a.lastName).toLowerCase().includes(t)
            ) : agents;

            if (filtered.length === 0) {
                listEl.innerHTML = `<div style="padding:14px 16px;color:var(--gray);font-size:13px;text-align:center;">Aucun agent trouvé</div>`;
                return;
            }
            listEl.innerHTML = filtered.map(a => {
                const fullName = a.lastName + ' ' + a.firstName;
                const highlighted = t
                    ? fullName.replace(new RegExp(`(${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
                        '<mark style="background:rgba(99,102,241,.18);border-radius:3px;padding:0 2px;">$1</mark>')
                    : fullName;
                return `<div onclick="selectAgent('${a.id}','${fullName}')"
                             style="padding:10px 16px;cursor:pointer;font-size:14px;transition:background .15s;display:flex;align-items:center;gap:10px;"
                             onmouseover="this.style.background='rgba(99,102,241,.08)'"
                             onmouseout="this.style.background='none'">
                            <i class="fas fa-user-circle" style="color:var(--primary);opacity:.7;"></i>
                            ${highlighted}
                        </div>`;
            }).join('');
        }

        function showAgentDropdown() {
            const listEl = document.getElementById('agentDropdownList');
            if (listEl) {
                listEl.style.display = 'block';
                renderAgentDropdownItems(document.getElementById('agentSearchInput')?.value || '');
            }
        }

        function hideAgentDropdown() {
            const listEl = document.getElementById('agentDropdownList');
            if (listEl) listEl.style.display = 'none';
        }

        function filterAgentDropdown() {
            const input = document.getElementById('agentSearchInput');
            const clearBtn = document.getElementById('agentSearchClearBtn');
            if (clearBtn) clearBtn.style.display = input?.value ? 'block' : 'none';
            showAgentDropdown();
            renderAgentDropdownItems(input?.value || '');
        }

        function selectAgent(id, name) {
            const hiddenSel = document.getElementById('agentSelector');
            const input = document.getElementById('agentSearchInput');
            const clearBtn = document.getElementById('agentSearchClearBtn');
            if (hiddenSel) hiddenSel.value = id;
            if (input) input.value = name;
            if (clearBtn) clearBtn.style.display = 'block';
            hideAgentDropdown();
            // Déclencher le chargement
            onAgentSelected(id, name);
        }

        function clearAgentSearch() {
            const hiddenSel = document.getElementById('agentSelector');
            const input = document.getElementById('agentSearchInput');
            const clearBtn = document.getElementById('agentSearchClearBtn');
            if (hiddenSel) hiddenSel.value = '';
            if (input) { input.value = ''; input.focus(); }
            if (clearBtn) clearBtn.style.display = 'none';
            showAgentDropdown();
        }

        // Fonction pour charger la page Bilan Agent
        function loadAgentReport() {
            initAgentDropdown();
            updateAgentStats();
            loadAgentDetailTable();
        }

        function onAgentSelected(agentId, agentName) {
            // Mettre à jour le nom affiché dans le tableau
            const nameEl = document.getElementById('selectedAgentName');
            if (nameEl) nameEl.textContent = agentName || 'Agent sélectionné';
            updateAgentStats(agentId);
            loadAgentDetailTable(agentId);
        }


        function updateAgentStats(agentId) {
            const agentEl = document.getElementById('agentAssignedTenants');
            if (!agentEl) return;

            // Si un agent est sélectionné, filtrer ses données réelles
            let agentClients = clientsData;
            if (agentId) {
                const agent = collectorsData.find(c => String(c.id) === String(agentId));
                if (agent) {
                    agentClients = clientsData.filter(c => c.agent === agent.lastName);
                }
            }

            const totalDue       = agentClients.reduce((s, c) => s + (c.amountDue  || 0), 0);
            const totalCollected = agentClients.reduce((s, c) => s + (c.amountPaid || 0), 0);
            const lateClients    = agentClients.filter(c => c.status === 'overdue' || c.status === 'pending').length;
            const rate           = totalDue > 0 ? Math.round(totalCollected / totalDue * 100) : 0;

            agentEl.textContent = agentClients.length;
            document.getElementById('agentLateTenants').textContent    = lateClients;
            document.getElementById('agentCollectionRate').textContent  = rate + '%';
            document.getElementById('agentCollectedAmount').textContent = totalCollected.toLocaleString();
            document.getElementById('agentTotalDue').textContent        = totalDue.toLocaleString();
            document.getElementById('agentCriticalLate').textContent    = agentClients.filter(c => c.status === 'overdue').length;
        }

        function loadAgentDetailTable(agentId) {
            const tbody = document.getElementById('agentDetailTable')?.querySelector('tbody');
            if (!tbody) return;

            let agentClients = clientsData;
            if (agentId) {
                const agent = collectorsData.find(c => String(c.id) === String(agentId));
                if (agent) agentClients = clientsData.filter(c => c.agent === agent.lastName);
            }

            if (!agentClients.length) {
                tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--gray);">Aucun locataire trouvé pour cet agent</td></tr>';
                return;
            }

            const html = agentClients.map(client => {
                const due       = client.amountDue  || 0;
                const paid      = client.amountPaid || 0;
                const remainder = due - paid;
                const statusLabel = { paid: 'Payé', pending: 'En attente', overdue: 'En retard', partial: 'Partiel' }[client.status] || client.status;
                const statusClass = { paid: 'paid', pending: 'pending', overdue: 'overdue', partial: 'partial' }[client.status] || 'pending';
                return `<tr>
                    <td>${client.lastName} ${client.firstName}</td>
                    <td>${client.address || 'Non renseignée'}</td>
                    <td class="xof">${due.toLocaleString()}</td>
                    <td class="xof">${due.toLocaleString()}</td>
                    <td class="xof">${paid.toLocaleString()}</td>
                    <td class="xof" style="color:${remainder > 0 ? 'var(--danger)' : 'var(--success)'};">${remainder.toLocaleString()}</td>
                    <td><span class="status-badge ${statusClass}">${statusLabel}</span></td>
                    <td>
                        <button class="btn btn-icon btn-outline btn-small" title="Détails" onclick="openPaymentModal(${client.id})">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');

            tbody.innerHTML = html;
        }


        // ============================================================
        // AUTHENTIFICATION — utilitaires
        // ============================================================

        function toggleLoginPassword() {
            const input  = document.getElementById('loginPassword');
            const icon   = document.querySelector('#loginPasswordToggle i');
            const isHidden = input.type === 'password';
            input.type   = isHidden ? 'text' : 'password';
            icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
        }

        // ============================================================
        // PANEL ADMIN — Navigation
        // ============================================================

        function adminShowTab(tab) {
            const panels = ['access','dashboard','data','health','logs','security','settings','reports','versements','notifications','planner'];
            panels.forEach(p => {
                const el = document.getElementById('panel' + p.charAt(0).toUpperCase() + p.slice(1));
                if (el) el.style.display = p === tab ? 'block' : 'none';
            });
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            const map = {
                access:'tabAccess', dashboard:'tabDashboard', data:'tabData',
                health:'tabHealth', logs:'tabLogs', security:'tabSecurity', settings:'tabSettings',
                reports:'tabReports', versements:'tabVersements', notifications:'tabNotifications', planner:'tabPlanner'
            };
            if (map[tab]) document.getElementById(map[tab])?.classList.add('active');

            if (tab === 'logs')          { adminRenderLogs(); }
            if (tab === 'health')        { adminRenderHealthDataGrid(); }
            if (tab === 'data')          { adminRefreshDataTab(); }
            if (tab === 'dashboard')     { adminRefreshDashboard(); }
            if (tab === 'security')      { adminRefreshSecurity(); }
            if (tab === 'settings')      { adminLoadSettings(); }
            if (tab === 'reports')       { adminLoadReports(); }
            if (tab === 'versements')    { adminLoadVersements(); }
            if (tab === 'notifications') { adminLoadNotifications(); }
            if (tab === 'planner')       { adminLoadPlanner(); }
        }

        // ============================================================
        // PANEL ADMIN — Gestion des accès
        // ============================================================

        const ROLE_LABELS = {
            admin:             { label: 'Administrateur',      color: 'role-admin' },
            director:          { label: 'Directeur',           color: 'role-director' },
            accounting:        { label: 'Comptable',           color: 'role-accounting' },
            collector_manager: { label: 'Manager',             color: 'role-collector_manager' },
            collector:         { label: 'Récolteur',           color: 'role-collector' }
        };

        const ROLE_ICONS = {
            admin: 'fas fa-shield-alt',
            director: 'fas fa-crown',
            accounting: 'fas fa-calculator',
            collector_manager: 'fas fa-users-cog',
            collector: 'fas fa-hand-holding-usd'
        };

        const AVATAR_COLORS = [
            '#6366f1','#10b981','#f59e0b','#ef4444','#3b82f6',
            '#8b5cf6','#06b6d4','#84cc16','#f97316','#ec4899'
        ];

        function adminGetAvatarColor(email) {
            let h = 0;
            for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) & 0xffffffff;
            return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
        }

        // â”€â”€ Export liste utilisateurs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminExportUsers() {
            const rows = [['Identifiant','Nom complet','Rôle','Statut','Créé le']];
            Object.entries(USER_ACCOUNTS).forEach(([key, acc]) => {
                rows.push([key, acc.displayName||'', acc.role||'', acc.active===false?'Inactif':'Actif', acc.createdAt||'']);
            });
            const csv = rows.map(r => r.map(v=>`"${v}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url; a.download = 'SYGIM_utilisateurs.csv'; a.click();
            URL.revokeObjectURL(url);
            adminLog('export', 'ðŸ“¤ Export liste utilisateurs');
        }

        function adminRenderStats() {
            const accounts = Object.values(USER_ACCOUNTS);
            const counts = { total: accounts.length, active: 0, admin: 0, director: 0, accounting: 0, collector_manager: 0, collector: 0 };
            accounts.forEach(a => {
                if (a.active) counts.active++;
                if (counts[a.role] !== undefined) counts[a.role]++;
            });
            const stats = [
                { num: counts.total,    lbl: 'Total' },
                { num: counts.active,   lbl: 'Actifs' },
                { num: counts.director + counts.accounting, lbl: 'Direction/Compta' },
                { num: counts.collector_manager, lbl: 'Managers' },
                { num: counts.collector, lbl: 'Récolteurs' }
            ];
            document.getElementById('adminStatsRow').innerHTML = stats.map(s => `
                <div class="admin-stat-pill">
                    <div class="stat-num">${s.num}</div>
                    <div class="stat-lbl">${s.lbl}</div>
                </div>`).join('');
        }

        // â”€â”€ Charger les utilisateurs depuis le backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        async function adminLoadUsers() {
            try {
                const response = await API.Users.getAll();
                const usersFromAPI = response?.data || [];
                
                // Réinitialiser USER_ACCOUNTS
                USER_ACCOUNTS = {};
                
                // Remplir depuis l'API
                for (const user of usersFromAPI) {
                    USER_ACCOUNTS[user.username] = {
                        role: user.role,
                        firstName: user.first_name || '',
                        lastName: user.last_name || '',
                        displayName: user.display_name || user.username,
                        avatar: user.avatar || '?',
                        active: user.active === 1 || user.active === true,
                        collectorName: user.collector_name || '',
                        apiId: user.id,
                        lastLogin: user.last_login || null,
                        createdAt: user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : null
                    };
                }
                
                console.log(`✓ ${usersFromAPI.length} utilisateur(s) chargé(s) de la BD`);
                adminRenderUsers();
            } catch (err) {
                console.error('âŒ Erreur chargement utilisateurs:', err);
                // Les données locales restent disponibles même en cas d'erreur
                adminRenderUsers();
            }
        }

        function adminRenderUsers(filter = '') {
            const roleFilter   = document.getElementById('adminRoleFilter')?.value   || '';
            const statusFilter = document.getElementById('adminStatusFilter')?.value || '';
            const search       = (document.getElementById('adminUserSearch')?.value || '').toLowerCase();

            const entries = Object.entries(USER_ACCOUNTS).filter(([username, acc]) => {
                const matchSearch = !search || username.includes(search) ||
                    (acc.displayName || '').toLowerCase().includes(search) ||
                    (acc.firstName || '').toLowerCase().includes(search) ||
                    (acc.lastName  || '').toLowerCase().includes(search);
                const matchRole   = !roleFilter   || acc.role === roleFilter;
                const matchStatus = !statusFilter || (statusFilter === 'active' ? acc.active : !acc.active);
                return matchSearch && matchRole && matchStatus;
            });

            const tbody = document.getElementById('adminUserTableBody');
            if (!entries.length) {
                tbody.innerHTML = `<tr><td colspan="6"><div class="admin-empty-state"><i class="fas fa-users"></i><p>Aucun utilisateur trouvé</p></div></td></tr>`;
                return;
            }

            tbody.innerHTML = entries.map(([username, acc]) => {
                const roleInfo = ROLE_LABELS[acc.role] || { label: acc.role, color: '' };
                const initials = ((acc.firstName||'')[0]||'') + ((acc.lastName||'')[0]||acc.displayName?.[0]||'?');
                const bgColor  = adminGetAvatarColor(username);
                const isAdmin  = acc.role === 'admin';
                return `
                <tr>
                    <td>
                        <div class="user-cell">
                            <div class="user-avatar-tbl" style="background:${bgColor}20;color:${bgColor};">
                                ${initials.toUpperCase()}
                            </div>
                            <div>
                                <div class="user-name-tbl">${acc.firstName || ''} ${acc.lastName || acc.displayName || ''}</div>
                                <div class="user-email-tbl" style="font-family:monospace;"><i class="fas fa-at" style="font-size:10px;opacity:.6;margin-right:3px;"></i>${username}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="font-family:monospace;font-size:13px;background:rgba(99,102,241,.08);color:var(--primary);padding:3px 10px;border-radius:20px;font-weight:600;">
                            ${username}
                        </span>
                    </td>
                    <td>
                        <span class="role-badge ${roleInfo.color}">
                            <i class="${ROLE_ICONS[acc.role]||'fas fa-user'}"></i>
                            ${roleInfo.label}
                        </span>
                    </td>
                    <td>
                        <span class="status-pill ${acc.active ? 'status-active' : 'status-inactive'}">
                            <i class="fas fa-circle" style="font-size:6px;"></i>
                            ${acc.active ? 'Actif' : 'Inactif'}
                        </span>
                    </td>
                    <td style="color:var(--gray);font-size:13px;">${acc.lastLogin ? `<i class="fas fa-sign-in-alt" style="color:#10b981;margin-right:4px;"></i>${acc.lastLogin}` : '<span style="color:var(--gray);opacity:.5;">Jamais</span>'}</td>
                    <td>
                        <div class="admin-action-btns">
                            <button class="btn-icon edit" title="Modifier" onclick="adminOpenEditUser('${username}')">
                                <i class="fas fa-pen"></i>
                            </button>
                            <button class="btn-icon reset" title="Voir / Réinitialiser le mot de passe" onclick="adminShowPassword('${username}')">
                                <i class="fas fa-key"></i>
                            </button>
                            ${isAdmin ? '' : `
                            <button class="btn-icon del" title="Supprimer" onclick="adminOpenDelete('${username}')">
                                <i class="fas fa-trash"></i>
                            </button>`}
                        </div>
                    </td>
                </tr>`;
            }).join('');
        }

        function adminFilterUsers() {
            adminRenderUsers();
        }

        function adminOpenCreateUser() {
            document.getElementById('adminUserEditKey').value = '';
            document.getElementById('adminUserModalTitle').innerHTML = '<i class="fas fa-user-plus"></i> Nouvel utilisateur';
            document.getElementById('adminUserFirstName').value = '';
            document.getElementById('adminUserLastName').value  = '';
            document.getElementById('adminUserEmail').value     = '';
            document.getElementById('adminUserRole').value      = '';
            document.getElementById('adminUserPassword').value  = '';
            document.getElementById('adminUserStatus').value    = 'active';
            document.getElementById('adminUserCollectorName').value = '';
            document.getElementById('collectorNameField').style.display = 'none';
            document.getElementById('adminUserModalError').textContent = '';
            document.getElementById('adminUserModalError').classList.remove('show');
            document.getElementById('pwdRequired').style.display = 'inline';
            document.getElementById('adminPwdHint').style.display = 'none';
            document.getElementById('adminUserModal').style.display = 'flex';
        }

        // â”€â”€ Éditer un utilisateur â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminOpenEditUser(username) {
            const acc = USER_ACCOUNTS[username];
            if (!acc) return;
            document.getElementById('adminUserEditKey').value  = username;
            document.getElementById('adminUserModalTitle').innerHTML = '<i class="fas fa-user-edit"></i> Modifier l\'utilisateur';
            document.getElementById('adminUserFirstName').value = acc.firstName || '';
            document.getElementById('adminUserLastName').value  = acc.lastName  || '';
            document.getElementById('adminUserEmail').value     = username;
            document.getElementById('adminUserRole').value      = acc.role;
            document.getElementById('adminUserPassword').value  = '';
            document.getElementById('adminUserStatus').value    = acc.active ? 'active' : 'inactive';
            document.getElementById('adminUserCollectorName').value = acc.collectorName || '';
            document.getElementById('collectorNameField').style.display = acc.role === 'collector' ? 'block' : 'none';
            document.getElementById('adminUserModalError').textContent = '';
            document.getElementById('adminUserModalError').classList.remove('show');
            document.getElementById('pwdRequired').style.display = 'none';
            document.getElementById('adminPwdHint').style.display = 'inline';
            document.getElementById('adminUserModal').style.display = 'flex';
        }

        function adminToggleCollectorField() {
            const role = document.getElementById('adminUserRole').value;
            document.getElementById('collectorNameField').style.display = role === 'collector' ? 'block' : 'none';
        }

        function adminTogglePwd() {
            const input = document.getElementById('adminUserPassword');
            const icon  = document.querySelector('#adminPwdToggle i');
            const isHidden = input.type === 'password';
            input.type  = isHidden ? 'text' : 'password';
            icon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
        }

        function adminGeneratePwd() {
            const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#';
            let pwd = '';
            for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
            const input = document.getElementById('adminUserPassword');
            input.type  = 'text';
            input.value = pwd;
            document.querySelector('#adminPwdToggle i').className = 'fas fa-eye-slash';
        }

        async function adminSaveUser() {
            const editKey    = document.getElementById('adminUserEditKey').value;
            const firstName  = document.getElementById('adminUserFirstName').value.trim();
            const lastName   = document.getElementById('adminUserLastName').value.trim();
            const username   = document.getElementById('adminUserEmail').value.trim().toLowerCase();
            const role       = document.getElementById('adminUserRole').value;
            const password   = document.getElementById('adminUserPassword').value;
            const status     = document.getElementById('adminUserStatus').value;
            const collName   = document.getElementById('adminUserCollectorName').value.trim().toUpperCase();
            const errEl      = document.getElementById('adminUserModalError');

            // Validation
            if (!username) {
                errEl.textContent = 'Le nom d\'utilisateur est obligatoire.';
                errEl.classList.add('show');
                return;
            }
            if (!role) {
                errEl.textContent = 'Le rôle est obligatoire.';
                errEl.classList.add('show');
                return;
            }
            if (!/^[a-z0-9._@-]+$/.test(username)) {
                errEl.textContent = 'Nom d\'utilisateur invalide (lettres minuscules, chiffres, @, . et - seulement).';
                errEl.classList.add('show');
                return;
            }
            if (!editKey && !password) {
                errEl.textContent = 'Un mot de passe est requis pour un nouvel utilisateur.';
                errEl.classList.add('show');
                return;
            }
            if (password && password.length < 6) {
                errEl.textContent = 'Le mot de passe doit contenir au moins 6 caractères.';
                errEl.classList.add('show');
                return;
            }
            if (role === 'collector' && !collName) {
                errEl.textContent = 'Veuillez indiquer le nom du récolteur dans le système.';
                errEl.classList.add('show');
                return;
            }
            // Doublon username sur création
            if (!editKey && USER_ACCOUNTS[username]) {
                errEl.textContent = 'Ce nom d\'utilisateur est déjà utilisé.';
                errEl.classList.add('show');
                return;
            }

            const initials = ((firstName[0]||'') + (lastName[0]||role[0])).toUpperCase();
            const newAcc = {
                role,
                firstName,
                lastName,
                displayName: `${firstName} ${lastName}`.trim() || role,
                avatar: initials || role.slice(0,3).toUpperCase(),
                active: status === 'active',
                createdAt: editKey ? (USER_ACCOUNTS[editKey]?.createdAt || new Date().toLocaleDateString('fr-FR'))
                                   : new Date().toLocaleDateString('fr-FR'),
                ...(role === 'collector' ? { collectorName: collName } : {})
            };

            if (password) newAcc.password = password;
            else if (editKey) newAcc.password = USER_ACCOUNTS[editKey]?.password || '';

            // â”€â”€ Persister via l'API backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            try {
                const apiPayload = {
                    username:      username,
                    password:      password || undefined,
                    firstName:     firstName,
                    lastName:      lastName,
                    role:          role,
                    displayName:   newAcc.displayName,
                    avatar:        newAcc.avatar,
                    collectorName: role === 'collector' ? collName : null
                };
                
                // Supprimer les champs undefined
                Object.keys(apiPayload).forEach(k => apiPayload[k] === undefined && delete apiPayload[k]);

                let apiResponse;
                if (editKey) {
                    // Édition — trouver l'ID de l'utilisateur existant
                    const existingAcc = USER_ACCOUNTS[editKey];
                    if (existingAcc && existingAcc.apiId) {
                        apiResponse = await API.Users.update(existingAcc.apiId, apiPayload);
                    } else {
                        // Tenter la mise à jour par username via recherche
                        const usersResp = await API.Users.getAll({ search: editKey });
                        const users = usersResp?.data || [];
                        const match = users.find(u => u.username === editKey);
                        if (match) {
                            apiResponse = await API.Users.update(match.id, apiPayload);
                        } else {
                            // Créer si non trouvé en BD
                            apiResponse = await API.Users.create(apiPayload);
                        }
                    }
                } else {
                    // Création
                    apiResponse = await API.Users.create(apiPayload);
                }

                // Stocker l'ID API pour les futures éditions
                if (apiResponse?.data?.id) {
                    newAcc.apiId = apiResponse.data.id;
                }

                console.log(`✓ [API] Utilisateur ${editKey ? 'modifié' : 'créé'} en BD:`, username, apiResponse);

                // â”€â”€ Mettre à jour le cache local APRÈS succès API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                const oldAcc = editKey ? USER_ACCOUNTS[editKey] : null;
                if (oldAcc && oldAcc.apiId && !newAcc.apiId) {
                    newAcc.apiId = oldAcc.apiId;
                }

                if (editKey && editKey !== username) {
                    delete USER_ACCOUNTS[editKey];
                }

                USER_ACCOUNTS[username] = newAcc;

                const action = editKey ? 'edit' : 'create';
                adminLog(action, `${editKey ? 'âœï¸ Modifié' : '➜ Créé'} : ${newAcc.displayName} (${role}) â†’ @${username}`);

                adminCloseUserModal();
                adminRenderUsers();
                adminRenderStats();

                showAlert(`✓ Utilisateur ${editKey ? 'modifié' : 'créé'} avec succès !`, 'success');

            } catch (apiError) {
                console.error('âŒ Erreur API utilisateur :', apiError);
                
                let errorMsg = 'Une erreur s\'est produite lors de la sauvegarde';
                if (apiError.data?.error) {
                    errorMsg = apiError.data.error;
                } else if (apiError.message) {
                    errorMsg = apiError.message;
                }

                errEl.textContent = `âŒ Erreur serveur : ${errorMsg}`;
                errEl.classList.add('show');
                
                showAlert(`âŒ Erreur : ${errorMsg}`, 'error');
                return;  // <-- Ne pas sauvegarder localement si l'API échoue
            }
        }

        function adminCloseUserModal(e) {
            if (e && e.target && e.target !== document.getElementById('adminUserModal')) return;
            document.getElementById('adminUserModal').style.display = 'none';
            document.getElementById('adminUserModalError').textContent = '';
            document.getElementById('adminUserModalError').classList.remove('show');
        }

        // â”€â”€ Afficher le mot de passe d'un compte (modal sécurisé) â”€â”€
        function adminShowPassword(username) {
            const acc = USER_ACCOUNTS[username];
            if (!acc) return;
            document.getElementById('adminPwdModalName').textContent = acc.displayName || username;
            const inp = document.getElementById('adminPwdModalValue');
            inp.value = acc.password || '';
            inp.type  = 'password';
            document.getElementById('adminPwdModalToggle').innerHTML = '<i class="fas fa-eye"></i>';
            document.getElementById('adminPwdCopied').style.display = 'none';
            document.getElementById('adminPwdModal').style.display = 'flex';
            adminLog('view_pwd', `ðŸ‘ Mot de passe consulté : ${acc.displayName || username}`);
        }
        function adminTogglePwdModal() {
            const inp = document.getElementById('adminPwdModalValue');
            const btn = document.getElementById('adminPwdModalToggle');
            if (inp.type === 'password') {
                inp.type = 'text';
                btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                inp.type = 'password';
                btn.innerHTML = '<i class="fas fa-eye"></i>';
            }
        }
        function adminCopyPwd() {
            const val = document.getElementById('adminPwdModalValue').value;
            navigator.clipboard.writeText(val).then(() => {
                const el = document.getElementById('adminPwdCopied');
                el.style.display = 'block';
                setTimeout(() => el.style.display = 'none', 2000);
            });
        }

        // â”€â”€ Supprimer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        let _deleteTarget = null;
        function adminOpenDelete(email) {
            _deleteTarget = email;
            document.getElementById('adminDeleteName').textContent = USER_ACCOUNTS[email]?.displayName || email;
            document.getElementById('adminDeleteModal').style.display = 'flex';
        }
        function adminCloseDeleteModal(e) {
            if (e && e.target !== document.getElementById('adminDeleteModal')) return;
            document.getElementById('adminDeleteModal').style.display = 'none';
            _deleteTarget = null;
        }
        async function adminConfirmDelete() {
            if (!_deleteTarget) return;
            const acc = USER_ACCOUNTS[_deleteTarget];
            adminLog('delete', `ðŸ—‘ï¸ Supprimé : ${acc?.displayName || _deleteTarget}`);

            // â”€â”€ Supprimer via l'API backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            try {
                if (acc && acc.apiId) {
                    await API.Users.delete(acc.apiId);
                } else {
                    // Rechercher par username
                    const usersResp = await API.Users.getAll({ search: _deleteTarget });
                    const users = usersResp?.data || [];
                    const match = users.find(u => u.username === _deleteTarget);
                    if (match) {
                        await API.Users.delete(match.id);
                    }
                }
                console.log(`✓ [API] Utilisateur supprimé en BD:`, _deleteTarget);
            } catch (apiError) {
                console.warn('⚠️ Erreur API suppression utilisateur:', apiError);
                showAlert('⚠️ Suppression locale uniquement — Erreur API', 'warning');
            }

            delete USER_ACCOUNTS[_deleteTarget];
            _deleteTarget = null;
            document.getElementById('adminDeleteModal').style.display = 'none';
            adminRenderUsers();
            adminRenderStats();
        }

        // ============================================================
        // PANEL ADMIN — Moniteur de santé
        // ============================================================

        function adminRunHealthCheck() {
            const checks = [];
            let score = 100;

            // 1. Comptes utilisateurs
            const totalAccounts = Object.keys(USER_ACCOUNTS).length;
            const activeAccounts = Object.values(USER_ACCOUNTS).filter(a => a.active).length;
            checks.push({
                icon: totalAccounts > 0 ? 'ok' : 'err',
                iconClass: 'fas fa-users',
                title: 'Comptes utilisateurs',
                desc: `${totalAccounts} compte(s) enregistré(s), ${activeAccounts} actif(s).`,
                value: totalAccounts > 0 ? `âœ” ${totalAccounts} comptes` : 'âœ˜ Aucun compte',
                status: totalAccounts > 0 ? 'ok' : 'err'
            });
            if (totalAccounts === 0) score -= 30;

            // 2. Compte admin présent
            const hasAdmin = Object.values(USER_ACCOUNTS).some(a => a.role === 'admin' && a.active);
            checks.push({
                icon: hasAdmin ? 'ok' : 'err',
                iconClass: 'fas fa-shield-alt',
                title: 'Compte administrateur',
                desc: hasAdmin ? 'Un administrateur actif est configuré.' : 'Aucun administrateur actif — créez-en un immédiatement.',
                value: hasAdmin ? 'âœ” Présent' : 'âœ˜ Manquant',
                status: hasAdmin ? 'ok' : 'err'
            });
            if (!hasAdmin) score -= 40;

            // 3. Clients
            const totalClients = clientsData.length;
            const paidClients  = clientsData.filter(c => c.status === 'paid').length;
            const pendClients  = clientsData.filter(c => c.status === 'pending').length;
            checks.push({
                icon: totalClients > 0 ? 'ok' : 'warn',
                iconClass: 'fas fa-users',
                title: 'Données clients',
                desc: `${totalClients} client(s) au total. ${paidClients} payé(s), ${pendClients} en attente.`,
                value: totalClients > 0 ? `âœ” ${totalClients} clients` : 'âš  Aucun client',
                status: totalClients > 0 ? 'ok' : 'warn'
            });
            if (totalClients === 0) score -= 10;

            // 4. Propriétaires
            const totalOwners = ownersData ? ownersData.length : 0;
            checks.push({
                icon: totalOwners > 0 ? 'ok' : 'warn',
                iconClass: 'fas fa-building',
                title: 'Données propriétaires',
                desc: `${totalOwners} propriétaire(s) enregistré(s) dans le système.`,
                value: totalOwners > 0 ? `âœ” ${totalOwners} propriétaires` : 'âš  Aucun propriétaire',
                status: totalOwners > 0 ? 'ok' : 'warn'
            });
            if (totalOwners === 0) score -= 5;

            // 5. Récolteurs
            const totalCollectors = collectorsData ? collectorsData.length : 0;
            checks.push({
                icon: totalCollectors > 0 ? 'ok' : 'warn',
                iconClass: 'fas fa-hand-holding-usd',
                title: 'Récolteurs actifs',
                desc: `${totalCollectors} récolteur(s) dans la base de données.`,
                value: totalCollectors > 0 ? `âœ” ${totalCollectors} récolteurs` : 'âš  Aucun récolteur',
                status: totalCollectors > 0 ? 'ok' : 'warn'
            });
            if (totalCollectors === 0) score -= 5;

            // 6. Cohérence récolteurs-comptes
            const collectorAccounts = Object.values(USER_ACCOUNTS).filter(a => a.role === 'collector');
            const orphanCollectors = collectorAccounts.filter(a => {
                if (!a.collectorName) return true;
                return !collectorsData.find(c => c.lastName.toUpperCase() === a.collectorName.toUpperCase());
            });
            checks.push({
                icon: orphanCollectors.length === 0 ? 'ok' : 'warn',
                iconClass: 'fas fa-link',
                title: 'Liens récolteurs',
                desc: orphanCollectors.length === 0
                    ? 'Tous les comptes récolteurs sont liés à un agent dans le système.'
                    : `${orphanCollectors.length} compte(s) récolteur(s) non liés : ${orphanCollectors.map(a=>a.displayName).join(', ')}.`,
                value: orphanCollectors.length === 0 ? 'âœ” Cohérent' : `âš  ${orphanCollectors.length} non lié(s)`,
                status: orphanCollectors.length === 0 ? 'ok' : 'warn'
            });
            if (orphanCollectors.length > 0) score -= 5 * orphanCollectors.length;

            // 7. Mots de passe faibles
            const weakPwd = Object.entries(USER_ACCOUNTS).filter(([_, a]) => !a.password || a.password.length < 6);
            checks.push({
                icon: weakPwd.length === 0 ? 'ok' : 'warn',
                iconClass: 'fas fa-lock',
                title: 'Sécurité des mots de passe',
                desc: weakPwd.length === 0
                    ? 'Tous les comptes ont un mot de passe d\'au moins 6 caractères.'
                    : `${weakPwd.length} compte(s) avec mot de passe absent ou trop court.`,
                value: weakPwd.length === 0 ? 'âœ” Sécurisé' : `âš  ${weakPwd.length} compte(s) à risque`,
                status: weakPwd.length === 0 ? 'ok' : 'warn'
            });
            if (weakPwd.length > 0) score -= 10;

            // 8. Comptes inactifs
            const inactiveCount = Object.values(USER_ACCOUNTS).filter(a => !a.active).length;
            checks.push({
                icon: 'info',
                iconClass: 'fas fa-user-slash',
                title: 'Comptes désactivés',
                desc: inactiveCount > 0
                    ? `${inactiveCount} compte(s) désactivé(s). Ces utilisateurs ne peuvent pas se connecter.`
                    : 'Aucun compte désactivé.',
                value: inactiveCount > 0 ? `â„¹ ${inactiveCount} désactivé(s)` : 'âœ” Aucun',
                status: 'info'
            });

            // 9. Propriétaires sans jour de versement
            const ownersNoDay2 = (ownersData||[]).filter(o => !o.paymentDay);
            checks.push({
                icon: ownersNoDay2.length === 0 ? 'ok' : 'warn',
                iconClass: 'fas fa-calendar-check',
                title: 'Jours de versement',
                desc: ownersNoDay2.length === 0
                    ? 'Tous les propriétaires ont un jour de versement défini.'
                    : `${ownersNoDay2.length} propriétaire(s) sans jour de versement : ${ownersNoDay2.map(o=>`${o.lastName}`).join(', ')}.`,
                value: ownersNoDay2.length === 0 ? 'âœ” Complet' : `âš  ${ownersNoDay2.length} manquant(s)`,
                status: ownersNoDay2.length === 0 ? 'ok' : 'warn'
            });
            if (ownersNoDay2.length > 0) score -= 3 * ownersNoDay2.length;

            // 10. Biens sans propriétaire
            const propsNoOwner2 = (propertiesData||[]).filter(p => !p.ownerId);
            checks.push({
                icon: propsNoOwner2.length === 0 ? 'ok' : 'err',
                iconClass: 'fas fa-home',
                title: 'Biens sans propriétaire',
                desc: propsNoOwner2.length === 0
                    ? 'Tous les biens sont rattachés à un propriétaire.'
                    : `${propsNoOwner2.length} bien(s) sans propriétaire assigné.`,
                value: propsNoOwner2.length === 0 ? 'âœ” OK' : `âœ˜ ${propsNoOwner2.length} bien(s)`,
                status: propsNoOwner2.length === 0 ? 'ok' : 'err'
            });
            if (propsNoOwner2.length > 0) score -= 8;

            // 11. Clients en retard
            const overdueCount = clientsData.filter(c => c.status === 'overdue').length;
            checks.push({
                icon: overdueCount === 0 ? 'ok' : overdueCount < 5 ? 'warn' : 'err',
                iconClass: 'fas fa-clock',
                title: 'Clients en retard de paiement',
                desc: overdueCount === 0
                    ? 'Aucun client en retard de paiement.'
                    : `${overdueCount} client(s) en retard. Des relances sont recommandées.`,
                value: overdueCount === 0 ? 'âœ” Aucun' : `${overdueCount > 4 ? 'âœ˜' : 'âš '} ${overdueCount} en retard`,
                status: overdueCount === 0 ? 'ok' : overdueCount < 5 ? 'warn' : 'err'
            });
            if (overdueCount > 0) score -= Math.min(15, overdueCount * 2);

            score = Math.max(0, Math.min(100, score));

            // Affichage
            const circle = document.getElementById('healthScoreCircle');
            const val    = document.getElementById('healthScoreValue');
            const title  = document.getElementById('healthScoreTitle');
            const sub    = document.getElementById('healthScoreSubtitle');
            const dot    = document.getElementById('adminHealthDot');

            val.textContent = score + '%';
            circle.className = 'health-score-circle ' + (score >= 90 ? 'score-ok' : score >= 60 ? 'score-warn' : 'score-err');
            dot.className    = 'admin-health-dot '    + (score >= 90 ? 'ok' : score >= 60 ? 'warn' : 'err');

            if (score >= 90) {
                title.textContent = 'Tout fonctionne correctement';
                sub.textContent   = 'Aucune anomalie détectée. La plateforme est en bonne santé.';
            } else if (score >= 60) {
                title.textContent = 'Quelques points d\'attention';
                sub.textContent   = 'Des avertissements ont été détectés. Consultez les détails ci-dessous.';
            } else {
                title.textContent = 'Problèmes critiques détectés';
                sub.textContent   = 'Des erreurs importantes nécessitent votre attention immédiate.';
            }

            document.getElementById('healthChecksGrid').innerHTML = checks.map(c => `
                <div class="health-check-card">
                    <div class="health-check-icon ${c.icon}">
                        <i class="${c.iconClass}"></i>
                    </div>
                    <div>
                        <div class="health-check-title">${c.title}</div>
                        <div class="health-check-desc">${c.desc}</div>
                        <div class="health-check-value ${c.status}">${c.value}</div>
                    </div>
                </div>`).join('');

            adminRenderHealthDataGrid();
            adminLog('health', `ðŸ©º Diagnostic exécuté — Score : ${score}% (${checks.length} vérifications)`);
        }

        function adminRenderHealthDataGrid() {
            const items = [
                { num: clientsData.length,    lbl: 'Clients' },
                { num: (ownersData||[]).length, lbl: 'Propriétaires' },
                { num: (collectorsData||[]).length, lbl: 'Récolteurs' },
                { num: Object.keys(USER_ACCOUNTS).length, lbl: 'Comptes accès' },
                { num: clientsData.filter(c=>c.status==='paid').length, lbl: 'Paiements OK' },
                { num: clientsData.filter(c=>c.status==='pending'||c.status==='overdue').length, lbl: 'En attente' },
            ];
            document.getElementById('healthDataGrid').innerHTML = items.map(i =>
                `<div class="health-data-item">
                    <div class="health-data-num">${i.num}</div>
                    <div class="health-data-lbl">${i.lbl}</div>
                </div>`).join('');
        }

        // ============================================================
        // PANEL ADMIN — Logs
        // ============================================================

        // ============================================================
        // PANEL ADMIN — Données & Export
        // ============================================================

        // ============================================================
        // PANEL ADMIN — DATA TAB : sous-onglets
        // ============================================================

        function switchDataSubTab(tab) {
            const tabs = { modules:'dsModules', importexport:'dsImportExport', scan:'dsScan', backup:'dsBackup' };
            Object.keys(tabs).forEach(k => {
                const el = document.getElementById(tabs[k]);
                if (el) el.style.display = k === tab ? 'block' : 'none';
                const btn = document.getElementById('dsTab' + k.charAt(0).toUpperCase() + k.slice(1));
                if (btn) btn.classList.toggle('active', k === tab);
            });
            if (tab === 'backup')   adminRefreshBackupList();
            if (tab === 'scan')     ; // prêt à l'emploi
            if (tab === 'modules')  adminRefreshModuleStats();
        }

        // â”€â”€ KPIs dynamiques â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminRefreshDataTab() {
            const counts = [
                { id:'adminDataCountClients',    val: clientsData.length },
                { id:'adminDataCountOwners',     val: (ownersData||[]).length },
                { id:'adminDataCountProperties', val: (propertiesData||[]).length },
                { id:'adminDataCountCollectors', val: (collectorsData||[]).length }
            ];
            counts.forEach(c => { const el = document.getElementById(c.id); if (el) el.textContent = c.val; });

            const totalRent     = clientsData.reduce((s,c) => s + (c.rent||0), 0);
            const totalPaid     = clientsData.reduce((s,c) => s + (c.amountPaid||0), 0);
            const paidClients   = clientsData.filter(c => c.status === 'paid').length;
            const overdueCount  = clientsData.filter(c => c.status === 'overdue').length;
            const pendingCount  = clientsData.filter(c => c.status === 'pending').length;
            const totalProps    = (propertiesData||[]).length;
            const rentedProps   = (propertiesData||[]).filter(p => p.status === 'loue' || p.status === 'partiel').length;
            const tauxOccup     = totalProps > 0 ? Math.round(rentedProps / totalProps * 100) : 0;
            const txRecouvr     = totalRent > 0 ? Math.round(totalPaid / totalRent * 100) : 0;

            const kpis = [
                { icon:'fas fa-users',               color:'#6366f1', bg:'rgba(99,102,241,.1)',   label:'Clients',          val: clientsData.length },
                { icon:'fas fa-building',             color:'#10b981', bg:'rgba(16,185,129,.1)',   label:'Propriétaires',    val: (ownersData||[]).length },
                { icon:'fas fa-home',                 color:'#f59e0b', bg:'rgba(245,158,11,.1)',   label:'Biens',            val: totalProps },
                { icon:'fas fa-check-circle',         color:'#10b981', bg:'rgba(16,185,129,.1)',   label:'Payés ce mois',    val: paidClients },
                { icon:'fas fa-clock',                color:'#ef4444', bg:'rgba(239,68,68,.1)',    label:'En retard',        val: overdueCount },
                { icon:'fas fa-money-bill-wave',      color:'#6366f1', bg:'rgba(99,102,241,.1)',   label:'Loyers/mois',      val: totalRent.toLocaleString() + ' XOF' },
                { icon:'fas fa-chart-line',           color:'#10b981', bg:'rgba(16,185,129,.1)',   label:'Taux recouvr.',    val: txRecouvr + '%' },
                { icon:'fas fa-door-open',            color:'#f59e0b', bg:'rgba(245,158,11,.1)',   label:'Taux occupation',  val: tauxOccup + '%' },
            ];

            const grid = document.getElementById('adminDataSummaryGrid');
            if (!grid) return;
            grid.innerHTML = kpis.map(k => `
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center;transition:.2s;" onmouseover="this.style.boxShadow='0 4px 16px rgba(0,0,0,.08)'" onmouseout="this.style.boxShadow='none'">
                    <div style="width:38px;height:38px;border-radius:10px;background:${k.bg};display:flex;align-items:center;justify-content:center;margin:0 auto 8px;">
                        <i class="${k.icon}" style="color:${k.color};font-size:16px;"></i>
                    </div>
                    <div style="font-size:17px;font-weight:700;color:var(--text);">${k.val}</div>
                    <div style="font-size:11px;color:var(--gray);margin-top:2px;">${k.label}</div>
                </div>`).join('');

            adminRefreshModuleStats();
            switchDataSubTab('modules');
        }

        // â”€â”€ Stats par module (mini-cards dans chaque module card) â”€â”€â”€
        function adminRefreshModuleStats() {
            // Clients
            const csEl = document.getElementById('dataStatsClients');
            if (csEl) {
                const paid = clientsData.filter(c=>c.status==='paid').length;
                const late = clientsData.filter(c=>c.status==='overdue').length;
                const pend = clientsData.filter(c=>c.status==='pending').length;
                csEl.innerHTML = _miniStat('Payés', paid, '#10b981') + _miniStat('En attente', pend, '#f59e0b') + _miniStat('En retard', late, '#ef4444');
            }
            // Propriétaires
            const osEl = document.getElementById('dataStatsOwners');
            if (osEl) {
                const withDay   = (ownersData||[]).filter(o=>o.paymentDay).length;
                const withRIB   = (ownersData||[]).filter(o=>o.bankAccount).length;
                const fixedComm = (ownersData||[]).filter(o=>o.commissionType==='fixed').length;
                osEl.innerHTML = _miniStat('Avec jour J', withDay, '#6366f1') + _miniStat('Avec RIB', withRIB, '#10b981') + _miniStat('Comm. fixe', fixedComm, '#f59e0b');
            }
            // Propriétés
            const psEl = document.getElementById('dataStatsProperties');
            if (psEl) {
                const loue  = (propertiesData||[]).filter(p=>p.status==='loue').length;
                const libre = (propertiesData||[]).filter(p=>p.status==='libre').length;
                const part  = (propertiesData||[]).filter(p=>p.status==='partiel').length;
                psEl.innerHTML = _miniStat('Loués', loue, '#10b981') + _miniStat('Libres', libre, '#6b7280') + _miniStat('Partiels', part, '#f59e0b');
            }
            // Récolteurs
            const colEl = document.getElementById('dataStatsCollectors');
            if (colEl) {
                const withAcc = (collectorsData||[]).filter(c =>
                    Object.values(USER_ACCOUNTS).find(a => a.role==='collector' && a.collectorName &&
                    a.collectorName.toUpperCase() === (c.lastName||'').toUpperCase())).length;
                const total   = (collectorsData||[]).length;
                const without = total - withAcc;
                colEl.innerHTML = _miniStat('Avec compte', withAcc, '#10b981') + _miniStat('Sans compte', without, '#ef4444') + _miniStat('Total', total, '#6366f1');
            }
        }

        function _miniStat(label, val, color) {
            return `<div style="background:rgba(0,0,0,.04);border-radius:8px;padding:7px 4px;text-align:center;">
                <div style="font-size:15px;font-weight:700;color:${color};">${val}</div>
                <div style="font-size:10px;color:var(--gray);margin-top:1px;">${label}</div>
            </div>`;
        }

        // â”€â”€ Aperçu données (modal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminShowDataPreview(module) {
            const modal = document.getElementById('adminDataPreviewModal');
            const title = document.getElementById('adminDataPreviewTitle');
            const body  = document.getElementById('adminDataPreviewBody');
            if (!modal || !body) return;

            const STATUS_LABELS = { paid:'✓ Payé', pending:'• En attente', overdue:'🔴 En retard', inactive:'âšª Inactif', loue:'ðŸŸ¢ Loué', libre:'âšª Libre', partiel:'ðŸŸ¡ Partiel' };

            let headers = [], data = [], titleHTML = '';

            if (module === 'clients') {
                headers = ['Nom', 'Téléphone', 'Bien assigné', 'Loyer', 'Payé', 'Statut'];
                data = clientsData.slice(0, 50).map(c => [
                    `<strong>${c.lastName||''} ${c.firstName||''}</strong>`,
                    c.phone || '—',
                    c.propertyName || c.property || '—',
                    `<span style="font-weight:600;">${(c.rent||0).toLocaleString()} XOF</span>`,
                    `<span style="color:#10b981;">${(c.amountPaid||0).toLocaleString()} XOF</span>`,
                    `<span style="font-size:12px;">${STATUS_LABELS[c.status]||c.status||'—'}</span>`
                ]);
                titleHTML = '<i class="fas fa-users"></i> Aperçu — Clients';
            } else if (module === 'owners') {
                headers = ['Nom', 'Téléphone', 'Commission', 'Jour versement', 'RIB', 'Biens'];
                data = (ownersData||[]).slice(0, 50).map(o => {
                    const nbBiens = (propertiesData||[]).filter(p=>p.ownerId===o.id).length;
                    return [
                        `<strong>${o.lastName||''} ${o.firstName||''}</strong>`,
                        o.phone || '—',
                        o.commissionType === 'fixed'
                            ? `<span style="color:#f59e0b;font-weight:600;">${(o.commissionFixed||0).toLocaleString()} XOF fixe</span>`
                            : `<span style="color:var(--primary);font-weight:600;">${o.commissionRate||10}%</span>`,
                        o.paymentDay ? `<span style="color:var(--primary);">${o.paymentDay==='dernier'?'Dernier jour':'Le '+o.paymentDay}</span>` : '<span style="color:#ef4444;">Non fixé</span>',
                        o.bankAccount ? `<code style="font-size:11px;">${o.bankAccount}</code>` : '—',
                        `<span style="font-weight:600;">${nbBiens}</span>`
                    ];
                });
                titleHTML = '<i class="fas fa-building"></i> Aperçu — Propriétaires';
            } else if (module === 'properties') {
                headers = ['Nom du bien', 'Ville', 'Loyer', 'Statut', 'Propriétaire', 'Locataire'];
                data = (propertiesData||[]).slice(0, 50).map(p => {
                    const owner  = (ownersData||[]).find(o=>o.id===p.ownerId);
                    const tenant = clientsData.find(c=>c.propertyId===p.id && c.status!=='inactive');
                    return [
                        `<strong>${p.name||'—'}</strong>`,
                        p.city || p.address || '—',
                        `<span style="font-weight:600;">${(p.rent||0).toLocaleString()} XOF</span>`,
                        `<span style="font-size:12px;">${STATUS_LABELS[p.status]||p.status||'—'}</span>`,
                        owner ? `${owner.lastName} ${owner.firstName}` : '<span style="color:#ef4444;">Manquant</span>',
                        tenant ? `${tenant.lastName} ${tenant.firstName}` : '—'
                    ];
                });
                titleHTML = '<i class="fas fa-home"></i> Aperçu — Biens';
            } else if (module === 'collectors') {
                headers = ['Nom', 'Téléphone', 'Zone', 'Clients assignés', 'Compte accès'];
                data = (collectorsData||[]).slice(0, 50).map(c => {
                    const assigned = clientsData.filter(cl=>cl.collector===(c.lastName||'') || cl.collectorId===c.id).length;
                    const hasAcc   = Object.values(USER_ACCOUNTS).find(a=>a.role==='collector'&&a.collectorName&&a.collectorName.toUpperCase()===(c.lastName||'').toUpperCase());
                    return [
                        `<strong>${c.lastName||''} ${c.firstName||''}</strong>`,
                        c.phone || '—',
                        c.zone || c.sector || '—',
                        `<span style="font-weight:600;color:var(--primary);">${assigned}</span>`,
                        hasAcc ? '<span style="color:#10b981;">âœ” Actif</span>' : '<span style="color:#ef4444;">âœ˜ Absent</span>'
                    ];
                });
                titleHTML = '<i class="fas fa-hand-holding-usd"></i> Aperçu — Récolteurs';
            }

            const totalRows = { clients: clientsData.length, owners: (ownersData||[]).length, properties: (propertiesData||[]).length, collectors: (collectorsData||[]).length };
            body.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                    <span style="font-size:12px;color:var(--gray);">Affichage de ${data.length} / ${totalRows[module]} enregistrements</span>
                    <button class="btn btn-outline btn-small" onclick="adminExportModule('${module}','csv')"><i class="fas fa-download"></i> Exporter ce module</button>
                </div>
                <div style="overflow-x:auto;">
                <table style="width:100%;border-collapse:collapse;font-size:13px;">
                    <thead><tr>${headers.map(h=>`<th style="background:var(--surface-alt);padding:9px 12px;text-align:left;font-size:11px;color:var(--gray);text-transform:uppercase;letter-spacing:.4px;border-bottom:2px solid var(--border);white-space:nowrap;">${h}</th>`).join('')}</tr></thead>
                    <tbody>${data.map((row,i)=>`<tr style="background:${i%2===0?'transparent':'rgba(0,0,0,.015)'};" onmouseover="this.style.background='rgba(99,102,241,.05)'" onmouseout="this.style.background='${i%2===0?'transparent':'rgba(0,0,0,.015)'}'">${row.map(cell=>`<td style="padding:9px 12px;border-bottom:1px solid var(--border);">${cell}</td>`).join('')}</tr>`).join('')}</tbody>
                </table></div>`;

            title.innerHTML = titleHTML;
            modal.style.display = 'flex';
            adminLog('view', `ðŸ‘ Aperçu module : ${module}`);
        }

        // â”€â”€ Stats module (popup) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminShowModuleStats(module) {
            const modal = document.getElementById('adminDataPreviewModal');
            const title = document.getElementById('adminDataPreviewTitle');
            const body  = document.getElementById('adminDataPreviewBody');
            if (!modal || !body) return;

            let html = '';
            if (module === 'clients') {
                const total = clientsData.length;
                const paid  = clientsData.filter(c=>c.status==='paid').length;
                const over  = clientsData.filter(c=>c.status==='overdue').length;
                const pend  = clientsData.filter(c=>c.status==='pending').length;
                const inac  = clientsData.filter(c=>c.status==='inactive').length;
                const totalRent  = clientsData.reduce((s,c)=>s+(c.rent||0),0);
                const totalPaid  = clientsData.reduce((s,c)=>s+(c.amountPaid||0),0);
                const txRecouvr  = totalRent > 0 ? (totalPaid/totalRent*100).toFixed(1) : 0;
                title.innerHTML = '<i class="fas fa-chart-pie"></i> Statistiques — Clients';
                html = _statCard('Total clients', total, '#6366f1', 'fas fa-users')
                     + _statCard('Payés', paid, '#10b981', 'fas fa-check-circle')
                     + _statCard('En attente', pend, '#f59e0b', 'fas fa-clock')
                     + _statCard('En retard', over, '#ef4444', 'fas fa-exclamation-circle')
                     + _statCard('Inactifs', inac, '#6b7280', 'fas fa-user-slash')
                     + _statCard('Taux recouvrement', txRecouvr+'%', '#10b981', 'fas fa-chart-line')
                     + _statCard('Loyers totaux/mois', totalRent.toLocaleString()+' XOF', '#6366f1', 'fas fa-money-bill')
                     + _statCard('Montant collecté', totalPaid.toLocaleString()+' XOF', '#10b981', 'fas fa-hand-holding-usd');
            } else if (module === 'owners') {
                const total    = (ownersData||[]).length;
                const withDay  = (ownersData||[]).filter(o=>o.paymentDay).length;
                const withRIB  = (ownersData||[]).filter(o=>o.bankAccount).length;
                const fixedC   = (ownersData||[]).filter(o=>o.commissionType==='fixed').length;
                const percC    = total - fixedC;
                const avgRate  = total > 0 ? ((ownersData||[]).filter(o=>o.commissionType!=='fixed').reduce((s,o)=>s+(o.commissionRate||0),0)/(percC||1)).toFixed(1) : 0;
                title.innerHTML = '<i class="fas fa-chart-pie"></i> Statistiques — Propriétaires';
                html = _statCard('Total propriétaires', total, '#10b981', 'fas fa-building')
                     + _statCard('Avec jour versement', withDay, '#6366f1', 'fas fa-calendar-check')
                     + _statCard('Avec RIB', withRIB, '#10b981', 'fas fa-university')
                     + _statCard('Commission fixe', fixedC, '#f59e0b', 'fas fa-lock')
                     + _statCard('Commission %', percC, '#6366f1', 'fas fa-percentage')
                     + _statCard('Taux comm. moyen', avgRate+'%', '#6366f1', 'fas fa-chart-bar');
            } else if (module === 'properties') {
                const total = (propertiesData||[]).length;
                const loue  = (propertiesData||[]).filter(p=>p.status==='loue').length;
                const libre = (propertiesData||[]).filter(p=>p.status==='libre').length;
                const part  = (propertiesData||[]).filter(p=>p.status==='partiel').length;
                const avgRent = total > 0 ? Math.round((propertiesData||[]).reduce((s,p)=>s+(p.rent||0),0)/total) : 0;
                const tauxOcc = total > 0 ? Math.round((loue+part)/total*100) : 0;
                title.innerHTML = '<i class="fas fa-chart-pie"></i> Statistiques — Biens';
                html = _statCard('Total biens', total, '#f59e0b', 'fas fa-home')
                     + _statCard('Loués', loue, '#10b981', 'fas fa-door-open')
                     + _statCard('Libres', libre, '#6b7280', 'fas fa-door-closed')
                     + _statCard('Partiels', part, '#f59e0b', 'fas fa-adjust')
                     + _statCard('Loyer moyen', avgRent.toLocaleString()+' XOF', '#6366f1', 'fas fa-coins')
                     + _statCard('Taux occupation', tauxOcc+'%', '#10b981', 'fas fa-chart-pie');
            } else if (module === 'collectors') {
                const total  = (collectorsData||[]).length;
                const active = (collectorsData||[]).filter(c => Object.values(USER_ACCOUNTS).find(a=>a.role==='collector'&&a.collectorName&&a.collectorName.toUpperCase()===(c.lastName||'').toUpperCase())).length;
                const avgClients = total > 0 ? (clientsData.length / total).toFixed(1) : 0;
                title.innerHTML = '<i class="fas fa-chart-pie"></i> Statistiques — Récolteurs';
                html = _statCard('Total récolteurs', total, '#3b82f6', 'fas fa-hand-holding-usd')
                     + _statCard('Avec compte actif', active, '#10b981', 'fas fa-user-check')
                     + _statCard('Sans compte', total-active, '#ef4444', 'fas fa-user-times')
                     + _statCard('Moy. clients/récolteur', avgClients, '#6366f1', 'fas fa-chart-bar');
            }

            body.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;">${html}</div>`;
            modal.style.display = 'flex';
        }

        function _statCard(label, val, color, icon) {
            return `<div style="background:var(--surface-alt);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--border);">
                <div style="width:36px;height:36px;border-radius:10px;background:${color}20;display:flex;align-items:center;justify-content:center;margin:0 auto 8px;">
                    <i class="${icon}" style="color:${color};font-size:15px;"></i>
                </div>
                <div style="font-size:20px;font-weight:700;color:var(--text);">${val}</div>
                <div style="font-size:11px;color:var(--gray);margin-top:3px;">${label}</div>
            </div>`;
        }

        // â”€â”€ Export module (CSV ou Excel simulé) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminExportModule(module, format) {
            let rows = [], headers = [], filename = '';

            if (module === 'clients') {
                headers = ['Nom','Prénom','Téléphone','Email','Bien','Loyer','Payé','Statut','Récolteur'];
                rows = clientsData.map(c=>[c.lastName||'',c.firstName||'',c.phone||'',c.email||'',c.propertyName||'',c.rent||0,c.amountPaid||0,c.status||'',c.collector||'']);
                filename = 'SYGIM_clients';
            } else if (module === 'owners') {
                headers = ['Nom','Prénom','Téléphone','Email','Type commission','Taux%','Montant fixe XOF','Jour versement','RIB'];
                rows = (ownersData||[]).map(o=>[o.lastName||'',o.firstName||'',o.phone||'',o.email||'',o.commissionType||'percentage',o.commissionRate||10,o.commissionFixed||0,o.paymentDay||'',o.bankAccount||'']);
                filename = 'SYGIM_proprietaires';
            } else if (module === 'properties') {
                headers = ['Nom bien','Ville','Adresse','Loyer','Statut','ID propriétaire','Propriétaire'];
                rows = (propertiesData||[]).map(p=>{
                    const ow=(ownersData||[]).find(o=>o.id===p.ownerId);
                    return [p.name||'',p.city||'',p.address||'',p.rent||0,p.status||'',p.ownerId||'',ow?`${ow.lastName} ${ow.firstName}`:''];
                });
                filename = 'SYGIM_biens';
            } else if (module === 'collectors') {
                headers = ['Nom','Prénom','Téléphone','Zone','Clients assignés'];
                rows = (collectorsData||[]).map(c=>[c.lastName||'',c.firstName||'',c.phone||'',c.zone||c.sector||'',clientsData.filter(cl=>cl.collector===c.lastName||cl.collectorId===c.id).length]);
                filename = 'SYGIM_recolteurs';
            }

            const date = new Date().toLocaleDateString('fr-FR').replace(/\//g,'-');
            const csv  = [headers, ...rows].map(r=>r.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
            const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `${filename}_${date}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            adminLog('export', `ðŸ“¤ Export ${format.toUpperCase()} : ${module} (${rows.length} lignes)`);
        }

        // â”€â”€ Export avancé â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminAdvancedExport() {
            const format = document.getElementById('exportFormat')?.value || 'json';
            const incCl  = document.getElementById('exportIncClients')?.checked !== false;
            const incOw  = document.getElementById('exportIncOwners')?.checked !== false;
            const incPr  = document.getElementById('exportIncProperties')?.checked !== false;
            const incCo  = document.getElementById('exportIncCollectors')?.checked !== false;
            const incTr  = document.getElementById('exportIncTransactions')?.checked !== false;

            if (format === 'json') {
                const data = { exportedAt: new Date().toISOString(), exportedBy: currentUser?.displayName||'Admin' };
                if (incCl)  data.clients     = clientsData;
                if (incOw)  data.owners      = ownersData || [];
                if (incPr)  data.properties  = propertiesData || [];
                if (incCo)  data.collectors  = collectorsData || [];
                if (incTr)  data.transactions= transactionsData || [];
                const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
                const url  = URL.createObjectURL(blob);
                const a    = document.createElement('a');
                a.href = url;
                a.download = `SYGIM_export_complet_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } else if (format.startsWith('csv_')) {
                const mod = format.replace('csv_','');
                if (mod === 'all') {
                    if (incCl)  adminExportModule('clients','csv');
                    if (incOw)  adminExportModule('owners','csv');
                    if (incPr)  adminExportModule('properties','csv');
                    if (incCo)  adminExportModule('collectors','csv');
                } else {
                    adminExportModule(mod,'csv');
                }
            }
            adminLog('export', `ðŸ“¤ Export avancé : format=${format}`);
        }

        // â”€â”€ Export tous (bouton header) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminExportAllData() {
            adminAdvancedExport();
        }

        // â”€â”€ Import : gestion fichier â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Partagée avec script_import_csv.js via window
        window._importData = window._importData || null;

        function adminHandleImportDrop(e) {
            e.preventDefault();
            const dz = document.getElementById('importDropZone');
            if (dz) dz.style.borderColor = 'var(--border)';
            const file = e.dataTransfer?.files?.[0];
            if (file) _parseImportFile(file);
        }

        function adminHandleImportFile(e) {
            const file = e.target?.files?.[0];
            if (file) _parseImportFile(file);
        }

        function adminImportData() {
            switchDataSubTab('importexport');
            document.getElementById('importFileInput').click();
        }

        function _parseImportFile(file) {
            if (!file.name.endsWith('.json')) {
                showAlert && showAlert('âŒ Format non supporté. Utilisez un fichier .json', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const data = JSON.parse(e.target.result);
                    window._importData = data;

                    // Construire le résumé
                    const counts = [];
                    if (data.clients)      counts.push(`${data.clients.length} clients`);
                    if (data.owners)       counts.push(`${data.owners.length} propriétaires`);
                    if (data.properties)   counts.push(`${data.properties.length} biens`);
                    if (data.collectors)   counts.push(`${data.collectors.length} récolteurs`);
                    if (data.transactions) counts.push(`${data.transactions.length} transactions`);

                    // Afficher dans importPreviewBox (seul ID présent dans le HTML)
                    const previewBox = document.getElementById('importPreviewBox');
                    if (previewBox) {
                        previewBox.style.display = 'block';
                        previewBox.innerHTML = `
                            <div style="background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.25);border-radius:10px;padding:12px 14px;margin-top:10px;">
                                <div style="font-size:13px;font-weight:600;color:var(--success,#10b981);margin-bottom:4px;">
                                    <i class="fas fa-check-circle"></i> Fichier valide — ${file.name}
                                </div>
                                <div style="font-size:12px;color:var(--gray);">${counts.length ? counts.join(' · ') : 'Structure reconnue'}</div>
                                ${data.exportedAt ? `<div style="font-size:11px;color:var(--gray);margin-top:4px;">Exporté le : ${new Date(data.exportedAt).toLocaleString('fr-FR')}</div>` : ''}
                            </div>`;
                    }

                    // Afficher le sélecteur de module et le bouton confirmer
                    const modSel = document.getElementById('importModuleSelect');
                    if (modSel) modSel.style.display = 'block';

                    const btn = document.getElementById('importConfirmBtn');
                    if (btn) {
                        btn.style.display = 'block';
                        btn.disabled = false;
                        btn.innerHTML = '<i class="fas fa-check"></i> Confirmer l\'import';
                    }
                } catch(err) {
                    showAlert && showAlert('âŒ Fichier JSON invalide : ' + err.message, 'error');
                    const previewBox = document.getElementById('importPreviewBox');
                    if (previewBox) {
                        previewBox.style.display = 'block';
                        previewBox.innerHTML = `<div style="background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.25);border-radius:10px;padding:10px 14px;margin-top:10px;font-size:12px;color:#ef4444;"><i class="fas fa-times-circle"></i> Erreur : ${err.message}</div>`;
                    }
                }
            };
            reader.readAsText(file);
        }

        function adminConfirmImport() {
            if (!window._importData) return;
            const mode  = document.getElementById('importMode')?.value || 'merge';
            const msgEl = document.getElementById('importResultMsg');
            let imported = 0;

            try {
                if (mode === 'replace') {
                    if (window._importData.clients)     { clientsData.length = 0;    window._importData.clients.forEach(c=>clientsData.push(c)); imported += window._importData.clients.length; }
                    if (window._importData.owners)      { ownersData.length = 0;     window._importData.owners.forEach(o=>ownersData.push(o)); imported += window._importData.owners.length; }
                    if (window._importData.properties)  { propertiesData.length = 0; window._importData.properties.forEach(p=>propertiesData.push(p)); imported += window._importData.properties.length; }
                    if (window._importData.collectors)  { collectorsData.length = 0; window._importData.collectors.forEach(c=>collectorsData.push(c)); imported += window._importData.collectors.length; }
                } else { // merge
                    if (window._importData.clients)    { window._importData.clients.forEach(c=>{ if(!clientsData.find(x=>x.id===c.id)) { clientsData.push(c); imported++; } }); }
                    if (window._importData.owners)     { window._importData.owners.forEach(o=>{ if(!ownersData.find(x=>x.id===o.id)) { ownersData.push(o); imported++; } }); }
                    if (window._importData.properties) { window._importData.properties.forEach(p=>{ if(!propertiesData.find(x=>x.id===p.id)) { propertiesData.push(p); imported++; } }); }
                    if (window._importData.collectors) { window._importData.collectors.forEach(c=>{ if(!collectorsData.find(x=>x.id===c.id)) { collectorsData.push(c); imported++; } }); }
                }

                if (window.SYGIM_DB) window.SYGIM_DB.saveAll();

                if (msgEl) msgEl.innerHTML = `<span style="color:var(--success,#10b981);font-weight:600;"><i class="fas fa-check-circle"></i> Import réussi — ${imported} enregistrement(s) importé(s).</span>`;
                adminLog('import', `ðŸ“¥ Import ${mode} : ${imported} enregistrements`);

                // RafraÃ®chir tous les panels impactés
                adminRefreshDataTab();
                if (typeof loadDashboard === 'function')          try { loadDashboard(); }          catch(e) {}
                if (typeof loadClientsGrid === 'function')        try { loadClientsGrid(); }        catch(e) {}
                if (typeof loadOwnersList === 'function')         try { loadOwnersList(); }         catch(e) {}
                if (typeof loadPropertiesGrid === 'function')     try { loadPropertiesGrid(); }     catch(e) {}
                if (typeof loadCollectorsGrid === 'function')     try { loadCollectorsGrid(); }     catch(e) {}
                if (typeof updateOverdueStatuses === 'function')  try { updateOverdueStatuses(); }  catch(e) {}

                // Nettoyage UI
                window._importData = null;
                const btn = document.getElementById('importConfirmBtn');
                if (btn) { btn.disabled = true; btn.style.display = 'none'; }
                const modSel = document.getElementById('importModuleSelect');
                if (modSel) modSel.style.display = 'none';
                const previewBox = document.getElementById('importPreviewBox');
                if (previewBox) previewBox.style.display = 'none';

            } catch(err) {
                if (msgEl) msgEl.innerHTML = `<span style="color:var(--danger,#ef4444);">âŒ Erreur : ${err.message}</span>`;
            }
        }

        // â”€â”€ Exposition des fonctions d'import sur window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // Nécessaire pour que script_import_csv.js puisse les patcher correctement
        window.adminConfirmImport     = adminConfirmImport;
        window.adminHandleImportFile  = adminHandleImportFile;
        window.adminHandleImportDrop  = adminHandleImportDrop;
        window._parseImportFile       = _parseImportFile;
        window.adminImportData        = adminImportData;

        // â”€â”€ Reset module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminResetModule(module) {
            const labels = { clients:'clients', owners:'propriétaires', properties:'biens', collectors:'récolteurs' };
            if (!confirm(`⚠️ ATTENTION — Supprimer TOUTES les données Â« ${labels[module]||module} Â» ?\n\nCette action est IRRÉVERSIBLE.`)) return;
            adminCreateBackup(); // sauvegarde auto avant purge
            if (module === 'clients')    { clientsData.length = 0; }
            if (module === 'owners')     { if(ownersData) ownersData.length = 0; }
            if (module === 'properties') { if(propertiesData) propertiesData.length = 0; }
            if (module === 'collectors') { if(collectorsData) collectorsData.length = 0; }
            if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
            adminLog('delete', `ðŸ—‘ï¸ Purge module : ${module} (sauvegarde auto créée)`);
            adminRefreshDataTab();
            showAlert && showAlert(`✓ Module Â« ${module} Â» purgé. Une sauvegarde automatique a été créée.`, 'success');
        }

        // â”€â”€ Scan incohérences complet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminScanInconsistencies() {
            const issues = [], repairs = [];

            const push = (level, msg, details, repairFn, repairLabel) => {
                issues.push({ level, msg, details });
                if (repairFn) repairs.push({ label: repairLabel, fn: repairFn });
            };

            // 1. Clients sans bien assigné
            const cNoProp = clientsData.filter(c => c.status!=='inactive' && !c.propertyId && !c.propertyName);
            if (cNoProp.length) push('warn', `${cNoProp.length} client(s) sans bien immobilier assigné`, cNoProp.map(c=>`${c.lastName} ${c.firstName}`).join(', '));

            // 2. Biens sans propriétaire
            const pNoOwner = (propertiesData||[]).filter(p => !p.ownerId);
            if (pNoOwner.length) push('err', `${pNoOwner.length} bien(s) sans propriétaire`, pNoOwner.map(p=>p.name||('ID:'+p.id)).join(', '));

            // 3. Propriétaires sans bien
            const oNoProp = (ownersData||[]).filter(o => !(propertiesData||[]).find(p=>p.ownerId===o.id));
            if (oNoProp.length) push('info', `${oNoProp.length} propriétaire(s) sans bien enregistré`, oNoProp.map(o=>`${o.lastName} ${o.firstName}`).join(', '));

            // 4. Propriétaires sans jour de versement
            const oNoDay = (ownersData||[]).filter(o => !o.paymentDay);
            if (oNoDay.length) push('warn', `${oNoDay.length} propriétaire(s) sans jour de versement défini`, oNoDay.map(o=>`${o.lastName} ${o.firstName}`).join(', '));

            // 5. Commission fixe à 0
            const oZeroFixed = (ownersData||[]).filter(o => o.commissionType==='fixed' && (!o.commissionFixed || o.commissionFixed<=0));
            if (oZeroFixed.length) push('err', `${oZeroFixed.length} propriétaire(s) avec commission fixe = 0 XOF`, oZeroFixed.map(o=>`${o.lastName} ${o.firstName}`).join(', '));

            // 6. Clients en retard
            const overdueC = clientsData.filter(c => c.status==='overdue');
            if (overdueC.length) push('err', `${overdueC.length} client(s) en statut Â« En retard Â»`, overdueC.map(c=>`${c.lastName} ${c.firstName}`).join(', '));

            // 7. Récolteurs sans compte d'accès
            const colNoAcc = (collectorsData||[]).filter(c =>
                !Object.values(USER_ACCOUNTS).find(a => a.role==='collector' && a.collectorName &&
                a.collectorName.toUpperCase() === (c.lastName||'').toUpperCase()));
            if (colNoAcc.length) push('warn', `${colNoAcc.length} récolteur(s) sans compte d'accès`, colNoAcc.map(c=>`${c.lastName} ${c.firstName}`).join(', '));

            // 8. IDs dupliqués dans clients
            const clientIds  = clientsData.map(c=>c.id);
            const dupClientIds = clientIds.filter((v,i)=>clientIds.indexOf(v)!==i && v!==undefined);
            if (dupClientIds.length) push('err', `${dupClientIds.length} ID(s) dupliqué(s) dans les clients`, 'IDs: '+[...new Set(dupClientIds)].join(', '));

            // 9. Propriétés référencées par clients inexistantes
            const propIds = new Set((propertiesData||[]).map(p=>p.id));
            const cBadProp = clientsData.filter(c => c.propertyId && !propIds.has(c.propertyId));
            if (cBadProp.length) push('warn', `${cBadProp.length} client(s) référencent un bien inexistant`, cBadProp.map(c=>`${c.lastName} ${c.firstName}`).join(', '));

            // Résumé
            const errCount  = issues.filter(i=>i.level==='err').length;
            const warnCount = issues.filter(i=>i.level==='warn').length;
            const infoCount = issues.filter(i=>i.level==='info').length;

            const summaryEl = document.getElementById('adminScanSummary');
            if (summaryEl) {
                summaryEl.style.display = 'grid';
                summaryEl.innerHTML =
                    `<div style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);border-radius:10px;padding:12px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#ef4444;">${errCount}</div>
                        <div style="font-size:11px;color:#6b7280;">Erreurs critiques</div></div>
                    <div style="background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.2);border-radius:10px;padding:12px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#f59e0b;">${warnCount}</div>
                        <div style="font-size:11px;color:#6b7280;">Avertissements</div></div>
                    <div style="background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:10px;padding:12px;text-align:center;">
                        <div style="font-size:22px;font-weight:700;color:#3b82f6;">${infoCount}</div>
                        <div style="font-size:11px;color:#6b7280;">Informations</div></div>`;
            }

            const panel = document.getElementById('adminInconsistenciesPanel');
            if (!issues.length) {
                panel.innerHTML = `<div style="text-align:center;padding:20px;color:var(--success);"><i class="fas fa-check-circle" style="font-size:28px;margin-bottom:8px;display:block;"></i><strong>Aucune incohérence détectée.</strong><div style="font-size:13px;color:var(--gray);margin-top:4px;">Les données sont cohérentes.</div></div>`;
                return;
            }

            const colors = { err:'#ef4444', warn:'#f59e0b', info:'#3b82f6' };
            const icons  = { err:'fas fa-times-circle', warn:'fas fa-exclamation-triangle', info:'fas fa-info-circle' };
            const levelLabel = { err:'Critique', warn:'Avertissement', info:'Info' };

            panel.innerHTML = issues.map((iss,i) => `
                <div style="display:flex;gap:12px;align-items:flex-start;padding:12px 14px;margin-bottom:8px;border-radius:10px;background:rgba(${iss.level==='err'?'239,68,68':iss.level==='warn'?'245,158,11':'59,130,246'},.06);border:1px solid rgba(${iss.level==='err'?'239,68,68':iss.level==='warn'?'245,158,11':'59,130,246'},.2);">
                    <div style="width:32px;height:32px;border-radius:8px;background:rgba(${iss.level==='err'?'239,68,68':iss.level==='warn'?'245,158,11':'59,130,246'},.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="${icons[iss.level]}" style="color:${colors[iss.level]};font-size:14px;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
                            <span style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${colors[iss.level]};">${levelLabel[iss.level]}</span>
                        </div>
                        <div style="font-weight:600;font-size:13px;color:var(--text);">${iss.msg}</div>
                        ${iss.details ? `<div style="font-size:11px;color:var(--gray);margin-top:4px;line-height:1.5;">${iss.details}</div>` : ''}
                    </div>
                </div>`).join('');

            adminLog('scan', `🔍 Scan : ${errCount} erreur(s), ${warnCount} avertissement(s), ${infoCount} info(s)`);
        }

        // â”€â”€ Sauvegardes locales â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminCreateBackup(silent = false) {
            try {
                const backups = JSON.parse(localStorage.getItem('SYGIM_BACKUPS') || '[]');
                const snap = {
                    id:         Date.now(),
                    createdAt:  new Date().toISOString(),
                    label:      new Date().toLocaleString('fr-FR'),
                    clients:    clientsData.slice(),
                    owners:     (ownersData||[]).slice(),
                    properties: (propertiesData||[]).slice(),
                    collectors: (collectorsData||[]).slice()
                };
                backups.unshift(snap);
                if (backups.length > 5) backups.length = 5; // max 5
                localStorage.setItem('SYGIM_BACKUPS', JSON.stringify(backups));
                adminLog('backup', `ðŸ’¾ Sauvegarde créée : ${snap.label}`);
                if (!silent) {
                    adminRefreshBackupList();
                    showAlert && showAlert('✓ Sauvegarde créée avec succès', 'success');
                }
            } catch(e) {
                if (!silent) showAlert && showAlert('âŒ Impossible de créer la sauvegarde (espace insuffisant ?)', 'error');
            }
        }

        function adminRefreshBackupList() {
            const container = document.getElementById('adminBackupList');
            if (!container) return;
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('SYGIM_BACKUPS') || '[]'); } catch(e) {}

            if (!backups.length) {
                container.innerHTML = '<div style="text-align:center;color:var(--gray);padding:20px;font-size:13px;"><i class="fas fa-archive" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px;"></i>Aucune sauvegarde disponible.</div>';
                return;
            }

            container.innerHTML = backups.map((b, i) => `
                <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--surface-alt);">
                    <div style="width:34px;height:34px;border-radius:8px;background:rgba(99,102,241,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                        <i class="fas fa-save" style="color:var(--primary);font-size:14px;"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:600;">Sauvegarde #${backups.length - i}</div>
                        <div style="font-size:11px;color:var(--gray);">${new Date(b.createdAt).toLocaleString('fr-FR')} · ${b.clients?.length||0} clients · ${b.owners?.length||0} propriétaires</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button class="btn btn-outline btn-small" onclick="adminRestoreBackup(${b.id})" title="Restaurer"><i class="fas fa-undo"></i></button>
                        <button class="btn btn-outline btn-small" onclick="adminDownloadBackup(${b.id})" title="Télécharger"><i class="fas fa-download"></i></button>
                        <button class="btn btn-outline btn-small" style="color:var(--danger);border-color:var(--danger);" onclick="adminDeleteBackup(${b.id})" title="Supprimer"><i class="fas fa-trash"></i></button>
                    </div>
                </div>`).join('');
        }

        function adminRestoreBackup(id) {
            if (!confirm('⚠️ Restaurer cette sauvegarde ? Les données actuelles seront remplacées.')) return;
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('SYGIM_BACKUPS') || '[]'); } catch(e) {}
            const b = backups.find(x=>x.id===id);
            if (!b) return;
            adminCreateBackup(true); // snapshot avant restauration
            if (b.clients)    { clientsData.length=0;    b.clients.forEach(c=>clientsData.push(c)); }
            if (b.owners)     { ownersData.length=0;     b.owners.forEach(o=>ownersData.push(o)); }
            if (b.properties) { propertiesData.length=0; b.properties.forEach(p=>propertiesData.push(p)); }
            if (b.collectors) { collectorsData.length=0; b.collectors.forEach(c=>collectorsData.push(c)); }
            if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
            adminLog('restore', `â™»ï¸ Restauration sauvegarde du ${new Date(b.createdAt).toLocaleString('fr-FR')}`);
            adminRefreshDataTab();
            document.getElementById('restoreResultMsg') && (document.getElementById('restoreResultMsg').innerHTML = '<span style="color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> Restauration réussie.</span>');
            showAlert && showAlert('✓ Données restaurées avec succès', 'success');
        }

        function adminDownloadBackup(id) {
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('SYGIM_BACKUPS') || '[]'); } catch(e) {}
            const b = backups.find(x=>x.id===id);
            if (!b) return;
            const blob = new Blob([JSON.stringify(b, null, 2)], { type:'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `SYGIM_backup_${new Date(b.createdAt).toLocaleDateString('fr-FR').replace(/\//g,'-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
        }

        function adminDeleteBackup(id) {
            if (!confirm('Supprimer cette sauvegarde ?')) return;
            let backups = [];
            try { backups = JSON.parse(localStorage.getItem('SYGIM_BACKUPS') || '[]'); } catch(e) {}
            const filtered = backups.filter(b=>b.id!==id);
            localStorage.setItem('SYGIM_BACKUPS', JSON.stringify(filtered));
            adminRefreshBackupList();
        }

        function adminRestoreFromFile(e) {
            const file = e.target?.files?.[0];
            if (!file) return;
            if (!file.name.endsWith('.json')) {
                showAlert && showAlert('âŒ Format non supporté. Utilisez un fichier .json', 'error');
                return;
            }
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const data = JSON.parse(ev.target.result);
                    window._importData = data;
                    const modeEl = document.getElementById('importMode');
                    if (modeEl) modeEl.value = 'replace';
                    adminConfirmImport();
                    const msgEl = document.getElementById('restoreResultMsg');
                    if (msgEl) msgEl.innerHTML = '<span style="color:var(--success);font-weight:600;"><i class="fas fa-check-circle"></i> Restauration depuis fichier réussie.</span>';
                } catch(err) {
                    showAlert && showAlert('âŒ Fichier JSON invalide : ' + err.message, 'error');
                }
            };
            reader.readAsText(file);
        }

        // ============================================================
        // PANEL ADMIN — PARAMÈTRES (complet)
        // ============================================================

        const SYGIM_SETTINGS = {
            defaultCommType:'percentage', defaultRate:10, defaultFixed:0,
            minCommission:0, maxCommission:30,
            lateAlertDays:5, overdueDays:15, reminderFreq:'weekly',
            alertOverdue:true, alertPaymentDay:true,
            companyName:'SYGIM', companyAbbr:'SYGIM', companyEmail:'', companyPhone:'', companyAddress:'', currency:'XOF',
            minPwdLength:6, forceStrongPwd:false, logAllActions:true, lockout:false, maintenanceMode:false,
            language:'fr', pageSize:20, dateFormat:'dd/mm/yyyy', darkDefault:false, animations:true,
            defaultCollectDay:'', gracePeriod:5, lateFee:0, autoDisburse:false
        };

        function adminSelectSettingCommType(type) {
            const rateBlock  = document.getElementById('settingRateBlock');
            const fixedBlock = document.getElementById('settingFixedBlock');
            const percCard   = document.getElementById('sRadioPercCard');
            const fixedCard  = document.getElementById('sRadioFixedCard');
            const dotPerc    = document.getElementById('sDotPerc');
            const dotFixed   = document.getElementById('sDotFixed');

            if (type === 'percentage') {
                rateBlock.style.display  = 'block';
                fixedBlock.style.display = 'none';
                percCard.style.borderColor  = 'var(--primary)';
                percCard.style.background   = 'rgba(99,102,241,.07)';
                fixedCard.style.borderColor = 'var(--border)';
                fixedCard.style.background  = 'transparent';
                if (dotPerc)  dotPerc.style.cssText  = 'width:10px;height:10px;border-radius:50%;background:var(--primary);display:block;';
                if (dotFixed) dotFixed.style.cssText = 'width:10px;height:10px;border-radius:50%;background:transparent;display:block;';
            } else {
                rateBlock.style.display  = 'none';
                fixedBlock.style.display = 'block';
                fixedCard.style.borderColor = 'var(--success)';
                fixedCard.style.background  = 'rgba(16,185,129,.07)';
                percCard.style.borderColor  = 'var(--border)';
                percCard.style.background   = 'transparent';
                if (dotFixed) dotFixed.style.cssText = 'width:10px;height:10px;border-radius:50%;background:var(--success);display:block;';
                if (dotPerc)  dotPerc.style.cssText  = 'width:10px;height:10px;border-radius:50%;background:transparent;display:block;';
            }
            SYGIM_SETTINGS.defaultCommType = type;
        }

        function adminSaveSettings() {
            const g = id => document.getElementById(id);
            SYGIM_SETTINGS.defaultCommType    = SYGIM_SETTINGS.defaultCommType || 'percentage';
            SYGIM_SETTINGS.defaultRate        = parseFloat(g('settingDefaultRate')?.value) || 10;
            SYGIM_SETTINGS.defaultFixed       = parseFloat(g('settingDefaultFixed')?.value) || 0;
            SYGIM_SETTINGS.minCommission      = parseFloat(g('settingMinCommission')?.value) || 0;
            SYGIM_SETTINGS.maxCommission      = parseFloat(g('settingMaxCommission')?.value) || 30;
            SYGIM_SETTINGS.lateAlertDays      = parseInt(g('settingLateAlertDays')?.value) || 5;
            SYGIM_SETTINGS.overdueDays        = parseInt(g('settingOverdueDays')?.value) || 15;
            SYGIM_SETTINGS.reminderFreq       = g('settingReminderFreq')?.value || 'weekly';
            SYGIM_SETTINGS.alertOverdue       = g('settingAlertOverdue')?.checked !== false;
            SYGIM_SETTINGS.alertPaymentDay    = g('settingAlertPaymentDay')?.checked !== false;
            SYGIM_SETTINGS.companyName        = g('settingCompanyName')?.value || 'SYGIM';
            SYGIM_SETTINGS.companyAbbr        = g('settingCompanyAbbr')?.value || 'SYGIM';
            SYGIM_SETTINGS.companyEmail       = g('settingCompanyEmail')?.value || '';
            SYGIM_SETTINGS.companyPhone       = g('settingCompanyPhone')?.value || '';
            SYGIM_SETTINGS.companyAddress     = g('settingCompanyAddress')?.value || '';
            SYGIM_SETTINGS.currency           = g('settingCurrency')?.value || 'XOF';
            SYGIM_SETTINGS.minPwdLength       = parseInt(g('settingMinPwdLength')?.value) || 6;
            SYGIM_SETTINGS.forceStrongPwd     = g('settingForceStrongPwd')?.checked || false;
            SYGIM_SETTINGS.logAllActions      = g('settingLogAllActions')?.checked !== false;
            SYGIM_SETTINGS.lockout            = g('settingLockout')?.checked || false;
            SYGIM_SETTINGS.maintenanceMode    = g('settingMaintenanceMode')?.checked || false;
            SYGIM_SETTINGS.language           = g('settingLanguage')?.value || 'fr';
            SYGIM_SETTINGS.pageSize           = parseInt(g('settingPageSize')?.value) || 20;
            SYGIM_SETTINGS.dateFormat         = g('settingDateFormat')?.value || 'dd/mm/yyyy';
            SYGIM_SETTINGS.darkDefault        = g('settingDarkDefault')?.checked || false;
            SYGIM_SETTINGS.animations         = g('settingAnimations')?.checked !== false;
            SYGIM_SETTINGS.defaultCollectDay  = g('settingDefaultCollectDay')?.value || '';
            SYGIM_SETTINGS.gracePeriod        = parseInt(g('settingGracePeriod')?.value) || 5;
            SYGIM_SETTINGS.lateFee            = parseFloat(g('settingLateFee')?.value) || 0;
            SYGIM_SETTINGS.autoDisburse       = g('settingAutoDisburse')?.checked || false;

            try { localStorage.setItem('SYGIM_SETTINGS', JSON.stringify(SYGIM_SETTINGS)); } catch(e) {}
            adminLog('settings', 'âš™ï¸ Paramètres enregistrés');

            const banner = document.getElementById('settingsSavedBanner');
            if (banner) { banner.style.display = 'block'; setTimeout(()=>banner.style.display='none', 3000); }
        }

        function adminResetSettings() {
            if (!confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) return;
            try { localStorage.removeItem('SYGIM_SETTINGS'); } catch(e) {}
            Object.assign(SYGIM_SETTINGS, {
                defaultCommType:'percentage', defaultRate:10, defaultFixed:0, minCommission:0, maxCommission:30,
                lateAlertDays:5, overdueDays:15, reminderFreq:'weekly', alertOverdue:true, alertPaymentDay:true,
                companyName:'SYGIM', companyAbbr:'SYGIM', companyEmail:'', companyPhone:'', companyAddress:'', currency:'XOF',
                minPwdLength:6, forceStrongPwd:false, logAllActions:true, lockout:false, maintenanceMode:false,
                language:'fr', pageSize:20, dateFormat:'dd/mm/yyyy', darkDefault:false, animations:true,
                defaultCollectDay:'', gracePeriod:5, lateFee:0, autoDisburse:false
            });
            adminLoadSettings();
            showAlert && showAlert('✓ Paramètres réinitialisés', 'success');
        }

        function adminLoadSettings() {
            try {
                const saved = JSON.parse(localStorage.getItem('SYGIM_SETTINGS') || '{}');
                Object.assign(SYGIM_SETTINGS, saved);
            } catch(e) {}

            const g = id => document.getElementById(id);
            const setVal = (id, val) => { const el = g(id); if (el) el.value = val; };
            const setCk  = (id, val) => { const el = g(id); if (el) el.checked = val; };

            setVal('settingDefaultRate',      SYGIM_SETTINGS.defaultRate);
            setVal('settingDefaultFixed',     SYGIM_SETTINGS.defaultFixed);
            setVal('settingMinCommission',    SYGIM_SETTINGS.minCommission);
            setVal('settingMaxCommission',    SYGIM_SETTINGS.maxCommission);
            setVal('settingLateAlertDays',    SYGIM_SETTINGS.lateAlertDays);
            setVal('settingOverdueDays',      SYGIM_SETTINGS.overdueDays);
            setVal('settingReminderFreq',     SYGIM_SETTINGS.reminderFreq);
            setVal('settingCompanyName',      SYGIM_SETTINGS.companyName);
            setVal('settingCompanyAbbr',      SYGIM_SETTINGS.companyAbbr);
            setVal('settingCompanyEmail',     SYGIM_SETTINGS.companyEmail);
            setVal('settingCompanyPhone',     SYGIM_SETTINGS.companyPhone);
            setVal('settingCompanyAddress',   SYGIM_SETTINGS.companyAddress);
            setVal('settingCurrency',         SYGIM_SETTINGS.currency);
            setVal('settingMinPwdLength',     SYGIM_SETTINGS.minPwdLength);
            setVal('settingLanguage',         SYGIM_SETTINGS.language);
            setVal('settingPageSize',         SYGIM_SETTINGS.pageSize);
            setVal('settingDateFormat',       SYGIM_SETTINGS.dateFormat);
            setVal('settingDefaultCollectDay',SYGIM_SETTINGS.defaultCollectDay);
            setVal('settingGracePeriod',      SYGIM_SETTINGS.gracePeriod);
            setVal('settingLateFee',          SYGIM_SETTINGS.lateFee);
            const rng = g('settingMinPwdLengthRange'); if (rng) rng.value = SYGIM_SETTINGS.minPwdLength;

            setCk('settingAlertOverdue',    SYGIM_SETTINGS.alertOverdue);
            setCk('settingAlertPaymentDay', SYGIM_SETTINGS.alertPaymentDay);
            setCk('settingForceStrongPwd',  SYGIM_SETTINGS.forceStrongPwd);
            setCk('settingLogAllActions',   SYGIM_SETTINGS.logAllActions);
            setCk('settingLockout',         SYGIM_SETTINGS.lockout);
            setCk('settingMaintenanceMode', SYGIM_SETTINGS.maintenanceMode);
            setCk('settingDarkDefault',     SYGIM_SETTINGS.darkDefault);
            setCk('settingAnimations',      SYGIM_SETTINGS.animations);
            setCk('settingAutoDisburse',    SYGIM_SETTINGS.autoDisburse);

            adminSelectSettingCommType(SYGIM_SETTINGS.defaultCommType);
        }

        // ============================================================
        // PANEL ADMIN — TABLEAU DE BORD
        // ============================================================

        function adminRefreshDashboard() {
            _adminBuildKpis();
            _adminBuildAlerts();
            _adminBuildRecentLogs();
            _adminBuildRoleChart();
            _adminBuildClientStatus();
            _adminBuildIndicators();
        }

        function _adminBuildKpis() {
            const totalRent   = clientsData.reduce((s,c) => s+(c.rent||0), 0);
            const totalPaid   = clientsData.reduce((s,c) => s+(c.amountPaid||0), 0);
            const tauxR       = totalRent > 0 ? Math.round(totalPaid/totalRent*100) : 0;
            const overdueN    = clientsData.filter(c=>c.status==='overdue').length;
            const totalProps  = (propertiesData||[]).length;
            const rentedProps = (propertiesData||[]).filter(p=>p.status==='loue'||p.status==='partiel').length;
            const tauxOcc     = totalProps > 0 ? Math.round(rentedProps/totalProps*100) : 0;
            const users       = Object.keys(USER_ACCOUNTS).length;
            const kpis = [
                { icon:'fas fa-users',          color:'#6366f1', bg:'rgba(99,102,241,.12)',  label:'Clients',          val: clientsData.length },
                { icon:'fas fa-building',        color:'#10b981', bg:'rgba(16,185,129,.12)',  label:'Propriétaires',    val: (ownersData||[]).length },
                { icon:'fas fa-home',            color:'#f59e0b', bg:'rgba(245,158,11,.12)',  label:'Biens',            val: totalProps },
                { icon:'fas fa-exclamation',     color:'#ef4444', bg:'rgba(239,68,68,.12)',   label:'En retard',        val: overdueN },
                { icon:'fas fa-chart-pie',       color:'#10b981', bg:'rgba(16,185,129,.12)',  label:'Taux recouvr.',    val: tauxR+'%' },
                { icon:'fas fa-door-open',       color:'#f59e0b', bg:'rgba(245,158,11,.12)',  label:'Taux occupation',  val: tauxOcc+'%' },
                { icon:'fas fa-money-bill-wave', color:'#6366f1', bg:'rgba(99,102,241,.12)',  label:'Loyers/mois',      val: totalRent.toLocaleString()+' XOF' },
                { icon:'fas fa-user-shield',     color:'#8b5cf6', bg:'rgba(139,92,246,.12)',  label:'Utilisateurs',     val: users },
            ];
            const el = document.getElementById('adminDashKpis');
            if (!el) return;
            el.innerHTML = kpis.map(k => `
                <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px;transition:.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                        <div style="width:34px;height:34px;border-radius:9px;background:${k.bg};display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                            <i class="${k.icon}" style="color:${k.color};font-size:14px;"></i>
                        </div>
                        <div style="font-size:11px;color:var(--gray);">${k.label}</div>
                    </div>
                    <div style="font-size:20px;font-weight:800;color:var(--text);">${k.val}</div>
                </div>`).join('');
        }

        function _adminBuildAlerts() {
            const alerts = [];
            const overdueClients = clientsData.filter(c=>c.status==='overdue');
            if (overdueClients.length) alerts.push({ level:'danger', icon:'fas fa-exclamation-circle', msg:`${overdueClients.length} locataire(s) en retard de paiement` });
            const ownersNoRIB = (ownersData||[]).filter(o=>!o.bankAccount);
            if (ownersNoRIB.length) alerts.push({ level:'warning', icon:'fas fa-university', msg:`${ownersNoRIB.length} propriétaire(s) sans RIB bancaire` });
            const ownersNoDay = (ownersData||[]).filter(o=>!o.paymentDay);
            if (ownersNoDay.length) alerts.push({ level:'warning', icon:'fas fa-calendar-times', msg:`${ownersNoDay.length} propriétaire(s) sans jour de versement` });
            const propsNoOwner = (propertiesData||[]).filter(p=>!(ownersData||[]).find(o=>o.id===p.ownerId));
            if (propsNoOwner.length) alerts.push({ level:'danger', icon:'fas fa-unlink', msg:`${propsNoOwner.length} bien(s) sans propriétaire lié` });
            const failedLogins = adminActivityLog.filter(e=>e.type==='login'&&e.message.includes('âŒ')).slice(-5);
            if (failedLogins.length >= 3) alerts.push({ level:'danger', icon:'fas fa-shield-alt', msg:`${failedLogins.length} tentatives de connexion échouées récentes` });

            const el   = document.getElementById('adminDashAlerts');
            const cnt  = document.getElementById('dashAlertCount');
            if (cnt) { cnt.textContent = alerts.length; cnt.style.background = alerts.length ? '#ef4444' : '#10b981'; }
            if (!el) return;
            el.innerHTML = alerts.length
                ? alerts.map(a => `<div style="display:flex;align-items:flex-start;gap:8px;background:${a.level==='danger'?'rgba(239,68,68,.07)':'rgba(245,158,11,.07)'};border:1px solid ${a.level==='danger'?'rgba(239,68,68,.2)':'rgba(245,158,11,.2)'};border-radius:8px;padding:8px 10px;font-size:12px;">
                    <i class="${a.icon}" style="color:${a.level==='danger'?'#ef4444':'#f59e0b'};margin-top:1px;flex-shrink:0;"></i>
                    <span>${a.msg}</span></div>`).join('')
                : '<div style="text-align:center;color:var(--gray);font-size:13px;padding:16px;"><i class="fas fa-check-circle" style="color:#10b981;font-size:20px;display:block;margin-bottom:6px;"></i>Aucune alerte active</div>';
        }

        function _adminBuildRecentLogs() {
            const el = document.getElementById('adminDashRecentLogs');
            if (!el) return;
            const recent = [...adminActivityLog].reverse().slice(0, 8);
            const faMap = { login:'fas fa-sign-in-alt',logout:'fas fa-sign-out-alt',create:'fas fa-plus',edit:'fas fa-pen',delete:'fas fa-trash',health:'fas fa-heartbeat',export:'fas fa-download',settings:'fas fa-cog',backup:'fas fa-save',restore:'fas fa-undo' };
            const cMap  = { login:'#10b981',logout:'#6b7280',create:'#6366f1',edit:'#f59e0b',delete:'#ef4444',health:'#06b6d4',export:'#3b82f6',settings:'#8b5cf6',backup:'#10b981',restore:'#f59e0b' };
            el.innerHTML = recent.length
                ? recent.map(e => `<div style="display:flex;align-items:flex-start;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border);">
                    <i class="${faMap[e.type]||'fas fa-info'}" style="color:${cMap[e.type]||'var(--gray)'};margin-top:2px;width:12px;flex-shrink:0;"></i>
                    <div style="flex:1;line-height:1.4;">${e.message}</div>
                    <div style="color:var(--gray);white-space:nowrap;font-size:10px;">${e.time}</div>
                </div>`).join('')
                : '<div style="text-align:center;color:var(--gray);font-size:13px;padding:16px;opacity:.5;">Aucune activité</div>';
        }

        function _adminBuildRoleChart() {
            const el = document.getElementById('adminDashRoles');
            if (!el) return;
            const counts = {};
            Object.values(USER_ACCOUNTS).forEach(a => { counts[a.role] = (counts[a.role]||0) + 1; });
            const total = Object.values(counts).reduce((s,v)=>s+v,0) || 1;
            const colors = { admin:'#ef4444',director:'#6366f1',accounting:'#10b981',collector_manager:'#f59e0b',collector:'#3b82f6' };
            el.innerHTML = Object.entries(counts).map(([role,n]) => `
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;">
                        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                            <span>${ROLE_LABELS[role]?.label||role}</span>
                            <strong>${n}</strong>
                        </div>
                        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                            <div style="height:100%;width:${Math.round(n/total*100)}%;background:${colors[role]||'var(--primary)'};border-radius:3px;transition:.4s;"></div>
                        </div>
                    </div>
                </div>`).join('');
        }

        function _adminBuildClientStatus() {
            const el = document.getElementById('adminDashClientStatus');
            if (!el) return;
            const paid    = clientsData.filter(c=>c.status==='paid').length;
            const pending = clientsData.filter(c=>c.status==='pending').length;
            const overdue = clientsData.filter(c=>c.status==='overdue').length;
            const inactive= clientsData.filter(c=>c.status==='inactive').length;
            const total   = clientsData.length || 1;
            const items   = [{label:'Payés',val:paid,color:'#10b981'},{label:'En attente',val:pending,color:'#f59e0b'},{label:'En retard',val:overdue,color:'#ef4444'},{label:'Inactifs',val:inactive,color:'#6b7280'}];
            el.innerHTML = items.map(it => `
                <div style="display:flex;align-items:center;gap:8px;">
                    <div style="flex:1;">
                        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px;">
                            <span>${it.label}</span>
                            <strong style="color:${it.color};">${it.val} <span style="color:var(--gray);font-weight:400;">(${Math.round(it.val/total*100)}%)</span></strong>
                        </div>
                        <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                            <div style="height:100%;width:${Math.round(it.val/total*100)}%;background:${it.color};border-radius:3px;transition:.4s;"></div>
                        </div>
                    </div>
                </div>`).join('');
        }

        function _adminBuildIndicators() {
            const el = document.getElementById('adminDashIndicators');
            if (!el) return;
            const totalRent  = clientsData.reduce((s,c)=>s+(c.rent||0),0);
            const totalPaid  = clientsData.reduce((s,c)=>s+(c.amountPaid||0),0);
            const totalOwned = (ownersData||[]).length;
            const avgComm    = totalOwned > 0 ? ((ownersData||[]).reduce((s,o)=>s+(o.commissionRate||0),0)/totalOwned).toFixed(1) : 0;
            const totalProps = (propertiesData||[]).length;
            const vacants    = (propertiesData||[]).filter(p=>p.status==='vacant'||p.status==='libre').length;
            const items = [
                { label:'Loyers collectés', val: totalPaid.toLocaleString()+' XOF', color:'#10b981' },
                { label:'Loyers attendus',  val: totalRent.toLocaleString()+' XOF', color:'#6366f1' },
                { label:'Comm. moyenne',    val: avgComm+'%',                        color:'#f59e0b' },
                { label:'Biens vacants',    val: vacants+' / '+totalProps,           color: vacants>0?'#ef4444':'#10b981' },
            ];
            el.innerHTML = items.map(it => `
                <div style="display:flex;justify-content:space-between;align-items:center;font-size:13px;padding:6px 0;border-bottom:1px solid var(--border);">
                    <span style="color:var(--gray);">${it.label}</span>
                    <strong style="color:${it.color};">${it.val}</strong>
                </div>`).join('');
        }

        // ============================================================
        // PANEL ADMIN — SÉCURITÉ
        // ============================================================

        function adminRefreshSecurity() {
            _adminBuildSecurityScore();
            _adminBuildFailedLogins();
            _adminBuildAccountAudit();
            // Sync checkboxes avec SYGIM_SETTINGS
            const m = document.getElementById('secMaintenanceMode');
            if (m) m.checked = SYGIM_SETTINGS.maintenanceMode || false;
        }

        function _adminBuildSecurityScore() {
            let score = 0;
            const total = 5;
            // Critère 1 : pas de compte avec MDP par défaut
            const weakPwd = Object.values(USER_ACCOUNTS).filter(a=>a.password&&a.password.length<6).length;
            if (weakPwd === 0) score++;
            // Critère 2 : mode maintenance configurable
            if (typeof SYGIM_SETTINGS !== 'undefined') score++;
            // Critère 3 : journalisation active
            if (SYGIM_SETTINGS.logAllActions) score++;
            // Critère 4 : pas trop de tentatives échouées récentes
            const failN = adminActivityLog.filter(e=>e.type==='login'&&e.message.includes('âŒ')).length;
            if (failN < 5) score++;
            // Critère 5 : au moins 1 admin
            if (Object.values(USER_ACCOUNTS).filter(a=>a.role==='admin').length >= 1) score++;

            const pct  = Math.round(score/total*100);
            const col  = pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
            const lbl  = pct >= 80 ? 'Bonne sécurité' : pct >= 50 ? 'À améliorer' : 'Risques détectés';
            const circ = document.getElementById('securityScoreCircle');
            const val  = document.getElementById('securityScoreValue');
            const lab  = document.getElementById('securityScoreLabel');
            if (circ) circ.style.background = `conic-gradient(${col} 0% ${pct}%, var(--border) ${pct}% 100%)`;
            if (val)  val.textContent = pct+'%';
            if (lab)  { lab.textContent = lbl; lab.style.color = col; }
        }

        function _adminBuildFailedLogins() {
            const el = document.getElementById('securityFailedLogins');
            if (!el) return;
            const fails = adminActivityLog.filter(e=>e.type==='login'&&e.message.includes('âŒ')).reverse().slice(0,10);
            el.innerHTML = fails.length
                ? fails.map(e => `<div style="display:flex;gap:8px;font-size:12px;padding:4px 6px;background:rgba(239,68,68,.06);border-radius:6px;margin-bottom:4px;">
                    <i class="fas fa-times-circle" style="color:#ef4444;margin-top:2px;flex-shrink:0;"></i>
                    <div>${e.message}</div>
                    <div style="margin-left:auto;color:var(--gray);white-space:nowrap;">${e.time}</div></div>`).join('')
                : '<div style="text-align:center;color:var(--gray);font-size:12px;opacity:.6;padding:12px;"><i class="fas fa-check-circle" style="color:#10b981;"></i> Aucune tentative échouée</div>';
        }

        function _adminBuildAccountAudit() {
            const el = document.getElementById('securityAccountAudit');
            if (!el) return;
            const checks = Object.entries(USER_ACCOUNTS).map(([key, acc]) => {
                const issues = [];
                if (!acc.password || acc.password.length < 6) issues.push('MDP trop court');
                if (!acc.displayName) issues.push('Nom manquant');
                if (!acc.role) issues.push('Rôle manquant');
                return { key, acc, issues };
            });
            el.innerHTML = checks.map(c => `
                <div style="display:flex;align-items:center;gap:10px;background:${c.issues.length?'rgba(239,68,68,.05)':'rgba(16,185,129,.05)'};border:1px solid ${c.issues.length?'rgba(239,68,68,.2)':'rgba(16,185,129,.2)'};border-radius:10px;padding:10px 12px;">
                    <div style="width:32px;height:32px;border-radius:8px;background:${adminGetAvatarColor(c.key)}20;color:${adminGetAvatarColor(c.key)};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;flex-shrink:0;">
                        ${(c.acc.displayName||c.key).slice(0,2).toUpperCase()}
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:13px;font-weight:600;">${c.acc.displayName||c.key}</div>
                        <div style="font-size:11px;color:var(--gray);">${ROLE_LABELS[c.acc.role]?.label||c.acc.role||'—'}</div>
                    </div>
                    <div>
                        ${c.issues.length
                            ? c.issues.map(i=>`<span style="background:rgba(239,68,68,.12);color:#ef4444;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600;">${i}</span>`).join(' ')
                            : '<span style="background:rgba(16,185,129,.12);color:#10b981;border-radius:6px;padding:2px 7px;font-size:10px;font-weight:600;"><i class="fas fa-check"></i> OK</span>'
                        }
                    </div>
                </div>`).join('');
        }

        function adminClearFailedLogins() {
            if (!confirm('Effacer l\'historique des tentatives échouées ?')) return;
            adminActivityLog = adminActivityLog.filter(e=>!(e.type==='login'&&e.message.includes('âŒ')));
            _adminBuildFailedLogins();
            adminLog('settings', 'ðŸ§¹ Historique des tentatives échouées effacé');
        }

        function adminToggleMaintenance() {
            const chk = document.getElementById('secMaintenanceMode');
            SYGIM_SETTINGS.maintenanceMode = chk?.checked || false;
            const badge = document.getElementById('adminMaintenanceBadge');
            if (badge) badge.style.display = SYGIM_SETTINGS.maintenanceMode ? 'inline-flex' : 'none';
            const settingChk = document.getElementById('settingMaintenanceMode');
            if (settingChk) settingChk.checked = SYGIM_SETTINGS.maintenanceMode;
            try { localStorage.setItem('SYGIM_SETTINGS', JSON.stringify(SYGIM_SETTINGS)); } catch(e) {}
            adminLog('settings', SYGIM_SETTINGS.maintenanceMode ? 'ðŸ”’ Mode maintenance activé' : 'ðŸ”“ Mode maintenance désactivé');
            showAlert && showAlert(SYGIM_SETTINGS.maintenanceMode ? 'ðŸ”’ Mode maintenance activé' : '✓ Mode maintenance désactivé', 'info');
        }

        function adminApplyPasswordPolicy() {
            const min     = parseInt(document.getElementById('secPwdMin')?.value) || 6;
            const upper   = document.getElementById('secPwdUpper')?.checked || false;
            const num     = document.getElementById('secPwdNum')?.checked || false;
            const special = document.getElementById('secPwdSpecial')?.checked || false;
            SYGIM_SETTINGS.minPwdLength   = min;
            SYGIM_SETTINGS.forceStrongPwd = upper || num || special;
            try { localStorage.setItem('SYGIM_SETTINGS', JSON.stringify(SYGIM_SETTINGS)); } catch(e) {}
            adminLog('settings', `ðŸ” Politique MDP mise à jour : min ${min} car. | Majuscule:${upper} | Chiffre:${num} | Spécial:${special}`);
            showAlert && showAlert('✓ Politique de mot de passe appliquée', 'success');
            _adminBuildSecurityScore();
        }

        // â”€â”€ Scan intégrité données â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminRunDataScan() {
            const el = document.getElementById('dataScanResults');
            if (el) el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--gray);"><i class="fas fa-spinner fa-spin" style="font-size:22px;margin-bottom:8px;display:block;"></i>Scan en cours…</div>';

            setTimeout(() => {
                const issues = [];
                const ok     = [];
                // Biens sans propriétaire
                const orphanProps = (propertiesData||[]).filter(p=>!(ownersData||[]).find(o=>o.id===p.ownerId));
                if (orphanProps.length) issues.push({ icon:'fas fa-unlink', color:'#ef4444', msg:`${orphanProps.length} bien(s) sans propriétaire valide`, fix: null });
                else ok.push('Tous les biens ont un propriétaire');
                // Clients sans bien
                const clientsNoProp = clientsData.filter(c=>c.propertyId && !(propertiesData||[]).find(p=>p.id===c.propertyId));
                if (clientsNoProp.length) issues.push({ icon:'fas fa-home', color:'#f59e0b', msg:`${clientsNoProp.length} client(s) avec un bien supprimé`, fix: null });
                else ok.push('Tous les clients ont un bien valide');
                // Propriétaires sans biens
                const ownersNoBiens = (ownersData||[]).filter(o=>!(propertiesData||[]).find(p=>p.ownerId===o.id));
                if (ownersNoBiens.length) issues.push({ icon:'fas fa-building', color:'#f59e0b', msg:`${ownersNoBiens.length} propriétaire(s) sans bien enregistré`, fix: null });
                // Doublons téléphones clients
                const phones = clientsData.map(c=>c.phone).filter(Boolean);
                const dupPhones = phones.filter((p,i)=>phones.indexOf(p)!==i);
                if (dupPhones.length) issues.push({ icon:'fas fa-phone', color:'#ef4444', msg:`${[...new Set(dupPhones)].length} numéro(s) de téléphone en doublon`, fix: null });
                else ok.push('Aucun doublon de téléphone');
                // Propriétaires sans RIB
                const noRib = (ownersData||[]).filter(o=>!o.bankAccount).length;
                if (noRib) issues.push({ icon:'fas fa-university', color:'#f59e0b', msg:`${noRib} propriétaire(s) sans RIB bancaire`, fix: null });

                const html = `
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
                        <div style="background:${issues.length?'rgba(239,68,68,.06)':'rgba(16,185,129,.06)'};border:1px solid ${issues.length?'rgba(239,68,68,.2)':'rgba(16,185,129,.2)'};border-radius:10px;padding:14px;text-align:center;">
                            <div style="font-size:24px;font-weight:800;color:${issues.length?'#ef4444':'#10b981'};">${issues.length}</div>
                            <div style="font-size:12px;color:var(--gray);">Problème(s) détecté(s)</div>
                        </div>
                        <div style="background:rgba(16,185,129,.06);border:1px solid rgba(16,185,129,.2);border-radius:10px;padding:14px;text-align:center;">
                            <div style="font-size:24px;font-weight:800;color:#10b981;">${ok.length}</div>
                            <div style="font-size:12px;color:var(--gray);">Vérification(s) passée(s)</div>
                        </div>
                    </div>
                    ${issues.map(i=>`<div style="display:flex;align-items:flex-start;gap:10px;background:rgba(239,68,68,.05);border:1px solid rgba(239,68,68,.15);border-radius:8px;padding:10px 12px;margin-bottom:8px;">
                        <i class="${i.icon}" style="color:${i.color};margin-top:2px;"></i>
                        <span style="font-size:13px;">${i.msg}</span>
                    </div>`).join('')}
                    ${ok.map(o=>`<div style="display:flex;align-items:center;gap:8px;font-size:12px;color:#065f46;padding:6px 10px;background:rgba(16,185,129,.06);border-radius:8px;margin-bottom:6px;">
                        <i class="fas fa-check-circle" style="color:#10b981;"></i> ${o}
                    </div>`).join('')}`;

                if (el) el.innerHTML = html;
                adminLog('scan', `🔍 Scan intégrité : ${issues.length} problème(s) détecté(s)`);
            }, 600);
        }

        // â”€â”€ Réinitialisation totale des données â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminResetAllData() {
            const confirm1 = confirm('⚠️ ATTENTION : Cette action va supprimer TOUTES les données (clients, propriétaires, biens, récolteurs). Cette action est irréversible.\n\nVoulez-vous continuer ?');
            if (!confirm1) return;
            const confirm2 = confirm('Dernière confirmation : Êtes-vous absolument certain de vouloir tout effacer ?');
            if (!confirm2) return;
            adminCreateBackup(true); // snapshot de sécurité
            clientsData.length = 0;
            if (ownersData) ownersData.length = 0;
            if (propertiesData) propertiesData.length = 0;
            if (collectorsData) collectorsData.length = 0;
            if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
            adminLog('delete', 'ðŸ’¥ Réinitialisation complète de toutes les données');
            showAlert && showAlert('✓ Données réinitialisées. Une sauvegarde automatique a été créée.', 'success');
            adminRefreshDataTab();
        }

        // â”€â”€ Import via fichier (handler unifié) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        // (version complète définie plus haut via _parseImportFile)

        // â”€â”€ Export tout en JSON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        function adminExportAll() {
            const data = {
                exportedAt: new Date().toISOString(),
                version: '1.0',
                clients: clientsData,
                owners: ownersData || [],
                properties: propertiesData || [],
                collectors: collectorsData || []
            };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `SYGIM_export_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.json`;
            a.click();
            URL.revokeObjectURL(url);
            adminLog('export', 'ðŸ“¦ Export complet JSON (tous modules)');
        }

        // ============================================================
        // PANEL ADMIN — Logs (version complète avec filtres et stats)
        // ============================================================

        function adminRenderLogs() {
            const container = document.getElementById('adminLogsContainer');
            const search    = (document.getElementById('logSearch')?.value || '').toLowerCase();
            const typeF     = document.getElementById('logTypeFilter')?.value || '';
            const countEl   = document.getElementById('logCount');
            const statsEl   = document.getElementById('logsStatsRow');

            // Stats rapides
            if (statsEl) {
                const types = ['login','logout','create','edit','delete','export','health','settings'];
                const colors = { login:'#10b981',logout:'#6b7280',create:'#6366f1',edit:'#f59e0b',delete:'#ef4444',export:'#3b82f6',health:'#06b6d4',settings:'#8b5cf6' };
                const icons  = { login:'fas fa-sign-in-alt',logout:'fas fa-sign-out-alt',create:'fas fa-plus',edit:'fas fa-pen',delete:'fas fa-trash',export:'fas fa-download',health:'fas fa-heartbeat',settings:'fas fa-cog' };
                const labels = { login:'Connexions',logout:'Déconn.',create:'Créations',edit:'Modifs',delete:'Suppress.',export:'Exports',health:'Diagno.',settings:'Params' };
                statsEl.innerHTML = types.map(t => {
                    const n = adminActivityLog.filter(e=>e.type===t).length;
                    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px;text-align:center;cursor:pointer;" onclick="document.getElementById('logTypeFilter').value='${t}';adminRenderLogs();">
                        <div style="font-size:13px;font-weight:700;color:${colors[t]};">${n}</div>
                        <div style="font-size:10px;color:var(--gray);">${labels[t]}</div>
                    </div>`;
                }).join('');
            }

            let filtered = adminActivityLog;
            if (typeF)   filtered = filtered.filter(e => e.type === typeF);
            if (search)  filtered = filtered.filter(e => e.message.toLowerCase().includes(search) || e.date.includes(search));

            if (countEl) countEl.textContent = `${filtered.length} / ${adminActivityLog.length} entrée(s)`;

            if (!filtered.length) {
                container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--gray);"><i class="fas fa-scroll" style="font-size:28px;opacity:.3;display:block;margin-bottom:10px;"></i>${adminActivityLog.length ? 'Aucun résultat pour ce filtre.' : 'Aucune activité enregistrée.'}</div>`;
                return;
            }

            const iconMap  = { login:'log-login',logout:'log-logout',create:'log-create',edit:'log-edit',delete:'log-delete',health:'log-health',export:'log-export',settings:'log-settings',import:'log-import',backup:'log-backup',restore:'log-restore',scan:'log-health',view:'log-view',view_pwd:'log-view' };
            const faMap    = { login:'fas fa-sign-in-alt',logout:'fas fa-sign-out-alt',create:'fas fa-user-plus',edit:'fas fa-pen',delete:'fas fa-trash',health:'fas fa-heartbeat',export:'fas fa-file-export',settings:'fas fa-cog',import:'fas fa-file-import',backup:'fas fa-save',restore:'fas fa-undo',scan:'fas fa-search',view:'fas fa-eye',view_pwd:'fas fa-key' };

            container.innerHTML = filtered.map(entry => `
                <div class="admin-log-entry" style="display:flex;gap:12px;align-items:flex-start;padding:10px 14px;border-bottom:1px solid var(--border);transition:.15s;" onmouseover="this.style.background='rgba(99,102,241,.04)'" onmouseout="this.style.background='transparent'">
                    <div class="log-icon ${iconMap[entry.type]||'log-login'}" style="flex-shrink:0;">
                        <i class="${faMap[entry.type]||'fas fa-info'}"></i>
                    </div>
                    <div style="flex:1;">
                        <div style="font-size:13px;">${entry.message}</div>
                        <div class="log-time" style="font-size:11px;color:var(--gray);margin-top:2px;">${entry.date} à ${entry.time}</div>
                    </div>
                </div>`).join('');
        }

        function adminClearLogs() {
            if (!confirm('Effacer tout le journal d\'activité ?')) return;
            adminActivityLog = [];
            adminRenderLogs();
        }

        function adminExportLogs() {
            const csv = ['Date,Heure,Type,Message', ...adminActivityLog.map(e =>
                `"${e.date}","${e.time}","${e.type}","${e.message.replace(/"/g,'""')}"`)].join('\n');
            const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' });
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href = url;
            a.download = `SYGIM_logs_${new Date().toLocaleDateString('fr-FR').replace(/\//g,'-')}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            adminLog('export', 'ðŸ“¤ Export du journal d\'activité');
        }



// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// FONCTIONS MANQUANTES — implémentées pour corriger les appels HTML
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// â”€â”€ Statuts overdue automatique â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateOverdueStatuses() {
    clientsData.forEach(c => {
        if (c.status === 'inactive') return;
        if (c.amountDue > 0 && c.amountPaid >= c.amountDue) {
            c.status = 'paid';
        } else if (c.contractStart) {
            const months = calculateLateMonths(c);
            if (months >= 2 && c.status !== 'paid') c.status = 'overdue';
            else if (months >= 1 && c.status !== 'paid') c.status = 'pending';
        }
    });
}

// â”€â”€ Chart paiements â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function initPaymentChart() {
    const ctx = document.getElementById('paymentChart')?.getContext('2d');
    if (!ctx) return;
    const paid    = clientsData.filter(c => c.status === 'paid').length;
    const pending = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue').length;
    const partial = clientsData.filter(c => c.status === 'partial').length;
    if (charts.payment) charts.payment.destroy();
    charts.payment = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Payé', 'En attente', 'Partiel'],
            datasets: [{ data: [paid, pending, partial], backgroundColor: ['#10b981','#f59e0b','#6366f1'] }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// â”€â”€ Chart revenus (update) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateRevenueChart() {
    initRevenueChart();
}

// â”€â”€ Versements propriétaires â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function markOwnerPaid(ownerId) {
    const owner = ownersData.find(o => o.id === ownerId);
    if (!owner) return;
    if (!confirm(`Marquer le versement de ${owner.lastName} ${owner.firstName} comme effectué ?`)) return;
    owner._paymentStatus = 'paid';
    owner._lastPaymentDate = new Date().toLocaleDateString('fr-FR');
    if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
    showAlert(`✓ Versement de ${owner.lastName} ${owner.firstName} confirmé`, 'success');
    loadOwnerPaymentsPage();
}

function viewOwnerPaymentDetail(ownerId) {
    const owner = ownersData.find(o => o.id === ownerId);
    if (!owner) return;
    const ownerClients = clientsData.filter(c => c.ownerId === ownerId);
    const collected    = ownerClients.reduce((s, c) => s + (c.amountPaid||0), 0);
    const isFixed      = owner.commissionType === 'fixed';
    const commission   = isFixed
        ? (owner.commissionFixed || 0)
        : Math.round(collected * ((owner.commissionRate||0) / 100));
    const net          = collected - commission;
    const commLabel    = isFixed
        ? `${commission.toLocaleString()} XOF (montant fixe)`
        : `${commission.toLocaleString()} XOF (${owner.commissionRate || 0}%)`;
    const dayLabel     = owner.paymentDay
        ? (owner.paymentDay === 'dernier' ? 'Dernier jour du mois' : `Le ${owner.paymentDay} du mois`)
        : 'Non fixé';
    const w = window.open('', '_blank', 'width=540,height=420');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Détail versement</title>
    <style>body{font-family:Arial,sans-serif;max-width:500px;margin:30px auto;padding:20px;color:#1f2937}
    h2{color:#6366f1;margin-bottom:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
    td,th{border:1px solid #e5e7eb;padding:10px 14px}th{background:#f9fafb;font-size:12px;color:#6b7280;text-transform:uppercase}
    .total{font-weight:700;color:#10b981}.meta{color:#6b7280;font-size:13px;margin-bottom:4px}
    </style></head><body>
    <h2>📊 Détail du versement</h2>
    <p class="meta"><strong>Propriétaire :</strong> ${owner.lastName} ${owner.firstName}</p>
    <p class="meta"><strong>Dernier versement :</strong> ${owner._lastPaymentDate || 'Jamais'}</p>
    <p class="meta"><strong>Jour de versement prévu :</strong> ${dayLabel}</p>
    <table><thead><tr><th>Désignation</th><th>Montant (XOF)</th></tr></thead><tbody>
    <tr><td>Loyers collectés</td><td>${collected.toLocaleString()}</td></tr>
    <tr><td>Commission SYGIM</td><td>- ${commLabel}</td></tr>
    <tr><td class="total"><strong>Net à verser</strong></td><td class="total"><strong>${net.toLocaleString()}</strong></td></tr>
    </tbody></table>
    </body></html>`);
    w.document.close();
}

function generateOwnerReceipt(ownerId) {
    const owner = ownersData.find(o => o.id === ownerId);
    if (!owner) return;
    const ownerClients = clientsData.filter(c => c.ownerId === ownerId);
    const collected    = ownerClients.reduce((s, c) => s + (c.amountPaid||0), 0);
    const isFixed2     = owner.commissionType === 'fixed';
    const commission   = isFixed2
        ? (owner.commissionFixed || 0)
        : Math.round(collected * ((owner.commissionRate||0) / 100));
    const net          = collected - commission;
    const commDesc     = isFixed2
        ? `Commission SYGIM (montant fixe)`
        : `Commission SYGIM (${owner.commissionRate || 0}%)`;
    const date         = new Date().toLocaleDateString('fr-FR');
    const dayLabel2    = owner.paymentDay
        ? (owner.paymentDay === 'dernier' ? 'Dernier jour du mois' : `Le ${owner.paymentDay} du mois`)
        : 'Non fixé';
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reçu versement</title>
    <style>body{font-family:Arial,sans-serif;max-width:640px;margin:40px auto;padding:20px;color:#1f2937}
    h1{color:#6366f1;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:20px}
    td,th{border:1px solid #e5e7eb;padding:12px 14px}th{background:#f9fafb;font-size:12px;color:#6b7280;text-transform:uppercase;text-align:left}
    .total{font-weight:700;color:#10b981;font-size:16px}.meta{color:#6b7280;font-size:13px;margin:4px 0}
    .footer{margin-top:30px;display:flex;justify-content:space-between;font-size:13px;color:#6b7280}
    </style></head><body>
    <h1>SYGIM — Reçu de Versement</h1>
    <p class="meta"><strong>Date :</strong> ${date}</p>
    <p class="meta"><strong>Propriétaire :</strong> ${owner.lastName} ${owner.firstName}</p>
    <p class="meta"><strong>Jour de versement :</strong> ${dayLabel2}</p>
    <p class="meta"><strong>RIB :</strong> ${owner.bankAccount || 'Non renseigné'}</p>
    <table><thead><tr><th>Désignation</th><th>Montant (XOF)</th></tr></thead><tbody>
    <tr><td>Loyers collectés</td><td>${collected.toLocaleString()}</td></tr>
    <tr><td>${commDesc}</td><td>- ${commission.toLocaleString()}</td></tr>
    <tr><td class="total"><strong>Net versé</strong></td><td class="total"><strong>${net.toLocaleString()}</strong></td></tr>
    </tbody></table>
    <div class="footer"><span>Signature propriétaire : ___________________</span><span>Signature SYGIM : ___________________</span></div>
    </body></html>`);
    w.document.close();
    w.print();
}

// â”€â”€ Dépenses â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function populateExpenseSelects() {
    const ownerOpts = '<option value="">-- Propriétaire --</option>' +
        ownersData.map(o => `<option value="${o.id}">${o.lastName} ${o.firstName}</option>`).join('');
    const propOpts  = '<option value="">-- Bien --</option>' +
        propertiesData.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    ['expenseOwnerSelect'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ownerOpts; });
    ['expensePropertySelect'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = propOpts; });
}

function saveExpenseFiles(expenseId, files) {
    if (!files || !files.length) return;
    const expense = transactionsData.find(t => t.id === expenseId);
    if (expense) {
        expense.files = expense.files || [];
        Array.from(files).forEach(f => expense.files.push({ name: f.name, size: f.size, type: f.type }));
        if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
    }
}

// â”€â”€ Formatage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatNumber(n) {
    if (isNaN(n)) return '0';
    return Number(n).toLocaleString('fr-FR');
}

// â”€â”€ Navigation calendrier paiements par lots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _currentPaymentMonth = new Date();
function changePaymentMonth(delta) {
    _currentPaymentMonth = new Date(_currentPaymentMonth.getFullYear(), _currentPaymentMonth.getMonth() + delta, 1);
    const label = _currentPaymentMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const el = document.getElementById('currentPaymentMonthLabel');
    if (el) el.textContent = label;
    if (typeof loadBatchPaymentClients === 'function') loadBatchPaymentClients(_currentPaymentMonth);
}

// â”€â”€ Onglets Préfinancement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function switchPrefinancementTab(tab) {
    ['prefinancementNewTab', 'prefinancementHistoryTab'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('active', id === `prefinancement${tab.charAt(0).toUpperCase()+tab.slice(1)}Tab`);
    });
    document.querySelectorAll('#prefinancementModal .tab').forEach(t => {
        t.classList.toggle('active', t.getAttribute('onclick')?.includes(`'${tab}'`));
    });
    if (tab === 'history') loadPrefinancementHistory();
}

function loadPrefinancementHistory() {
    const tbody = document.getElementById('prefinancementHistoryTable')?.querySelector('tbody') ||
                  document.getElementById('prefinancementHistoryTable');
    if (!tbody) return;
    const history = transactionsData.filter(t => t.type === 'prefinancement');
    if (!history.length) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--gray);">Aucun préfinancement enregistré</td></tr>';
        return;
    }
    tbody.innerHTML = history.map(t => `
        <tr>
            <td>${t.date}</td>
            <td>${ownersData.find(o=>o.id===t.ownerId)?.lastName || '—'}</td>
            <td class="xof">${(t.amount||0).toLocaleString()}</td>
            <td>${t.months || '—'} mois</td>
            <td>${t.interest || '0'}%</td>
            <td><span class="status-badge ${t.status||'pending'}">${t.status==='paid'?'Remboursé':'En cours'}</span></td>
        </tr>`).join('');
}

// â”€â”€ Modal propriété (manager) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function openPropertyModalForManager() {
    // Pré-remplir le select des propriétaires dans le modal manager
    const propOwnerEl = document.getElementById('propOwner');
    if (propOwnerEl && ownersData && ownersData.length > 0) {
        if (propOwnerEl.options.length <= 1) {
            ownersData.forEach(o => {
                const opt = document.createElement('option');
                opt.value = o.id;
                opt.textContent = o.lastName + ' ' + o.firstName;
                propOwnerEl.appendChild(opt);
            });
        }
    }
    // Réinitialiser le formulaire
    const form = document.getElementById('managerPropertyForm');
    if (form) form.reset();
    const infoBox = document.getElementById('propOwnerContractInfo');
    if (infoBox) infoBox.style.display = 'none';
    const chk = document.getElementById('propUseCustomCommission');
    if (chk) { chk.checked = false; togglePropCommissionField(); }
    openModal('managerPropertyModal');
}

// â”€â”€ Champs spécifiques type de propriété â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function togglePropertySpecificFields() {
    const type = document.getElementById('propType')?.value;
    const fields = {
        appartement: ['propFloor','propRooms','propArea'],
        immeuble:    ['propFloors','propUnitsPerFloor'],
        quartier:    ['propTotalUnits'],
        commercial:  ['propSurface']
    };
    // Masquer tous
    ['propFloor','propRooms','propArea','propFloors','propUnitsPerFloor','propTotalUnits','propSurface'].forEach(id => {
        const wrap = document.getElementById(id + 'Wrap') || document.getElementById(id)?.closest('.form-group');
        if (wrap) wrap.style.display = 'none';
    });
    // Afficher ceux du type courant
    (fields[type] || []).forEach(id => {
        const wrap = document.getElementById(id + 'Wrap') || document.getElementById(id)?.closest('.form-group');
        if (wrap) wrap.style.display = '';
    });
}

// â”€â”€ Compteur biens propriétaire â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function updateOwnerPropertiesCount() {
    const ownerId  = parseInt(document.getElementById('propOwner')?.value);
    const owner    = ownersData.find(o => o.id === ownerId);
    const count    = propertiesData.filter(p => p.ownerId === ownerId).length;
    const countEl  = document.getElementById('ownerPropertiesCount');
    if (countEl) countEl.textContent = `${count} bien(s) déjà enregistré(s)`;

    // Fiche contrat du propriétaire
    const infoBox = document.getElementById('propOwnerContractInfo');
    if (!infoBox) return;

    if (!owner) {
        infoBox.style.display = 'none';
        return;
    }
    infoBox.style.display = 'block';

    // Commission par défaut
    const commEl = document.getElementById('ownerContractCommission');
    if (commEl) {
        if (owner.commissionType === 'fixed') {
            commEl.textContent = `${(owner.commissionFixed || 0).toLocaleString()} XOF fixe`;
        } else {
            commEl.textContent = `${owner.commissionRate || 10} %`;
        }
    }

    // Jour de versement
    const dayEl = document.getElementById('ownerContractPayDay');
    if (dayEl) {
        dayEl.textContent = owner.paymentDay ? `${owner.paymentDay} du mois` : 'Non fixé';
    }

    // Nb biens
    const propCountEl = document.getElementById('ownerContractPropCount');
    if (propCountEl) propCountEl.textContent = count;

    // Mettre à jour le label commission par défaut dans la section bien
    const defLabel = document.getElementById('propDefaultCommLabel');
    if (defLabel) {
        if (owner.commissionType === 'fixed') {
            defLabel.textContent = `${(owner.commissionFixed || 0).toLocaleString()} XOF (montant fixe — contrat initial)`;
        } else {
            defLabel.textContent = `${owner.commissionRate || 10}% (contrat initial)`;
        }
        const hint = defLabel.nextElementSibling;
        if (hint) hint.style.display = 'none';
    }

    // Reset le formulaire commission si l'owner change
    const chk = document.getElementById('propUseCustomCommission');
    if (chk) { chk.checked = false; togglePropCommissionField(); }
}

// Toggle les champs commission dérogatoire
function togglePropCommissionField() {
    const chk       = document.getElementById('propUseCustomCommission');
    const fields    = document.getElementById('propCustomCommFields');
    const defInfo   = document.getElementById('propDefaultCommInfo');
    const banner    = document.getElementById('ownerAvenantBanner');
    const motifWrap = document.getElementById('propAvenantReasonWrapper');
    if (!chk || !fields) return;

    if (chk.checked) {
        fields.style.display  = 'block';
        defInfo.style.display = 'none';
        if (banner)    banner.style.display    = 'block';
        if (motifWrap) motifWrap.style.display = 'block';
    } else {
        fields.style.display  = 'none';
        defInfo.style.display = 'block';
        if (banner)    banner.style.display    = 'none';
        if (motifWrap) motifWrap.style.display = 'none';
        // Réinitialiser le champ motif
        const motifEl = document.getElementById('propAvenantReason');
        if (motifEl) motifEl.value = '';
    }
}

// Quand type % / fixe change dans le formulaire bien
function onPropCommTypeChange() {
    const type     = document.getElementById('propCommissionType')?.value;
    const percW    = document.getElementById('propCommPercWrapper');
    const fixedW   = document.getElementById('propCommFixedWrapper');
    if (!percW || !fixedW) return;
    percW.style.display  = type === 'fixed' ? 'none' : 'block';
    fixedW.style.display = type === 'fixed' ? 'block' : 'none';
    checkCommissionDeviation();
}

// Vérifie si la commission saisie déroge et met à jour le bandeau
function checkCommissionDeviation() {
    const ownerId = parseInt(document.getElementById('propOwner')?.value);
    const owner   = ownersData.find(o => o.id === ownerId);
    if (!owner) return;
    const type     = document.getElementById('propCommissionType')?.value;
    const rateVal  = parseFloat(document.getElementById('propCommissionRate')?.value);
    const fixedVal = parseFloat(document.getElementById('propCommissionFixed')?.value);
    const banner   = document.getElementById('ownerAvenantBanner');
    if (!banner) return;

    let deviates = false;
    if (type === 'percentage' && !isNaN(rateVal)) {
        deviates = (owner.commissionType !== 'fixed') && (rateVal !== (owner.commissionRate || 10));
    } else if (type === 'fixed' && !isNaN(fixedVal)) {
        deviates = true; // fixe vs contrat = toujours un avenant
    }
    banner.style.display = deviates ? 'block' : 'none';
}

// â”€â”€ Commission settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function saveCommissionSettings() {
    const ownerId   = parseInt(document.getElementById('commissionOwnerSelect')?.value);
    const rate      = parseFloat(document.getElementById('commissionRate')?.value);
    const payDay    = document.getElementById('commissionPayDay')?.value;
    if (!ownerId || isNaN(rate)) { showAlert('Remplissez tous les champs', 'error'); return; }
    const owner = ownersData.find(o => o.id === ownerId);
    if (owner) {
        owner.commissionRate = rate;
        if (payDay) owner.paymentDay = payDay;
        if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
        showAlert(`✓ Paramètres de commission mis à jour pour ${owner.lastName}`, 'success');
        loadOwnersList();
    }
}

function loadOwnerCommissionInfo() {
    const ownerId = parseInt(document.getElementById('commissionOwnerSelect')?.value);
    const owner   = ownersData.find(o => o.id === ownerId);
    if (!owner) return;
    const rateEl  = document.getElementById('commissionRate');
    const dayEl   = document.getElementById('commissionPayDay');
    if (rateEl) rateEl.value = owner.commissionRate || 10;
    if (dayEl)  dayEl.value  = owner.paymentDay || '';
}

// â”€â”€ Rapports agent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function printAgentReport() { window.print(); }

function sendAgentReport() {
    const email = prompt('Adresse email du destinataire :');
    if (email) showAlert(`ðŸ“§ Rapport envoyé à ${email} (simulation)`, 'info');
}

function exportAgentReport() {
    const agentEl = document.getElementById('agentReportSelect');
    const agentId = agentEl ? agentEl.value : null;
    const agent   = agentId ? collectorsData.find(c => c.id == agentId) : null;
    const name    = agent ? `${agent.lastName}_${agent.firstName}` : 'tous_agents';
    const data    = { generated: new Date().toISOString(), agent: name, clients: clientsData.filter(c => !agent || c.agent === agent.lastName) };
    const blob    = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url     = URL.createObjectURL(blob);
    const a       = document.createElement('a');
    a.href = url; a.download = `rapport_${name}_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
}

// â”€â”€ Export listes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function exportManagerProperties() { exportProperties(); }

function exportOwnerPortfolio() {
    const data  = ownersData.map(o => ({ ...o, biens: propertiesData.filter(p=>p.ownerId===o.id).length }));
    const blob  = new Blob([JSON.stringify(data,null,2)], { type:'application/json' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a'); a.href=url; a.download='portefeuille_proprietaires.json'; a.click();
    URL.revokeObjectURL(url);
}

function exportPaymentSchedule() {
    const rows  = clientsData.map(c => `${c.lastName};${c.firstName};${c.amountDue};${c.amountPaid};${c.status}`);
    const csv   = 'Nom;Prénom;Loyer Dû;Payé;Statut\n' + rows.join('\n');
    const blob  = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url   = URL.createObjectURL(blob);
    const a     = document.createElement('a'); a.href=url; a.download='echeancier.csv'; a.click();
    URL.revokeObjectURL(url);
}

function filterOwnerProperties(status) {
    const ownerId = parseInt(document.getElementById('ownerSelect')?.value);
    let props = propertiesData.filter(p => p.ownerId === ownerId || !ownerId);
    if (status !== 'all') props = props.filter(p => p.status === status);
    const container = document.getElementById('ownerPropertiesList');
    if (!container) return;
    container.innerHTML = props.map(p => `
        <div class="property-item"><strong>${p.name}</strong> — <span class="status-badge ${getPropertyStatusClass(p.status)}">${getPropertyStatusText(p.status)}</span>
        <span class="xof">${(p.value||0).toLocaleString()} XOF</span></div>`).join('') || '<p style="color:var(--gray)">Aucun bien</p>';
    document.querySelectorAll('.property-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${status}'`));
    });
}

// â”€â”€ Paiements en lot â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function processBatchPayments() {
    const month   = _currentPaymentMonth || new Date();
    const pending = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue');
    if (!pending.length) { showAlert('Aucun paiement en attente ce mois', 'info'); return; }
    if (!confirm(`Traiter ${pending.length} paiement(s) en lot pour ${month.toLocaleDateString('fr-FR', {month:'long',year:'numeric'})} ?`)) return;
    let count = 0;
    pending.forEach(c => {
        if (!selectedPaymentMethod) return;
        c.amountPaid += c.amountDue;
        c.status = 'paid';
        transactionsData.unshift({
            id: `BATCH-${Date.now()}-${c.id}`,
            date: new Date().toLocaleDateString('fr-FR'),
            client: `${c.lastName} ${c.firstName}`,
            description: `Paiement en lot — ${month.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})}`,
            amount: c.amountDue,
            method: selectedPaymentMethod,
            reference: `BATCH-${Date.now()}`,
            status: 'paid'
        });
        count++;
    });
    if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
    showAlert(`✓ ${count} paiement(s) traités en lot`, 'success');
    loadDashboard();
}

// â”€â”€ Générateurs de rapports / ordres â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function generatePaymentOrders() {
    const unpaid = clientsData.filter(c => c.status === 'pending' || c.status === 'overdue');
    const csv    = 'Nom;Prénom;Téléphone;Montant Dû;Statut\n' +
        unpaid.map(c => `${c.lastName};${c.firstName};${c.phone};${c.amountDue};${c.status}`).join('\n');
    const blob   = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a'); a.href=url; a.download='ordres_paiement.csv'; a.click();
    URL.revokeObjectURL(url);
    showAlert(`ðŸ“„ ${unpaid.length} ordre(s) de paiement générés`, 'success');
}

// â”€â”€ Recherche locataire dans préfinancement â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function selectLocataireFromSearch() {
    const input = document.getElementById('prefinancementLocataireSearch');
    if (!input) return;
    const term = input.value.trim().toLowerCase();
    const match = clientsData.find(c =>
        `${c.lastName} ${c.firstName}`.toLowerCase().includes(term) ||
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(term)
    );
    if (match) {
        const amountEl = document.getElementById('prefinancementAmount');
        if (amountEl) amountEl.placeholder = `Loyer : ${match.amountDue.toLocaleString()} XOF`;
        input.dataset.selectedId = match.id;
    }
}

// â”€â”€ Hiérarchie biens (immeuble/appartements) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function expandAllHierarchy() {
    document.querySelectorAll('.hierarchy-children').forEach(el => el.style.display = '');
    document.querySelectorAll('.hierarchy-toggle').forEach(el => { el.textContent = 'â–¼'; });
}

function collapseAllHierarchy() {
    document.querySelectorAll('.hierarchy-children').forEach(el => el.style.display = 'none');
    document.querySelectorAll('.hierarchy-toggle').forEach(el => { el.textContent = 'â–¶'; });
}

// â”€â”€ Manager: rafraÃ®chir liste biens â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function refreshPropertyList() {
    if (typeof loadManagerPropertiesTable === 'function') loadManagerPropertiesTable();
    else if (typeof loadPortfolioPage === 'function') loadPortfolioPage();
    showAlert('Liste actualisée', 'success');
}

// â”€â”€ Dashboard propriétaire â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function loadOwnerDashboard(ownerId) {
    if (!ownerId) return;
    const owner   = ownersData.find(o => o.id == ownerId);
    if (!owner) return;
    const clients = clientsData.filter(c => c.ownerId == ownerId);
    const props   = propertiesData.filter(p => p.ownerId == ownerId);
    const total   = clients.reduce((s,c) => s+(c.amountPaid||0), 0);
    const due     = clients.reduce((s,c) => s+(c.amountDue||0), 0);
    const commission = Math.round(total * ((owner.commissionRate||0)/100));
    const el = document.getElementById('ownerDashboardContent');
    if (!el) return;
    el.innerHTML = `
        <div class="stats-grid">
            <div class="stat-card"><div class="stat-label">Biens gérés</div><div class="stat-value">${props.length}</div></div>
            <div class="stat-card success"><div class="stat-label">Loyers collectés</div><div class="stat-value xof">${total.toLocaleString()}</div></div>
            <div class="stat-card warning"><div class="stat-label">Loyers dus</div><div class="stat-value xof">${due.toLocaleString()}</div></div>
            <div class="stat-card info"><div class="stat-label">Commission SYGIM</div><div class="stat-value xof">${commission.toLocaleString()}</div></div>
        </div>`;
}


// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN — RAPPORTS & STATISTIQUES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function adminLoadReports() {
    _adminRenderReportsKpis();
    _adminRenderReportsCharts();
    _adminRenderReportsTopAgents();
    _adminRenderReportsTopOwners();
    _adminRenderReportsRecovery();
    _adminRenderReportsOwnerTable();
}

function _adminRenderReportsKpis() {
    const owners    = ownersData   || [];
    const clients   = clientsData  || [];
    const props     = propertiesData || [];

    const totalDue       = clients.reduce((s,c) => s + (c.amountDue   || 0), 0);
    const totalCollected = clients.reduce((s,c) => s + (c.amountPaid  || 0), 0);
    const totalOverdue   = clients.filter(c => c.status === 'retard' || c.status === 'overdue').reduce((s,c) => s + ((c.amountDue||0)-(c.amountPaid||0)), 0);
    const totalCommission = owners.reduce((s,o) => {
        const oc = clients.filter(c => c.ownerId === o.id).reduce((a,c)=>a+(c.amountPaid||0),0);
        return s + (o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(oc*(o.commissionRate||10)/100));
    }, 0);
    const totalNet  = totalCollected - totalCommission;
    const rateGlobal = totalDue > 0 ? Math.round(totalCollected / totalDue * 100) : 0;

    const kpis = [
        { label:'Loyers attendus',    val: totalDue.toLocaleString() + ' XOF',       icon:'fa-file-invoice-dollar', color:'#6366f1' },
        { label:'Loyers collectés',   val: totalCollected.toLocaleString() + ' XOF', icon:'fa-coins',               color:'#10b981' },
        { label:'Impayés',            val: totalOverdue.toLocaleString() + ' XOF',   icon:'fa-exclamation-circle',  color:'#ef4444' },
        { label:'Commissions SYGIM',  val: totalCommission.toLocaleString() + ' XOF',icon:'fa-percentage',          color:'#f59e0b' },
        { label:'Net propriétaires',  val: totalNet.toLocaleString() + ' XOF',       icon:'fa-wallet',              color:'#8b5cf6' },
        { label:'Taux recouvrement',  val: rateGlobal + ' %',                        icon:'fa-chart-line',          color: rateGlobal >= 80 ? '#10b981' : rateGlobal >= 50 ? '#f59e0b' : '#ef4444' },
    ];

    const el = document.getElementById('reportsKpis');
    if (!el) return;
    el.innerHTML = kpis.map(k => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;transition:.2s;" onmouseenter="this.style.transform='translateY(-2px)'" onmouseleave="this.style.transform=''">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="width:30px;height:30px;background:${k.color}20;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas ${k.icon}" style="color:${k.color};font-size:13px;"></i>
                </span>
                <div style="font-size:11px;color:var(--gray);font-weight:600;">${k.label}</div>
            </div>
            <div style="font-size:18px;font-weight:800;color:${k.color};">${k.val}</div>
        </div>`).join('');
}

function _adminRenderReportsCharts() {
    // Simulation de 6 mois de données basées sur les données réelles
    const clients = clientsData || [];
    const months  = _getLast6Months();
    const totalBase = clients.reduce((s,c) => s+(c.amountPaid||0), 0);
    const avgBase   = totalBase / 6 || 0;

    const rentData = months.map((_,i) => Math.round(avgBase * (0.7 + Math.random()*0.6)));
    const commData = rentData.map(v => Math.round(v * 0.1));

    const maxRent = Math.max(...rentData, 1);
    const maxComm = Math.max(...commData, 1);

    const rentChart  = document.getElementById('reportsRentChart');
    const commChart  = document.getElementById('reportsCommChart');
    const rentLabels = document.getElementById('reportsRentLabels');
    const commLabels = document.getElementById('reportsCommLabels');
    if (!rentChart || !commChart) return;

    rentChart.innerHTML = rentData.map((v,i) => `
        <div class="report-bar-col" title="${months[i]}: ${v.toLocaleString()} XOF">
            <div style="font-size:9px;color:var(--gray);text-align:center;">${v > 0 ? (v/1000).toFixed(0)+'k' : ''}</div>
            <div class="report-bar" style="height:${Math.round(v/maxRent*130)+4}px;background:linear-gradient(to top,#6366f1,#818cf8);"></div>
        </div>`).join('');
    rentLabels.innerHTML = months.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--gray);">${m}</div>`).join('');

    commChart.innerHTML = commData.map((v,i) => `
        <div class="report-bar-col" title="${months[i]}: ${v.toLocaleString()} XOF">
            <div style="font-size:9px;color:var(--gray);text-align:center;">${v > 0 ? (v/1000).toFixed(0)+'k' : ''}</div>
            <div class="report-bar" style="height:${Math.round(v/maxComm*130)+4}px;background:linear-gradient(to top,#10b981,#34d399);"></div>
        </div>`).join('');
    commLabels.innerHTML = months.map(m => `<div style="flex:1;text-align:center;font-size:10px;color:var(--gray);">${m}</div>`).join('');
}

function _getLast6Months() {
    const months = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];
    const now = new Date();
    const result = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        result.push(months[d.getMonth()]);
    }
    return result;
}

function _adminRenderReportsTopAgents() {
    const collectors = collectorsData || [];
    const clients    = clientsData    || [];
    const el = document.getElementById('reportsTopAgents');
    if (!el) return;

    const agentStats = collectors.map(a => {
        const myClients = clients.filter(c => c.agent === a.lastName || c.agentId === a.id);
        const collected = myClients.reduce((s,c) => s + (c.amountPaid||0), 0);
        const due       = myClients.reduce((s,c) => s + (c.amountDue||0), 0);
        const rate      = due > 0 ? Math.round(collected/due*100) : 0;
        return { name: a.lastName + ' ' + a.firstName, collected, rate, count: myClients.length };
    }).sort((a,b) => b.collected - a.collected).slice(0, 5);

    if (!agentStats.length) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;text-align:center;padding:16px;">Aucun agent enregistré</div>'; return; }

    el.innerHTML = agentStats.map((a,i) => `
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:22px;height:22px;border-radius:50%;background:${['#f59e0b','#9ca3af','#cd7c54','#6366f1','#10b981'][i]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">${i+1}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${a.name}</div>
                <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;">
                    <div style="height:4px;background:#6366f1;border-radius:2px;width:${a.rate}%;transition:width .5s;"></div>
                </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:12px;font-weight:700;color:var(--primary);">${a.rate}%</div>
                <div style="font-size:10px;color:var(--gray);">${a.count} clients</div>
            </div>
        </div>`).join('');
}

function _adminRenderReportsTopOwners() {
    const owners  = ownersData  || [];
    const clients = clientsData || [];
    const el = document.getElementById('reportsTopOwners');
    if (!el) return;

    const ownerStats = owners.map(o => {
        const oc = clients.filter(c => c.ownerId === o.id);
        const collected = oc.reduce((s,c) => s+(c.amountPaid||0), 0);
        const comm = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(collected*(o.commissionRate||10)/100);
        return { name: o.lastName + ' ' + (o.firstName||''), collected, comm, net: collected-comm, count: oc.length };
    }).sort((a,b) => b.collected - a.collected).slice(0, 5);

    if (!ownerStats.length) { el.innerHTML = '<div style="color:var(--gray);font-size:13px;text-align:center;padding:16px;">Aucun propriétaire</div>'; return; }

    const maxC = Math.max(...ownerStats.map(o => o.collected), 1);
    el.innerHTML = ownerStats.map((o,i) => `
        <div style="display:flex;align-items:center;gap:10px;">
            <div style="width:22px;height:22px;border-radius:50%;background:${['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'][i]};color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;">${i+1}</div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${o.name}</div>
                <div style="height:4px;background:var(--border);border-radius:2px;margin-top:4px;">
                    <div style="height:4px;background:#6366f1;border-radius:2px;width:${Math.round(o.collected/maxC*100)}%;transition:width .5s;"></div>
                </div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
                <div style="font-size:11px;font-weight:700;color:var(--primary);">${(o.collected/1000).toFixed(0)}k XOF</div>
                <div style="font-size:10px;color:var(--gray);">${o.count} client(s)</div>
            </div>
        </div>`).join('');
}

function _adminRenderReportsRecovery() {
    const clients = clientsData || [];
    const el = document.getElementById('reportsRecovery');
    if (!el) return;

    const paid    = clients.filter(c => c.status === 'paid'   || c.status === 'payé').length;
    const partial = clients.filter(c => c.status === 'partial'|| c.status === 'partiel').length;
    const overdue = clients.filter(c => c.status === 'retard' || c.status === 'overdue').length;
    const vacant  = clients.filter(c => c.status === 'vacant').length;
    const total   = clients.length || 1;

    const stats = [
        { label:'Payés', count:paid,    pct:Math.round(paid/total*100),    color:'#10b981' },
        { label:'Partiels', count:partial, pct:Math.round(partial/total*100), color:'#f59e0b' },
        { label:'Retards', count:overdue,  pct:Math.round(overdue/total*100), color:'#ef4444' },
        { label:'Vacants', count:vacant,   pct:Math.round(vacant/total*100),  color:'#6b7280' },
    ];

    el.innerHTML = stats.map(s => `
        <div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                <span style="font-size:12px;font-weight:600;">${s.label}</span>
                <span style="font-size:12px;color:${s.color};font-weight:700;">${s.count} (${s.pct}%)</span>
            </div>
            <div style="height:6px;background:var(--border);border-radius:3px;">
                <div style="height:6px;background:${s.color};border-radius:3px;width:${s.pct}%;transition:width .5s;"></div>
            </div>
        </div>`).join('');
}

function _adminRenderReportsOwnerTable() {
    const owners  = ownersData  || [];
    const clients = clientsData || [];
    const tbody   = document.getElementById('reportsOwnerTableBody');
    if (!tbody) return;

    tbody.innerHTML = owners.map(o => {
        const oc        = clients.filter(c => c.ownerId === o.id);
        const due       = oc.reduce((s,c) => s+(c.amountDue||0), 0);
        const collected = oc.reduce((s,c) => s+(c.amountPaid||0), 0);
        const comm      = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(collected*(o.commissionRate||10)/100);
        const net       = collected - comm;
        const rate      = due > 0 ? Math.round(collected/due*100) : 0;
        const rateColor = rate >= 80 ? '#10b981' : rate >= 50 ? '#f59e0b' : '#ef4444';
        const propCount = (propertiesData||[]).filter(p => p.ownerId === o.id).length;
        const commLabel = o.commissionType === 'fixed'
            ? `${(o.commissionFixed||0).toLocaleString()} XOF`
            : `${o.commissionRate||10}% (${comm.toLocaleString()})`;
        return `<tr>
            <td><div style="font-weight:600;">${o.lastName} ${o.firstName||''}</div><div style="font-size:11px;color:var(--gray);">${o.phone||''}</div></td>
            <td style="text-align:center;">${propCount}</td>
            <td class="xof">${due.toLocaleString()}</td>
            <td class="xof">${collected.toLocaleString()}</td>
            <td style="color:#f59e0b;font-weight:600;font-size:12px;">${commLabel}</td>
            <td class="xof" style="color:#10b981;font-weight:700;">${net.toLocaleString()}</td>
            <td><span style="font-weight:700;color:${rateColor};">${rate}%</span></td>
        </tr>`;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--gray);padding:20px;">Aucun propriétaire</td></tr>';
}

function adminExportReports() {
    const rows = (ownersData||[]).map(o => {
        const oc = (clientsData||[]).filter(c => c.ownerId === o.id);
        const collected = oc.reduce((s,c) => s+(c.amountPaid||0), 0);
        const comm = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(collected*(o.commissionRate||10)/100);
        return [o.lastName, o.firstName||'', collected, comm, collected-comm].join(';');
    });
    const csv  = 'Nom;Prénom;Collecté;Commission;Net\n' + rows.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='rapport_sygim.csv'; a.click();
    URL.revokeObjectURL(url);
    adminLog('export','Rapport financier exporté');
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN — VERSEMENTS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _versementsMonth = new Date();

function adminLoadVersements() {
    _adminRenderVersementsKpis();
    _adminRenderVersementsCalendar();
    adminRenderVersementsTable();
    _updateVersementsBadge();
}

function _adminRenderVersementsKpis() {
    const owners  = ownersData  || [];
    const clients = clientsData || [];

    let totalNet = 0, totalComm = 0, totalCollected = 0, pending = 0, paid = 0;
    owners.forEach(o => {
        const oc = clients.filter(c => c.ownerId === o.id);
        const col  = oc.reduce((s,c) => s+(c.amountPaid||0), 0);
        const comm = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(col*(o.commissionRate||10)/100);
        totalCollected += col;
        totalComm += comm;
        totalNet  += col - comm;
        if (o._paymentStatus === 'paid') paid++; else pending++;
    });

    const el = document.getElementById('versementsKpis');
    if (!el) return;

    // Update badge
    const badge = document.getElementById('versementsBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }

    el.innerHTML = [
        { label:'Total à verser ce mois', val: totalNet.toLocaleString()+' XOF',  icon:'fa-money-bill-wave', color:'#6366f1' },
        { label:'Commissions SYGIM',      val: totalComm.toLocaleString()+' XOF', icon:'fa-percentage',      color:'#10b981' },
        { label:'Versements en attente',  val: pending + ' propriétaires',         icon:'fa-clock',           color:'#f59e0b' },
        { label:'Versements effectués',   val: paid + ' propriétaires',            icon:'fa-check-circle',    color:'#10b981' },
    ].map(k => `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="width:30px;height:30px;background:${k.color}20;border-radius:8px;display:flex;align-items:center;justify-content:center;">
                    <i class="fas ${k.icon}" style="color:${k.color};font-size:13px;"></i>
                </span>
                <div style="font-size:11px;color:var(--gray);font-weight:600;">${k.label}</div>
            </div>
            <div style="font-size:17px;font-weight:800;color:${k.color};">${k.val}</div>
        </div>`).join('');
}

function _adminRenderVersementsCalendar() {
    const el    = document.getElementById('versementsCalendar');
    const label = document.getElementById('versementsMonthLabel');
    if (!el) return;

    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const m = _versementsMonth;
    if (label) label.textContent = months[m.getMonth()] + ' ' + m.getFullYear();

    const daysInMonth = new Date(m.getFullYear(), m.getMonth()+1, 0).getDate();
    const today = new Date();

    // Jours de versement prévus par date
    const versMap = {};
    (ownersData||[]).forEach(o => {
        let day = o.paymentDay;
        if (!day) return;
        if (day === 'dernier') day = daysInMonth;
        day = parseInt(day);
        if (!versMap[day]) versMap[day] = [];
        versMap[day].push(o.lastName);
    });

    // En-tête jours de semaine
    const dayHeaders = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    const firstDay = new Date(m.getFullYear(), m.getMonth(), 1).getDay(); // 0=dim
    const offset   = firstDay === 0 ? 6 : firstDay - 1;

    let html = dayHeaders.map(d => `<div style="text-align:center;font-size:10px;font-weight:700;color:var(--gray);padding:3px;">${d}</div>`).join('');
    for (let i = 0; i < offset; i++) html += '<div class="vers-cal-day" style="opacity:.2;"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getDate()===d && today.getMonth()===m.getMonth() && today.getFullYear()===m.getFullYear();
        const events  = versMap[d] || [];
        html += `<div class="vers-cal-day ${events.length?'has-event':''} ${isToday?'today':''}">
            <div style="font-size:11px;font-weight:${isToday?700:400};">${d}</div>
            ${events.length ? `<div style="font-size:9px;color:#6366f1;font-weight:600;">${events.length}v</div>` : ''}
        </div>`;
    }

    el.innerHTML = html;
}

function changeVersementMonth(delta) {
    _versementsMonth = new Date(_versementsMonth.getFullYear(), _versementsMonth.getMonth() + delta, 1);
    _adminRenderVersementsCalendar();
}

function adminRenderVersementsTable() {
    const owners  = ownersData  || [];
    const clients = clientsData || [];
    const search  = (document.getElementById('versementsSearch')?.value  || '').toLowerCase();
    const stFilt  = document.getElementById('versementsStatusFilter')?.value || 'all';
    const comFilt = document.getElementById('versementsCommFilter')?.value   || 'all';
    const tbody   = document.getElementById('versementsTableBody');
    if (!tbody) return;

    let rows = owners.map(o => {
        const oc  = clients.filter(c => c.ownerId === o.id);
        const col = oc.reduce((s,c) => s+(c.amountPaid||0), 0);
        const comm = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(col*(o.commissionRate||10)/100);
        const net  = col - comm;
        const status = o._paymentStatus === 'paid' ? 'paid' : col === 0 ? 'overdue' : 'pending';
        return { ...o, col, comm, net, status, propCount: (propertiesData||[]).filter(p=>p.ownerId===o.id).length };
    });

    if (search) rows = rows.filter(o => (o.lastName+' '+(o.firstName||'')).toLowerCase().includes(search));
    if (stFilt  !== 'all') rows = rows.filter(o => o.status === stFilt);
    if (comFilt !== 'all') rows = rows.filter(o => (o.commissionType||'percentage') === comFilt);

    const statusMap = {
        paid:    ['Versé',      '#10b981','fa-check-circle'],
        pending: ['En attente', '#f59e0b','fa-clock'],
        overdue: ['En retard',  '#ef4444','fa-exclamation-circle']
    };

    tbody.innerHTML = rows.map(o => {
        const [slabel, scolor, sicon] = statusMap[o.status] || statusMap.pending;
        const dayLabel = !o.paymentDay ? '—' : o.paymentDay === 'dernier' ? 'Fin de mois' : `Le ${o.paymentDay}`;
        const commLabel = o.commissionType === 'fixed'
            ? `${(o.commissionFixed||0).toLocaleString()} XOF <small style="color:var(--gray);">(fixe)</small>`
            : `${(o.comm||0).toLocaleString()} XOF <small style="color:var(--gray);">(${o.commissionRate||10}%)</small>`;
        return `<tr>
            <td><div style="font-weight:600;">${o.lastName} ${o.firstName||''}</div><div style="font-size:11px;color:var(--gray);">${o.bankAccount||'RIB non renseigné'}</div></td>
            <td style="text-align:center;">${o.propCount}</td>
            <td class="xof">${(o.col||0).toLocaleString()}</td>
            <td style="font-size:12px;">${commLabel}</td>
            <td class="xof" style="color:#10b981;font-weight:700;">${(o.net||0).toLocaleString()}</td>
            <td style="font-size:12px;color:var(--primary);font-weight:600;">${dayLabel}</td>
            <td><span style="background:${scolor}20;color:${scolor};border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;">
                <i class="fas ${sicon}"></i> ${slabel}</span></td>
            <td>
                <div style="display:flex;gap:4px;">
                    ${o.status !== 'paid' ? `<button class="btn btn-primary btn-small" onclick="adminMarkOwnerPaidFromAdmin(${o.id})" title="Valider le versement"><i class="fas fa-check"></i></button>` : ''}
                    <button class="btn btn-outline btn-small" onclick="viewOwnerPaymentDetail(${o.id})" title="Détail"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-outline btn-small" onclick="generateOwnerReceipt(${o.id})" title="Reçu"><i class="fas fa-receipt"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--gray);padding:20px;">Aucun propriétaire</td></tr>';
}

function adminMarkOwnerPaidFromAdmin(ownerId) {
    const o = (ownersData||[]).find(x => x.id === ownerId);
    if (!o || !confirm(`Confirmer le versement pour ${o.lastName} ${o.firstName||''} ?`)) return;
    o._paymentStatus = 'paid';
    o._lastPaymentDate = new Date().toLocaleDateString('fr-FR');
    if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
    adminLog('edit', `Versement validé : ${o.lastName} ${o.firstName||''}`);
    showAlert(`✓ Versement de ${o.lastName} confirmé`, 'success');
    adminLoadVersements();
}

function adminMarkAllPaid() {
    if (!confirm('Marquer TOUS les versements en attente comme effectués ?')) return;
    (ownersData||[]).forEach(o => {
        if (o._paymentStatus !== 'paid') {
            o._paymentStatus = 'paid';
            o._lastPaymentDate = new Date().toLocaleDateString('fr-FR');
        }
    });
    if (window.SYGIM_DB) window.SYGIM_DB.saveAll();
    adminLog('edit', 'Tous les versements validés en masse');
    showAlert('✓ Tous les versements ont été validés', 'success');
    adminLoadVersements();
}

function adminExportVersements() {
    const rows = (ownersData||[]).map(o => {
        const oc  = (clientsData||[]).filter(c => c.ownerId === o.id);
        const col = oc.reduce((s,c)=>s+(c.amountPaid||0),0);
        const comm = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(col*(o.commissionRate||10)/100);
        return [o.lastName, o.firstName||'', col, comm, col-comm, o.paymentDay||'', o._paymentStatus||'pending'].join(';');
    });
    const csv  = 'Nom;Prénom;Collecté;Commission;Net;Jour versement;Statut\n' + rows.join('\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a'); a.href=url; a.download='versements_sygim.csv'; a.click();
    URL.revokeObjectURL(url);
}

function _updateVersementsBadge() {
    const pending = (ownersData||[]).filter(o => o._paymentStatus !== 'paid').length;
    const badge = document.getElementById('versementsBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN — NOTIFICATIONS
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _notifHistory = JSON.parse(localStorage.getItem('sygim_notifs') || '[]');

function adminLoadNotifications() {
    _generateAutoNotifs();
    adminRenderNotifHistory();
    _updateNotifBadge();
}

function _generateAutoNotifs() {
    const clients = clientsData || [];
    const owners  = ownersData  || [];
    const now     = new Date();

    // Clients en retard
    const overdueClients = clients.filter(c => c.status === 'retard' || c.status === 'overdue');
    overdueClients.forEach(c => {
        const exists = _notifHistory.some(n => n.autoId === 'overdue_' + c.id && _sameDay(n.date, now));
        if (!exists && document.getElementById('alertOverdueEnabled')?.checked !== false) {
            _notifHistory.unshift({ id: Date.now() + Math.random(), autoId:'overdue_'+c.id, type:'warning',
                title:'Loyer en retard', message:`${c.lastName} ${c.firstName||''} — ${(c.amountDue||0).toLocaleString()} XOF`,
                target:'collectors', date: now.toISOString(), read:false });
        }
    });

    // Versements imminents
    const day = now.getDate();
    owners.forEach(o => {
        let vday = o.paymentDay;
        if (!vday) return;
        if (vday === 'dernier') vday = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
        const diff = parseInt(vday) - day;
        if (diff >= 0 && diff <= 2) {
            const exists = _notifHistory.some(n => n.autoId === 'vers_'+o.id && _sameDay(n.date, now));
            if (!exists) {
                _notifHistory.unshift({ id: Date.now() + Math.random(), autoId:'vers_'+o.id, type:'info',
                    title:'Versement imminent', message:`${o.lastName} — prévu le ${o.paymentDay === 'dernier' ? 'dernier jour' : o.paymentDay + ' du mois'}`,
                    target:'admin', date: now.toISOString(), read:false });
            }
        }
    });

    _saveNotifHistory();
}

function _sameDay(isoStr, date) {
    const d = new Date(isoStr);
    return d.getDate()===date.getDate() && d.getMonth()===date.getMonth() && d.getFullYear()===date.getFullYear();
}

function _saveNotifHistory() {
    try { localStorage.setItem('sygim_notifs', JSON.stringify(_notifHistory.slice(0,200))); } catch(e){}
}

function adminRenderNotifHistory() {
    const filter = document.getElementById('notifHistoryFilter')?.value || 'all';
    const el     = document.getElementById('notifHistoryList');
    const countEl= document.getElementById('notifHistoryCount');
    if (!el) return;

    let list = _notifHistory;
    if (filter !== 'all') list = list.filter(n => n.type === filter);

    if (countEl) countEl.textContent = _notifHistory.length;

    const icons = { info:'fa-info-circle', warning:'fa-exclamation-triangle', danger:'fa-exclamation-circle', success:'fa-check-circle' };
    const colors = { info:'#6366f1', warning:'#f59e0b', danger:'#ef4444', success:'#10b981' };

    el.innerHTML = list.length ? list.map(n => `
        <div class="notif-item ${n.type}" style="${n.read?'opacity:.7':''}">
            <div style="display:flex;align-items:flex-start;gap:10px;">
                <i class="fas ${icons[n.type]||'fa-bell'}" style="color:${colors[n.type]||'#6366f1'};margin-top:2px;"></i>
                <div style="flex:1;">
                    <div style="font-weight:700;font-size:13px;">${n.title}</div>
                    <div style="font-size:12px;color:var(--gray);margin-top:2px;">${n.message}</div>
                    <div style="font-size:11px;color:var(--gray);margin-top:4px;display:flex;gap:10px;">
                        <span><i class="fas fa-users"></i> ${n.target||'all'}</span>
                        <span><i class="fas fa-clock"></i> ${new Date(n.date).toLocaleString('fr-FR')}</span>
                        ${n.autoId ? '<span style="background:rgba(99,102,241,.1);color:#6366f1;border-radius:10px;padding:1px 6px;font-size:10px;">Auto</span>' : ''}
                    </div>
                </div>
                <button onclick="adminDeleteNotif('${n.id}')" style="border:none;background:none;cursor:pointer;color:var(--gray);padding:2px 6px;" title="Supprimer">✕</button>
            </div>
        </div>`).join('')
    : '<div style="text-align:center;color:var(--gray);padding:24px;"><i class="fas fa-bell-slash" style="font-size:24px;opacity:.3;display:block;margin-bottom:8px;"></i>Aucune notification</div>';
}

function adminSendNotif() {
    const target  = document.getElementById('notifTarget')?.value   || 'all';
    const type    = document.getElementById('notifType')?.value     || 'info';
    const title   = document.getElementById('notifTitle')?.value.trim();
    const message = document.getElementById('notifMessage')?.value.trim();
    if (!title || !message) { showAlert('Titre et message requis', 'error'); return; }

    _notifHistory.unshift({ id: Date.now(), type, title, message, target,
        date: new Date().toISOString(), read:false, sentBy:'admin' });
    _saveNotifHistory();
    adminLog('create', `Notification envoyée : ${title}`);
    showAlert('✓ Notification envoyée', 'success');
    adminClearNotifForm();
    adminRenderNotifHistory();
    _updateNotifBadge();
}

function adminClearNotifForm() {
    ['notifTitle','notifMessage'].forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
}

function adminDeleteNotif(id) {
    _notifHistory = _notifHistory.filter(n => String(n.id) !== String(id));
    _saveNotifHistory();
    adminRenderNotifHistory();
    _updateNotifBadge();
}

function adminClearAllNotifs() {
    if (!confirm('Effacer tout l\'historique des notifications ?')) return;
    _notifHistory = [];
    _saveNotifHistory();
    adminRenderNotifHistory();
    _updateNotifBadge();
    showAlert('ðŸ—‘ Notifications effacées', 'success');
}

function adminSaveAlertConfig() {
    const cfg = {
        overdue:  { enabled: document.getElementById('alertOverdueEnabled')?.checked,  days: document.getElementById('alertOverdueDays')?.value },
        versement:{ enabled: document.getElementById('alertVersementEnabled')?.checked, days: document.getElementById('alertVersementDays')?.value },
        vacant:   { enabled: document.getElementById('alertVacantEnabled')?.checked,    days: document.getElementById('alertVacantDays')?.value },
        monthly:  { enabled: document.getElementById('alertMonthlyReport')?.checked }
    };
    try { localStorage.setItem('sygim_alert_cfg', JSON.stringify(cfg)); } catch(e){}
}

function _updateNotifBadge() {
    const unread = _notifHistory.filter(n => !n.read).length;
    const badge  = document.getElementById('notifBadge');
    if (badge) { badge.textContent = unread; badge.style.display = unread > 0 ? 'inline' : 'none'; }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ADMIN — PLANIFICATEUR
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

let _plannerMonth    = new Date();
let _plannerSelected = null;
let _plannerTasks    = JSON.parse(localStorage.getItem('sygim_tasks') || '[]');

function adminLoadPlanner() {
    adminRenderPlannerCalendar();
    adminRenderTaskList();
    const cnt = document.getElementById('plannerTaskCount');
    if (cnt) cnt.textContent = _plannerTasks.length;
}

function adminRenderPlannerCalendar() {
    const el    = document.getElementById('plannerGrid');
    const label = document.getElementById('plannerMonthLabel');
    if (!el) return;

    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const m = _plannerMonth;
    if (label) label.textContent = months[m.getMonth()] + ' ' + m.getFullYear();

    const daysInMonth = new Date(m.getFullYear(), m.getMonth()+1, 0).getDate();
    const today = new Date();
    const firstDay = new Date(m.getFullYear(), m.getMonth(), 1).getDay();
    const offset   = firstDay === 0 ? 6 : firstDay - 1;

    // Construire map des événements par jour
    const evMap = {};
    const addEv = (day, color, label, type) => {
        if (!day || isNaN(day) || day < 1 || day > daysInMonth) return;
        if (!evMap[day]) evMap[day] = [];
        evMap[day].push({ color, label, type });
    };

    // Versements propriétaires
    (ownersData||[]).forEach(o => {
        let d = o.paymentDay === 'dernier' ? daysInMonth : parseInt(o.paymentDay);
        addEv(d, '#6366f1', o.lastName, 'vers');
    });

    // TÃ¢ches admin
    _plannerTasks.forEach(t => {
        if (!t.date) return;
        const td = new Date(t.date);
        if (td.getMonth() === m.getMonth() && td.getFullYear() === m.getFullYear()) {
            addEv(td.getDate(), t.urgent ? '#ef4444' : '#f59e0b', t.title, 'task');
        }
    });

    let html = '';
    for (let i = 0; i < offset; i++) html += '<div class="planner-cell other-month"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday    = today.getDate()===d && today.getMonth()===m.getMonth() && today.getFullYear()===m.getFullYear();
        const isSelected = _plannerSelected === d;
        const evs = evMap[d] || [];
        const dots = [...new Set(evs.map(e => e.color))].map(c => `<span class="planner-dot" style="background:${c};"></span>`).join('');
        const pills = evs.slice(0,2).map(e => `<span class="planner-event-pill" style="background:${e.color}20;color:${e.color};">${e.label}</span>`).join('');

        html += `<div class="planner-cell ${isToday?'today':''} ${isSelected?'selected':''}"
            onclick="plannerSelectDay(${d})">
            <div class="planner-cell-date">${d}</div>
            <div>${dots}</div>
            ${pills}
        </div>`;
    }

    el.innerHTML = html;
}

function plannerSelectDay(day) {
    _plannerSelected = day;
    adminRenderPlannerCalendar();

    const m   = _plannerMonth;
    const daysInMonth = new Date(m.getFullYear(), m.getMonth()+1, 0).getDate();
    const months = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const label = document.getElementById('plannerSelectedDate');
    if (label) label.textContent = `${day} ${months[m.getMonth()]}`;

    const evEl = document.getElementById('plannerDayEvents');
    if (!evEl) return;

    const events = [];

    // Versements du jour
    (ownersData||[]).forEach(o => {
        let d = o.paymentDay === 'dernier' ? daysInMonth : parseInt(o.paymentDay);
        if (d === day) events.push({ color:'#6366f1', icon:'fa-wallet', label:`Versement : ${o.lastName} ${o.firstName||''}`, sub: _formatAmount(o) });
    });

    // TÃ¢ches du jour
    _plannerTasks.forEach(t => {
        if (!t.date) return;
        const td = new Date(t.date);
        if (td.getDate()===day && td.getMonth()===m.getMonth() && td.getFullYear()===m.getFullYear()) {
            events.push({ color: t.urgent ? '#ef4444' : '#f59e0b', icon:'fa-tasks', label:t.title, sub:t.description||'', id:t.id, isTask:true });
        }
    });

    evEl.innerHTML = events.length ? events.map(e => `
        <div style="background:var(--surface-alt);border-left:3px solid ${e.color};border-radius:0 8px 8px 0;padding:8px 10px;display:flex;gap:8px;align-items:flex-start;">
            <i class="fas ${e.icon}" style="color:${e.color};margin-top:2px;font-size:12px;"></i>
            <div style="flex:1;">
                <div style="font-weight:600;font-size:12px;">${e.label}</div>
                ${e.sub ? `<div style="font-size:11px;color:var(--gray);">${e.sub}</div>` : ''}
            </div>
            ${e.isTask ? `<button onclick="adminDeleteTask('${e.id}')" style="border:none;background:none;cursor:pointer;color:var(--gray);font-size:11px;" title="Supprimer">✕</button>` : ''}
        </div>`).join('')
    : '<div style="text-align:center;padding:16px;color:var(--gray);font-size:12px;"><i class="fas fa-calendar-times" style="font-size:20px;opacity:.3;display:block;margin-bottom:6px;"></i>Aucun événement</div>';
}

function _formatAmount(o) {
    const oc  = (clientsData||[]).filter(c => c.ownerId === o.id);
    const col = oc.reduce((s,c)=>s+(c.amountPaid||0), 0);
    const comm = o.commissionType === 'fixed' ? (o.commissionFixed||0) : Math.round(col*(o.commissionRate||10)/100);
    return `Net estimé : ${(col-comm).toLocaleString()} XOF`;
}

function changePlannerMonth(delta) {
    _plannerSelected = null;
    _plannerMonth = new Date(_plannerMonth.getFullYear(), _plannerMonth.getMonth() + delta, 1);
    adminRenderPlannerCalendar();
    const evEl = document.getElementById('plannerDayEvents');
    if (evEl) evEl.innerHTML = '<div style="text-align:center;padding:16px;opacity:.5;"><i class="fas fa-calendar-day" style="font-size:24px;display:block;margin-bottom:6px;"></i>Cliquez sur un jour</div>';
    const lbl = document.getElementById('plannerSelectedDate');
    if (lbl) lbl.textContent = 'Sélectionnez un jour';
}

function adminRenderTaskList() {
    const filter = document.getElementById('plannerTaskFilter')?.value || 'all';
    const el     = document.getElementById('plannerTaskList');
    const cnt    = document.getElementById('plannerTaskCount');
    if (!el) return;

    let tasks = [..._plannerTasks];
    if (filter === 'pending') tasks = tasks.filter(t => !t.done);
    if (filter === 'done')    tasks = tasks.filter(t => t.done);
    if (filter === 'urgent')  tasks = tasks.filter(t => t.urgent && !t.done);

    if (cnt) cnt.textContent = _plannerTasks.length;

    el.innerHTML = tasks.length ? tasks.map(t => {
        const dateStr = t.date ? new Date(t.date).toLocaleDateString('fr-FR') : '—';
        const color   = t.urgent ? '#ef4444' : t.done ? '#10b981' : '#f59e0b';
        return `<div style="background:var(--surface-alt);border-radius:10px;padding:12px 14px;display:flex;gap:10px;align-items:flex-start;border-left:3px solid ${color};">
            <input type="checkbox" ${t.done?'checked':''} onchange="adminToggleTask('${t.id}')"
                style="margin-top:3px;width:15px;height:15px;accent-color:${color};cursor:pointer;">
            <div style="flex:1;">
                <div style="font-weight:600;font-size:13px;${t.done?'text-decoration:line-through;opacity:.6':''}">${t.title}</div>
                ${t.description ? `<div style="font-size:12px;color:var(--gray);">${t.description}</div>` : ''}
                <div style="font-size:11px;color:var(--gray);margin-top:4px;display:flex;gap:10px;flex-wrap:wrap;">
                    <span><i class="fas fa-calendar"></i> ${dateStr}</span>
                    ${t.urgent ? '<span style="color:#ef4444;font-weight:600;"><i class="fas fa-fire"></i> Urgent</span>' : ''}
                    ${t.done   ? '<span style="color:#10b981;font-weight:600;"><i class="fas fa-check"></i> Terminé</span>' : ''}
                </div>
            </div>
            <button onclick="adminDeleteTask('${t.id}')" style="border:none;background:none;cursor:pointer;color:var(--gray);" title="Supprimer">✕</button>
        </div>`;
    }).join('')
    : '<div style="text-align:center;color:var(--gray);padding:20px;"><i class="fas fa-tasks" style="font-size:28px;opacity:.3;display:block;margin-bottom:8px;"></i>Aucune tÃ¢che planifiée</div>';
}

function adminOpenAddTask() {
    const title = prompt('Titre de la tÃ¢che :');
    if (!title) return;
    const dateStr = prompt('Date (JJ/MM/AAAA) :', new Date().toLocaleDateString('fr-FR'));
    const desc    = prompt('Description (optionnel) :') || '';
    const urgent  = confirm('Cette tÃ¢che est-elle urgente ?');

    let date = null;
    if (dateStr) {
        const parts = dateStr.split('/');
        if (parts.length === 3) date = new Date(parts[2], parts[1]-1, parts[0]).toISOString();
    }

    _plannerTasks.unshift({ id: 'task_' + Date.now(), title, description:desc, date, urgent, done:false, createdAt: new Date().toISOString() });
    try { localStorage.setItem('sygim_tasks', JSON.stringify(_plannerTasks)); } catch(e){}
    adminLog('create', `TÃ¢che planifiée : ${title}`);
    showAlert('✓ TÃ¢che ajoutée', 'success');
    adminRenderPlannerCalendar();
    adminRenderTaskList();
}

function adminToggleTask(id) {
    const t = _plannerTasks.find(x => x.id === id);
    if (t) { t.done = !t.done; try { localStorage.setItem('sygim_tasks', JSON.stringify(_plannerTasks)); } catch(e){} }
    adminRenderTaskList();
}

function adminDeleteTask(id) {
    _plannerTasks = _plannerTasks.filter(t => t.id !== id);
    try { localStorage.setItem('sygim_tasks', JSON.stringify(_plannerTasks)); } catch(e){}
    adminRenderPlannerCalendar();
    adminRenderTaskList();
    if (_plannerSelected) plannerSelectDay(_plannerSelected);
}
