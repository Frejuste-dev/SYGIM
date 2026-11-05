import React from 'react';

export default function AuthBranding() {
  return (
    <div className="auth-section auth-left">
      <div className="flex items-center gap-3 px-6 py-4 mb-4">
        <i className="fas fa-building text-primary text-4xl"></i>
        <span className="text-primary font-bold text-4xl tracking-wide">SYGIM</span>
      </div>
      <p className="auth-subtitle">Système de Gestion Immobilière</p>
      <p className="auth-description">
        Gérez vos propriétés, clients et finances en toute simplicité
      </p>
    </div>
  );
}
