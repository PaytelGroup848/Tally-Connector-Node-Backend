// services/gspProvider/index.js
const clearTaxAdapter = require("./clearTaxAdapter");
// const cygnetAdapter = require('./cygnetAdapter'); // future

const PROVIDERS = {
  CLEARTAX: clearTaxAdapter,
};

const getProvider = (providerName) => {
  const provider = PROVIDERS[providerName];
  if (!provider) throw new Error(`Unsupported GSP provider: ${providerName}`);
  return provider;
};

module.exports = { getProvider };
