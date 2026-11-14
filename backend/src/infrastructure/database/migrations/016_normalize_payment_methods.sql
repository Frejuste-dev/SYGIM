-- Migration 016: Normalisation stricte des modes de paiement et assainissement des événements de bail
-- SYGIM Backend - MySQL 8.0 Compatible

-- 1. Normalisation des méthodes de paiement dans la table transactions
UPDATE transactions
SET method = 'bank_transfer'
WHERE LOWER(TRIM(method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire');

UPDATE transactions
SET method = 'mobile_money'
WHERE LOWER(TRIM(method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov');

UPDATE transactions
SET method = 'cheque'
WHERE LOWER(TRIM(method)) IN ('cheque', 'check', 'chèque');

UPDATE transactions
SET method = 'cash'
WHERE LOWER(TRIM(method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces');

-- 2. Normalisation des modes de paiement dans owner_settlements
UPDATE owner_settlements
SET payment_method = 'bank_transfer'
WHERE LOWER(TRIM(payment_method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire');

UPDATE owner_settlements
SET payment_method = 'mobile_money'
WHERE LOWER(TRIM(payment_method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov');

UPDATE owner_settlements
SET payment_method = 'cheque'
WHERE LOWER(TRIM(payment_method)) IN ('cheque', 'check', 'chèque');

UPDATE owner_settlements
SET payment_method = 'cash'
WHERE LOWER(TRIM(payment_method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces');

-- 3. Normalisation des modes de paiement dans owner_settlement_installments
UPDATE owner_settlement_installments
SET payment_method = 'bank_transfer'
WHERE LOWER(TRIM(payment_method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire');

UPDATE owner_settlement_installments
SET payment_method = 'mobile_money'
WHERE LOWER(TRIM(payment_method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov');

UPDATE owner_settlement_installments
SET payment_method = 'cheque'
WHERE LOWER(TRIM(payment_method)) IN ('cheque', 'check', 'chèque');

UPDATE owner_settlement_installments
SET payment_method = 'cash'
WHERE LOWER(TRIM(payment_method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces');

-- 4. Normalisation dans la table owners (preferred_payment_method)
UPDATE owners
SET preferred_payment_method = 'bank_transfer'
WHERE LOWER(TRIM(preferred_payment_method)) IN ('transfer', 'bank_transfer', 'virement', 'virement bancaire', 'virement_bancaire');

UPDATE owners
SET preferred_payment_method = 'mobile_money'
WHERE LOWER(TRIM(preferred_payment_method)) IN ('mobile_money', 'mobile money', 'wave', 'orange_money', 'orange money', 'mtn', 'moov');

UPDATE owners
SET preferred_payment_method = 'cheque'
WHERE LOWER(TRIM(preferred_payment_method)) IN ('cheque', 'check', 'chèque');

UPDATE owners
SET preferred_payment_method = 'cash'
WHERE LOWER(TRIM(preferred_payment_method)) IN ('cash', 'especes', 'espece', 'espèce', 'espèces');

-- 5. Normalisation dans la table payments (si des lignes existent)
UPDATE payments
SET payment_method = 'BANK_TRANSFER'
WHERE UPPER(TRIM(payment_method)) IN ('TRANSFER', 'BANK_TRANSFER', 'VIREMENT');

UPDATE payments
SET payment_method = 'MOBILE_MONEY'
WHERE UPPER(TRIM(payment_method)) IN ('WAVE', 'ORANGE_MONEY', 'MTN', 'MOOV', 'MOBILE_MONEY');

UPDATE payments
SET payment_method = 'CHEQUE'
WHERE UPPER(TRIM(payment_method)) IN ('CHECK', 'CHEQUE');

UPDATE payments
SET payment_method = 'CASH'
WHERE UPPER(TRIM(payment_method)) IN ('CASH', 'ESPECES');

-- 6. Annulation / neutralisation des événements de bail dans transactions
-- Toute ligne avec method IN ('assignment', 'departure') ou amount <= 0 n'est pas un encaissement financier
UPDATE transactions
SET status = 'cancelled'
WHERE (method IN ('assignment', 'departure') OR amount <= 0)
  AND status IN ('processed', 'paid', 'completed', 'partial', 'partiel');
