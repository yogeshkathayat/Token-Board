/**
 * OIDC integration. The IdP is configured per deployment via env vars
 * (OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET). Any OIDC-compliant
 * IdP works: Google Workspace, Okta, Auth0, Azure AD, Keycloak, etc.
 *
 * State + nonce are stored in short-lived cookies signed by JWT_SECRET.
 */
import { Issuer, generators, type Client } from 'openid-client';

import { config, isOidcConfigured } from '../config.js';

let cachedClient: Client | null = null;

export async function getOidcClient(): Promise<Client> {
  if (!isOidcConfigured()) {
    throw Object.assign(new Error('OIDC not configured on this server'), { statusCode: 501 });
  }
  if (cachedClient) return cachedClient;
  const issuer = await Issuer.discover(config.oidcIssuer);
  cachedClient = new issuer.Client({
    client_id: config.oidcClientId,
    client_secret: config.oidcClientSecret,
    redirect_uris: [config.oidcRedirectUri],
    response_types: ['code'],
  });
  return cachedClient;
}

export interface OidcAuthRequest {
  authorizeUrl: string;
  state: string;
  nonce: string;
  codeVerifier: string;
}

export async function buildAuthRequest(): Promise<OidcAuthRequest> {
  const client = await getOidcClient();
  const state = generators.state();
  const nonce = generators.nonce();
  const codeVerifier = generators.codeVerifier();
  const codeChallenge = generators.codeChallenge(codeVerifier);
  const authorizeUrl = client.authorizationUrl({
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return { authorizeUrl, state, nonce, codeVerifier };
}

export interface OidcUserInfo {
  sub: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
}

export async function handleCallback(input: {
  code: string;
  state: string;
  expectedState: string;
  expectedNonce: string;
  codeVerifier: string;
}): Promise<OidcUserInfo> {
  const client = await getOidcClient();
  const tokenSet = await client.callback(
    config.oidcRedirectUri,
    { code: input.code, state: input.state },
    { state: input.expectedState, nonce: input.expectedNonce, code_verifier: input.codeVerifier },
  );
  const claims = tokenSet.claims();
  const email = String(claims.email ?? '').toLowerCase();
  if (!email) {
    throw Object.assign(new Error('IdP returned no email claim'), { statusCode: 400 });
  }
  return {
    sub: String(claims.sub),
    email,
    emailVerified: Boolean(claims.email_verified),
    name: typeof claims.name === 'string' ? claims.name : null,
    picture: typeof claims.picture === 'string' ? claims.picture : null,
  };
}
