#!/usr/bin/env node
/**
 * Detect drift between an operator tenant folder and tenants/template/, plus
 * sanity-check the operator's .env against .env.example.
 *
 *   pnpm migrate:doctor <slug>          report only
 *   pnpm migrate:doctor <slug> --fix    auto-repair safe surfaces (scripts block)
 *
 * Exits 0 when clean, 1 when findings remain after any fixes were applied.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  AEM_AUTH_FLOWS,
  OPERATOR_FILES,
  TEMPLATE_DIR,
  TEMPLATE_FILES,
  TENANTS_DIR,
  isMeaningfulValue,
  parseEnv,
  parseEnvExample,
  readFileIfExists,
  tenantDir,
} from "./lib/tenant-template.ts";

type Severity = "error" | "warn" | "info";

interface Finding {
  severity: Severity;
  area: "package.json" | "template-file" | "env" | "structure";
  message: string;
}

const findings: Finding[] = [];
const record = (severity: Severity, area: Finding["area"], message: string): void => {
  findings.push({ severity, area, message });
};

function fail(msg: string): never {
  console.error(`[migrate:doctor] ${msg}`);
  process.exit(2);
}

function checkPackageJson(dir: string, fix: boolean): void {
  const templatePkgPath = join(TEMPLATE_DIR, "package.json");
  const tenantPkgPath = join(dir, "package.json");
  if (!existsSync(tenantPkgPath)) {
    record("error", "structure", "package.json is missing");
    return;
  }
  const templatePkg = JSON.parse(readFileSync(templatePkgPath, "utf8")) as Record<string, any>;
  const tenantPkg = JSON.parse(readFileSync(tenantPkgPath, "utf8")) as Record<string, any>;

  const templateScripts = (templatePkg.scripts ?? {}) as Record<string, string>;
  const tenantScripts = (tenantPkg.scripts ?? {}) as Record<string, string>;

  const drift: string[] = [];
  for (const [key, val] of Object.entries(templateScripts)) {
    if (tenantScripts[key] === undefined) {
      drift.push(`+ scripts.${key}: missing`);
    } else if (tenantScripts[key] !== val) {
      drift.push(`~ scripts.${key}: differs from template`);
    }
  }

  if (drift.length === 0) {
    record("info", "package.json", "scripts block matches template");
    return;
  }

  if (fix) {
    tenantPkg.scripts = { ...templateScripts };
    writeFileSync(tenantPkgPath, JSON.stringify(tenantPkg, null, 2) + "\n", "utf8");
    record("info", "package.json", `fixed scripts block (${drift.length} change(s))`);
  } else {
    for (const line of drift) {
      record("warn", "package.json", line);
    }
    record("warn", "package.json", "run with --fix to overwrite the scripts block with the template's");
  }
}

function checkTemplateFiles(dir: string): void {
  for (const name of TEMPLATE_FILES) {
    const templatePath = join(TEMPLATE_DIR, name);
    const tenantPath = join(dir, name);
    const templateContent = readFileIfExists(templatePath);
    const tenantContent = readFileIfExists(tenantPath);
    if (templateContent === null) continue;
    if (tenantContent === null) {
      record("warn", "template-file", `${name} missing — template has a newer version`);
      continue;
    }
    if (tenantContent !== templateContent) {
      record(
        "warn",
        "template-file",
        `${name} differs from template (re-copy if you haven't customized it)`,
      );
    }
  }
}

function checkEnv(dir: string): void {
  const envExamplePath = join(dir, ".env.example");
  const envPath = join(dir, ".env");
  const envExampleContent = readFileIfExists(envExamplePath);
  if (envExampleContent === null) {
    record("error", "env", ".env.example missing");
    return;
  }
  const envContent = readFileIfExists(envPath);
  if (envContent === null) {
    record("error", "env", ".env missing — copy .env.example to .env and fill in values");
    return;
  }

  const declared = parseEnvExample(envExampleContent);
  const tenantEnv = parseEnv(envContent);

  for (const entry of declared) {
    if (!entry.required) continue;
    const value = tenantEnv.get(entry.key);
    if (value === undefined) {
      record("error", "env", `${entry.key} is required but missing in .env`);
    } else if (!value) {
      record("error", "env", `${entry.key} is empty in .env`);
    } else if (!isMeaningfulValue(value)) {
      record("error", "env", `${entry.key}="${value}" still looks like a template placeholder`);
    }
  }

  const aemEnv = tenantEnv.get("AEM_ENV");
  if (aemEnv === "author" || aemEnv === undefined) {
    const matched = AEM_AUTH_FLOWS.some((flow) => {
      if (flow.mode === "any-of") {
        return flow.keys.some((k) => isMeaningfulValue(tenantEnv.get(k)));
      }
      return flow.keys.every((k) => isMeaningfulValue(tenantEnv.get(k)));
    });
    if (!matched) {
      const options = AEM_AUTH_FLOWS.map((f) => `${f.name} (${f.keys.join(" + ")})`).join(" | ");
      record(
        "error",
        "env",
        `no AEM author authentication configured — pick one: ${options}`,
      );
    }
  }

  if (tenantEnv.get("MIGRATION_DRY_RUN") === "false") {
    if (!isMeaningfulValue(tenantEnv.get("SANITY_MEDIA_LIBRARY_ID"))) {
      record(
        "error",
        "env",
        "MIGRATION_DRY_RUN=false but SANITY_MEDIA_LIBRARY_ID is unset — aem-assets will fail",
      );
    }
  }

  const known = new Set(declared.map((d) => d.key));
  for (const key of tenantEnv.keys()) {
    if (!known.has(key)) {
      record("info", "env", `${key} is set but not documented in .env.example (likely fine)`);
    }
  }
}

function ensureNotIgnoringOperatorFiles(dir: string): void {
  for (const name of OPERATOR_FILES) {
    const path = join(dir, name);
    if (!existsSync(path)) {
      record("warn", "structure", `${name} missing — copy the template's version if you need it`);
    }
  }
}

function render(slug: string): number {
  const groups: Record<Severity, Finding[]> = { error: [], warn: [], info: [] };
  for (const f of findings) groups[f.severity].push(f);

  const banner = `[migrate:doctor] tenants/${slug}/`;
  if (groups.error.length === 0 && groups.warn.length === 0) {
    console.log(`${banner} — clean`);
    if (groups.info.length > 0) {
      console.log("");
      for (const f of groups.info) console.log(`  info  [${f.area}] ${f.message}`);
    }
    return 0;
  }

  console.log(banner);
  for (const severity of ["error", "warn", "info"] as const) {
    if (groups[severity].length === 0) continue;
    console.log("");
    for (const f of groups[severity]) {
      const tag = severity === "error" ? "ERROR" : severity === "warn" ? "WARN " : "info ";
      console.log(`  ${tag} [${f.area}] ${f.message}`);
    }
  }

  return groups.error.length > 0 ? 1 : 0;
}

function listTenants(): string[] {
  if (!existsSync(TENANTS_DIR)) return [];
  return readdirSync(TENANTS_DIR).filter((name) => {
    if (name === "template") return false;
    const path = join(TENANTS_DIR, name);
    if (!statSync(path).isDirectory()) return false;
    return existsSync(join(path, "package.json"));
  });
}

function main(): void {
  const args = process.argv.slice(2);
  const fix = args.includes("--fix");
  const all = args.includes("--all");
  const positional = args.filter((a) => !a.startsWith("--"));
  const slugs = all ? listTenants() : positional;

  if (slugs.length === 0) {
    fail(
      "usage: pnpm migrate:doctor <slug> [--fix]   or   pnpm migrate:doctor --all [--fix]",
    );
  }

  let exitCode = 0;
  for (let i = 0; i < slugs.length; i++) {
    if (i > 0) console.log("");
    const slug = slugs[i];
    findings.length = 0;
    const dir = tenantDir(slug);
    if (!existsSync(dir)) {
      console.error(`[migrate:doctor] tenants/${slug}/ does not exist`);
      exitCode = Math.max(exitCode, 2);
      continue;
    }
    checkPackageJson(dir, fix);
    checkTemplateFiles(dir);
    ensureNotIgnoringOperatorFiles(dir);
    checkEnv(dir);
    exitCode = Math.max(exitCode, render(slug));
  }
  process.exit(exitCode);
}

main();
