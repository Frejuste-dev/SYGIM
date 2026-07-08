/**
 * ╔════════════════════════════════════════════════════════════════════╗
 * ║        SYGIM — Context d'Authentification                         ║
 * ║     Partage l'état de l'utilisateur connecté et gère la session    ║
 * ╚════════════════════════════════════════════════════════════════════╝
 */

import React, { createContext, useState, useEffect, useContext } from 'react';
import { API } from '../api/services';
import { httpClient } from '../api/client';
import { CONFIG } from '../api/config';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Initialiser l'état d'authentification depuis le localStorage
        const storedUser = localStorage.getItem(CONFIG.STORAGE.CURRENT_USER);
        const storedToken = localStorage.getItem(CONFIG.STORAGE.JWT_TOKEN);
        
        if (storedUser && storedToken) {
            try {
                setUser(JSON.parse(storedUser));
                httpClient.setToken(storedToken);
            } catch (e) {
                console.error("Erreur lors du parsing de l'utilisateur stocké", e);
                localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
                localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const response = await API.Auth.login({ username, password });
            
            // Adapter pour correspondre au format standardisé de l'API v2 (ApiResponse)
            const success = response.success;
            const data = response.data;
            const token = data?.accessToken;
            
            if (success && token) {
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
                    collectorName: account.collectorName || account.collector_name || '',
                    collectorId:   null
                };

                httpClient.setToken(token);
                localStorage.setItem(CONFIG.STORAGE.JWT_TOKEN, token);
                localStorage.setItem(CONFIG.STORAGE.CURRENT_USER, JSON.stringify(loggedUser));
                if (data.refreshToken) {
                    localStorage.setItem('sygim_refresh_token', data.refreshToken);
                }
                
                setUser(loggedUser);
                return { success: true, user: loggedUser };
            } else {
                return { success: false, error: response.message || response.error || 'Identifiants incorrects.' };
            }
        } catch (error) {
            console.error("Erreur de connexion dans le context:", error);
            return { success: false, error: error.message || 'Erreur de connexion au serveur.' };
        }
    };

    const logout = async () => {
        try {
            await API.Auth.logout();
        } catch (e) {
            console.error("Erreur lors de la déconnexion", e);
        } finally {
            setUser(null);
            httpClient.setToken(null);
            localStorage.removeItem(CONFIG.STORAGE.JWT_TOKEN);
            localStorage.removeItem(CONFIG.STORAGE.CURRENT_USER);
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
