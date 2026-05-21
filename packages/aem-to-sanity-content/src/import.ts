#!/usr/bin/env node
import "dotenv/config";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { createColors, startTimer } from "aem-to-sanity-core";

interface SanityDoc {
  _id: string;
  _type: string;
  [key: string]: unknown;
}
interface CleanFile {
  jcrPath: string;
  slug?: string;
  docs: SanityDoc[];
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env var: ${name}`);
    process.exit(2);
  }
  return v;
}

async function main(): Promise<void> {
  const timer = startTimer();
  const c = createColors({ stream: process.stderr });
  const outputDir = resolve(process.env.OUTPUT_DIR ?? "./output");
  const cleanDir = join(outputDir, "cache", "clean");
  const categoriesDir = join(outputDir, "cache", "categories");
  const dryRun = process.env.MIGRATION_DRY_RUN !== "false";

  // `--discard-drafts` (or `MIGRATION_DISCARD_DRAFTS=true`) deletes
  // `drafts.{id}` alongside each `createOrReplace({id})`. The Studio edits
  // a draft whenever one exists, so without this flag a stale draft from
  // a prior migration run keeps shadowing the newly-written published
  // doc — the user sees old data even though the import "succeeded".
  // Opt-in because it destroys authored-in-progress edits; the right
  // default is to leave drafts alone.
  const discardDrafts =
    process.argv.includes("--discard-drafts") ||
    process.env.MIGRATION_DISCARD_DRAFTS === "true";

  const files = readdirSync(cleanDir).filter((f) => f.endsWith(".json")).sort();
  // Category docs come from `aem-tags`. They live in their own cache dir so
  // they don't get swept up by `clean/` operations that target pages, and
  // so we can guarantee a "categories first" import ordering — without that
  // ordering, references on page docs would commit pointing at category
  // docs that don't yet exist, and Sanity would (depending on validation
  // strength) either reject the page or fail the live ref count check.
  const categoryFiles = existsSync(categoriesDir)
    ? readdirSync(categoriesDir)
        .filter((f) => f.endsWith(".json") && f !== "manifest.json")
        .sort()
    : [];
  if (files.length === 0 && categoryFiles.length === 0) {
    console.error(
      `No clean files in ${cleanDir} and no category files in ${categoriesDir}. Run \`aem-transform\` (and \`aem-tags\` if migrating tags) first.`,
    );
    process.exit(2);
  }

  let client: unknown = undefined;
  if (!dryRun) {
    const projectId = requireEnv("SANITY_PROJECT_ID");
    const dataset = requireEnv("SANITY_DATASET");
    const token = requireEnv("SANITY_TOKEN");
    const apiVersion = process.env.SANITY_API_VERSION ?? "2024-01-01";
    const mod = await import("@sanity/client").catch((err) => {
      throw new Error(`@sanity/client is required to import. ${(err as Error).message}`);
    });
    client = mod.createClient({ projectId, dataset, token, apiVersion, useCdn: false });
  }

  const mode = dryRun
    ? c.dim("(DRY RUN — set MIGRATION_DRY_RUN=false to commit)")
    : discardDrafts
      ? c.bold("→ Sanity") + c.dim(" (discarding drafts)")
      : c.bold("→ Sanity");
  console.error(
    `[import] ${categoryFiles.length} categor${categoryFiles.length === 1 ? "y" : "ies"}, ${files.length} page(s) ${mode}`,
  );

  let pages = 0;
  let categories = 0;
  let docs = 0;
  let draftsDiscarded = 0;

  // 1) Categories first. They're independent docs (only reference each
  // other via `parent`, never references on a page side). Committing them
  // upfront means every later page-side reference resolves immediately.
  if (categoryFiles.length > 0) {
    console.error(c.dim(`  categories →`));
    // Chunk into batches of 50 docs per transaction so a tenant with
    // thousands of tags doesn't try to commit them all in a single payload
    // (Sanity caps transaction size). 50 is well under the cap and matches
    // the order-of-magnitude `aem-import` already uses implicitly via the
    // one-tx-per-page model.
    const BATCH = 50;
    for (let i = 0; i < categoryFiles.length; i += BATCH) {
      const batch = categoryFiles.slice(i, i + BATCH);
      const batchDocs: SanityDoc[] = [];
      for (const file of batch) {
        const clean = JSON.parse(
          readFileSync(join(categoriesDir, file), "utf8"),
        ) as CleanFile;
        for (const doc of clean.docs) batchDocs.push(doc);
      }
      if (!dryRun && client && batchDocs.length > 0) {
        const tx = (client as SanityClientLike).transaction();
        for (const doc of batchDocs) {
          if (discardDrafts) {
            const draftId = doc._id.startsWith("drafts.")
              ? doc._id
              : `drafts.${doc._id}`;
            tx.delete(draftId);
            draftsDiscarded++;
          }
          tx.createOrReplace(doc);
        }
        await tx.commit();
      }
      categories += batchDocs.length;
      docs += batchDocs.length;
    }
    console.error(
      `    ${c.green(categories)} categor${categories === 1 ? "y" : "ies"} from ${c.dim(categoriesDir)}`,
    );
  }

  // 2) Pages — one transaction per page, same as before.
  for (const file of files) {
    const clean = JSON.parse(readFileSync(join(cleanDir, file), "utf8")) as CleanFile;
    if (clean.docs.length === 0) continue;
    if (!dryRun && client) {
      const tx = (client as SanityClientLike).transaction();
      for (const doc of clean.docs) {
        if (discardDrafts) {
          const draftId = doc._id.startsWith("drafts.") ? doc._id : `drafts.${doc._id}`;
          tx.delete(draftId);
          draftsDiscarded++;
        }
        tx.createOrReplace(doc);
      }
      await tx.commit();
    }
    pages++;
    docs += clean.docs.length;
    console.error(
      `  ${c.dim(clean.jcrPath)} ${c.dim("→")} ${c.green(clean.docs.length)} doc(s)`,
    );
  }

  console.error(c.dim("────────────────────────────────────────"));
  console.error(
    `${dryRun ? c.dim("Would commit") : c.green("Committed")}: ${c.green(pages)} page(s), ${c.green(categories)} categor${categories === 1 ? "y" : "ies"}, ${c.green(docs)} doc(s)`,
  );
  if (discardDrafts && !dryRun) {
    console.error(`${c.dim("Drafts discarded:")} ${c.green(draftsDiscarded)}`);
  }
  console.error(`${c.dim("Elapsed:         ")} ${c.dim(timer.elapsed())}`);
}

interface SanityTransactionLike {
  createOrReplace(doc: SanityDoc): SanityTransactionLike;
  delete(id: string): SanityTransactionLike;
  commit(): Promise<{ transactionId?: string; results?: Array<{ id: string; operation: string }> }>;
}
interface SanityClientLike {
  transaction(): SanityTransactionLike;
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
