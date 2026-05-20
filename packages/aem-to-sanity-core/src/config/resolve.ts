import {
  exchangeImsToken,
  parseServiceCredentials,
  readServiceCredentialsFile,
  type ExchangedToken,
  type ServiceCredentials,
} from "../aem/ims.ts";
import { EnvSchema, type AuthMode, type Config } from "./schema.ts";

/**
 * Resolve a validated {@link Config} from a plain env-like record. No file
 * I/O beyond the optional Service Credentials JSON read; callers (CLIs) are
 * responsible for calling `dotenv/config` before invoking this.
 *
 * Auth precedence:
 *
 *   1. `AEM_SERVICE_CREDENTIALS_FILE` / `AEM_SERVICE_CREDENTIALS` (AEMaaCS) —
 *      JSON is parsed, then exchanged with Adobe IMS for a short-lived access
 *      token. Highest priority because operators almost always paste these in
 *      for Cloud Service work even when older basic-auth creds linger in the
 *      env from local dev.
 *   2. `AEM_TOKEN` — bearer. Covers both Adobe Developer Console "local dev"
 *      tokens (24h) and any other pre-minted bearer.
 *   3. `AEM_{ENV}_USERNAME` + `AEM_{ENV}_PASSWORD` — HTTP basic. Works for
 *      on-prem / AMS author + publish; rejected by AEMaaCS.
 *
 * Returns a `Config` whose `auth` is always `bearer` or `basic` — the IMS
 * exchange happens here so downstream code (`fetcher.ts`, `assets.ts`) keeps
 * a single Authorization-header path.
 */
export async function resolveConfig(env: NodeJS.ProcessEnv): Promise<Config> {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  const data = parsed.data;

  const activeUrl =
    data.AEM_ENV === "author" ? data.AEM_AUTHOR_URL : data.AEM_PUBLISH_URL;
  const activeUser =
    data.AEM_ENV === "author"
      ? data.AEM_AUTHOR_USERNAME
      : data.AEM_PUBLISH_USERNAME;
  const activePass =
    data.AEM_ENV === "author"
      ? data.AEM_AUTHOR_PASSWORD
      : data.AEM_PUBLISH_PASSWORD;

  if (!activeUrl) {
    throw new Error(
      `AEM_${data.AEM_ENV.toUpperCase()}_URL is required when AEM_ENV=${data.AEM_ENV}`,
    );
  }

  let auth: AuthMode;
  let imsExchange: ExchangedToken | undefined;
  const creds = loadServiceCredentials(
    data.AEM_SERVICE_CREDENTIALS_FILE,
    data.AEM_SERVICE_CREDENTIALS,
  );
  if (creds) {
    imsExchange = await exchangeImsToken(creds);
    auth = {
      kind: "bearer",
      token: imsExchange.accessToken,
      source: "ims",
      expiresAt: imsExchange.expiresAt,
    };
  } else if (data.AEM_TOKEN) {
    auth = { kind: "bearer", token: data.AEM_TOKEN, source: "token" };
  } else if (activeUser && activePass) {
    auth = { kind: "basic", username: activeUser, password: activePass };
  } else {
    throw new Error(
      `Missing credentials. Set AEM_SERVICE_CREDENTIALS_FILE (AEMaaCS), ` +
        `AEM_TOKEN, or AEM_${data.AEM_ENV.toUpperCase()}_USERNAME and ` +
        `AEM_${data.AEM_ENV.toUpperCase()}_PASSWORD.`,
    );
  }

  return {
    env: data.AEM_ENV,
    baseUrl: activeUrl.replace(/\/$/, ""),
    auth,
    componentPathsFile: data.AEM_COMPONENT_PATHS_FILE,
    contentRootsFile: data.AEM_CONTENT_ROOTS_FILE,
    outputDir: data.OUTPUT_DIR,
    concurrency: data.CONCURRENCY,
  };
}

function loadServiceCredentials(
  fromFile: string | undefined,
  fromInline: string | undefined,
): ServiceCredentials | undefined {
  if (fromFile && fromInline) {
    throw new Error(
      "Set only one of AEM_SERVICE_CREDENTIALS_FILE or AEM_SERVICE_CREDENTIALS, not both.",
    );
  }
  if (fromFile) return readServiceCredentialsFile(fromFile);
  if (fromInline) {
    let raw: unknown;
    try {
      raw = JSON.parse(fromInline);
    } catch (err) {
      throw new Error(
        `AEM_SERVICE_CREDENTIALS is not valid JSON: ${(err as Error).message}`,
      );
    }
    return parseServiceCredentials(raw);
  }
  return undefined;
}
