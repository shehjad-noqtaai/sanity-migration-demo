#!/usr/bin/env node
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  DialogNodeSchema,
  createColors,
  createLogger,
  fetchInfinityJson,
  logStartupBanner,
  resolveConfig,
  type DialogNode,
  type SanityRuntimeSummary,
} from "aem-to-sanity-core";
import { migrateSchemas } from "./api.ts";

async function main(): Promise<void> {
  const config = resolveConfig(process.env);

  // `--verbose` / `-v` elevates log level to `debug`, which surfaces the
  // per-request `GET <url>` line already emitted by the AEM fetcher
  // (`packages/aem-to-sanity-core/src/aem/fetcher.ts`). Also honor the
  // `AEM_VERBOSE=true` env var for CI pipelines that can't pass flags.
  const verbose =
    process.argv.includes("--verbose") ||
    process.argv.includes("-v") ||
    process.env.AEM_VERBOSE === "true";
  const logger = createLogger({ level: verbose ? "debug" : "info" });

  logStartupBanner(logger, config, {
    command: "migrate:schema",
    verbose,
    sanity: describeSanityEnv(process.env),
  });

  // Accept both the CLI flag and the env var. When true, per-component 401/403
  // failures are recorded as skips and the batch keeps going; the api-level
  // circuit breaker still bails if no component has succeeded after N auth
  // failures (signals credentials-wide failure, not per-path ACL).
  const continueOnAuth =
    process.argv.includes("--continue-on-auth") ||
    process.env.AEM_CONTINUE_ON_AUTH === "true";

  // Schemas are emitted under SCHEMAS_OUT_DIR when set, otherwise the legacy
  // `{outputDir}/schemas` path. Lets consumers (e.g. apps/studio) own the
  // generated schemas directly while `{outputDir}/cache/` still holds
  // regenerable artifacts.
  const schemasDir = process.env.SCHEMAS_OUT_DIR
    ? resolve(process.env.SCHEMAS_OUT_DIR)
    : undefined;

  const componentPaths = await readComponentPaths(config.componentPathsFile);
  const exceptionsFile = resolve(
    process.env.AEM_COMPONENT_EXCEPTIONS_FILE ?? "./aem-component-exceptions",
  );
  const exceptions = await readExceptionList(exceptionsFile);
  const filtered = applyComponentExceptions(componentPaths, exceptions);

  if (filtered.length === 0) {
    logger.error(
      `No component paths in ${config.componentPathsFile} after applying exceptions.`,
    );
    process.exit(1);
  }

  if (exceptions.size > 0) {
    logger.info(
      `Applied ${exceptions.size} exception(s) from ${exceptionsFile}; ${
        componentPaths.length - filtered.length
      } component(s) ignored.`,
    );
  }

  logger.info(
    `Migrating ${filtered.length} component(s) from ${config.baseUrl} [env=${config.env}, auth=${config.auth.kind}]`,
  );

  const fetcher = (jcrPath: string): Promise<DialogNode> =>
    fetchInfinityJson({ config, logger }, jcrPath, (raw) => {
      const parsed = DialogNodeSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(
          parsed.error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; "),
        );
      }
      return parsed.data;
    });

  const { report, reportFile } = await migrateSchemas({
    componentPaths: filtered,
    fetcher,
    outputDir: config.outputDir,
    schemasDir,
    concurrency: config.concurrency,
    logger,
    docsOutputFile: "./docs/aem-to-sanity-mapping.md",
    continueOnAuth,
  });

  const s = report.summary();
  const unmappedCount = Object.keys(s.unmappedTypes).length;
  const c = createColors({ stream: process.stderr });

  const ok = c.green(s.successes);
  const total = c.dim(`/ ${s.total}`);
  const failed = s.failures > 0 ? c.yellow(s.failures) : c.green(0);
  const unmapped = unmappedCount > 0 ? c.yellow(unmappedCount) : c.green(0);
  const sep = c.dim("────────────────────────────────────────");

  logger.info(sep);
  logger.info(`Emitted:             ${ok} ${total} component(s)`);
  logger.info(`Failed:              ${failed}`);
  logger.info(`Unmapped AEM types:  ${unmapped}`);
  logger.info(`Report:              ${c.dim(reportFile)}`);
  logger.info(sep);

  if (s.failures > 0) {
    const failures = report.results.filter(
      (r): r is Extract<typeof r, { status: "failure" }> =>
        r.status === "failure",
    );
    const pathWidth = Math.min(
      60,
      failures.reduce((w, f) => Math.max(w, f.path.length), 0),
    );
    const hasAuthFailure = failures.some((f) => f.kind === "auth");
    // With continueOnAuth, per-component auth failures are ACL skips as long
    // as at least one component succeeded. A full wipeout (0 successes) still
    // means credentials were wrong → hard abort.
    const treatAsFatal =
      (hasAuthFailure && !continueOnAuth) || s.successes === 0;
    const headline = treatAsFatal
      ? hasAuthFailure
        ? `${failures.length} component(s) failed (auth — aborting):`
        : `${failures.length} component(s) failed (no successes — aborting):`
      : hasAuthFailure
        ? `${failures.length} component(s) skipped (${failures.filter((f) => f.kind === "auth").length} auth / ${failures.length - failures.filter((f) => f.kind === "auth").length} other):`
        : `${failures.length} component(s) skipped with errors:`;
    const level = treatAsFatal ? logger.error : logger.warn;

    level(headline);
    failures.forEach((f, i) => {
      const n = c.dim(String(i + 1).padStart(2, " ") + ".");
      const path = f.path.padEnd(pathWidth, " ");
      const kindPainted = treatAsFatal ? c.red : c.yellow;
      const kind = kindPainted(`[${f.kind}]`.padEnd(14, " "));
      const msg = c.dim(f.message.replace(/\s+/g, " ").slice(0, 140));
      level(`  ${n} ${path}  ${kind} ${msg}`);
    });
    level(`Full details in ${c.dim(reportFile)} under results[].`);

    if (treatAsFatal) process.exit(1);
    logger.info(
      "Partial-success run. Drop failed paths from the component-paths file (or fix them in AEM) to clean this up.",
    );
  }
}

async function readComponentPaths(file: string): Promise<string[]> {
  const raw = await readFile(file, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

async function readExceptionList(file: string): Promise<Set<string>> {
  try {
    const raw = await readFile(file, "utf8");
    return new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && !line.startsWith("#"))
        .map(normalizeExceptionKey),
    );
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw err;
  }
}

function normalizeExceptionKey(v: string): string {
  const trimmed = v.trim().replace(/^\/+/, "");
  if (trimmed.startsWith("apps/")) return trimmed.slice("apps/".length);
  return trimmed;
}

function toResourceTypeFromPath(componentPath: string): string {
  const noLead = componentPath.replace(/^\/+/, "");
  return noLead.startsWith("apps/") ? noLead.slice("apps/".length) : noLead;
}

/**
 * Surface Sanity runtime env values for the startup banner. `migrate:schema`
 * never connects to Sanity — this is pre-flight context so the operator can
 * confirm their `.env` is loaded correctly for the downstream ingest step.
 * Secrets are not read, only presence (`tokenSet: boolean`).
 */
function describeSanityEnv(env: NodeJS.ProcessEnv): SanityRuntimeSummary {
  const projectId = env.SANITY_STUDIO_PROJECT_ID ?? env.SANITY_PROJECT_ID;
  const dataset = env.SANITY_STUDIO_DATASET ?? env.SANITY_DATASET;
  return {
    projectId,
    dataset,
    apiVersion: env.SANITY_API_VERSION,
    tokenSet: Boolean(env.SANITY_TOKEN),
  };
}

function applyComponentExceptions(
  componentPaths: string[],
  exceptions: Set<string>,
): string[] {
  if (exceptions.size === 0) return componentPaths;
  return componentPaths.filter((p) => {
    const pathKey = normalizeExceptionKey(p);
    const resourceType = toResourceTypeFromPath(p);
    return !(exceptions.has(pathKey) || exceptions.has(resourceType));
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
