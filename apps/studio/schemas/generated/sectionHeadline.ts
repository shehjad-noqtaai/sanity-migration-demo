import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/section-headline
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const sectionHeadline = defineType({
  name: "sectionHeadline",
  title: "Section headline",
  type: "object",
  groups: [{ name: "properties", title: "Properties" }],
  preview: {
    prepare() {
      return { title: "Section headline" };
    },
  },
  fields: [
    defineField({
      name: "headline1",
      title: "Headline 1 (script)",
      type: "string",
    }),
    defineField({
      name: "headline2",
      title: "Headline 2 (sans serif)",
      type: "string",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "array",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "removeTopPadding",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "removeBottomPadding",
      type: "boolean",
      initialValue: true,
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      group: "properties",
      options: {
        list: [
          { title: "White", value: "white" },
          { title: "Black", value: "black" },
          { title: "Claret", value: "claret" },
          { title: "Mocassin", value: "mocassin" },
          { title: "Seashell", value: "seashell" },
        ],
      },
    }),
  ],
});
