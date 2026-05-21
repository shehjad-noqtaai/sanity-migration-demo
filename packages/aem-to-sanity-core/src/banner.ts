import type { Config } from "./config/schema.ts";
import type { Logger } from "./logger.ts";

/**
 * Optional Sanity summary the host CLI wants to surface alongside the AEM
 * config. The schema CLI doesn't talk to Sanity, but printing `projectId` /
 * `dataset` / token presence at startup is still useful: it confirms the
 * operator's `.env` was actually loaded, and surfaces the values that the
 * downstream content-import step will consume.
 *
 * No value here is required — any field the caller omits is simply left off
 * the banner.
 */
export interface SanityRuntimeSummary {
  projectId?: string;
  dataset?: string;
  apiVersion?: string;
  /** Whether a write/auth token is present. The value itself is never logged. */
  tokenSet?: boolean;
  /**
   * Arbitrary extra lines: `{"Media Library id": "ml-xxxx"}` renders as
   *   `  Media Library id     ml-xxxx`
   * Useful for the content-import CLI which reads `SANITY_MEDIA_LIBRARY_ID`.
   */
  extras?: Record<string, string>;
}

export interface StartupBannerOptions {
  /** Optional friendly name of the invoking command, e.g. `migrate:schema`. */
  command?: string;
  /** If true, prints "(verbose)" next to the command line. */
  verbose?: boolean;
  /** Sanity preflight summary. Omit to skip the Sanity block. */
  sanity?: SanityRuntimeSummary;
}

/**
 * Mask a bearer token for safe logging. We never echo the token itself —
 * only its length plus a 4-character prefix — so an operator who mis-pasted
 * credentials can diagnose the mismatch without leaking the secret into log
 * captures (CI, terminal multiplexers, sidecar collectors).
 */
function maskBearer(token: string): string {
  if (token.length <= 4) return `(len=${token.length})`;
  return `(len=${token.length}, prefix=${token.slice(0, 4)}…)`;
}

/**
 * Log a human-readable summary of the runtime config at the start of a CLI
 * run. Passwords are never logged; bearer tokens are length+prefix only.
 *
 * Written via the supplied logger at `info` level so it honors the
 * `--verbose` / JSON / silent levels the host already chose.
 */
export function logStartupBanner(
  logger: Logger,
  config: Config,
  opts: StartupBannerOptions = {},
): void {
  if (opts.command) {
    logger.info(`${opts.command}${opts.verbose ? " (verbose)" : ""}`);
  }

  const authDesc =
    config.auth.kind === "bearer"
      ? config.auth.source === "ims"
        ? `IMS access token ${maskBearer(config.auth.token)}${
            config.auth.expiresAt
              ? ` (expires ${new Date(config.auth.expiresAt).toISOString()})`
              : ""
          }`
        : `bearer ${maskBearer(config.auth.token)}`
      : `basic (user=${config.auth.username})`;

  logger.info("AEM");
  logger.info(`  env          ${config.env}`);
  logger.info(`  base URL     ${config.baseUrl}`);
  logger.info(`  auth         ${authDesc}`);
  logger.info(`  paths file   ${config.componentPathsFile}`);
  logger.info(`  roots file   ${config.contentRootsFile}`);
  logger.info(`  output dir   ${config.outputDir}`);
  logger.info(`  concurrency  ${config.concurrency}`);

  if (opts.sanity) {
    const s = opts.sanity;
    logger.info("Sanity");
    if (s.projectId !== undefined)
      logger.info(`  project      ${s.projectId || "(unset)"}`);
    if (s.dataset !== undefined)
      logger.info(`  dataset      ${s.dataset || "(unset)"}`);
    if (s.apiVersion !== undefined)
      logger.info(`  api version  ${s.apiVersion}`);
    if (s.tokenSet !== undefined)
      logger.info(`  token        ${s.tokenSet ? "(set)" : "(unset)"}`);
    if (s.extras) {
      for (const [k, v] of Object.entries(s.extras)) {
        logger.info(`  ${k.padEnd(12, " ")} ${v}`);
      }
    }
  }
}
