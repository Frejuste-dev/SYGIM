/**
 * 🤖 MOTEUR IA - SYGIM
 * 
 * Apprentissage local basé sur:
 * - Patterns de paiement
 * - Comportements des clients
 * - Données historiques
 * - Tendances financières
 * 
 * SANS API externe - 100% local
 */

const fs = require('fs');
const path = require('path');

class AIEngine {
  constructor() {
    this.aiDataPath = path.join(__dirname, '../../ai_data');
    this.modelFile = path.join(this.aiDataPath, 'ai_model.json');
    this.predictionsFile = path.join(this.aiDataPath, 'predictions.json');
    
    this.ensureDataDirectory();
    this.loadModel();
  }

  // ────────────────────────────────────────────────────────
  // 1. INITIALISATION
  // ────────────────────────────────────────────────────────

  ensureDataDirectory() {
    if (!fs.existsSync(this.aiDataPath)) {
      fs.mkdirSync(this.aiDataPath, { recursive: true });
    }
  }

  loadModel() {
    try {
      if (fs.existsSync(this.modelFile)) {
        this.model = JSON.parse(fs.readFileSync(this.modelFile, 'utf8'));
      } else {
        this.model = this.createEmptyModel();
        this.saveModel();
      }
    } catch (error) {
      console.error('❌ Erreur chargement modèle IA:', error.message);
      this.model = this.createEmptyModel();
    }
  }

  createEmptyModel() {
    return {
      version: '1.0',
      createdAt: new Date(),
      updatedAt: new Date(),
      stats: {
        totalTransactions: 0,
        totalClients: 0,
        averagePaymentDelay: 0,
        defaultRate: 0, // % clients en retard
        paymentMethods: {},
        paymentTiming: {}, // Jours préférés de paiement
        clientBehaviors: []
      },
      patterns: {
        clientSegments: {}, // Groupes de clients par comportement
        paymentCycles: {}, // Cycles de paiement
        seasonality: {} // Saisonnalité
      },
      predictions: {
        atRiskClients: [],
        likelyToPaySoon: [],
        anomalies: []
      }
    };
  }

  saveModel() {
    try {
      this.model.updatedAt = new Date();
      fs.writeFileSync(this.modelFile, JSON.stringify(this.model, null, 2), 'utf8');
    } catch (error) {
      console.error('❌ Erreur sauvegarde modèle:', error.message);
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. APPRENTISSAGE DES DONNÉES
  // ────────────────────────────────────────────────────────

  /**
   * Apprendre des données de transactions existantes
   */
  async learnFromTransactions(transactions) {
    console.log('🧠 Apprentissage des transactions...');

    if (!transactions || transactions.length === 0) return;

    // Calculer statistiques
    this.model.stats.totalTransactions = transactions.length;
    
    // Analyser les méthodes de paiement
    transactions.forEach(tx => {
      const method = tx.method || 'unknown';
      this.model.stats.paymentMethods[method] = 
        (this.model.stats.paymentMethods[method] || 0) + 1;
    });

    // Analyser timing de paiement
    const paymentDays = {};
    transactions.forEach(tx => {
      const day = new Date(tx.date).getDay();
      paymentDays[day] = (paymentDays[day] || 0) + 1;
    });
    this.model.stats.paymentTiming = paymentDays;

    this.saveModel();
    console.log('✅ Apprentissage complété');
  }

  /**
   * Apprendre des comportements clients
   */
  async learnFromClients(clients) {
    console.log('🧠 Apprentissage des clients...');

    if (!clients || clients.length === 0) return;

    this.model.stats.totalClients = clients.length;

    // Segmenter les clients par comportement
    const segments = {
      'payeur_ponctuel': [],    // Paie toujours à l'heure
      'payeur_retard': [],       // Paie avec retard
      'defaillant': [],          // En défaut de paiement
      'nouveau': []              // Nouveau client
    };

    clients.forEach(client => {
      let segment = 'nouveau';
      
      if (client.status === 'paid') {
        segment = 'payeur_ponctuel';
      } else if (client.status === 'late') {
        segment = 'payeur_retard';
      } else if (client.status === 'inactive') {
        segment = 'defaillant';
      }
      
      segments[segment].push({
        id: client.id,
        name: `${client.first_name} ${client.last_name}`,
        status: client.status,
        amountDue: client.amount_due,
        amountPaid: client.amount_paid,
        createdAt: client.created_at
      });
    });

    this.model.patterns.clientSegments = segments;
    
    // Calculer taux de défaut
    const defaillants = segments.defaillant.length;
    const total = clients.length;
    this.model.stats.defaultRate = total > 0 ? 
      Math.round((defaillants / total) * 100) : 0;

    this.saveModel();
    console.log('✅ Apprentissage clients complété');
  }

  /**
   * Apprendre des retards de paiement
   */
  async learnPaymentDelays(transactions, clients) {
    if (!transactions || transactions.length === 0) return;

    console.log('🧠 Analyse des retards de paiement...');

    const delays = [];

    transactions.forEach(tx => {
      if (tx.due_date && tx.date) {
        const dueDate = new Date(tx.due_date);
        const payDate = new Date(tx.date);
        const delayDays = Math.floor((payDate - dueDate) / (1000 * 60 * 60 * 24));
        
        if (delayDays > 0) {
          delays.push({
            clientId: tx.client_id,
            delayDays,
            amount: tx.amount,
            method: tx.method
          });
        }
      }
    });

    if (delays.length > 0) {
      const avgDelay = Math.round(
        delays.reduce((sum, d) => sum + d.delayDays, 0) / delays.length
      );
      this.model.stats.averagePaymentDelay = avgDelay;
    }

    this.saveModel();
  }

  // ────────────────────────────────────────────────────────
  // 3. PRÉDICTIONS INTELLIGENTES
  // ────────────────────────────────────────────────────────

  /**
   * Prédire les clients à risque (impayés probables)
   */
  async predictAtRiskClients(clients, transactions) {
    console.log('🔮 Prédiction des clients à risque...');

    const atRisk = [];

    clients.forEach(client => {
      let riskScore = 0;

      // Facteur 1: Status actuel (poids: 30%)
      if (client.status === 'late') riskScore += 30;
      else if (client.status === 'pending') riskScore += 15;

      // Facteur 2: Montant dû (poids: 25%)
      if (client.amount_due > client.amount_paid * 2) riskScore += 25;
      else if (client.amount_due > client.amount_paid) riskScore += 12;

      // Facteur 3: Historique (poids: 25%)
      const clientTransactions = transactions.filter(t => t.client_id === client.id);
      const lateTransactions = clientTransactions.filter(t => {
        if (t.due_date && t.date) {
          const delay = (new Date(t.date) - new Date(t.due_date)) / (1000 * 60 * 60 * 24);
          return delay > 0;
        }
        return false;
      });

      if (lateTransactions.length > 0) {
        const lateRate = (lateTransactions.length / clientTransactions.length) * 100;
        riskScore += Math.min((lateRate / 100) * 25, 25);
      }

      // Facteur 4: Ancienneté (poids: 20%)
      const accountAge = Math.floor(
        (Date.now() - new Date(client.created_at)) / (1000 * 60 * 60 * 24)
      );
      if (accountAge < 30) riskScore += 20; // Nouveaux clients = plus risqués
      else if (accountAge < 90) riskScore += 10;

      // Si score >= 40 → client à risque
      if (riskScore >= 40) {
        atRisk.push({
          clientId: client.id,
          name: `${client.first_name} ${client.last_name}`,
          email: client.email,
          phone: client.phone,
          riskScore: Math.min(riskScore, 100), // Capper à 100
          amountDue: client.amount_due,
          recommendation: this.getRecommendation(riskScore),
          priority: riskScore >= 80 ? 'URGENT' : riskScore >= 60 ? 'HIGH' : 'MEDIUM'
        });
      }
    });

    // Trier par score décroissant
    atRisk.sort((a, b) => b.riskScore - a.riskScore);

    this.model.predictions.atRiskClients = atRisk.slice(0, 20); // Top 20

    console.log(`⚠️ ${atRisk.length} clients à risque identifiés`);
    this.saveModel();
    return atRisk;
  }

  /**
   * Prédire quels clients vont payer bientôt
   */
  async predictLikelyToPay(clients, transactions) {
    console.log('🎯 Prédiction des clients à contacter en priorité...');

    const likelyToPay = [];

    clients.forEach(client => {
      if (client.status === 'inactive') return; // Skip inactifs

      let paymentProbability = 0;

      // Facteur 1: Status pending/partial (bonne indication)
      if (client.status === 'pending' || client.status === 'partial') {
        paymentProbability += 30;
      }

      // Facteur 2: Historique de ponctualité
      const clientTransactions = transactions.filter(t => t.client_id === client.id);
      if (clientTransactions.length > 0) {
        const successfulTransactions = clientTransactions.filter(t => t.status === 'processed');
        const successRate = (successfulTransactions.length / clientTransactions.length) * 100;
        
        if (successRate >= 80) paymentProbability += 40;
        else if (successRate >= 50) paymentProbability += 20;
        else if (successRate >= 20) paymentProbability += 10;
      }

      // Facteur 3: Méthode de paiement habituelle
      const preferredMethod = this.getMostCommonPaymentMethod(clientTransactions);
      if (preferredMethod) paymentProbability += 15;

      // Facteur 4: Montant raisonnable
      if (client.amount_due > 0 && client.amount_due <= client.amount_paid) {
        paymentProbability += 15;
      }

      if (paymentProbability >= 40) {
        likelyToPay.push({
          clientId: client.id,
          name: `${client.first_name} ${client.last_name}`,
          email: client.email,
          phone: client.phone,
          paymentProbability: Math.min(paymentProbability, 100),
          amountDue: client.amount_due,
          preferredMethod,
          lastPaymentDate: this.getLastPaymentDate(client.id, transactions),
          action: 'Contacter pour rappel paiement'
        });
      }
    });

    // Trier par probabilité décroissante
    likelyToPay.sort((a, b) => b.paymentProbability - a.paymentProbability);

    this.model.predictions.likelyToPaySoon = likelyToPay.slice(0, 15); // Top 15

    console.log(`✅ ${likelyToPay.length} clients probables à contacter`);
    return likelyToPay;
  }

  // ────────────────────────────────────────────────────────
  // 4. DÉTECTION D'ANOMALIES
  // ────────────────────────────────────────────────────────

  /**
   * Détecter les anomalies (transactions inhabituelles, clients suspects)
   */
  async detectAnomalies(transactions, clients) {
    console.log('🔍 Détection des anomalies...');

    const anomalies = [];
    const avgTransactionAmount = this.calculateAverageTransactionAmount(transactions);
    const avgDelay = this.model.stats.averagePaymentDelay || 5;

    transactions.forEach(tx => {
      const anomaly = {
        type: null,
        severity: 'LOW',
        message: '',
        transactionId: tx.id
      };

      // Anomalie 1: Montant anormalement élevé
      if (tx.amount > avgTransactionAmount * 3) {
        anomaly.type = 'HIGH_AMOUNT';
        anomaly.severity = 'MEDIUM';
        anomaly.message = `Montant très élevé: ${tx.amount} (moyenne: ${Math.round(avgTransactionAmount)})`;
        anomalies.push(anomaly);
      }

      // Anomalie 2: Montant très faible (peut être une erreur)
      if (tx.amount < avgTransactionAmount * 0.1 && tx.amount > 0) {
        anomaly.type = 'LOW_AMOUNT';
        anomaly.severity = 'LOW';
        anomaly.message = `Montant très faible: ${tx.amount}`;
        anomalies.push(anomaly);
      }

      // Anomalie 3: Très grand retard
      if (tx.due_date && tx.date) {
        const delay = (new Date(tx.date) - new Date(tx.due_date)) / (1000 * 60 * 60 * 24);
        if (delay > avgDelay * 5) {
          anomaly.type = 'EXTREME_DELAY';
          anomaly.severity = 'HIGH';
          anomaly.message = `Retard extrême: ${Math.round(delay)} jours`;
          anomalies.push(anomaly);
        }
      }
    });

    // Détecter les clients suspects
    clients.forEach(client => {
      // Plusieurs changements de statut rapides
      const changeCount = this.countStatusChanges(client.id, transactions);
      if (changeCount > 5) {
        anomalies.push({
          type: 'FREQUENT_STATUS_CHANGES',
          severity: 'MEDIUM',
          message: `Client ${client.first_name} a ${changeCount} changements de statut`,
          clientId: client.id
        });
      }

      // Montant dû incohérent
      if (client.amount_due < 0) {
        anomalies.push({
          type: 'NEGATIVE_AMOUNT',
          severity: 'HIGH',
          message: `Client avec montant dû négatif: ${client.amount_due}`,
          clientId: client.id
        });
      }
    });

    this.model.predictions.anomalies = anomalies.slice(0, 10); // Top 10

    console.log(`⚠️ ${anomalies.length} anomalies détectées`);
    return anomalies;
  }

  // ────────────────────────────────────────────────────────
  // 5. RECOMMANDATIONS INTELLIGENTES
  // ────────────────────────────────────────────────────────

  /**
   * Générer des recommandations personnalisées
   */
  async generateRecommendations(clients, transactions) {
    console.log('💡 Génération des recommandations...');

    const recommendations = [];

    // Recommandation 1: Top clients à contacter
    const atRiskClients = this.model.predictions.atRiskClients.slice(0, 5);
    if (atRiskClients.length > 0) {
      recommendations.push({
        id: 'contact_at_risk',
        priority: 'URGENT',
        title: 'Contacter clients à risque',
        description: `${atRiskClients.length} clients à risque d'impayé. Priorité: ${atRiskClients[0].priority}`,
        action: 'Appeler/emailer les clients',
        expectedImpact: `Potentiellement ${Math.round(atRiskClients.reduce((s, c) => s + c.amountDue, 0))} de paiements`,
        clients: atRiskClients
      });
    }

    // Recommandation 2: Clients à relancer
    const likelyToPay = this.model.predictions.likelyToPaySoon.slice(0, 5);
    if (likelyToPay.length > 0) {
      recommendations.push({
        id: 'contact_likely_to_pay',
        priority: 'HIGH',
        title: 'Relancer clients probables',
        description: `${likelyToPay.length} clients avec forte probabilité de paiement (>60%)`,
        action: 'Envoyer rappel paiement',
        expectedImpact: `Taux de succès estimé: ${Math.round(likelyToPay[0].paymentProbability)}%`,
        clients: likelyToPay
      });
    }

    // Recommandation 3: Optimiser méthode de paiement
    const bestMethod = this.getBestPaymentMethod();
    if (bestMethod) {
      recommendations.push({
        id: 'optimize_payment_method',
        priority: 'MEDIUM',
        title: `Favoriser paiements en ${bestMethod.method}`,
        description: `${bestMethod.count} paiements en ${bestMethod.method} (${bestMethod.percentage}% des paiements)`,
        action: 'Promouvoir cette méthode',
        expectedImpact: 'Augmentation du taux de conversion'
      });
    }

    // Recommandation 4: Déterminer meilleur moment de contact
    const bestDay = this.getBestDayForPayment();
    if (bestDay) {
      recommendations.push({
        id: 'best_payment_timing',
        priority: 'MEDIUM',
        title: `Contacter le ${bestDay.dayName}`,
        description: `Le ${bestDay.dayName} a ${bestDay.count} paiements (taux de succès plus élevé)`,
        action: 'Programmer contacts pour le ' + bestDay.dayName,
        expectedImpact: 'Amélioration du taux de réponse'
      });
    }

    // Recommandation 5: Anomalies à investiguer
    const anomalies = this.model.predictions.anomalies.filter(a => a.severity === 'HIGH');
    if (anomalies.length > 0) {
      recommendations.push({
        id: 'investigate_anomalies',
        priority: 'HIGH',
        title: 'Investiguer anomalies',
        description: `${anomalies.length} anomalies graves détectées`,
        action: 'Vérifier et corriger les données',
        expectedImpact: 'Amélioration de la qualité des données',
        anomalies: anomalies.slice(0, 3)
      });
    }

    return recommendations;
  }

  // ────────────────────────────────────────────────────────
  // 6. FONCTIONS UTILITAIRES
  // ────────────────────────────────────────────────────────

  getRecommendation(riskScore) {
    if (riskScore >= 80) return '🚨 Appel immédiat requis';
    if (riskScore >= 60) return '⚠️ Relance urgente';
    return '📞 Rappel paiement recommandé';
  }

  getMostCommonPaymentMethod(transactions) {
    if (!transactions || transactions.length === 0) return null;
    
    const methods = {};
    transactions.forEach(tx => {
      methods[tx.method] = (methods[tx.method] || 0) + 1;
    });
    
    return Object.keys(methods).sort((a, b) => methods[b] - methods[a])[0] || null;
  }

  getLastPaymentDate(clientId, transactions) {
    const clientTransactions = transactions
      .filter(t => t.client_id === clientId && t.status === 'processed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return clientTransactions.length > 0 ? clientTransactions[0].date : null;
  }

  calculateAverageTransactionAmount(transactions) {
    if (!transactions || transactions.length === 0) return 0;
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    return total / transactions.length;
  }

  countStatusChanges(clientId, transactions) {
    return transactions.filter(t => t.client_id === clientId).length;
  }

  getBestPaymentMethod() {
    const methods = this.model.stats.paymentMethods;
    const total = Object.values(methods).reduce((a, b) => a + b, 0);
    
    if (total === 0) return null;
    
    const best = Object.entries(methods)
      .sort((a, b) => b[1] - a[1])[0];
    
    return {
      method: best[0],
      count: best[1],
      percentage: Math.round((best[1] / total) * 100)
    };
  }

  getBestDayForPayment() {
    const timing = this.model.stats.paymentTiming;
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    
    const best = Object.entries(timing)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (!best) return null;
    
    return {
      dayName: days[parseInt(best[0])],
      dayNumber: parseInt(best[0]),
      count: best[1]
    };
  }

  // ────────────────────────────────────────────────────────
  // 7. DASHBOARD IA
  // ────────────────────────────────────────────────────────

  /**
   * Obtenir dashboard complet d'IA
   */
  getDashboard() {
    return {
      summary: {
        totalClients: this.model.stats.totalClients,
        totalTransactions: this.model.stats.totalTransactions,
        defaultRate: `${this.model.stats.defaultRate}%`,
        averagePaymentDelay: `${this.model.stats.averagePaymentDelay} jours`
      },
      risks: {
        atRiskCount: this.model.predictions.atRiskClients.length,
        topAtRisk: this.model.predictions.atRiskClients.slice(0, 3),
        anomalyCount: this.model.predictions.anomalies.length,
        topAnomalies: this.model.predictions.anomalies.slice(0, 3)
      },
      opportunities: {
        likelyToPayCount: this.model.predictions.likelyToPaySoon.length,
        topCandidates: this.model.predictions.likelyToPaySoon.slice(0, 3),
        potentialRevenue: Math.round(
          this.model.predictions.likelyToPaySoon.reduce((s, c) => s + c.amountDue, 0)
        )
      },
      insights: {
        bestPaymentMethod: this.getBestPaymentMethod(),
        bestDayForPayment: this.getBestDayForPayment(),
        clientSegments: {
          payers: this.model.patterns.clientSegments.payeur_ponctuel?.length || 0,
          delayedPayers: this.model.patterns.clientSegments.payeur_retard?.length || 0,
          defaulters: this.model.patterns.clientSegments.defaillant?.length || 0,
          newClients: this.model.patterns.clientSegments.nouveau?.length || 0
        }
      }
    };
  }

  /**
   * Obtenir les stats du modèle IA
   */
  getStats() {
    return {
      modelVersion: this.model.version,
      createdAt: this.model.createdAt,
      lastUpdated: this.model.updatedAt,
      ...this.model.stats
    };
  }
}

module.exports = AIEngine;
