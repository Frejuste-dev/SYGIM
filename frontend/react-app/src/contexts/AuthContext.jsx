/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Context d'Authentification                         ║
 * ║     Partage l'état de l'utilisateur connecté et gère la session    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API } from '../api/services';
import { httpClient } from '../api/client';
import { CONFIG } from '../api/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const queryClient = useQueryClient();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Flag pour eviter les mises a jour d'etat apres demontage
        // (React StrictMode en dev monte les effets deux fois)
        let ignore = false;

        // Hydrater temporairement l'UI avec l'utilisateur mis en cache si present
        const cachedUser = localStorage.getItem(CONFIG.STORAGE.CURRENT_USER);
        if (cachedUser) {
            try { setUser(JSON.parse(cachedUser)); } catch (_) { setUser(null); }
        }

        // Connecter le callback onUnauthorized du client HTTP a setUser
        // Ainsi, quand le token expire (401), React deconnecte l'utilisateur
        // via ProtectedRoute -> <Navigate to="/login" /> sans window.location.href
        const prevOnUnauthorized = httpClient.onUnauthorized;
        httpClient.onUnauthorized = () => {
            // Nettoyer le cache React Query et le localStorage
            if (typeof window !== 'undefined') {
                localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            }
            queryClient.clear();
            // Mettre a jour l'etat React -> ProtectedRoute redirige vers /login
            if (!ignore) setUser(null);
        };
        // Validation systematique de la session via cookie
        const validateSession = async () => {
            try {
                    const response = await API.Auth.getCurrentUser();
                    
                    if (ignore) return; // Composant demonte entre temps

                    if (response.success && response.data) {
                        // Session valide : utiliser les donnees fraiches du serveur
                        const serverUser = response.data;
                        const loggedUser = {
                            id: serverUser.id,
                            username: serverUser.username,
                            role: serverUser.role,
                            userType: serverUser.role,
                            firstName: serverUser.first_name || serverUser.firstName || '',
                            lastName: serverUser.last_name || serverUser.lastName || '',
                            displayName: serverUser.display_name || serverUser.displayName || '',
                            avatar: serverUser.avatar || '',
                            email: serverUser.email || '',
                            collectorName: serverUser.collectorName || serverUser.collector_name || serverUser.displayName || '',
                            collectorId: serverUser.collectorId || serverUser.collector_id || null
                        };
                        
                        setUser(loggedUser);
                        localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, JSON.stringify(loggedUser));
                    } else {
                        // Session invalide : nettoyer
                        throw new Error('Session invalide');
                    }
                } catch (error) {
                    if (ignore) return; // Composant demonte entre temps
                    
                    const status = error.status || error.statusCode || 0;
                    // 429 = rate limit, 503 = serveur indisponible, 0 = reseau
                    const isTransientError = status === 429 || status === 503 || status === 0;

                    if (isTransientError) {
                        // Erreur transitoire : conserver la session depuis le cache local
                        console.warn('Erreur transitoire lors de la validation de session, conservation du cache local', error.message);
                        const cached = localStorage.getItem(CONFIG.STORAGE.CURRENT_USER);
                        if (cached) {
                            try { setUser(JSON.parse(cached)); } catch (_) { setUser(null); }
                        } else {
                        // Pas de cache : deconnecter proprement
                        localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
                        setUser(null);
                    }
                } else {
                    // Vraie erreur d'auth (401, 403) : nettoyer la session
                    console.warn('Session invalide ou expiree, nettoyage localStorage', status, error.message);
                    localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
                    setUser(null);
                }
            } finally {
                if (!ignore) setLoading(false);
            }
        };
        
        validateSession();

        return () => {
            ignore = true;
            // Restaurer le handler precedent si besoin (cleanup StrictMode)
            httpClient.onUnauthorized = prevOnUnauthorized;
        };
    }, []);

    const login = async (username, password) => {
        try {
            const response = await API.Auth.login({ username, password });
            
            // Adapter pour correspondre au format standardisé de l'API v2 (ApiResponse)
            const success = response.success;
            const data = response.data;
            
            if (success && data && data.user) {
                const account = data.user;
                const userType = account.role || account.userType;
                
                const loggedUser = {
                    id:            account.id,
                    username:      account.username,
                    role:          userType,
                    userType:      userType,
                    firstName:     account.firstName || account.first_name || '',
                    lastName:      account.lastName || account.last_name || '',
                    displayName:   account.displayName || account.display_name || '',
                    avatar:        account.avatar || '',
                    email:         account.email || '',
                    collectorName: account.collectorName || account.collector_name || account.displayName || '',
                    collectorId:   account.collectorId || account.collector_id || null
                };

                localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, JSON.stringify(loggedUser));
                queryClient.clear();
                setUser(loggedUser);
                return { success: true, user: loggedUser };
            } else {
                return { success: false, error: response.message || response.error || 'Identifiants incorrects.' };
            }
        } catch (error) {
            console.error("Erreur de connexion dans le context:", error);
            const status = error.status || 0;
            const errorType = status === 403 ? 'LOCKED' : status === 429 ? 'RATE_LIMIT' : 'UNKNOWN';
            return { success: false, error: error.message || 'Erreur de connexion au serveur.', errorType };
        }
    };

    const logout = async () => {
        try {
            await API.Auth.logout();
        } catch (e) {
            console.error("Erreur lors de la déconnexion", e);
        } finally {
            setUser(null);
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
            queryClient.clear();
        }
    };

    const value = {
        user,
        setUser,
        loading,
        login,
        logout,
        isAuthenticated: !!user
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
