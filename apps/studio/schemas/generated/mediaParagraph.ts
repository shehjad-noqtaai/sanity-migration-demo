import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/media-paragraph
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const mediaParagraph = defineType({
  name: "mediaParagraph",
  title: "Media paragraph",
  type: "object",
  groups: [{ name: "general", title: "General" }],
  preview: {
    prepare() {
      return { title: "Media paragraph" };
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
      name: "layout",
      title: "Layout",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "medium", value: "medium" },
          { title: "large", value: "large" },
          { title: "full", value: "full" },
        ],
      },
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
          { title: "Seashell-block", value: "seashell-block" },
          { title: "Mocassin", value: "mocassin" },
          { title: "Mocassin-block", value: "mocassin-block" },
          { title: "Claret", value: "claret" },
          { title: "Claret-block", value: "claret-block" },
          { title: "Black", value: "black" },
          { title: "Black-block", value: "black-block" },
        ],
      },
    }),
    defineField({
      name: "buttons",
      title: "Buttons",
      type: "array",
      of: [
        {
          type: "object",
          title: "Buttons",
          fields: [
            defineField({
              name: "text",
              title: "Button text",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "link",
              title: "Button link",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "buttonHexColor",
              title: "Button color",
              type: "string",
            }),
            defineField({
              name: "type",
              title: "Button type",
              type: "string",
              options: {
                list: [
                  { title: "Ghost", value: "ghost" },
                  { title: "Filled", value: "filled" },
                  { title: "link", value: "link" },
                ],
              },
            }),
            defineField({
              name: "ctaTextHexColor",
              title: "CTA Text Color",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({ name: "id", title: "Component ID", type: "string" }),
    defineField({ name: "content", title: "content", type: "content" }),
  ],
});
