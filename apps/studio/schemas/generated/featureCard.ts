import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/feature-card
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const featureCard = defineType({
  name: "featureCard",
  title: "Feature card",
  type: "object",
  groups: [
    { name: "layout", title: "Layout" },
    { name: "text", title: "Text" },
    { name: "media", title: "Media" },
  ],
  preview: {
    select: {
      prMedia: "mediaItems.0.fileReference",
    },
    prepare({ prMedia }) {
      return {
        title: "Feature card",
        media: prMedia,
      };
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
      name: "layoutType",
      title: "Layout type",
      type: "string",
      group: "layout",
      options: {
        list: [
          { title: "in-line", value: "inline" },
          { title: "off-set", value: "offset" },
        ],
      },
    }),
    defineField({
      name: "layoutArrangement",
      title: "Layout Arrangement",
      type: "string",
      group: "layout",
      options: {
        list: [
          { title: "image right, copy left", value: "img_right" },
          { title: "image left, copy right", value: "img_left" },
        ],
      },
    }),
    defineField({
      name: "theme",
      title: "Theme",
      type: "string",
      group: "layout",
      options: {
        list: [
          { title: "White", value: "white" },
          { title: "Mocassin", value: "mocassin" },
          { title: "Seashell", value: "seashell" },
          { title: "Claret", value: "claret" },
          { title: "Black", value: "black" },
        ],
      },
    }),
    defineField({
      name: "cardBackground",
      title: "Card background color",
      type: "string",
      group: "layout",
    }),
    defineField({
      name: "overline",
      title: "Overline",
      type: "string",
      group: "text",
    }),
    defineField({
      name: "headline",
      title: "Headline",
      type: "string",
      group: "text",
    }),
    defineField({
      name: "bodyText",
      title: "Body text",
      type: "array",
      group: "text",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "textAlign",
      title: "Text alignment",
      type: "string",
      group: "text",
    }),
    defineField({
      name: "mediaItems",
      title: "Media assets",
      type: "array",
      group: "media",
      of: [
        {
          type: "object",
          title: "Media assets",
          fields: [
            defineField({
              name: "fileReferenceAemPath",
              title: "Asset (AEM DAM path)",
              description:
                "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
              type: "string",
              readOnly: true,
            }),
            defineField({
              name: "fileReference",
              title: "Asset",
              type: "image",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "videoAssetPreviewImage",
              title: "Video thumbnail",
              type: "image",
            }),
            defineField({
              name: "visible",
              title: "Devices",
              type: "string",
              options: {
                list: [
                  { title: "desktop", value: "desktop" },
                  { title: "tablet", value: "tablet" },
                  { title: "mobile", value: "mobile" },
                ],
              },
            }),
            defineField({
              name: "title",
              title: "Popup title",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "buttons",
      title: "Section CTA Options",
      type: "array",
      of: [
        {
          type: "object",
          title: "Section CTA Options",
          fields: [
            defineField({
              name: "type",
              title: "CTA type",
              type: "string",
              options: {
                list: [
                  { title: "Button", value: "button" },
                  { title: "Link", value: "link" },
                ],
                layout: "radio",
              },
            }),
            defineField({ name: "text", title: "CTA text", type: "string" }),
            defineField({ name: "link", title: "CTA link", type: "string" }),
            defineField({
              name: "ariaLabel",
              title: "Aria label",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({ name: "id", title: "Component ID", type: "string" }),
  ],
});
