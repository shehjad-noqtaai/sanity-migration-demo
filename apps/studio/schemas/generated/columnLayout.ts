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
    defineField({ name: "title", title: "Main title", type: "string" }),
    defineField({
      name: "enableHorizontalLine",
      type: "boolean",
      initialValue: true,
    }),
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
  ],
});
