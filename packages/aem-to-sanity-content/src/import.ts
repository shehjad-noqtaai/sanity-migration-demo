#!/usr/bin/env node
import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
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
  if (files.length === 0) {
    console.error(`No clean files in ${cleanDir}. Run \`aem-transform\` first.`);
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
  console.error(`[import] ${files.length} page(s) ${mode}`);

  let pages = 0;
  let docs = 0;
  let draftsDiscarded = 0;
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
    `${dryRun ? c.dim("Would commit") : c.green("Committed")}: ${c.green(pages)} page(s), ${c.green(docs)} doc(s)`,
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
