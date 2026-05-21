import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/latestupdates
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentLatestupdates = defineType({
  name: "proxyContentLatestupdates",
  title: "Latest Updates",
  type: "object",
  groups: [{ name: "latestUpdates", title: "Latest Updates" }],
  preview: {
    prepare() {
      return { title: "Latest Updates" };
    },
  },
  fields: [
    defineField({
      name: "revision",
      title: "Revision",
      description: "If not authored , updated text will not display",
      type: "array",
      group: "latestUpdates",
      of: [
        {
          type: "object",
          title: "Revision",
          fields: [
            defineField({
              name: "revisionNotes",
              title: "Revision Notes",
              type: "array",
              of: [{ type: "block" }],
            }),
            defineField({
              name: "revisionDate",
              title: "Revision Date",
              description:
                "Please select the Revision Date. Enter Date in Format: MMM dd, yyyy (For Example, Mar 13, 2025)",
              type: "date",
            }),
          ],
        },
      ],
    }),
  ],
});
