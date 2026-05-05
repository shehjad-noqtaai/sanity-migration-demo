import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/container
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const container = defineType({
  name: "container",
  title: "Container",
  type: "object",
  groups: [{ name: "general", title: "General" }],
  preview: {
    prepare() {
      return { title: "Container" };
    },
  },
  fields: [
    defineField({
      name: "fluid",
      type: "boolean",
      group: "general",
      initialValue: true,
    }),
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
  ],
});
