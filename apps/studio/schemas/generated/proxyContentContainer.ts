import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/container
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentContainer = defineType({
  name: "proxyContentContainer",
  title: "Container",
  type: "object",
  preview: {
    prepare() {
      return { title: "Container" };
    },
  },
  fields: [
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
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
  ],
});
