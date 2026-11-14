import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../hooks/queries/useNotifications';
import { formatDate } from '../utils/formatters';

const TYPE_CONFIG = {
  SUCCESS: { icon: 'fa-circle-check', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  INFO: { icon: 'fa-circle-info', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
  WARNING: { icon: 'fa-triangle-exclamation', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
  ERROR: { icon: 'fa-circle-xmark', color: 'text-rose-600', bg: 'bg-rose-50 border-rose-200' },
};

export default function Notifications() {
  const navigate = useNavigate();
  const [filterRead, setFilterRead] = useState('all'); // 'all' | 'unread' | 'read'
  const [filterCategory, setFilterCategory] = useState('all');

  const { data = {}, isLoading, refetch } = useNotifications({
    isRead: filterRead === 'unread' ? false : filterRead === 'read' ? true : undefined,
    category: filterCategory !== 'all' ? filterCategory : undefined,
  });

  const notifications = data.notifications || [];
  const unreadCount = data.unreadCount || 0;

  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const handleNotificationClick = async (notif) => {
    if (!notif.is_read) {
      await markReadMutation.mutateAsync(notif.id);
    }
    if (notif.reference_link) {
      navigate(notif.reference_link);
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">
      {/* EN-TÊTE DE PAGE */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <i className="fas fa-bell text-lg"></i>
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Centre de Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-500 text-white animate-pulse">
                  {unreadCount} non lue{unreadCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Suivi en temps réel des créations de biens, mandats bailleurs, attributions et alertes d'exploitation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5"
            >
              <i className="fas fa-check-double text-slate-400"></i>
              <span>Tout marquer comme lu</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
          >
            <i className="fas fa-rotate text-slate-400"></i>
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* FILTRES RAPIDES */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200/80 rounded-xl p-3 shadow-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterRead('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterRead === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Toutes ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterRead('unread')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterRead === 'unread'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Non lues ({unreadCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterRead('read')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterRead === 'read'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Déjà lues
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Catégorie :</span>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none"
          >
            <option value="all">Toutes les catégories</option>
            <option value="PROPERTY">Biens immobiliers</option>
            <option value="OWNER">Propriétaires bailleurs</option>
            <option value="ASSIGNMENT">Attributions de biens</option>
            <option value="SYSTEM">Système & Alertes</option>
          </select>
        </div>
      </div>

      {/* LISTE DES NOTIFICATIONS */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-xs overflow-hidden divide-y divide-slate-100">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            <i className="fas fa-spinner fa-spin mr-2"></i> Chargement des notifications...
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs space-y-2">
            <i className="fas fa-bell-slash text-3xl mb-1 text-slate-300 block"></i>
            <div className="font-semibold text-slate-600">Aucune notification pour le moment</div>
            <p className="text-slate-400">Toutes vos confirmations d'enregistrement et d'attribution apparaîtront ici.</p>
          </div>
        ) : (
          notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.INFO;
            const isUnread = !notif.is_read;

            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={`p-4 flex items-start justify-between gap-4 transition-colors cursor-pointer hover:bg-slate-50 ${
                  isUnread ? 'bg-sky-50/30' : 'bg-white'
                }`}
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${config.bg} ${config.color}`}
                  >
                    <i className={`fas ${config.icon} text-sm`}></i>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-900">{notif.title}</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {notif.category}
                      </span>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" title="Non lu"></span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">{notif.message}</p>
                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-2">
                      <i className="fas fa-clock text-[10px]"></i>
                      <span>
                        {formatDate(notif.created_at, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                      {notif.reference_link && (
                        <>
                          <span>•</span>
                          <span className="text-primary hover:underline font-medium flex items-center gap-1">
                            <span>Accéder</span>
                            <i className="fas fa-arrow-right text-[9px]"></i>
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  {isUnread && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        markReadMutation.mutate(notif.id);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-600 p-1.5 rounded-md hover:bg-slate-100"
                      title="Marquer comme lu"
                    >
                      <i className="fas fa-check"></i>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
