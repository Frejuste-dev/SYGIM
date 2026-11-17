/**
 * Configuration des cookies HttpOnly pour SYGIM
 * Supporte le mode SameSite=None / Secure pour les déploiements Cross-Site (Cloudflare Workers/Pages + Tunnel)
 */

const isProd = process.env.NODE_ENV === 'production';
// En environnement Cloudflare / cross-site HTTPS, SameSite=None et Secure=true sont indispensables
const isCrossSite = true;

const accessTokenOptions = {
  httpOnly: true,
  secure: isCrossSite || isProd,
  sameSite: isCrossSite || isProd ? 'none' : 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000 // 15 minutes
};

const refreshTokenOptions = {
  httpOnly: true,
  secure: isCrossSite || isProd,
  sameSite: isCrossSite || isProd ? 'none' : 'lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
};

module.exports = {
  accessTokenOptions,
  refreshTokenOptions
};
