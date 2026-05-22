#!/usr/bin/env node
/**
 * Scaffold a new tenant migration folder from tenants/template/.
 *
 *   pnpm migrate:init <slug>
 *
 * Copies the template, renames the workspace, seeds an editable `.env` from
 * `.env.example`, and prints the next steps. Refuses to overwrite an
 * existing folder.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, relative } from "node:path";

import {
  IGNORED_NAMES,
  TEMPLATE_DIR,
  tenantDir,
} from "./lib/tenant-template.ts";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function fail(msg: string): never {
  console.error(`[migrate:init] ${msg}`);
  process.exit(2);
}

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src)) {
    if (IGNORED_NAMES.has(name)) continue;
    const srcPath = join(src, name);
    const destPath = join(dest, name);
    const stat = statSync(srcPath);
    if (stat.isDirectory()) {
      copyTree(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function renameWorkspace(packageJsonPath: string, slug: string): void {
  const pkg = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    name: string;
    [k: string]: unknown;
  };
  pkg.name = `tenant-${slug}`;
  writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

function main(): void {
  const slug = process.argv[2];
  if (!slug) {
    fail("usage: pnpm migrate:init <slug>   (e.g. pnpm migrate:init acme)");
  }
  if (slug === "template") {
    fail("slug 'template' is reserved for the migration template");
  }
  if (!SLUG_RE.test(slug)) {
    fail(
      `slug "${slug}" is not valid — use lowercase letters, digits, and hyphens (e.g. davids-bridal)`,
    );
  }

  const dest = tenantDir(slug);
  if (existsSync(dest)) {
    fail(`tenants/${slug}/ already exists — refusing to overwrite`);
  }

  if (!existsSync(TEMPLATE_DIR)) {
    fail(`template not found at ${TEMPLATE_DIR}`);
  }

  copyTree(TEMPLATE_DIR, dest);
  renameWorkspace(join(dest, "package.json"), slug);

  const envExample = join(dest, ".env.example");
  const envFile = join(dest, ".env");
  if (existsSync(envExample) && !existsSync(envFile)) {
    copyFileSync(envExample, envFile);
  }

  const rel = relative(process.cwd(), dest) || dest;
  console.log(`[migrate:init] created ${rel}/`);
  console.log("");
  console.log("Next steps (these work from any cwd in the repo — `-w` targets the root workspace):");
  console.log("  1. pnpm install                                     # link the new workspace");
  console.log(`  2. $EDITOR ${rel}/.env                              # fill AEM + Sanity credentials`);
  console.log(`  3. $EDITOR ${rel}/aem-content-roots                 # list pages to migrate`);
  console.log(`  4. $EDITOR ${rel}/aem-component-paths               # list components to map`);
  console.log(`  5. pnpm -w migrate:doctor ${slug}                   # verify before running`);
  console.log(`  6. pnpm -F tenant-${slug} migrate                   # run the full pipeline`);
}

main();
