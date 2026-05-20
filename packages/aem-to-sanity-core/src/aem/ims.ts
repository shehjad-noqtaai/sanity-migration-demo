import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

/**
 * Adobe IMS Service Credentials parsing + token exchange.
 *
 * AEM as a Cloud Service does not accept basic auth. Operators authenticate
 * via Adobe IMS using one of:
 *
 *   1. **OAuth Server-to-Server** (Adobe's current recommendation, replacing
 *      JWT for new integrations from 2024 onward). The Service Credentials
 *      JSON downloaded from Adobe Developer Console includes a `CLIENT_ID`,
 *      `CLIENT_SECRET`, and `SCOPES`. We exchange those for an access token
 *      at `POST {imsEndpoint}/ims/token/v3` with `grant_type=client_credentials`.
 *
 *   2. **Legacy JWT exchange** (still issued for some AEMaaCS environments —
 *      deprecated by Adobe but supported by IMS through the migration window).
 *      The Service Credentials JSON includes a `privateKey`, `metascopes`, and
 *      a technical-account `id`. We sign a JWT with RS256, then exchange it
 *      at `POST {imsEndpoint}/ims/exchange/jwt/`.
 *
 *   3. **Developer / local-development token** (a short-lived bearer pasted
 *      directly into `AEM_TOKEN`). No exchange needed — the existing bearer
 *      auth path handles it.
 *
 * This module covers (1) and (2). The on-disk Service Credentials JSON shape
 * has evolved over the years; `parseServiceCredentials` accepts both modern
 * "flat" and legacy "integration-wrapped" formats so operators can paste in
 * the file Adobe Developer Console produced for them without hand-editing.
 */

export interface ServiceCredentials {
  /** Adobe IMS host, no scheme. e.g. `ims-na1.adobelogin.com`. */
  imsEndpoint: string;
  clientId: string;
  clientSecret: string;
  /** OAuth Server-to-Server scopes. Present in modern (2024+) credentials. */
  scopes?: string[];
  /** Legacy JWT — Adobe org id (e.g. `123ABC@AdobeOrg`). */
  org?: string;
  /** Legacy JWT — technical account id (e.g. `xxxxx@techacct.adobe.com`). */
  technicalAccountId?: string;
  /** Legacy JWT — metascopes granted to the technical account. */
  metascopes?: string[];
  /** Legacy JWT — PEM-encoded RSA private key. */
  privateKey?: string;
}

export interface ExchangedToken {
  accessToken: string;
  /** ms since epoch when the access token expires. */
  expiresAt: number;
  tokenType: string;
}

/**
 * Read a Service Credentials JSON file from disk. Convenience for CLIs that
 * point at a file via `AEM_SERVICE_CREDENTIALS_FILE`.
 */
export function readServiceCredentialsFile(path: string): ServiceCredentials {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    throw new Error(
      `Failed to read AEM service credentials at ${path}: ${(err as Error).message}`,
    );
  }
  return parseServiceCredentials(raw);
}

/**
 * Normalize a raw Service Credentials JSON blob into our internal shape.
 *
 * Accepted inputs:
 *
 * - **Modern (Server-to-Server, flat)** as Adobe Developer Console emits today:
 *   ```
 *   {
 *     "CLIENT_ID": "...",
 *     "CLIENT_SECRETS": ["..."],  // singular and plural both supported
 *     "CLIENT_SECRET": "...",
 *     "TECHNICAL_ACCOUNT_ID": "...",
 *     "TECHNICAL_ACCOUNT_EMAIL": "...",
 *     "IMS_ORG_ID": "...@AdobeOrg",
 *     "SCOPES": ["AdobeID", "openid", "read_organizations", ...],
 *     "IMS_HOST": "ims-na1.adobelogin.com"      // optional
 *   }
 *   ```
 *
 * - **Modern (Server-to-Server, wrapped)** as some Cloud Manager downloads emit:
 *   ```
 *   { "ok": true, "integration": { ...same keys as flat... } }
 *   ```
 *
 * - **Legacy JWT** (the older Service Credentials JSON for AEMaaCS):
 *   ```
 *   {
 *     "ok": true,
 *     "integration": {
 *       "imsEndpoint": "ims-na1.adobelogin.com",
 *       "metascopes": "ent_aem_cloud_api",
 *       "technicalAccount": { "clientId": "...", "clientSecret": "..." },
 *       "id": "...@techacct.adobe.com",
 *       "org": "...@AdobeOrg",
 *       "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----\n"
 *     }
 *   }
 *   ```
 *
 * Throws a descriptive error if neither shape is recognized — operators get
 * a clear message instead of an opaque "undefined is not a string" later in
 * the JWT signer.
 */
export function parseServiceCredentials(input: unknown): ServiceCredentials {
  if (!input || typeof input !== "object") {
    throw new Error(
      "AEM service credentials JSON must be an object. Got " + typeof input,
    );
  }
  const top = input as Record<string, unknown>;
  // Cloud Manager downloads commonly wrap the credential payload in
  // `{ ok: true, integration: {...} }`. Unwrap before inspecting.
  const body = (isRecord(top.integration) ? top.integration : top) as Record<
    string,
    unknown
  >;

  // Modern (Server-to-Server) — uppercase keys are canonical, but lowercase
  // is occasionally seen in older downloads. Probe both.
  const clientId = pickString(body, ["CLIENT_ID", "client_id", "clientId"]);
  const clientSecret =
    pickString(body, ["CLIENT_SECRET", "client_secret", "clientSecret"]) ??
    pickFirstString(body, ["CLIENT_SECRETS", "client_secrets"]);

  // Legacy JWT places clientId/clientSecret under `technicalAccount`.
  const techAccount = isRecord(body.technicalAccount)
    ? body.technicalAccount
    : undefined;
  const jwtClientId =
    clientId ?? (techAccount ? pickString(techAccount, ["clientId", "client_id"]) : undefined);
  const jwtClientSecret =
    clientSecret ??
    (techAccount ? pickString(techAccount, ["clientSecret", "client_secret"]) : undefined);

  if (!jwtClientId || !jwtClientSecret) {
    throw new Error(
      "AEM service credentials JSON is missing client id / client secret. " +
        "Expected `CLIENT_ID` + `CLIENT_SECRET` (Server-to-Server) or " +
        "`integration.technicalAccount.{clientId,clientSecret}` (legacy JWT).",
    );
  }

  const imsEndpoint =
    pickString(body, ["IMS_HOST", "imsEndpoint", "ims_endpoint"]) ??
    "ims-na1.adobelogin.com";

  const scopes =
    pickStringArray(body, ["SCOPES", "scopes"]) ??
    (typeof body.scope === "string" ? splitScopes(body.scope) : undefined);

  const metascopes =
    pickStringArray(body, ["metascopes"]) ??
    (typeof body.metascopes === "string" ? splitScopes(body.metascopes as string) : undefined);

  const technicalAccountId =
    pickString(body, ["TECHNICAL_ACCOUNT_ID", "technicalAccountId"]) ??
    pickString(body, ["id"]);

  const org = pickString(body, ["IMS_ORG_ID", "org", "imsOrgId"]);

  const privateKey = pickString(body, ["privateKey", "private_key"]);

  // Decide which flow this credential supports. Prefer Server-to-Server when
  // SCOPES are present — Adobe's stated recommendation. Fall back to JWT
  // only if a privateKey + metascopes are present.
  const hasOAuth = scopes && scopes.length > 0;
  const hasJwt = privateKey && metascopes && metascopes.length > 0 && technicalAccountId && org;

  if (!hasOAuth && !hasJwt) {
    throw new Error(
      "AEM service credentials JSON is missing the fields needed for either flow. " +
        "For Server-to-Server: SCOPES. For legacy JWT: privateKey + metascopes + technicalAccountId + org.",
    );
  }

  return {
    imsEndpoint,
    clientId: jwtClientId,
    clientSecret: jwtClientSecret,
    scopes,
    org,
    technicalAccountId,
    metascopes,
    privateKey,
  };
}

/**
 * Exchange Service Credentials for an Adobe IMS access token.
 *
 * Picks the right flow automatically:
 *  - `scopes` present → OAuth Server-to-Server (`/ims/token/v3`, `client_credentials`).
 *  - else `privateKey` + `metascopes` present → legacy JWT (`/ims/exchange/jwt/`).
 *
 * Throws a descriptive error on IMS rejection (4xx/5xx) so credential issues
 * surface as a single banner line, not as cryptic 401s deep in the AEM walker.
 */
export async function exchangeImsToken(
  creds: ServiceCredentials,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ExchangedToken> {
  if (creds.scopes && creds.scopes.length > 0) {
    return exchangeOAuth(creds, fetchImpl);
  }
  if (creds.privateKey && creds.metascopes && creds.metascopes.length > 0) {
    return exchangeJwt(creds, fetchImpl);
  }
  throw new Error(
    "Service credentials missing both `scopes` (OAuth) and `privateKey`+`metascopes` (JWT) — " +
      "cannot pick an exchange flow.",
  );
}

async function exchangeOAuth(
  creds: ServiceCredentials,
  fetchImpl: typeof globalThis.fetch,
): Promise<ExchangedToken> {
  const url = `https://${creds.imsEndpoint}/ims/token/v3`;
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    scope: creds.scopes!.join(","),
  });
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return parseImsResponse(res, "OAuth Server-to-Server");
}

async function exchangeJwt(
  creds: ServiceCredentials,
  fetchImpl: typeof globalThis.fetch,
): Promise<ExchangedToken> {
  const now = Math.floor(Date.now() / 1000);
  const claims: Record<string, unknown> = {
    exp: now + 60 * 60, // 1h — IMS will issue a shorter-lived access token from this.
    iss: creds.org,
    sub: creds.technicalAccountId,
    aud: `https://${creds.imsEndpoint}/c/${creds.clientId}`,
  };
  for (const m of creds.metascopes!) {
    claims[`https://${creds.imsEndpoint}/s/${m}`] = true;
  }
  const jwt = signRs256(claims, creds.privateKey!);
  const url = `https://${creds.imsEndpoint}/ims/exchange/jwt/`;
  const params = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    jwt_token: jwt,
  });
  const res = await fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  return parseImsResponse(res, "JWT exchange");
}

async function parseImsResponse(
  res: Response,
  flowLabel: string,
): Promise<ExchangedToken> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(
      `IMS ${flowLabel} failed: HTTP ${res.status} — ${text.slice(0, 400)}`,
    );
  }
  let body: { access_token?: string; token_type?: string; expires_in?: number };
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`IMS ${flowLabel} returned non-JSON body: ${text.slice(0, 200)}`);
  }
  if (!body.access_token) {
    throw new Error(`IMS ${flowLabel} response missing access_token: ${text.slice(0, 200)}`);
  }
  // `expires_in` is in seconds per RFC 6749 (OAuth) and per Adobe's JWT
  // exchange. Older docs occasionally referenced milliseconds — defend
  // against that by treating any value > 10 years' worth of seconds as ms.
  const rawExp = body.expires_in ?? 3600;
  const expiresInSec = rawExp > 60 * 60 * 24 * 365 * 10 ? Math.floor(rawExp / 1000) : rawExp;
  return {
    accessToken: body.access_token,
    tokenType: body.token_type ?? "bearer",
    expiresAt: Date.now() + expiresInSec * 1000,
  };
}

// ── JWT (RS256) signing — built-in crypto, no jsonwebtoken dep ────────────

function signRs256(claims: object, privateKey: string): string {
  const header = base64urlJson({ alg: "RS256", typ: "JWT" });
  const payload = base64urlJson(claims);
  const signingInput = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function base64urlJson(obj: object): string {
  return Buffer.from(JSON.stringify(obj), "utf8").toString("base64url");
}

// ── tiny field-pickers — tolerate the shape variations ───────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return undefined;
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      const first = v.find((x) => typeof x === "string" && x.length > 0);
      if (typeof first === "string") return first;
    }
  }
  return undefined;
}

function pickStringArray(
  obj: Record<string, unknown>,
  keys: string[],
): string[] | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      const list = v.filter((x): x is string => typeof x === "string" && x.length > 0);
      if (list.length > 0) return list;
    }
  }
  return undefined;
}

function splitScopes(s: string): string[] {
  return s
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
}
