import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/content
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const content = defineType({
  name: "content",
  title: "Text Content",
  type: "object",
  preview: {
    prepare() {
      return { title: "Text Content" };
    },
  },
  fields: [
    defineField({ name: "text", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "align", title: "Align type", type: "string" }),
    defineField({ name: "color", title: "Color", type: "string" }),
    defineField({ name: "display", title: "Display type", type: "string" }),
    defineField({ name: "fontFamily", title: "Font family", type: "string" }),
    defineField({ name: "fontSize", title: "Font size", type: "number" }),
    defineField({ name: "fontWeight", title: "Font weight", type: "string" }),
    defineField({ name: "as", title: "As default type", type: "string" }),
    defineField({ name: "measure", title: "Measure type", type: "string" }),
    defineField({ name: "lineHeight", title: "Line height", type: "number" }),
    defineField({
      name: "letterSpacing",
      title: "Letter spacing",
      type: "number",
    }),
    defineField({ name: "uppercase", type: "boolean", initialValue: true }),
    defineField({ name: "mt", title: "mt", type: "number" }),
    defineField({ name: "mr", title: "mr", type: "number" }),
    defineField({ name: "mb", title: "mb", type: "number" }),
    defineField({ name: "ml", title: "ml", type: "number" }),
    defineField({ name: "pt", title: "pt", type: "number" }),
    defineField({ name: "pr", title: "pr", type: "number" }),
    defineField({ name: "pb", title: "pb", type: "number" }),
    defineField({ name: "pl", title: "pl", type: "number" }),
    defineField({
      name: "panelTitle",
      title: "Paneltitle",
      description:
        "AEM authoring hint preserved from migration (`cq:panelTitle`). Read-only.",
      type: "string",
      readOnly: true,
    }),
  ],
});
