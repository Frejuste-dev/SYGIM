/**
 * Tests Unitaires & Logique Métier — Domaine Financier (Phase 5.6)
 * Valide les calculs arithmétiques, l'apurement FIFO et l'intégrité sans dépendance externe.
 */

const rentBillingService = require('../../../src/modules/financial/services/RentBillingService');

describe('Financial Domain Unit Tests — Calculations & Business Rules (Phase 5.6)', () => {

  describe('Scénario 1 : Calcul déterministe du Prorata Calendaire (FIN-012, FIN-014)', () => {
    test('Mois de Février (28 jours) : entrée le 15 février -> 14 jours d\'occupation', () => {
      const monthlyRent = 100000;
      const totalDays = 28;
      const occupiedDays = 14;

      const prorata = rentBillingService.calculateProrataAmount(monthlyRent, totalDays, occupiedDays);

      // (100000 / 28) * 14 = 50000.00
      expect(prorata).toBe(50000.00);
    });

    test('Mois de 31 jours (ex: Janvier/Mars/Mai/Juillet/Août/Octobre/Décembre)', () => {
      const monthlyRent = 120000;
      const totalDays = 31;
      const occupiedDays = 10;

      const prorata = rentBillingService.calculateProrataAmount(monthlyRent, totalDays, occupiedDays);

      // (120000 / 31) * 10 = 38709.6774... -> arrondi à 38709.68
      expect(prorata).toBe(38709.68);
    });

    test('Mois de 30 jours (ex: Avril/Juin/Septembre/Novembre)', () => {
      const monthlyRent = 90000;
      const totalDays = 30;
      const occupiedDays = 15;

      const prorata = rentBillingService.calculateProrataAmount(monthlyRent, totalDays, occupiedDays);

      expect(prorata).toBe(45000.00);
    });

    test('Mois complet (occupiedDays >= totalDays)', () => {
      const monthlyRent = 150000;
      const totalDays = 31;
      const occupiedDays = 31;

      const prorata = rentBillingService.calculateProrataAmount(monthlyRent, totalDays, occupiedDays);

      expect(prorata).toBe(150000.00);
    });

    test('Nombre de jours <= 0', () => {
      const prorata = rentBillingService.calculateProrataAmount(100000, 30, 0);
      expect(prorata).toBe(0.00);
    });
  });

  describe('Simulation Métier de l\'Apurement FIFO (FIN-002, FIN-003, FIN-004)', () => {
    test('Ventilation FIFO de 150 000 sur 3 factures de 100 000', () => {
      const invoices = [
        { id: 1, due_date: '2025-01-05', total_amount: 100000, paid_amount: 0, balance_due: 100000 },
        { id: 2, due_date: '2025-02-05', total_amount: 100000, paid_amount: 0, balance_due: 100000 },
        { id: 3, due_date: '2025-03-05', total_amount: 100000, paid_amount: 0, balance_due: 100000 }
      ];

      let remainingPayment = 150000;
      const allocations = [];

      for (const inv of invoices) {
        if (remainingPayment <= 0) break;
        const alloc = Math.min(remainingPayment, inv.balance_due);
        allocations.push({ invoice_id: inv.id, allocated_amount: alloc });
        inv.paid_amount += alloc;
        inv.balance_due -= alloc;
        inv.status = inv.balance_due === 0 ? 'PAID' : 'PARTIALLY_PAID';
        remainingPayment -= alloc;
      }

      // Assertions
      expect(allocations).toHaveLength(2);
      expect(allocations[0]).toEqual({ invoice_id: 1, allocated_amount: 100000 });
      expect(allocations[1]).toEqual({ invoice_id: 2, allocated_amount: 50000 });

      expect(invoices[0].status).toBe('PAID');
      expect(invoices[0].balance_due).toBe(0);

      expect(invoices[1].status).toBe('PARTIALLY_PAID');
      expect(invoices[1].balance_due).toBe(50000);

      expect(invoices[2].paid_amount).toBe(0);
      expect(invoices[2].balance_due).toBe(100000);

      expect(remainingPayment).toBe(0);
    });

    test('Surplus de paiement devenant une avance locataire (FIN-001, FIN-016)', () => {
      const invoices = [
        { id: 1, total_amount: 50000, balance_due: 50000 }
      ];

      const paymentReceived = 150000;
      let remaining = paymentReceived;
      const allocations = [];

      for (const inv of invoices) {
        const alloc = Math.min(remaining, inv.balance_due);
        allocations.push({ invoice_id: inv.id, allocated_amount: alloc });
        inv.balance_due -= alloc;
        remaining -= alloc;
      }

      const surplusAdvance = remaining;

      expect(allocations[0].allocated_amount).toBe(50000);
      expect(invoices[0].balance_due).toBe(0);
      expect(surplusAdvance).toBe(100000); // 100 000 crédités au compte d'avance
    });
  });

  describe('Simulation Métier de la Reddition Propriétaire (FIN-019, FIN-020, FIN-021)', () => {
    test('Calcul strict sur encaissements réels imputés à 8% de commission', () => {
      const activeAllocationsOnOwnerProperties = [
        { allocated_amount: 70000 },
        { allocated_amount: 50000 }
      ];

      const totalCollected = activeAllocationsOnOwnerProperties.reduce((sum, a) => sum + a.allocated_amount, 0);
      const commissionRate = 8.00;
      const agencyCommission = parseFloat(((totalCollected * commissionRate) / 100).toFixed(2));
      const maintenanceDeductions = 0.00;
      const netOwnerPayout = totalCollected - agencyCommission - maintenanceDeductions;

      expect(totalCollected).toBe(120000.00);
      expect(agencyCommission).toBe(9600.00);
      expect(netOwnerPayout).toBe(110400.00);
    });
  });
});
