// Expo Router API routes (server output) require the Expo Metro config.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
