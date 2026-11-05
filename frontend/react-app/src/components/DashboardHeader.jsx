import React from 'react';

export default function DashboardHeader({
  title, searchQuery, onSearchChange,
  isDark, onToggleTheme, user,
  subtitle, primaryAction, showSearch = true,
  searchPlaceholder = 'Rechercher...'
}) {
  const avatarText = user?.role === 'director' ? 'DIR' : 'CPT';
  const roleText = user?.role === 'director' ? 'Directeur Général' : 'Comptable';

  return (
    <div className="header flex justify-between items-center px-6 py-5 border-b border-slate-200">
      <div>
        <h1 className="header-title m-0 text-[22px] font-bold">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 text-slate-500 text-[13px] m-0">
            {subtitle}
          </p>
        )}
      </div>
      <div className="header-actions dashboard-header-actions flex items-center gap-[15px]">
        {primaryAction && (
          <button className="btn btn-primary btn-small w-auto whitespace-nowrap" onClick={primaryAction.onClick} type="button">
            {primaryAction.icon && <i className={`fas ${primaryAction.icon}`}></i>}
            {primaryAction.label}
          </button>
        )}
        {showSearch && (
          <div className="search-bar flex items-center bg-white py-1.5 px-3 rounded-full border border-slate-200">
            <i className="fas fa-search text-slate-400 mr-2"></i>
            <input type="text" placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              aria-label={searchPlaceholder}
              className="border-none bg-transparent outline-none text-inherit" />
          </div>
        )}
        <button className="btn btn-secondary btn-small" onClick={onToggleTheme}
          title={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}
          aria-label={isDark ? 'Activer le thème clair' : 'Activer le thème sombre'}>
          <i className={isDark ? 'fas fa-sun' : 'fas fa-moon'}></i>
        </button>
        <div className="user-profile dashboard-user-profile flex items-center gap-2.5">
          <div className="avatar w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold">
            {avatarText}
          </div>
          <div className="text-[13px]">
            <div className="font-semibold">{user?.displayName || 'Direction'}</div>
            <div className="text-slate-400 text-[11px]">{roleText}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
