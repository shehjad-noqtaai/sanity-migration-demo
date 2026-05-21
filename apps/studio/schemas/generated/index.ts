// STUB — replaced by `pnpm migrate:schema` once tenant schemas are
// generated. Default repo state keeps this empty so apps/studio boots and
// typechecks on a bare clone, before any AEM migration has run.
//
// After running `migrate:schema` this file (and its sibling component
// files in this directory) will show as modified. That's expected:
//
//   - Default: leave them local. Each operator regenerates per machine;
//     nothing in this directory gets committed.
//   - Opt-in source control: comment out the
//     `apps/studio/schemas/generated/` line in `.gitignore`, then
//     `git add` the regenerated files. Pick this only on single-tenant
//     repos where the schema doubles as documentation — otherwise
//     committed schemas conflict between operators on different AEM
//     installs.
//
// See CLAUDE.md § "Regenerating artifacts" for the full rationale.
import type { SchemaTypeDefinition } from "sanity";

export const allSchemaTypes: SchemaTypeDefinition[] = [];
