import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/box
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const box = defineType({
  name: "box",
  title: "Box",
  type: "object",
  groups: [
    { name: "general", title: "General" },
    { name: "marginAndPadding", title: "Margin and padding" },
    { name: "backgroundImage", title: "Background image" },
  ],
  preview: {
    select: {
      prMedia: "fileReference",
    },
    prepare({ prMedia }) {
      return {
        title: "Box",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "align",
      title: "Align type",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "alignItems",
      title: "Align items type",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "color",
      title: "Color",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "bg",
      title: "Background color",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "display",
      title: "Display type",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "fontFamily",
      title: "Font family",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "fontWeight",
      title: "Font weight",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "float",
      title: "Float",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "justifyContent",
      title: "Justify content",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "clearfix",
      type: "boolean",
      group: "general",
      initialValue: true,
    }),
    defineField({
      name: "fullWidth",
      type: "boolean",
      group: "general",
      initialValue: true,
    }),
    defineField({
      name: "as",
      title: "As default type",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "position",
      title: "Position",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "mt",
      title: "mt",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "mr",
      title: "mr",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "mb",
      title: "mb",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "ml",
      title: "ml",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "pt",
      title: "pt",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "pr",
      title: "pr",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "pb",
      title: "pb",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "pl",
      title: "pl",
      type: "number",
      group: "marginAndPadding",
    }),
    defineField({
      name: "fileReferenceAemPath",
      title: "Bg image (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "backgroundImage",
      readOnly: true,
    }),
    defineField({
      name: "fileReference",
      title: "Bg image",
      type: "image",
      group: "backgroundImage",
    }),
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
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
