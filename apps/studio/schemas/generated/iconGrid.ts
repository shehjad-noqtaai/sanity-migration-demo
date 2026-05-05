import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/icon-grid
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const iconGrid = defineType({
  name: "iconGrid",
  title: "Icon grid",
  type: "object",
  groups: [{ name: "iconCards", title: "Icon cards" }],
  preview: {
    select: {
      prMedia: "columnContents.0.fileReference",
    },
    prepare({ prMedia }) {
      return {
        title: "Icon grid",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "columns",
      title: "Number of columns",
      type: "string",
      options: {
        list: [
          { title: "2", value: "2" },
          { title: "3", value: "3" },
          { title: "4", value: "4" },
        ],
      },
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      options: {
        list: [
          { title: "White", value: "white" },
          { title: "Seashell card", value: "seashell" },
          { title: "Seashell-no-card", value: "seashell-no-card" },
          { title: "Mocassin card", value: "mocassin" },
          { title: "Mocassin-no-card", value: "mocassin-no-card" },
          { title: "Claret", value: "claret" },
          { title: "Claret-no-card", value: "claret-no-card" },
          { title: "Black", value: "black" },
          { title: "Black-no-card", value: "black-no-card" },
        ],
      },
    }),
    defineField({
      name: "desktopIconPosition",
      title: "Desktop icon position",
      type: "string",
      options: {
        list: [
          { title: "top", value: "top" },
          { title: "left", value: "left" },
        ],
      },
    }),
    defineField({
      name: "tabletIconPosition",
      title: "Tablet icon position",
      type: "string",
      options: {
        list: [
          { title: "top", value: "top" },
          { title: "left", value: "left" },
        ],
      },
    }),
    defineField({
      name: "columnContents",
      title: "Column content",
      type: "array",
      group: "iconCards",
      of: [
        {
          type: "object",
          title: "Column content",
          fields: [
            defineField({
              name: "fileReferenceAemPath",
              title: "Icon (AEM DAM path)",
              description:
                "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
              type: "string",
              readOnly: true,
            }),
            defineField({
              name: "fileReference",
              title: "Icon",
              type: "image",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "imageLink",
              title: "Image link",
              type: "string",
            }),
            defineField({
              name: "headline",
              title: "Headline",
              type: "string",
            }),
            defineField({
              name: "columnText",
              title: "Body text",
              type: "array",
              of: [{ type: "block" }],
            }),
            defineField({
              name: "ctaType",
              title: "Cta type",
              type: "string",
              options: {
                list: [
                  { title: "Button", value: "button" },
                  { title: "Link", value: "link" },
                ],
                layout: "radio",
              },
            }),
            defineField({ name: "ctaText", title: "Cta text", type: "string" }),
            defineField({ name: "ctaLink", title: "Cta link", type: "string" }),
          ],
        },
      ],
    }),
  ],
});
