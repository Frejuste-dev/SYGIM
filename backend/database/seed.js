/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           SYGIM — Script de Seed (Données initiales)            ║
 * ╚══════════════════════════════════════════════════════════════════╝
 *
 * Exécuter avec :  node database/seed.js
 *
 * Ce script crée les comptes utilisateurs par défaut dans la base
 * MySQL avec les mêmes identifiants que le frontend actuel.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');

const DEFAULT_USERS = [
    {
        username:      'admin',
        password:      'Admin2026!',
        role:          'admin',
        firstName:     'Super',
        lastName:      'Admin',
        displayName:   'Administrateur',
        avatar:        'ADM'
    },
    {
        username:      'directeur',
        password:      'Dir2026!',
        role:          'director',
        firstName:     'Direction',
        lastName:      'Générale',
        displayName:   'Direction Générale',
        avatar:        'DIR'
    },
    {
        username:      'comptable',
        password:      'Cpt2026!',
        role:          'accounting',
        firstName:     'Service',
        lastName:      'Comptabilité',
        displayName:   'Service Comptabilité',
        avatar:        'CPT'
    },
    {
        username:      'manager',
        password:      'Mgr2026!',
        role:          'collector_manager',
        firstName:     'Manager',
        lastName:      'Récolteurs',
        displayName:   'Manager des Récolteurs',
        avatar:        'MGR'
    },
    {
        username:      'korede',
        password:      'Korede2026!',
        role:          'collector',
        firstName:     '',
        lastName:      'KOREDE',
        displayName:   'KOREDE',
        avatar:        'KO',
        collectorName: 'KOREDE'
    },
    {
        username:      'leonce',
        password:      'Leonce2026!',
        role:          'collector',
        firstName:     '',
        lastName:      'LEONCE',
        displayName:   'LEONCE',
        avatar:        'LE',
        collectorName: 'LEONCE'
    }
];

async function seed() {
    console.log('');
    console.log('🌱 SYGIM — Initialisation des données...');
    console.log('');

    try {
        for (const user of DEFAULT_USERS) {
            // Vérifier si l'utilisateur existe déjà
            const [existing] = await pool.query(
                'SELECT id FROM users WHERE username = ?',
                [user.username]
            );

            // Hash du mot de passe
            const passwordHash = await bcrypt.hash(user.password, 10);

            if (existing.length > 0) {
                await pool.query(
                    `UPDATE users 
                     SET password_hash = ?, role = ?, first_name = ?, last_name = ?, display_name = ?, avatar = ?, collector_name = ?, active = 1
                     WHERE username = ?`,
                    [
                        passwordHash,
                        user.role,
                        user.firstName,
                        user.lastName,
                        user.displayName,
                        user.avatar,
                        user.collectorName || null,
                        user.username
                    ]
                );
                console.log(`   🔄 ${user.username} mis à jour (${user.role})`);
                continue;
            }

            await pool.query(
                `INSERT INTO users (username, password_hash, role, first_name, last_name, display_name, avatar, collector_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    user.username,
                    passwordHash,
                    user.role,
                    user.firstName,
                    user.lastName,
                    user.displayName,
                    user.avatar,
                    user.collectorName || null
                ]
            );

            console.log(`   ✅ ${user.username} créé (${user.role})`);
        }

        // Insérer les paramètres par défaut
        const settings = [
            ['app_name',           'SYGIM',  'Nom de l\'application'],
            ['currency',           'XOF',    'Devise par défaut'],
            ['maintenance_mode',   '0',      'Mode maintenance'],
            ['min_rent',           '10000',  'Loyer minimum autorisé'],
            ['commission_default', '5.00',   'Taux de commission par défaut (%)'],
        ];

        for (const [key, value, desc] of settings) {
            const [existing] = await pool.query(
                'SELECT id FROM settings WHERE setting_key = ?', [key]
            );

            if (existing.length === 0) {
                await pool.query(
                    'INSERT INTO settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
                    [key, value, desc]
                );
                console.log(`   ⚙️  Paramètre ${key} = ${value}`);
            }
        }

        console.log('');
        console.log('✅ Seed terminé avec succès !');
        console.log('');
        console.log('Comptes créés :');
        console.log('────────────────────────────────────────');
        for (const u of DEFAULT_USERS) {
            console.log(`   ${u.username.padEnd(12)} | ${u.role.padEnd(18)} | mot de passe: ${u.password}`);
        }
        console.log('────────────────────────────────────────');
        console.log('');

    } catch (err) {
        console.error('❌ Erreur seed :', err);
    } finally {
        process.exit(0);
    }
}

seed();
