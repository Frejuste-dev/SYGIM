import mysql.connector
import uuid
import datetime

def live_cutover():
    print("===============================================================")
    print("[PHASE 8.2] BASCULE FINALE EN PRODUCTION (LIVE CUTOVER)")
    print("===============================================================\n")

    db = mysql.connector.connect(
        host="127.0.0.1",
        user="root",
        password="sibmlab@1014",
        database="sygim_dev"
    )
    cursor = db.cursor(dictionary=True)

    try:
        # 1. Utilisateur system_migration
        cursor.execute("SELECT id FROM users WHERE username = 'system_migration' LIMIT 1")
        u_row = cursor.fetchone()
        system_migration_id = u_row['id']
        print(f"[USER] Utilisateur technique 'system_migration' : ID {system_migration_id}")

        # Nettoyer les tables financières avant peuplement
        cursor.execute("DELETE FROM payment_allocations")
        cursor.execute("DELETE FROM tenant_credit_ledger")
        cursor.execute("DELETE FROM payments")
        cursor.execute("DELETE FROM invoices")
        cursor.execute("DELETE FROM owner_settlements")

        # 2. Récupérer les 75 clients
        cursor.execute("""
            SELECT id, first_name, last_name, property_id, property_value, 
                   amount_due, amount_paid, created_at, status
            FROM clients
            ORDER BY id ASC
        """)
        clients = cursor.fetchall()
        print(f"[STATS] Clients a migrer : {len(clients)}")

        total_invoices_created = 0
        total_payments_created = 0
        total_allocations_created = 0
        total_opening_balances_created = 0
        total_advances_count = 0
        total_advances_amount = 0.0

        for client in clients:
            client_id = client['id']
            legacy_due = float(client['amount_due'] or 0.0)
            legacy_paid = float(client['amount_paid'] or 0.0)
            monthly_rent = float(client['property_value'] or 0.0)
            if monthly_rent <= 0:
                monthly_rent = legacy_due if legacy_due > 0 else 100000.0

            client_invoices = []

            # A. Reconstitution de la facture
            if legacy_due > 0:
                inv_uuid = str(uuid.uuid4())
                inv_num = f"FAC-LEGACY-{client_id}-{int(datetime.datetime.now().timestamp()) % 10000}"
                base_date = client['created_at'] if client['created_at'] else datetime.datetime(2025, 1, 1)

                sql_inv = """
                    INSERT INTO invoices (
                        uuid, invoice_number, client_id, property_id, invoice_type,
                        billing_period_start, billing_period_end, contract_rent_applied,
                        base_amount, total_amount, paid_amount, status, due_date
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql_inv, (
                    inv_uuid, inv_num, client_id, client['property_id'],
                    'RENT_FULL', base_date, base_date, monthly_rent,
                    legacy_due, legacy_due, 0.0, 'PENDING', base_date
                ))
                inv_id = cursor.lastrowid
                client_invoices.append({
                    'id': inv_id,
                    'total_amount': legacy_due,
                    'balance_due': legacy_due
                })
                total_invoices_created += 1

            # B. Transactions processed
            cursor.execute("""
                SELECT id, amount, method, status, date, created_at, reference, collector_id
                FROM transactions
                WHERE client_id = %s AND status = 'processed'
                ORDER BY COALESCE(date, created_at) ASC, id ASC
            """, (client_id,))
            transactions = cursor.fetchall()

            sum_real_tx = sum(float(t['amount'] or 0.0) for t in transactions)
            client_payments = []

            for tx in transactions:
                tx_amount = float(tx['amount'] or 0.0)
                if tx_amount <= 0:
                    continue

                p_uuid = str(uuid.uuid4())
                p_ref = tx['reference'] if tx['reference'] else str(uuid.uuid4())
                method = 'CASH'
                if tx['method'] and tx['method'].upper() in ['CASH', 'BANK_TRANSFER', 'MOBILE_MONEY', 'CHEQUE']:
                    method = tx['method'].upper()

                sql_pay = """
                    INSERT INTO payments (
                        uuid, transaction_reference, receipt_number, client_id, collector_id,
                        property_id, amount_received, payment_method, payment_date, status, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql_pay, (
                    p_uuid, p_ref, f"REC-TX-{tx['id']}", client_id, tx['collector_id'],
                    client['property_id'], tx_amount, method,
                    tx['date'] or tx['created_at'] or datetime.datetime.now(),
                    'RECONCILED', system_migration_id
                ))
                p_id = cursor.lastrowid
                client_payments.append({
                    'id': p_id,
                    'amount_received': tx_amount
                })
                total_payments_created += 1

            # C. Reprise de Solde Initial (Opening Balance Settlement)
            if legacy_paid > sum_real_tx:
                deficit = round(legacy_paid - sum_real_tx, 2)
                init_uuid = str(uuid.uuid4())
                init_ref = f"LEGACY-BAL-INIT-{client_id}-{int(datetime.datetime.now().timestamp()) % 10000}"

                sql_init = """
                    INSERT INTO payments (
                        uuid, transaction_reference, receipt_number, client_id, collector_id,
                        property_id, amount_received, payment_method, payment_date, status, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql_init, (
                    init_uuid, init_ref, f"INIT-{client_id}", client_id, None,
                    client['property_id'], deficit, 'CASH', datetime.datetime.now(),
                    'RECONCILED', system_migration_id
                ))
                p_id = cursor.lastrowid
                client_payments.append({
                    'id': p_id,
                    'amount_received': deficit
                })
                total_opening_balances_created += 1
                total_payments_created += 1

            # D. Moteur FIFO d'Imputation & Avances
            running_credit = 0.0

            for p in client_payments:
                rem_to_alloc = p['amount_received']

                for inv in client_invoices:
                    if rem_to_alloc <= 0:
                        break
                    if inv['balance_due'] <= 0:
                        continue

                    alloc_amount = min(rem_to_alloc, inv['balance_due'])

                    cursor.execute("""
                        INSERT INTO payment_allocations (uuid, payment_id, invoice_id, allocated_amount, status)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (str(uuid.uuid4()), p['id'], inv['id'], alloc_amount, 'ACTIVE'))

                    inv['balance_due'] = round(inv['balance_due'] - alloc_amount, 2)
                    cursor.execute("""
                        UPDATE invoices
                        SET paid_amount = paid_amount + %s,
                            status = CASE WHEN paid_amount + %s >= total_amount THEN 'PAID' ELSE 'PARTIALLY_PAID' END
                        WHERE id = %s
                    """, (alloc_amount, alloc_amount, inv['id']))

                    rem_to_alloc = round(rem_to_alloc - alloc_amount, 2)
                    total_allocations_created += 1

                # Surplus -> Grand Livre des Avances
                if rem_to_alloc > 0:
                    running_credit = round(running_credit + rem_to_alloc, 2)
                    cursor.execute("""
                        INSERT INTO tenant_credit_ledger (
                            uuid, client_id, transaction_type, amount, running_balance,
                            source_payment_id, consumed_invoice_id
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        str(uuid.uuid4()), client_id, 'CREDIT_ADVANCE', rem_to_alloc,
                        running_credit, p['id'], None
                    ))
                    total_advances_count += 1
                    total_advances_amount += rem_to_alloc

        db.commit()

        # Contrôles finaux post-commit
        cursor.execute("SELECT COUNT(*) as c, SUM(total_amount) as s_tot, SUM(paid_amount) as s_paid, SUM(balance_due) as s_due FROM invoices")
        inv_check = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as c, SUM(amount_received) as s_rec FROM payments")
        pay_check = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as c, SUM(allocated_amount) as s_alloc FROM payment_allocations")
        alloc_check = cursor.fetchone()
        cursor.execute("SELECT COUNT(*) as c, SUM(amount) as s_adv FROM tenant_credit_ledger WHERE transaction_type = 'CREDIT_ADVANCE'")
        tcl_check = cursor.fetchone()

        print("\n===============================================================")
        print("[SUCCESS] BASCULE EN PRODUCTION TERMINEE AVEC SUCCES (COMMIT EFFECTUE)")
        print("===============================================================")
        print(f"- Factures (invoices) creees              : {inv_check['c']} ({float(inv_check['s_tot']):,.2f} FCFA)")
        print(f"- Dettes residuelles (balance_due)        : {float(inv_check['s_due']):,.2f} FCFA")
        print(f"- Paiements (payments) injectes           : {pay_check['c']} ({float(pay_check['s_rec']):,.2f} FCFA)")
        print(f"- Ecritures de reprise (LEGACY-BAL-INIT)  : {total_opening_balances_created}")
        print(f"- Imputations unitaires (allocations)     : {alloc_check['c']} ({float(alloc_check['s_alloc']):,.2f} FCFA)")
        print(f"- Ecritures d'avance au Grand Livre       : {tcl_check['c']} ({float(tcl_check['s_adv'] or 0):,.2f} FCFA)")
        print("===============================================================\n")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] ERREUR CRITIQUE - ROLLBACK : {e}")
    finally:
        cursor.close()
        db.close()

if __name__ == "__main__":
    live_cutover()
