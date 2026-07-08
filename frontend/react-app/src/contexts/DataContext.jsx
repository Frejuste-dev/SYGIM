/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Context des Données Métier                          ║
 * ║     Gère et distribue les entités synchronisées depuis l'API       ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { API } from '../api/services';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);

export const DataProvider = ({ children }) => {
    const { user } = useAuth();
    const [properties, setProperties] = useState([]);
    const [owners, setOwners] = useState([]);
    const [clients, setClients] = useState([]);
    const [collectors, setCollectors] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const refreshData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            console.log('[DataContext] Synchronisation en cours...');
            
            const [propsResp, ownersResp, clientsResp, collectorsResp, txResp] = await Promise.all([
                API.Properties.getAll({ limit: 1000 }).catch(e => { console.error("Err Properties:", e); return { data: [] }; }),
                API.Owners.getAll({ limit: 1000 }).catch(e => { console.error("Err Owners:", e); return { data: [] }; }),
                API.Clients.getAll({ limit: 1000 }).catch(e => { console.error("Err Clients:", e); return { data: [] }; }),
                API.Collectors.getAll({ limit: 1000 }).catch(e => { console.error("Err Collectors:", e); return { data: [] }; }),
                API.Transactions.getAll({ limit: 1000 }).catch(e => { console.error("Err Transactions:", e); return { data: [] }; })
            ]);

            const props = propsResp?.data ? (Array.isArray(propsResp.data) ? propsResp.data : propsResp.data.data || propsResp.data.rows || []) : [];
            const own = ownersResp?.data ? (Array.isArray(ownersResp.data) ? ownersResp.data : ownersResp.data.data || ownersResp.data.rows || []) : [];
            const cli = clientsResp?.data ? (Array.isArray(clientsResp.data) ? clientsResp.data : clientsResp.data.data || clientsResp.data.rows || []) : [];
            const coll = collectorsResp?.data ? (Array.isArray(collectorsResp.data) ? collectorsResp.data : collectorsResp.data.data || collectorsResp.data.rows || []) : [];
            const txs = txResp?.data ? (Array.isArray(txResp.data) ? txResp.data : txResp.data.data || txResp.data.rows || []) : [];

            setProperties(props);
            setOwners(own);
            setClients(cli);
            setCollectors(coll);
            setTransactions(txs);
            console.log('[DataContext] Synchronisation terminée avec succès.');
        } catch (err) {
            console.error('[DataContext] Erreur lors du chargement des données:', err);
            setError(err.message || 'Erreur de synchronisation des données');
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user) {
            refreshData();
        } else {
            // Vider les states à la déconnexion
            setProperties([]);
            setOwners([]);
            setClients([]);
            setCollectors([]);
            setTransactions([]);
        }
    }, [user, refreshData]);

    const value = {
        properties,
        setProperties,
        owners,
        setOwners,
        clients,
        setClients,
        collectors,
        setCollectors,
        transactions,
        setTransactions,
        loading,
        error,
        refreshData
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = () => useContext(DataContext);
export default DataContext;
