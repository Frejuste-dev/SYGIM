require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { pool } = require('../src/config/database');

async function verify() {
  const [invRows] = await pool.query('SELECT status, count(*) as count, sum(total_amount) as total, sum(paid_amount) as paid, sum(balance_due) as due FROM invoices GROUP BY status');
  console.log('=== FACTURES PAR STATUT ===');
  console.table(invRows);

  const [payRow] = await pool.query('SELECT count(*) as count, sum(amount_received) as total FROM payments');
  console.log('=== PAIEMENTS ===');
  console.table(payRow);

  const [allocRow] = await pool.query('SELECT count(*) as count, sum(allocated_amount) as total FROM payment_allocations');
  console.log('=== IMPUTATIONS (ALLOCATIONS) ===');
  console.table(allocRow);

  const [tclRow] = await pool.query("SELECT count(*) as count, sum(amount) as total FROM tenant_credit_ledger WHERE transaction_type = 'CREDIT_ADVANCE'");
  console.log('=== AVANCES EN SÉQUESTRE ===');
  console.table(tclRow);

  const [openingRow] = await pool.query("SELECT count(*) as count, sum(amount_received) as total FROM payments WHERE receipt_number LIKE 'INIT-%'");
  console.log('=== REPRISES DE SOLDE INITIAL (LEGACY-BAL-INIT) ===');
  console.table(openingRow);

  const [anomalies] = await pool.query('SELECT id, invoice_number, total_amount, paid_amount, balance_due, status FROM invoices WHERE (status = "PAID" AND balance_due > 0.00) OR (status = "PARTIALLY_PAID" AND balance_due = 0.00)');
  console.log('=== ANOMALIES STATUT FACTURES ===');
  console.table(anomalies);

  process.exit(0);
}

verify();
