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
const OURA_SCOPES = 'daily session workout';
const SESSION_COOKIE_NAME = 'oura_session_id';
const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days
const oauthStates = new Map(); // state -> session id
const sessionStore = new Map(); // session id -> { accessToken, latestData, updatedAt }

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  return cookieHeader
    .split(';')
    .map(part => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return cookies;
      const key = part.slice(0, separatorIndex).trim();
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      cookies[key] = value;
      return cookies;
    }, {});
}

function getOrCreateSessionId(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const existingSessionId = cookies[SESSION_COOKIE_NAME];
  if (existingSessionId && sessionStore.has(existingSessionId)) {
    return existingSessionId;
  }

  const sessionId = crypto.randomBytes(24).toString('hex');
  sessionStore.set(sessionId, {
    accessToken: null,
    latestData: null,
    updatedAt: Date.now()
  });

  res.append('Set-Cookie', `${SESSION_COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_COOKIE_MAX_AGE_SECONDS}`);
  return sessionId;
}

function getSessionById(sessionId) {
  return sessionStore.get(sessionId) || null;
}

function getSessionAccessToken(sessionId) {
  return getSessionById(sessionId)?.accessToken || null;
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
  const sessionId = getOrCreateSessionId(req, res);
  res.json({ authorized: Boolean(getSessionAccessToken(sessionId)) });
});

app.get('/data/latest', (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const sessionData = getSessionById(sessionId);
  if (!sessionData?.latestData) {
    return res.json({ success: false, error: 'No saved dataset found yet.' });
  }

  return res.json({
    success: true,
    data: sessionData.latestData
  });
});

app.get('/auth/start', (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const oauthConfig = requireOAuthConfiguration();
  if (!oauthConfig) {
    return res.status(500).json({
      success: false,
      error: 'OAuth is not configured. Set OURA_CLIENT_ID and OURA_CLIENT_SECRET.'
    });
  }

  const state = crypto.randomBytes(24).toString('hex');
  oauthStates.set(state, sessionId);

  const authorizationUrl = new URL(OURA_AUTH_BASE_URL);
  authorizationUrl.searchParams.set('client_id', oauthConfig.clientId);
  authorizationUrl.searchParams.set('redirect_uri', oauthConfig.redirectUri);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', OURA_SCOPES);
  authorizationUrl.searchParams.set('state', state);

  return res.redirect(authorizationUrl.toString());
});

app.get('/auth/callback', async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const oauthConfig = requireOAuthConfiguration();
  if (!oauthConfig) {
    return res.redirect('/?auth=error&message=OAuth+is+not+configured');
  }

  const { code, state, error } = req.query;
  if (error) {
    return res.redirect(`/?auth=error&message=${encodeURIComponent(String(error))}`);
  }
  const expectedSessionId = oauthStates.get(String(state));
  if (!code || !state || !expectedSessionId || expectedSessionId !== sessionId) {
    return res.redirect('/?auth=error&message=Invalid+OAuth+callback+state');
  }
  oauthStates.delete(String(state));

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

    const session = getSessionById(sessionId);
    if (!session) {
      return res.redirect('/?auth=error&message=Session+not+found');
    }
    session.accessToken = tokenPayload.access_token;
    session.updatedAt = Date.now();
    return res.redirect('/?auth=success');
  } catch (exchangeError) {
    console.error('[ERROR] OAuth callback:', exchangeError);
    return res.redirect('/?auth=error&message=OAuth+token+exchange+failed');
  }
});

app.post('/fetch', async (req, res) => {
  const sessionId = getOrCreateSessionId(req, res);
  const { start, end, format } = req.body;
  if (!start || !end || !format) {
    return res.json({ success: false, error: 'Missing required fields.' });
  }
  const accessToken = getSessionAccessToken(sessionId);
  if (!accessToken) {
    return res.json({
      success: false,
      error: 'Auth is not configured for this browser session. Authorize via /auth/start.'
    });
  }
  try {
    const data = await fetchAndSaveOuraData({ accessToken, startDate: start, endDate: end, format });
    const session = getSessionById(sessionId);
    if (session) {
      session.latestData = data;
      session.updatedAt = Date.now();
    }
    res.json({ success: true, data });
  } catch (error) {
    console.error('[ERROR] fetchAndSaveOuraData:', error);
    res.json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Oura Data Fetcher server running at http://localhost:${PORT}`);
});
