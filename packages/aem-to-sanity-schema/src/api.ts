import { join, dirname } from "node:path";
import { readFile, readdir, unlink } from "node:fs/promises";
import {
  AemFetchError,
  writeJson,
  writeTextFile,
  type DialogNode,
  type Logger,
} from "aem-to-sanity-core";
import {
  flattenSchemaFieldNames,
  flattenSchemaFields,
  mapDialog,
  type NodeFetcher,
} from "./mapper.ts";
import { emitSchemaFile, resolveSchemaTitle } from "./emitter.ts";
import { resolveSanityTypeNames } from "./naming.ts";
import { Report } from "./report.ts";
import { auditUnmappedTypes } from "./audit.ts";
import {
  rewriteBarrelFromDisk,
  writePageBuilderArtifacts,
} from "./pagebuilder.ts";
import { writeContentRegistry } from "./content-registry.ts";

export interface MigrateSchemasOptions {
  /** AEM component paths (e.g. `/apps/<site>/components/promo`). */
  componentPaths: string[];
  /**
   * Fetches a JCR node as its validated dialog shape. Callers pass a raw JCR
   * path; for the component root, the api internally appends `/_cq_dialog`.
   * For includes, the exact `path` attribute is passed through unchanged.
   */
  fetcher: NodeFetcher;
  outputDir: string;
  concurrency?: number;
  logger?: Logger;
  /** Persist each component's raw dialog JSON to `{outputDir}/cache/aem/components/`. Defaults to true. */
  writeAemSnapshot?: boolean;
  /** Run the unmapped-type audit after the main pass. Defaults to true. */
  runAudit?: boolean;
  /** Write regenerated docs to this path. Omit to skip. */
  docsOutputFile?: string;
  /** Override the regenerate command shown in emitted file headers. */
  regenerateCommand?: string;
  /**
   * Generate `page.ts` + `pageBuilder.ts` alongside the component schemas so a
   * Studio has a page document type with every block registered in
   * `pageBuilder.of[]`. Defaults to true.
   */
  emitPageBuilder?: boolean;
  /** Type names to exclude from `pageBuilder.of[]` (e.g. page-level components). */
  pageBuilderExclude?: string[];
  /**
   * Emit a `content-type-registry.json` alongside the schemas, mapping AEM
   * `sling:resourceType` → Sanity type + field names. Consumed by the content
   * migrator. Defaults to true. Preserves a hand-edited file (detected by the
   * absence of the `__generated` marker).
   */
  emitContentRegistry?: boolean;
  /** Path for the generated registry. Default: `{outputDir}/cache/content-type-registry.json`. */
  contentRegistryFile?: string;
  /** JCR prefix to strip from component paths when deriving `sling:resourceType`. Default: `/apps/`. */
  jcrPrefix?: string;
  /**
   * Where the generated schema .ts files (component schemas + page.ts +
   * pageBuilder.ts + index.ts barrel) are written. Defaults to
   * `{outputDir}/schemas`. Set this when the consumer (e.g. a Sanity Studio
   * app) wants the schemas under its own tree — keeps schema emission
   * decoupled from `outputDir`, which holds only regenerable cache state.
   */
  schemasDir?: string;
  /**
   * Treat per-component 401/403 failures as skips (logged + reported) rather
   * than aborting the whole batch. Matches the "unknown shapes are audit
   * findings, not failures" invariant for components that exist in AEM but
   * whose dialog is ACL-denied to the caller.
   *
   * Circuit breaker: if no component succeeds within the first
   * `authCircuitBreakerThreshold` auth failures (default 5), the batch still
   * aborts — that pattern signals credentials-wide failure (wrong password,
   * expired token) rather than per-path ACL denial, and continuing just
   * hammers AEM toward an account lockout.
   *
   * Default: false (existing behaviour — any auth failure aborts).
   */
  continueOnAuth?: boolean;
  /** Threshold for the `continueOnAuth` circuit breaker. Default: 5. */
  authCircuitBreakerThreshold?: number;
}

export interface MigrateSchemasResult {
  report: Report;
  reportFile: string;
  auditPath?: string;
  pageBuilderFile?: string;
  pageFile?: string;
  contentRegistryFile?: string;
}

export async function migrateSchemas(
  opts: MigrateSchemasOptions,
): Promise<MigrateSchemasResult> {
  const {
    componentPaths,
    fetcher,
    outputDir,
    logger,
    writeAemSnapshot = true,
    runAudit = true,
    docsOutputFile,
    regenerateCommand,
    emitPageBuilder = true,
    pageBuilderExclude,
    emitContentRegistry = true,
    contentRegistryFile,
    jcrPrefix,
  } = opts;
  const concurrency = opts.concurrency ?? 4;
  const continueOnAuth = opts.continueOnAuth ?? false;
  const authCircuitBreakerThreshold = opts.authCircuitBreakerThreshold ?? 5;
  const schemasDir = opts.schemasDir ?? join(outputDir, "schemas");

  const report = new Report();

  // Resolve every component path to its final Sanity type name up front. This
  // is the single source of truth for naming across every downstream artifact
  // (emitted schema file, pageBuilder.of[], content registry, ingested
  // document `_type`). Doing it here — rather than leaving the Studio's
  // `sanitizeSchemaTypes` to rename reserved names at import time — is what
  // prevents ingested data from showing up as "Untitled" with an unknown-type
  // warning because its `_type` no longer matches the live schema.
  const typeNameByPath = resolveSanityTypeNames(componentPaths);

  let authFailures = 0;
  let successes = 0;

  await runWithConcurrency(
    componentPaths,
    (p) =>
      processOne(p, {
        fetcher,
        outputDir,
        schemasDir,
        report,
        logger,
        writeAemSnapshot,
        regenerateCommand,
        typeName: typeNameByPath.get(p)!,
      }),
    concurrency,
    (r) => {
      if (r.success) successes++;
      if (r.authFailure) authFailures++;
      if (!continueOnAuth) return { shouldAbort: r.authFailure };
      // continueOnAuth: only abort if we've seen N auth failures in a row with
      // zero successes — signals credentials-wide failure, not per-path ACL.
      if (successes === 0 && authFailures >= authCircuitBreakerThreshold) {
        logger?.error(
          `continueOnAuth: ${authFailures} consecutive auth failures with 0 successes — circuit breaker tripped, aborting to avoid account lockout.`,
        );
        return { shouldAbort: true };
      }
      if (r.authFailure) {
        logger?.warn(
          `Auth failure on a component — treating as per-path ACL denial and continuing (continueOnAuth=true).`,
        );
      }
      return { shouldAbort: false };
    },
  );

  const reportFile = join(outputDir, "cache", "migration-report.json");
  await report.write(reportFile);
  const successResults = report.results.filter(
    (r): r is Extract<typeof r, { status: "success" }> => r.status === "success",
  );
  const successTypeNames = successResults.map((r) => r.sanityTypeName);
  const successMembers = successResults.map((r) => ({
    name: r.sanityTypeName,
    title: r.schemaTitle,
  }));

  let pageBuilderFile: string | undefined;
  let pageFile: string | undefined;
  if (emitPageBuilder) {
    const pb = await writePageBuilderArtifacts({
      schemasDir,
      componentMembers: successMembers,
      exclude: pageBuilderExclude,
      logger,
    });
    pageBuilderFile = pb.pageBuilderFile;
    pageFile = pb.pageFile;
  }

  await pruneGeneratedSchemaFiles(schemasDir, successTypeNames, { emitPageBuilder, logger });

  if (emitPageBuilder) {
    // Prefer filenames on disk so `index.ts` never imports a missing `.ts`
    // (e.g. if a write races or a stale checkout diverges from the report).
    await rewriteBarrelFromDisk(schemasDir);
  } else {
    await writeSchemasBarrel(schemasDir, report, { emitPageBuilder: false });
  }

  if (docsOutputFile) {
    const { writeMappingDocs } = await import("./docs.ts");
    await writeMappingDocs(docsOutputFile);
  }

  let auditPath: string | undefined;
  if (runAudit) {
    const auditResult = await auditUnmappedTypes({
      report,
      dialogFetcher: fetcher,
      outputDir,
      logger,
    });
    auditPath = auditResult.examplesPath;
  }

  let registryFile: string | undefined;
  if (emitContentRegistry) {
    const file = contentRegistryFile ?? join(outputDir, "cache", "content-type-registry.json");
    const r = await writeContentRegistry({
      outputFile: file,
      report,
      jcrPrefix,
      logger,
    });
    registryFile = r.file;
  }

  return {
    report,
    reportFile,
    auditPath,
    pageBuilderFile,
    pageFile,
    contentRegistryFile: registryFile,
  };
}

interface ProcessOneDeps {
  fetcher: NodeFetcher;
  outputDir: string;
  schemasDir: string;
  report: Report;
  logger?: Logger;
  writeAemSnapshot: boolean;
  regenerateCommand?: string;
  /** Final Sanity type name resolved by `resolveSanityTypeNames` for this path. */
  typeName: string;
}

/**
 * AEM `.infinity.json` for a `cq:Component` usually nests the authoring dialog
 * under `cq:dialog`. When present, we avoid a second request to `/_cq_dialog`.
 */
function embeddedCqDialog(node: DialogNode): DialogNode | undefined {
  const embedded = node["cq:dialog"];
  if (
    embedded &&
    typeof embedded === "object" &&
    !Array.isArray(embedded) &&
    Object.keys(embedded as object).length > 0
  ) {
    return embedded as DialogNode;
  }
  return undefined;
}

async function processOne(
  componentPath: string,
  deps: ProcessOneDeps,
): Promise<{ authFailure: boolean; success: boolean }> {
  const {
    fetcher,
    outputDir,
    schemasDir,
    report,
    writeAemSnapshot,
    regenerateCommand,
    typeName,
  } = deps;

  let dialog: DialogNode;
  let schemaTitle: string | undefined;
  try {
    const componentNode = await fetcher(componentPath);
    const rawTitle = componentNode["jcr:title"];
    if (typeof rawTitle === "string" && rawTitle.trim()) {
      schemaTitle = rawTitle.trim();
    }
    const embeddedDialog = embeddedCqDialog(componentNode);
    if (embeddedDialog) {
      dialog = embeddedDialog;
    } else {
      dialog = await fetcher(`${componentPath}/_cq_dialog`);
    }
  } catch (err) {
    if (err instanceof AemFetchError) {
      report.add({
        status: "failure",
        path: componentPath,
        kind: err.kind,
        message: err.message,
        bodyExcerpt: err.details?.bodyExcerpt,
      });
      return { authFailure: err.kind === "auth", success: false };
    }
    report.add({
      status: "failure",
      path: componentPath,
      kind: "network",
      message: (err as Error).message,
    });
    return { authFailure: false, success: false };
  }

  if (writeAemSnapshot) {
    await saveDialogJson(outputDir, componentPath, dialog, deps.logger);
  }

  let mapped;
  try {
    mapped = await mapDialog(dialog, fetcher);
  } catch (err) {
    report.add({
      status: "failure",
      path: componentPath,
      kind: "mappingError",
      message: (err as Error).message,
    });
    return { authFailure: false, success: false };
  }

  let contents: string;
  try {
    contents = await emitSchemaFile({
      typeName,
      sourcePath: componentPath,
      fields: mapped.fields,
      groups: mapped.groups,
      schemaTitle,
      regenerateCommand,
    });
  } catch (err) {
    report.add({
      status: "failure",
      path: componentPath,
      kind: "mappingError",
      message: `emitter failed: ${(err as Error).message}`,
    });
    return { authFailure: false, success: false };
  }

  const outputFile = join(schemasDir, `${typeName}.ts`);
  try {
    await writeTextFile(outputFile, contents);
  } catch (err) {
    report.add({
      status: "failure",
      path: componentPath,
      kind: "writeError",
      message: (err as Error).message,
    });
    return { authFailure: false, success: false };
  }

  report.add({
    status: "success",
    path: componentPath,
    sanityTypeName: typeName,
    schemaTitle: resolveSchemaTitle(typeName, schemaTitle),
    outputFile,
    fieldNames: flattenSchemaFieldNames(mapped.fields),
    fields: flattenSchemaFields(mapped.fields),
    unmapped: mapped.unmapped,
    renamed: mapped.renamed,
  });
  return { authFailure: false, success: true };
}

async function pruneGeneratedSchemaFiles(
  schemasDir: string,
  componentTypeNames: string[],
  opts: { emitPageBuilder: boolean; logger?: Logger },
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(schemasDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }

  const keep = new Set(componentTypeNames);
  keep.add("index");
  if (opts.emitPageBuilder) {
    keep.add("page");
    keep.add("pageBuilder");
  }

  for (const file of entries) {
    if (!file.endsWith(".ts")) continue;
    const name = file.slice(0, -3);
    if (keep.has(name)) continue;
    const full = join(schemasDir, file);
    let contents = "";
    try {
      contents = await readFile(full, "utf8");
    } catch {
      continue;
    }
    const generated =
      contents.startsWith("// GENERATED by aem-to-sanity-schema") ||
      contents.includes("Generated from AEM component:");
    if (!generated) continue;
    await unlink(full);
    opts.logger?.info(`prune: removed stale generated schema ${full}`);
  }
}

/**
 * Emit `{outputDir}/schemas/index.ts`: a barrel that re-exports every
 * successfully generated schema plus an `allSchemaTypes` array suitable for
 * plugging directly into `defineConfig({ schema: { types: allSchemaTypes } })`.
 *
 * This is what lets `apps/studio` (and any downstream Studio) add one import
 * instead of 86. Regenerated on every run so the list stays in sync with the
 * schemas on disk.
 */
async function writeSchemasBarrel(
  schemasDir: string,
  report: Report,
  opts: { emitPageBuilder: boolean },
): Promise<void> {
  const successNames = report.results
    .filter((r): r is Extract<typeof r, { status: "success" }> => r.status === "success")
    .map((r) => r.sanityTypeName)
    .sort();
  if (successNames.length === 0) return;

  const pageExtras = opts.emitPageBuilder ? ["pageBuilder", "page"] : [];
  const allNames = [...successNames, ...pageExtras];

  const imports = allNames
    .map((n) => `import { ${n} } from "./${n}.ts";`)
    .join("\n");
  const list = allNames.join(", ");

  const src = `// GENERATED by aem-to-sanity-schema. Do not edit by hand.
${imports}

export const allSchemaTypes = [${list}];
${allNames.map((n) => `export { ${n} };`).join("\n")}
`;

  const file = join(schemasDir, "index.ts");
  await writeTextFile(file, src);
}

async function saveDialogJson(
  outputDir: string,
  componentPath: string,
  dialog: DialogNode,
  logger?: Logger,
): Promise<void> {
  const rel = componentPath.replace(/^\/+/, "");
  const file = join(outputDir, "cache", "aem", "components", `${rel}.json`);
  try {
    await writeJson(file, dialog, { pretty: true });
  } catch (err) {
    logger?.warn(
      `failed to save dialog JSON for ${componentPath}: ${(err as Error).message}`,
      { path: file, parentDir: dirname(file) },
    );
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
  onResult?: (r: R) => { shouldAbort: boolean },
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;
  let abort = false;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (!abort) {
        const i = index++;
        if (i >= items.length) break;
        const item = items[i]!;
        const r = await worker(item);
        results.push(r);
        if (onResult && onResult(r).shouldAbort) {
          abort = true;
          break;
        }
      }
    },
  );
  await Promise.all(runners);
  return results;
}
