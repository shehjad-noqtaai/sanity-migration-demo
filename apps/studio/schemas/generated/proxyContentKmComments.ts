import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/km/comments
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentKmComments = defineType({
  name: "proxyContentKmComments",
  title: "Comments",
  type: "object",
  preview: {
    prepare() {
      return { title: "Comments" };
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
  ],
});
