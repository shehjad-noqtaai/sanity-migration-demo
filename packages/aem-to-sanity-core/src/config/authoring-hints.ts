import { readFileSync } from "node:fs";

/**
 * Per-project config opting specific AEM components into authoring-hint
 * lifting. Keyed by `sling:resourceType`, value is the list of AEM keys
 * (e.g. `cq:panelTitle`) that should be:
 *
 *  1. Lifted at content-transform time to the corresponding Sanity field
 *     name (the rename vocabulary lives in
 *     `packages/aem-to-sanity-core/src/aem/authoring-hints.ts`).
 *  2. Declared as `readOnly` `string` fields on the matching emitted
 *     Sanity schema — so the Studio doesn't surface "Unknown field" on
 *     the lifted value.
 *
 * Only the listed AEM keys on the listed resource types are touched —
 * unrelated components stay clean. The transform still drops colon-
 * bearing keys for every other component as before.
 *
 * Example (`tenants/<your-tenant>/aem-component-hints.json`):
 *
 * ```json
 * {
 *   "aem-integration/components/box":     ["cq:panelTitle"],
 *   "aem-integration/components/content": ["cq:panelTitle"]
 * }
 * ```
 *
 * Override the file path via the `AEM_COMPONENT_HINTS_FILE` env var.
 */
export type AuthoringHintConfig = Map<string, ReadonlySet<string>>;

export interface LoadAuthoringHintConfigOptions {
  /** Absolute or relative path. Missing file → empty config. */
  file: string;
}

/**
 * Synchronous load — matches `loadContainerConfig`. Returns an empty Map
 * when the file is absent so opting in is fully optional. Throws on
 * malformed JSON or invalid entries so a typo doesn't silently disable
 * hint lifting.
 */
export function loadAuthoringHintConfig(
  opts: LoadAuthoringHintConfigOptions,
): AuthoringHintConfig {
  const { file } = opts;
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `authoring-hint config: ${file} is not valid JSON (${(err as Error).message})`,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(
      `authoring-hint config: ${file} must be a JSON object keyed by sling:resourceType`,
    );
  }

  const out: AuthoringHintConfig = new Map();
  for (const [resourceType, value] of Object.entries(parsed)) {
    if (!Array.isArray(value)) {
      throw new Error(
        `authoring-hint config: entry for "${resourceType}" must be an array of AEM hint keys`,
      );
    }
    const keys = new Set<string>();
    for (const k of value) {
      if (typeof k !== "string" || k.trim().length === 0) {
        throw new Error(
          `authoring-hint config: entry for "${resourceType}" has non-string / empty hint key`,
        );
      }
      keys.add(k);
    }
    if (keys.size > 0) out.set(resourceType, keys);
  }
  return out;
}
