import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { API } from '../api/services';

const INIT_PROFILE = { displayName: '', firstName: '', lastName: '', email: '', phone: '' };

function mapApiProfile(api) {
  return {
    displayName: api.display_name || api.displayName || '',
    firstName:   api.first_name   || api.firstName   || '',
    lastName:    api.last_name    || api.lastName    || '',
    email:       api.email        || '',
    phone:       api.phone        || '',
  };
}

function toSnake(form) {
  return {
    display_name: form.displayName,
    first_name:   form.firstName,
    last_name:    form.lastName,
    email:        form.email,
    phone:        form.phone,
  };
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(INIT_PROFILE);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileError, setProfileError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    API.Auth.getCurrentUser()
      .then(res => {
        if (res?.success && res.data) {
          const mapped = mapApiProfile(res.data);
          setProfile(mapped);
          setLoadError('');
        }
      })
      .catch(() => setLoadError('Impossible de charger vos informations de profil pour le moment.'))
      .finally(() => setLoading(false));
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileMsg('');
    setProfileError('');
    setProfileSaving(true);
    try {
      const res = await API.Auth.updateProfile(toSnake(profile));
      if (res?.success && res.data) {
        const mapped = mapApiProfile(res.data);
        setProfile(mapped);
        setUser({ ...user, ...mapped });
        setProfileMsg('Profil mis à jour avec succès.');
      } else {
        setProfileError(res?.message || 'Erreur lors de la mise à jour.');
      }
    } catch (err) {
      setProfileError(err.message || 'Erreur réseau.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwError('');

    if (pwForm.newPassword.length < 8) {
      setPwError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Les mots de passe ne correspondent pas.');
      return;
    }

    setPwSaving(true);
    try {
      const res = await API.Auth.changePassword({
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      if (res?.success) {
        setPwMsg('Mot de passe modifié avec succès. Vous allez être déconnecté(e).');
        setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => navigate('/login', { replace: true }), 3000);
      } else {
        setPwError(res?.message || res?.error || 'Erreur lors du changement.');
      }
    } catch (err) {
      setPwError(err.message || 'Erreur réseau.');
    } finally {
      setPwSaving(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 shadow-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const labelClass = "block text-sm font-medium text-slate-700 mb-1.5";
  const alertSuccessClass = "bg-emerald-50 text-emerald-700 p-4 rounded-lg text-sm mb-6 flex items-center gap-2 border border-emerald-100";
  const alertErrorClass = "bg-rose-50 text-rose-700 p-4 rounded-lg text-sm mb-6 flex items-center gap-2 border border-rose-100";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 mb-8">
          <i className="fas fa-user-circle text-primary text-2xl"></i>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Profil</h1>
            <p className="text-sm text-slate-500">Chargement de vos informations...</p>
          </div>
        </div>
        <div className="flex justify-center items-center py-20">
          <i className="fas fa-spinner fa-spin text-primary text-3xl"></i>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <i className="fas fa-user-circle text-primary"></i> Mon Profil
          </h1>
          <p className="text-slate-500 text-sm mt-1">Gérer vos informations personnelles et votre sécurité.</p>
        </div>
      </div>

      {loadError && (
        <div className={alertErrorClass}>
          <i className="fas fa-exclamation-circle"></i> {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* CARTE : INFORMATIONS PERSONNELLES */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-id-card text-primary"></i> Informations personnelles
            </h3>
            <p className="text-sm text-slate-500 mt-1">Identité et coordonnées de contact.</p>
          </div>

          {profileMsg && <div className={alertSuccessClass}><i className="fas fa-check-circle"></i> {profileMsg}</div>}
          {profileError && <div className={alertErrorClass}><i className="fas fa-exclamation-circle"></i> {profileError}</div>}

          <form onSubmit={handleProfileSubmit} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Prénom</label>
                <input className={inputClass} value={profile.firstName} onChange={e => setProfile({ ...profile, firstName: e.target.value })} />
              </div>
              <div>
                <label className={labelClass}>Nom</label>
                <input className={inputClass} value={profile.lastName} onChange={e => setProfile({ ...profile, lastName: e.target.value })} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Nom d'affichage</label>
              <input className={inputClass} value={profile.displayName} onChange={e => setProfile({ ...profile, displayName: e.target.value })} />
            </div>

            <div>
              <label className={labelClass}>Email</label>
              <input type="email" className={inputClass} value={profile.email} onChange={e => setProfile({ ...profile, email: e.target.value })} />
              <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                <i className="fas fa-info-circle"></i> Sans serveur SMTP configuré, l'email n'est pas vérifié.
              </p>
            </div>

            <div>
              <label className={labelClass}>Téléphone</label>
              <input type="tel" className={inputClass} value={profile.phone} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
            </div>

            <div className="pt-4">
              <button type="submit" className="w-full bg-primary text-white font-medium py-3 px-4 rounded-xl hover:bg-primary-dark transition-all flex justify-center items-center gap-2 shadow-sm" disabled={profileSaving}>
                {profileSaving ? <><i className="fas fa-spinner fa-spin"></i> Enregistrement...</> : <><i className="fas fa-save"></i> Enregistrer le profil</>}
              </button>
            </div>
          </form>
        </div>

        {/* CARTE : SÉCURITÉ */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 md:p-8 self-start">
          <div className="mb-6 pb-4 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <i className="fas fa-lock text-slate-700"></i> Changer le mot de passe
            </h3>
            <p className="text-sm text-slate-500 mt-1">Sécurisez l'accès à votre compte.</p>
          </div>

          {pwMsg && <div className={alertSuccessClass}><i className="fas fa-check-circle"></i> {pwMsg}</div>}
          {pwError && <div className={alertErrorClass}><i className="fas fa-exclamation-circle"></i> {pwError}</div>}

          <form onSubmit={handlePasswordSubmit} className="space-y-5">
            <div>
              <label className={labelClass}>Mot de passe actuel</label>
              <input type="password" required className={inputClass} value={pwForm.currentPassword} onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })} />
            </div>
            
            <div>
              <label className={labelClass}>Nouveau mot de passe</label>
              <input type="password" required minLength={8} placeholder="Au moins 8 caractères" className={inputClass} value={pwForm.newPassword} onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })} />
            </div>

            <div>
              <label className={labelClass}>Confirmer le mot de passe</label>
              <input type="password" required className={inputClass} value={pwForm.confirmPassword} onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })} />
            </div>

            <div className="pt-4">
              <button type="submit" className="w-full bg-white text-slate-700 border border-slate-300 font-medium py-3 px-4 rounded-xl hover:bg-slate-50 transition-all flex justify-center items-center gap-2 shadow-sm" disabled={pwSaving}>
                {pwSaving ? <><i className="fas fa-spinner fa-spin"></i> Modification...</> : <><i className="fas fa-key"></i> Changer le mot de passe</>}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
}
