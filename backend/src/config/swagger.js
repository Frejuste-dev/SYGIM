const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'SYGIM API — Système de Gestion Immobilière',
    version: '2.0.0',
    description: `API REST professionnelle pour la gestion immobilière.
    
## Authentification
Toutes les routes (sauf /health, /api/auth/login, /api/auth/register) nécessitent un token JWT dans le header \`Authorization: Bearer <token>\`.

## Formats de réponse
- **Succès**: \`{ success: true, statusCode, message, data, timestamp }\`
- **Erreur**: \`{ success: false, statusCode, message, code, timestamp }\`
- **Paginated**: \`{ success: true, data[], pagination: { page, limit, total, totalPages, hasNextPage, hasPreviousPage } }\`
`,
    contact: {
      name: 'SYGIM Team'
    },
    license: {
      name: 'UNLICENSED'
    }
  },
  servers: [
    { url: 'http://localhost:5000', description: 'Développement local' },
    { url: 'http://localhost:5001', description: 'Via Nginx (Docker)' }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          statusCode: { type: 'integer', example: 400 },
          message: { type: 'string', example: 'Message d\'erreur' },
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          username: { type: 'string' },
          role: { type: 'string', enum: ['admin', 'director', 'accounting', 'collector_manager', 'collector'] },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          displayName: { type: 'string' },
          email: { type: 'string', format: 'email' },
          phone: { type: 'string' },
          active: { type: 'boolean' }
        }
      },
      Client: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          property_name: { type: 'string' },
          amount_due: { type: 'number' },
          amount_paid: { type: 'number' },
          status: { type: 'string', enum: ['pending', 'paid', 'late', 'partial', 'inactive'] },
          collector_id: { type: 'integer' },
          owner_id: { type: 'integer' }
        }
      },
      Property: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          address: { type: 'string' },
          type: { type: 'string', enum: ['maison', 'appartement', 'villa', 'commercial', 'terrain'] },
          status: { type: 'string', enum: ['vacant', 'loue', 'maintenance'] },
          rent: { type: 'number' },
          owner_id: { type: 'integer' },
          tenant_id: { type: 'integer' }
        }
      },
      Transaction: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          reference: { type: 'string' },
          date: { type: 'string', format: 'date' },
          client_id: { type: 'integer' },
          client_name: { type: 'string' },
          amount: { type: 'number' },
          method: { type: 'string', enum: ['cash', 'wave', 'orange_money', 'mtn_money', 'bank_transfer', 'cheque'] },
          status: { type: 'string', enum: ['processed', 'pending', 'cancelled'] },
          collector_id: { type: 'integer' }
        }
      },
      Owner: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' }
        }
      },
      Collector: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone: { type: 'string' },
          email: { type: 'string' },
          user_id: { type: 'integer' },
          active: { type: 'boolean' }
        }
      }
    }
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Vérification de santé',
        responses: {
          '200': {
            description: 'Services OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    services: {
                      type: 'object',
                      properties: {
                        database: { type: 'string', example: 'ok' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },

    '/api/auth/login': {
      post: {
        tags: ['Authentification'],
        summary: 'Connexion utilisateur',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'admin_prod' },
                  password: { type: 'string', format: 'password', example: 'AdminSecure2024!' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Connexion réussie',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'object',
                      properties: {
                        accessToken: { type: 'string' },
                        refreshToken: { type: 'string' },
                        user: { $ref: '#/components/schemas/User' }
                      }
                    }
                  }
                }
              }
            }
          },
          '401': { description: 'Identifiants invalides' }
        }
      }
    },
    '/api/auth/register': {
      post: {
        tags: ['Authentification'],
        summary: 'Inscription (rôle collecteur par défaut)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string' },
                  password: { type: 'string', minLength: 6 },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  phone: { type: 'string' },
                  email: { type: 'string', format: 'email' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Inscription réussie' },
          '400': { description: 'Données invalides' },
          '409': { description: 'Conflit (username/email déjà utilisé)' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        tags: ['Authentification'],
        summary: 'Profil utilisateur courant',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Profil utilisateur' }
        }
      }
    },
    '/api/auth/refresh': {
      post: {
        tags: ['Authentification'],
        summary: 'Rafraîchir le token JWT',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  refreshToken: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': { description: 'Nouveau token' }
        }
      }
    },
    '/api/auth/logout': {
      post: {
        tags: ['Authentification'],
        summary: 'Déconnexion',
        responses: {
          '200': { description: 'Déconnexion réussie' }
        }
      }
    },

    '/api/users': {
      get: {
        tags: ['Utilisateurs'],
        summary: 'Liste des utilisateurs (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Liste des utilisateurs',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/User' }
                    }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Utilisateurs'],
        summary: 'Créer un utilisateur (admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Utilisateur créé' }
        }
      }
    },
    '/api/users/{id}': {
      get: {
        tags: ['Utilisateurs'],
        summary: 'Détail d\'un utilisateur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Utilisateur' },
          '404': { description: 'Non trouvé' }
        }
      },
      put: {
        tags: ['Utilisateurs'],
        summary: 'Modifier un utilisateur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Utilisateur modifié' }
        }
      },
      delete: {
        tags: ['Utilisateurs'],
        summary: 'Supprimer un utilisateur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Supprimé' },
          '400': { description: 'Impossible de supprimer son propre compte' }
        }
      }
    },

    '/api/clients': {
      get: {
        tags: ['Clients'],
        summary: 'Liste des clients',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'collectorId', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20 } }
        ],
        responses: {
          '200': {
            description: 'Liste des clients',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { type: 'array', items: { $ref: '#/components/schemas/Client' } }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        tags: ['Clients'],
        summary: 'Créer un client',
        security: [{ bearerAuth: [] }],
        responses: {
          '201': { description: 'Client créé' }
        }
      }
    },
    '/api/clients/{id}': {
      get: {
        tags: ['Clients'],
        summary: 'Détail d\'un client',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Client' } }
      },
      put: {
        tags: ['Clients'],
        summary: 'Modifier un client',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Client modifié' } }
      },
      delete: {
        tags: ['Clients'],
        summary: 'Supprimer un client',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Client supprimé' } }
      }
    },
    '/api/clients/{id}/replace': {
      post: {
        tags: ['Clients'],
        summary: 'Remplacer un locataire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Remplacement effectué' } }
      }
    },

    '/api/properties': {
      get: {
        tags: ['Propriétés'],
        summary: 'Liste des propriétés',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Liste des propriétés' } }
      },
      post: {
        tags: ['Propriétés'],
        summary: 'Créer une propriété',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Propriété créée' } }
      }
    },
    '/api/properties/stats': {
      get: {
        tags: ['Propriétés'],
        summary: 'Statistiques des propriétés',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Statistiques' } }
      }
    },
    '/api/properties/{id}': {
      get: {
        tags: ['Propriétés'],
        summary: 'Détail d\'une propriété',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriété' } }
      },
      put: {
        tags: ['Propriétés'],
        summary: 'Modifier une propriété',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriété modifiée' } }
      },
      delete: {
        tags: ['Propriétés'],
        summary: 'Supprimer une propriété',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriété supprimée' } }
      }
    },
    '/api/properties/{id}/assign': {
      post: {
        tags: ['Propriétés'],
        summary: 'Assigner un locataire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Locataire assigné' } }
      }
    },
    '/api/properties/{id}/release': {
      post: {
        tags: ['Propriétés'],
        summary: 'Libérer un locataire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriété libérée' } }
      }
    },

    '/api/owners': {
      get: {
        tags: ['Propriétaires'],
        summary: 'Liste des propriétaires',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Liste des propriétaires' } }
      },
      post: {
        tags: ['Propriétaires'],
        summary: 'Créer un propriétaire',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Propriétaire créé' } }
      }
    },
    '/api/owners/{id}': {
      get: {
        tags: ['Propriétaires'],
        summary: 'Détail d\'un propriétaire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriétaire' } }
      },
      put: {
        tags: ['Propriétaires'],
        summary: 'Modifier un propriétaire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriétaire modifié' } }
      },
      delete: {
        tags: ['Propriétaires'],
        summary: 'Supprimer un propriétaire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Propriétaire supprimé' } }
      }
    },
    '/api/owners/{id}/portfolio': {
      get: {
        tags: ['Propriétaires'],
        summary: 'Portfolio d\'un propriétaire',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Portfolio' } }
      }
    },

    '/api/transactions': {
      get: {
        tags: ['Transactions'],
        summary: 'Liste des transactions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'method', in: 'query', schema: { type: 'string' } },
          { name: 'clientId', in: 'query', schema: { type: 'integer' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Liste des transactions' } }
      },
      post: {
        tags: ['Transactions'],
        summary: 'Enregistrer une transaction',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Transaction créée' } }
      }
    },
    '/api/transactions/stats': {
      get: {
        tags: ['Transactions'],
        summary: 'Statistiques des transactions',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['day', 'month', 'year'] } }
        ],
        responses: { '200': { description: 'Statistiques' } }
      }
    },
    '/api/transactions/{id}': {
      get: {
        tags: ['Transactions'],
        summary: 'Détail d\'une transaction',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Transaction' } }
      },
      put: {
        tags: ['Transactions'],
        summary: 'Modifier une transaction',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Transaction modifiée' } }
      },
      delete: {
        tags: ['Transactions'],
        summary: 'Supprimer une transaction',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Transaction supprimée' } }
      }
    },

    '/api/alerts/overdue-payments': {
      get: {
        tags: ['Alertes'],
        summary: 'Alertes de paiement en retard',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'collectorId', in: 'query', schema: { type: 'integer' } },
          { name: 'severity', in: 'query', schema: { type: 'string', enum: ['all', 'normale', 'haute', 'critique', 'basse'] } },
          { name: 'daysThreshold', in: 'query', schema: { type: 'integer', default: 15 } }
        ],
        responses: { '200': { description: 'Alertes et statistiques' } }
      }
    },
    '/api/alerts/dashboard': {
      get: {
        tags: ['Alertes'],
        summary: 'Dashboard des alertes (admin/director/accounting)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Données du dashboard' } }
      }
    },
    '/api/alerts/summary': {
      get: {
        tags: ['Alertes'],
        summary: 'Résumé des alertes par sévérité',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Résumé' } }
      }
    },
    '/api/alerts/{clientId}/acknowledge': {
      put: {
        tags: ['Alertes'],
        summary: 'Marquer une alerte comme reconnue',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'clientId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Alerte reconnue' } }
      }
    },

    '/api/collectors': {
      get: {
        tags: ['Collecteurs'],
        summary: 'Liste des collecteurs',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Liste des collecteurs' } }
      },
      post: {
        tags: ['Collecteurs'],
        summary: 'Créer un collecteur',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Collecteur créé' } }
      }
    },
    '/api/collectors/{id}': {
      get: {
        tags: ['Collecteurs'],
        summary: 'Détail d\'un collecteur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Collecteur' } }
      },
      put: {
        tags: ['Collecteurs'],
        summary: 'Modifier un collecteur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Collecteur modifié' } }
      },
      delete: {
        tags: ['Collecteurs'],
        summary: 'Supprimer un collecteur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Collecteur supprimé' } }
      }
    },
    '/api/rgpd/me/export': {
      get: {
        tags: ['RGPD'],
        summary: 'Exporter ses données personnelles (Art. 20)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Export JSON de toutes les données liées à l\'utilisateur' } }
      }
    },
    '/api/rgpd/me/data': {
      delete: {
        tags: ['RGPD'],
        summary: 'Supprimer son compte et ses données (Art. 17)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Compte anonymisé' } }
      }
    },
    '/api/rgpd/admin/purge-logs': {
      post: {
        tags: ['RGPD'],
        summary: 'Purger les logs d\'activité de plus de 90 jours (admin)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Logs purgés' } }
      }
    },

    '/api/collectors/{id}/stats': {
      get: {
        tags: ['Collecteurs'],
        summary: 'Statistiques d\'un collecteur',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Statistiques' } }
      }
    },

    '/api/reports': {
      get: {
        tags: ['Rapports'],
        summary: 'Liste des rapports générés',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Liste des rapports' } }
      },
      post: {
        tags: ['Rapports'],
        summary: 'Générer un rapport',
        security: [{ bearerAuth: [] }],
        responses: { '201': { description: 'Rapport généré' } }
      }
    },
    '/api/reports/{id}': {
      get: {
        tags: ['Rapports'],
        summary: 'Télécharger un rapport',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Fichier rapport' } }
      }
    }
  }
};

module.exports = swaggerJsdoc({
  definition: swaggerDefinition,
  apis: []
});
