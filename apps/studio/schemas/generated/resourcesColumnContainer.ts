import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/resources-column-container
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const resourcesColumnContainer = defineType({
  name: "resourcesColumnContainer",
  title: "Resources column item",
  type: "object",
  groups: [{ name: "general", title: "General" }],
  preview: {
    prepare() {
      return { title: "Resources column item" };
    },
  },
  fields: [
    defineField({
      name: "id",
      title: "Container id",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "title",
      title: "Container title",
      type: "string",
      group: "general",
      initialValue: "Add category name",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "showCategoryName",
      type: "boolean",
      group: "general",
      initialValue: true,
    }),
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
  ],
});
