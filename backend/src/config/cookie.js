/**
 * Configuration des cookies HttpOnly pour SYGIM
 */

const isProd = process.env.NODE_ENV === 'production';

const accessTokenOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/',
  maxAge: 15 * 60 * 1000 // 15 minutes
};

const refreshTokenOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: 'lax',
  path: '/api/auth/',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 jours
};

module.exports = {
  accessTokenOptions,
  refreshTokenOptions
};
