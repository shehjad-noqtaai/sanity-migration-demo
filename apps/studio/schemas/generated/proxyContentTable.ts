import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/table
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentTable = defineType({
  name: "proxyContentTable",
  title: "Table",
  type: "object",
  groups: [
    { name: "properties", title: "Properties" },
    { name: "accessibility", title: "Accessibility" },
  ],
  preview: {
    prepare() {
      return { title: "Table" };
    },
  },
  fields: [
    defineField({
      name: "text",
      type: "array",
      group: "properties",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "hideCaption",
      type: "boolean",
      group: "accessibility",
      initialValue: true,
    }),
    defineField({
      name: "isAccessRestricted",
      title: " Is Access Restricted?",
      type: "string",
      options: {
        list: [
          { title: "False", value: "false" },
          { title: "True", value: "true" },
        ],
      },
    }),
    defineField({
      name: "componentId",
      title: "Component Id",
      description: "Component Id for the currently selected component. ",
      type: "string",
    }),
  ],
});
