import React, { useState, useEffect } from 'react';
import { CONFIG } from '../api/config';

const DEFAULT_SETTINGS = {
  theme: document.body.classList.contains('dark-mode') ? 'dark' : 'light',
  language: 'fr',
  notifications: true,
  itemsPerPage: 25,
  dateFormat: 'dd/mm/yyyy',
  currency: 'XOF',
};

export default function Settings() {
  const [settings, setSettings] = useState({ ...DEFAULT_SETTINGS });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONFIG.STORAGE.USER_PREFERENCES);
      if (stored) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
    } catch { /* ignore */ }
  }, []);

  const updateSetting = (key, value) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    if (key === 'theme') {
      document.body.classList.toggle('dark-mode', value === 'dark');
    }
    localStorage.setItem(CONFIG.STORAGE.USER_PREFERENCES, JSON.stringify(next));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-full">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Paramètres</h1>
          <p className="text-slate-500 text-sm mt-1">Personnalisez votre espace de travail et vos préférences</p>
        </div>
        <a href="/admin/profile" className="flex items-center gap-3 bg-white border border-slate-200 px-4 py-2.5 rounded-lg shadow-sm hover:bg-slate-50 transition-colors mt-4 md:mt-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            <i className="fas fa-user"></i>
          </div>
          <div className="text-left">
            <div className="text-sm font-semibold text-slate-800">Mon profil</div>
            <div className="text-xs text-slate-500">Identité & Sécurité</div>
          </div>
          <i className="fas fa-chevron-right text-slate-400 ml-2 text-xs"></i>
        </a>
      </div>

      {/* ALERT SAVED */}
      {saved && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center gap-3 animate-fade-in-up">
          <i className="fas fa-check-circle text-green-500"></i>
          <span className="text-sm font-medium">Préférences enregistrées automatiquement.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* APPARENCE */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-palette text-primary"></i> Apparence
            </h2>
            <p className="text-sm text-slate-500 mt-1">Choisissez le thème visuel de l'interface</p>
          </div>
          
          <div className="p-6 flex-1">
            <div className="mb-2 block text-sm font-medium text-slate-700">Thème de l'application</div>
            <div className="grid grid-cols-2 gap-4 mt-3">
              {['light', 'dark'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateSetting('theme', t)}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all ${
                    settings.theme === t 
                      ? 'border-primary bg-primary/5 ring-4 ring-primary/10' 
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    settings.theme === t ? 'border-primary' : 'border-slate-300'
                  }`}>
                    {settings.theme === t && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${settings.theme === t ? 'text-primary' : 'text-slate-700'}`}>
                      <i className={`fas fa-${t === 'dark' ? 'moon' : 'sun'} w-4 text-center mr-1`}></i> 
                      {t === 'dark' ? 'Sombre' : 'Clair'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {t === 'dark' ? 'Interface sombre contrastée' : 'Interface claire et lumineuse'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* PRÉFÉRENCES */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
          <div className="px-6 py-5 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-sliders-h text-primary"></i> Usage quotidien
            </h2>
            <p className="text-sm text-slate-500 mt-1">Configurez vos préférences d'utilisation</p>
          </div>
          
          <div className="p-6 space-y-6 flex-1">
            {/* Langue */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Langue de l'interface</label>
              <select 
                value={settings.language} 
                onChange={(e) => updateSetting('language', e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="fr">Français (France)</option>
                <option value="en">English (US)</option>
              </select>
            </div>

            {/* Éléments par page */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Éléments par page (Tableaux)</label>
              <select 
                value={settings.itemsPerPage} 
                onChange={(e) => updateSetting('itemsPerPage', parseInt(e.target.value))}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              >
                {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} éléments</option>)}
              </select>
            </div>

            <hr className="border-slate-100" />

            {/* Notifications Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-slate-900">Notifications Système</div>
                <div className="text-xs text-slate-500 mt-0.5">Recevoir les alertes d'impayés et rappels</div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={settings.notifications}
                  onChange={(e) => updateSetting('notifications', e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
