-- ╔══════════════════════════════════════════════════════════════════╗
-- ║ module: Financial Domain Tables (Phase 5.4)                     ║
-- ║ auteur: SYGIM Engineering Team                                  ║
-- ║ date: 2026-10-22                                                ║
-- ║ ref: PHASE_5.2_FINANCIAL_DOMAIN_CONTRACT_APPROVED.md             ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- 1. Table `invoices` (Échéances & Dettes locatives)
CREATE TABLE IF NOT EXISTS invoices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    client_id INT NOT NULL,
    property_id INT NULL,
    
    invoice_type ENUM('RENT_FULL', 'RENT_PRORATA', 'CHARGE', 'PENALTY', 'DEPOSIT') NOT NULL,
    billing_period_start DATE NOT NULL,
    billing_period_end DATE NOT NULL,
    
    contract_rent_applied DECIMAL(12, 2) NOT NULL,
    base_amount DECIMAL(12, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    paid_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_due DECIMAL(12, 2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    
    status ENUM('PENDING', 'PARTIALLY_PAID', 'PAID', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    due_date DATE NOT NULL,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    cancelled_at DATETIME NULL,
    cancellation_reason VARCHAR(255) NULL,
    
    CONSTRAINT fk_invoices_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_invoices_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    CONSTRAINT chk_invoices_base_amount CHECK (base_amount >= 0),
    CONSTRAINT chk_invoices_total_amount CHECK (total_amount >= 0),
    CONSTRAINT chk_invoices_paid_amount CHECK (paid_amount >= 0),
    CONSTRAINT chk_invoices_balance_due CHECK (balance_due >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_invoices_client_status ON invoices(client_id, status);
CREATE INDEX idx_invoices_client_fifo ON invoices(client_id, due_date ASC);
CREATE INDEX idx_invoices_due_date ON invoices(due_date);

-- 2. Table `payments` (Flux d'encaissement réels)
CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    receipt_number VARCHAR(50) NULL UNIQUE,
    client_id INT NOT NULL,
    collector_id INT NULL,
    property_id INT NULL,
    
    amount_received DECIMAL(12, 2) NOT NULL,
    payment_method ENUM('CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE') NOT NULL,
    payment_date DATETIME NOT NULL,
    
    status ENUM('RECEIVED', 'RECONCILED', 'REVERSED') NOT NULL DEFAULT 'RECEIVED',
    is_reversed BOOLEAN NOT NULL DEFAULT FALSE,
    reversed_at DATETIME NULL,
    reversal_reason VARCHAR(255) NULL,
    reversed_by INT NULL,
    
    created_by INT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_payments_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_collector FOREIGN KEY (collector_id) REFERENCES collectors(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_property FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_reversed_by FOREIGN KEY (reversed_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_payments_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT chk_payments_amount_received CHECK (amount_received > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_payments_client_date ON payments(client_id, payment_date DESC);
CREATE INDEX idx_payments_reference ON payments(transaction_reference);
CREATE INDEX idx_payments_status ON payments(status);

-- 3. Table `payment_allocations` (Table d'imputation unitaire & FIFO)
CREATE TABLE IF NOT EXISTS payment_allocations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    payment_id INT NOT NULL,
    invoice_id INT NOT NULL,
    
    allocated_amount DECIMAL(12, 2) NOT NULL,
    status ENUM('ACTIVE', 'REVERSED') NOT NULL DEFAULT 'ACTIVE',
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_alloc_payment FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_alloc_invoice FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    CONSTRAINT chk_alloc_amount CHECK (allocated_amount > 0),
    CONSTRAINT uk_alloc_payment_invoice UNIQUE (payment_id, invoice_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_alloc_invoice ON payment_allocations(invoice_id, status);
CREATE INDEX idx_alloc_payment ON payment_allocations(payment_id, status);

-- 4. Table `tenant_credit_ledger` (Grand livre des avances et passif locataire)
CREATE TABLE IF NOT EXISTS tenant_credit_ledger (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    client_id INT NOT NULL,
    
    transaction_type ENUM('CREDIT_ADVANCE', 'DEBIT_CONSUMPTION', 'REFUND') NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    running_balance DECIMAL(12, 2) NOT NULL,
    
    source_payment_id INT NULL,
    consumed_invoice_id INT NULL,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_tcl_client FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tcl_payment FOREIGN KEY (source_payment_id) REFERENCES payments(id) ON DELETE RESTRICT,
    CONSTRAINT fk_tcl_invoice FOREIGN KEY (consumed_invoice_id) REFERENCES invoices(id) ON DELETE RESTRICT,
    CONSTRAINT chk_tcl_amount CHECK (amount > 0),
    CONSTRAINT chk_tcl_running_balance CHECK (running_balance >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_tcl_client_date ON tenant_credit_ledger(client_id, created_at DESC);

-- 5. Table `owner_settlements` (Reversements et redditions de compte propriétaire)
CREATE TABLE IF NOT EXISTS owner_settlements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid VARCHAR(36) NOT NULL UNIQUE,
    owner_id INT NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    
    total_collected DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    commission_rate DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    agency_commission DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    maintenance_deductions DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    net_owner_payout DECIMAL(12, 2) NOT NULL,
    
    status ENUM('CALCULATED', 'APPROVED', 'PAID') NOT NULL DEFAULT 'CALCULATED',
    payout_date DATETIME NULL,
    payout_reference VARCHAR(100) NULL,
    
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT fk_settlement_owner FOREIGN KEY (owner_id) REFERENCES owners(id) ON DELETE RESTRICT,
    CONSTRAINT chk_settlement_total_collected CHECK (total_collected >= 0),
    CONSTRAINT chk_settlement_commission_rate CHECK (commission_rate >= 0),
    CONSTRAINT chk_settlement_agency_commission CHECK (agency_commission >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_settlements_owner_period ON owner_settlements(owner_id, period_start, period_end);
CREATE INDEX idx_settlements_status ON owner_settlements(status);
