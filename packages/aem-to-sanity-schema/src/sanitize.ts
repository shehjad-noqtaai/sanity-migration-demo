import { defineField } from "sanity";
import { RESERVED_SANITY_TYPE_NAMES } from "./naming.ts";

function aemPrefix(name: string): string {
  return "aem" + name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Post-process emitted Sanity schemas so that they validate under `sanity
 * schema validate`:
 *
 *   1. Object types with zero fields get a hidden `aemPlaceholder` string
 *      field. AEM dialogs occasionally consist entirely of hidden/unmapped
 *      children and would otherwise fail Sanity's "at least one field" rule.
 *   2. Defense-in-depth rename for any type still colliding with a Sanity
 *      built-in. The emitter's `resolveSanityTypeNames` already applies this
 *      prefix up front (so the on-disk name, the content registry, and
 *      ingested `_type` values agree). This pass only catches hand-authored
 *      schemas that slipped the prefix.
 *
 * The schema files on disk are untouched — the fix is applied at import time
 * so the emitted artifact remains a faithful AEM-shape snapshot. Call this
 * from your Studio config when wiring `allSchemaTypes` into `defineConfig`.
 */
export function sanitizeSchemaTypes<T>(types: T[]): T[] {
  return types.map((raw) => {
    const t = { ...(raw as Record<string, unknown>) };
    if (
      typeof t.name === "string" &&
      RESERVED_SANITY_TYPE_NAMES.has(t.name)
    ) {
      t.name = aemPrefix(t.name);
    }
    const isContainer = t.type === "object" || t.type === "document";
    if (isContainer) {
      const fields = Array.isArray(t.fields) ? t.fields : [];
      if (fields.length === 0) {
        t.fields = [
          defineField({
            name: "aemPlaceholder",
            type: "string",
            description:
              "AEM dialog had no mappable fields; this placeholder exists so the schema validates.",
            hidden: true,
          }),
        ];
      }
    }
    return t as T;
  });
}
