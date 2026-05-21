import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  exchangeImsToken,
  parseServiceCredentials,
  readServiceCredentialsFile,
} from "../src/aem/ims.ts";
import { resolveConfig } from "../src/config/resolve.ts";

// A throwaway RSA keypair so JWT signing has something to chew on.
// Tests never validate the JWT cryptographically — IMS would, but we mock
// IMS — so any valid key works.
const { privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs1", format: "pem" },
  publicKeyEncoding: { type: "pkcs1", format: "pem" },
});

describe("parseServiceCredentials", () => {
  it("parses the modern flat OAuth Server-to-Server shape", () => {
    const creds = parseServiceCredentials({
      CLIENT_ID: "abc",
      CLIENT_SECRET: "secret",
      SCOPES: ["AdobeID", "openid"],
      IMS_ORG_ID: "X@AdobeOrg",
      TECHNICAL_ACCOUNT_ID: "T@techacct.adobe.com",
      IMS_HOST: "ims-na1.adobelogin.com",
    });
    expect(creds.clientId).toBe("abc");
    expect(creds.clientSecret).toBe("secret");
    expect(creds.scopes).toEqual(["AdobeID", "openid"]);
    expect(creds.imsEndpoint).toBe("ims-na1.adobelogin.com");
  });

  it("parses CLIENT_SECRETS array form", () => {
    const creds = parseServiceCredentials({
      CLIENT_ID: "abc",
      CLIENT_SECRETS: ["secret-from-array"],
      SCOPES: ["openid"],
    });
    expect(creds.clientSecret).toBe("secret-from-array");
  });

  it("unwraps `{ok, integration: {...}}` Cloud Manager downloads", () => {
    const creds = parseServiceCredentials({
      ok: true,
      integration: {
        CLIENT_ID: "abc",
        CLIENT_SECRET: "secret",
        SCOPES: ["openid"],
      },
    });
    expect(creds.clientId).toBe("abc");
    expect(creds.scopes).toEqual(["openid"]);
  });

  it("parses legacy JWT shape", () => {
    const creds = parseServiceCredentials({
      ok: true,
      integration: {
        imsEndpoint: "ims-na1.adobelogin.com",
        metascopes: "ent_aem_cloud_api",
        technicalAccount: { clientId: "abc", clientSecret: "secret" },
        id: "T@techacct.adobe.com",
        org: "X@AdobeOrg",
        privateKey,
      },
    });
    expect(creds.clientId).toBe("abc");
    expect(creds.metascopes).toEqual(["ent_aem_cloud_api"]);
    expect(creds.privateKey).toContain("BEGIN");
    expect(creds.scopes).toBeUndefined();
  });

  it("throws when client id / secret is missing", () => {
    expect(() =>
      parseServiceCredentials({ SCOPES: ["openid"] }),
    ).toThrow(/client id/i);
  });

  it("throws when neither OAuth scopes nor JWT fields are present", () => {
    expect(() =>
      parseServiceCredentials({ CLIENT_ID: "abc", CLIENT_SECRET: "secret" }),
    ).toThrow(/SCOPES.*privateKey/);
  });
});

describe("readServiceCredentialsFile", () => {
  let tmp: string;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "ims-creds-"));
  });
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("reads + parses a file", () => {
    const file = join(tmp, "creds.json");
    writeFileSync(
      file,
      JSON.stringify({
        CLIENT_ID: "abc",
        CLIENT_SECRET: "secret",
        SCOPES: ["openid"],
      }),
    );
    const creds = readServiceCredentialsFile(file);
    expect(creds.clientId).toBe("abc");
  });

  it("wraps file-read errors with the path", () => {
    expect(() => readServiceCredentialsFile(join(tmp, "missing.json"))).toThrow(
      /missing\.json/,
    );
  });
});

describe("exchangeImsToken", () => {
  it("uses OAuth Server-to-Server when SCOPES present", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://ims-na1.adobelogin.com/ims/token/v3");
      const body = init.body as string;
      expect(body).toContain("grant_type=client_credentials");
      expect(body).toContain("client_id=abc");
      expect(body).toContain("scope=openid%2Cread_organizations");
      return new Response(
        JSON.stringify({
          access_token: "ims-access-xyz",
          token_type: "bearer",
          expires_in: 3600,
        }),
        { status: 200 },
      );
    });
    const out = await exchangeImsToken(
      {
        imsEndpoint: "ims-na1.adobelogin.com",
        clientId: "abc",
        clientSecret: "secret",
        scopes: ["openid", "read_organizations"],
      },
      fetchMock as unknown as typeof globalThis.fetch,
    );
    expect(out.accessToken).toBe("ims-access-xyz");
    expect(out.tokenType).toBe("bearer");
    expect(out.expiresAt).toBeGreaterThan(Date.now());
  });

  it("falls back to JWT when only privateKey + metascopes present", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe("https://ims-na1.adobelogin.com/ims/exchange/jwt/");
      const body = init.body as string;
      expect(body).toContain("jwt_token=");
      // Body should not contain raw privateKey — only the signed JWT.
      expect(body).not.toContain("PRIVATE KEY");
      return new Response(
        JSON.stringify({ access_token: "jwt-access-abc", expires_in: 3600 }),
        { status: 200 },
      );
    });
    const out = await exchangeImsToken(
      {
        imsEndpoint: "ims-na1.adobelogin.com",
        clientId: "abc",
        clientSecret: "secret",
        org: "X@AdobeOrg",
        technicalAccountId: "T@techacct.adobe.com",
        metascopes: ["ent_aem_cloud_api"],
        privateKey,
      },
      fetchMock as unknown as typeof globalThis.fetch,
    );
    expect(out.accessToken).toBe("jwt-access-abc");
  });

  it("surfaces IMS errors as a single descriptive throw", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: "invalid_client", error_description: "bad secret" }),
          { status: 400 },
        ),
    );
    await expect(
      exchangeImsToken(
        {
          imsEndpoint: "ims-na1.adobelogin.com",
          clientId: "abc",
          clientSecret: "secret",
          scopes: ["openid"],
        },
        fetchMock as unknown as typeof globalThis.fetch,
      ),
    ).rejects.toThrow(/IMS OAuth.*HTTP 400.*invalid_client/);
  });

  it("rejects when the 200 response is missing access_token", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ token_type: "bearer" }), { status: 200 }),
    );
    await expect(
      exchangeImsToken(
        {
          imsEndpoint: "ims-na1.adobelogin.com",
          clientId: "abc",
          clientSecret: "secret",
          scopes: ["openid"],
        },
        fetchMock as unknown as typeof globalThis.fetch,
      ),
    ).rejects.toThrow(/missing access_token/);
  });
});

describe("resolveConfig — IMS branch", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ access_token: "resolved-ims-token", expires_in: 1800 }),
          { status: 200 },
        ),
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exchanges service credentials and surfaces bearer auth with source=ims", async () => {
    const cfg = await resolveConfig({
      AEM_ENV: "author",
      AEM_AUTHOR_URL: "https://author-pXXX-eYYY.adobeaemcloud.com",
      AEM_SERVICE_CREDENTIALS: JSON.stringify({
        CLIENT_ID: "abc",
        CLIENT_SECRET: "secret",
        SCOPES: ["openid"],
      }),
    } as NodeJS.ProcessEnv);
    expect(cfg.auth.kind).toBe("bearer");
    if (cfg.auth.kind !== "bearer") throw new Error("type narrow");
    expect(cfg.auth.token).toBe("resolved-ims-token");
    expect(cfg.auth.source).toBe("ims");
    expect(cfg.auth.expiresAt).toBeGreaterThan(Date.now());
  });

  it("falls back to AEM_TOKEN bearer when no service credentials are set", async () => {
    const cfg = await resolveConfig({
      AEM_ENV: "author",
      AEM_AUTHOR_URL: "https://author-pXXX-eYYY.adobeaemcloud.com",
      AEM_TOKEN: "developer-token",
    } as NodeJS.ProcessEnv);
    expect(cfg.auth.kind).toBe("bearer");
    if (cfg.auth.kind !== "bearer") throw new Error("type narrow");
    expect(cfg.auth.token).toBe("developer-token");
    expect(cfg.auth.source).toBe("token");
  });

  it("falls back to basic when no token-style auth is set", async () => {
    const cfg = await resolveConfig({
      AEM_ENV: "author",
      AEM_AUTHOR_URL: "https://author.example.com",
      AEM_AUTHOR_USERNAME: "admin",
      AEM_AUTHOR_PASSWORD: "admin",
    } as NodeJS.ProcessEnv);
    expect(cfg.auth.kind).toBe("basic");
  });

  it("rejects setting both file and inline service credentials", async () => {
    await expect(
      resolveConfig({
        AEM_ENV: "author",
        AEM_AUTHOR_URL: "https://author.example.com",
        AEM_SERVICE_CREDENTIALS_FILE: "/tmp/creds.json",
        AEM_SERVICE_CREDENTIALS: "{}",
      } as NodeJS.ProcessEnv),
    ).rejects.toThrow(/only one/i);
  });

  it("errors with all three auth options listed when none are set", async () => {
    await expect(
      resolveConfig({
        AEM_ENV: "author",
        AEM_AUTHOR_URL: "https://author.example.com",
      } as NodeJS.ProcessEnv),
    ).rejects.toThrow(/AEM_SERVICE_CREDENTIALS_FILE.*AEM_TOKEN.*USERNAME/);
  });
});
