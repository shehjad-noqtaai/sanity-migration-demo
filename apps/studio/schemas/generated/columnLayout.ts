import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/column-layout
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const columnLayout = defineType({
  name: "columnLayout",
  title: "Column layout",
  type: "object",
  preview: {
    prepare() {
      return { title: "Column layout" };
    },
  },
  fields: [
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
      name: "properties",
      title: "properties",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
    }),
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
  ],
});
