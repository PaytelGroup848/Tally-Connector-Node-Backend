const axios = require('axios');

const getBrevoClient = () => {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not set');
  }

  return axios.create({
    baseURL: 'https://api.brevo.com/v3',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    timeout: 15000,
  });
};

module.exports = { getBrevoClient };
