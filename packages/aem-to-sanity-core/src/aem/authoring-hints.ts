/**
 * AEM authoring metadata that lives outside the dialog but carries
 * meaningful content the migration needs to preserve. Each entry maps
 * the original JCR/CQ-prefixed property to a Sanity-safe field name.
 *
 * Currently used for accordion / expander panel titles:
 * AEM stores the question / heading on each child node as
 * `cq:panelTitle`, separate from the child's own dialog fields. The
 * normal property iterator drops anything with a colon
 * (`isValidSanityAttributeKey` rejects `cq:*`), so the value would be
 * lost without an explicit lift step.
 *
 * Add a new row here when a similar AEM authoring hint needs to round
 * trip — the transform reads this map to rename keys, and the schema
 * emitter reads it to inject corresponding fields on every component
 * so Studio doesn't surface "Unknown field found" warnings.
 */
export const AEM_AUTHORING_HINTS: ReadonlyMap<string, string> = new Map([
  ["cq:panelTitle", "panelTitle"],
]);
