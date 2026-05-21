import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/actionbar
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentActionbar = defineType({
  name: "proxyContentActionbar",
  title: "Action Bar",
  type: "object",
  groups: [
    {
      name: "editShareableLinkProperties",
      title: "Edit Shareable Link Properties",
    },
  ],
  preview: {
    prepare() {
      return { title: "Action Bar" };
    },
  },
  fields: [
    defineField({
      name: "shareablelinks",
      title: "Configure edit shareable link",
      description: "A list of the Shareable Links.",
      type: "array",
      group: "editShareableLinkProperties",
      of: [
        {
          type: "object",
          title: "Configure edit shareable link",
          fields: [
            defineField({
              name: "englishTitle",
              title: "English Title",
              description: "English Title",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "spanishTitle",
              title: "Spanish Title",
              description: "Spanish Title",
              type: "string",
            }),
            defineField({
              name: "englishSubheading",
              title: "English Subheading",
              description: "English Subheading",
              type: "string",
            }),
            defineField({
              name: "spanishSubheading",
              title: "Spanish Subheading",
              description: "Spanish Subheading",
              type: "string",
            }),
            defineField({
              name: "englishLink",
              title: "English URL",
              description: "English URL",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "spanishLink",
              title: "Spanish URL",
              description: "Spanish URL",
              type: "string",
            }),
          ],
        },
      ],
    }),
  ],
});
