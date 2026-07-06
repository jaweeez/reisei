// Vercel serverless entry. vercel.json rewrites every request here; the Expo
// request handler (built to dist/server) serves the static web pages AND the
// Expo Router API routes (src/app/api/**+api.ts). Adapter: expo-server/adapter/vercel.
// This file is CommonJS, runs only on Vercel, and is excluded from the tsc build.
const { createRequestHandler } = require('expo-server/adapter/vercel');

module.exports = createRequestHandler({
  build: require('path').join(__dirname, '../dist/server'),
});
