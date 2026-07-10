// server.js
// Simple Express server to serve the HTML form and handle Oura data fetch requests

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const { fetchAndSaveOuraData } = require('./OuraDataService');

const app = express();
const PORT = process.env.PORT || 3000;
const OURA_AUTH_BASE_URL = 'https://cloud.ouraring.com/oauth/authorize';
const OURA_TOKEN_URL = 'https://api.ouraring.com/oauth/token';
const OURA_SCOPES = 'daily session workout heartrate';
const oauthStates = new Set();
let runtimeAccessToken = null;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function getConfiguredAccessToken() {
  return runtimeAccessToken || process.env.OURA_ACCESS_TOKEN || null;
}

function getRedirectUri() {
  return process.env.OURA_REDIRECT_URI || `http://localhost:${PORT}/auth/callback`;
}

function requireOAuthConfiguration() {
  const clientId = process.env.OURA_CLIENT_ID;
  const clientSecret = process.env.OURA_CLIENT_SECRET;
  const redirectUri = getRedirectUri();
  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }
  return { clientId, clientSecret, redirectUri };
}

app.get('/auth/status', (req, res) => {
  res.json({ authorized: Boolean(getConfiguredAccessToken()) });
});

app.get('/auth/start', (req, res) => {
  const oauthConfig = requireOAuthConfiguration();
  if (!oauthConfig) {
    return res.status(500).json({
      success: false,
      error: 'OAuth is not configured. Set OURA_CLIENT_ID and OURA_CLIENT_SECRET.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.add(state);

  const authorizationUrl = new URL(OURA_AUTH_BASE_URL);
  authorizationUrl.searchParams.set('client_id', oauthConfig.clientId);
  authorizationUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', OURA_SCOPES);
  authorizationUrl.searchParams.set('state', state);

  return res.redirect(authorizationUrl.toString());
});

app.get('/auth/callback', async (req, res) => {
  const oauthConfig = requireOAuthConfiguration();
  if (!oauthConfig) {
    return res.redirect('/?auth=error&message=OAuth+is+not+configured');
  }

  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`/?auth=error&message=${encodeURIComponent(String(error))}`);
  }
  if (!code || !state || !oauthStates.has(state)) {
    return res.redirect('/?auth=error&message=Invalid+OAuth+callback+state');
  }
  oauthStates.delete(state);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: String(code),
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret,
    redirect_uri: oauthConfig.redirectUri
  });

  try {
    const tokenResponse = await fetch(OURA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`OAuth token exchange failed (${tokenResponse.status}): ${errorText}`);
    }

    const tokenPayload = await tokenResponse.json();
    if (!tokenPayload.access_token) {
      throw new Error('OAuth token exchange did not return access_token.');
    }

    runtimeAccessToken = tokenPayload.access_token;
    return res.redirect('/?auth=success');
  } catch (exchangeError) {
    console.error('[ERROR] OAuth callback:', exchangeError);
    return res.redirect('/?auth=error&message=OAuth+token+exchange+failed');
  }
});

app.post('/fetch', async (req, res) => {
  const { start, end, format } = req.body;
  if (!start || !end || !format) {
    return res.json({ success: false, error: 'Missing required fields.' });
  }
  const accessToken = getConfiguredAccessToken();
  if (!accessToken) {
    return res.json({
      success: false,
      error: 'Auth is not configured. Set OURA_ACCESS_TOKEN or authorize via /auth/start.'
    });
  }
  try {
    const data = await fetchAndSaveOuraData({ accessToken, startDate: start, endDate: end, format });
    res.json({ success: true, data });
  } catch (error) {
    console.error('[ERROR] fetchAndSaveOuraData:', error);
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oura Data Fetcher server running at http://localhost:${PORT}`);
});
