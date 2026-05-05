import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/resources-column-list
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const resourcesColumnList = defineType({
  name: "resourcesColumnList",
  title: "Resource column list",
  type: "object",
  groups: [{ name: "general", title: "General" }],
  preview: {
    prepare() {
      return { title: "Resource column list" };
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
      name: "sidebarLink",
      title: "Sidebar link target",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "sidebarLinkText",
      title: "Sidebar link text",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "White", value: "white" },
          { title: "Seashell", value: "seashell" },
          { title: "Mocassin", value: "mocassin" },
        ],
      },
    }),
  ],
});
