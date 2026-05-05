import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/photo-layout
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const photoLayout = defineType({
  name: "photoLayout",
  title: "Photo layout",
  type: "object",
  groups: [
    { name: "properties", title: "Properties" },
    { name: "images", title: "Images" },
  ],
  preview: {
    select: {
      prMedia: "fileReference1",
    },
    prepare({ prMedia }) {
      return {
        title: "Photo layout",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "headline1",
      title: "Headline 1 (script)",
      type: "string",
    }),
    defineField({
      name: "headline2",
      title: "Headline 2 (sans serif)",
      type: "string",
    }),
    defineField({
      name: "description",
      title: "Description",
      type: "array",
      of: [{ type: "block" }],
    }),
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
      name: "theme",
      title: "Theme",
      type: "string",
      group: "properties",
      options: {
        list: [
          { title: "White", value: "white" },
          { title: "Seashell", value: "seashell" },
          { title: "Seashell-alt", value: "seashell-alt" },
          { title: "Seashell-cropped", value: "seashell-cropped" },
          { title: "Mocassin", value: "mocassin" },
          { title: "Mocassin-alt", value: "mocassin-alt" },
          { title: "Mocassin-cropped", value: "mocassin-cropped" },
          { title: "Claret", value: "claret" },
          { title: "Claret-alt", value: "claret-alt" },
          { title: "Black", value: "black" },
          { title: "Black-alt", value: "black-alt" },
        ],
      },
    }),
    defineField({
      name: "mobileLayout",
      title: "Mobile layout",
      type: "string",
      group: "properties",
      options: {
        list: [
          { title: "carousel", value: "carousel" },
          { title: "scroll", value: "scroll" },
        ],
      },
    }),
    defineField({
      name: "fileReference1AemPath",
      title: "Image 1 (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "images",
      readOnly: true,
    }),
    defineField({
      name: "fileReference1",
      title: "Image 1",
      type: "image",
      group: "images",
    }),
    defineField({
      name: "imageLink1",
      title: "Image link 1",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "link1",
      title: "Link 1",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "linkTitle1",
      title: "Link text 1",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "fileReference2AemPath",
      title: "Image 2 (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "images",
      readOnly: true,
    }),
    defineField({
      name: "fileReference2",
      title: "Image 2",
      type: "image",
      group: "images",
    }),
    defineField({
      name: "imageText2",
      title: "Image text",
      type: "array",
      group: "images",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "imageLink2",
      title: "Image link 2",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "link2",
      title: "Link 2",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "linkTitle2",
      title: "Link text 2",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "fileReference3AemPath",
      title: "Image 3 (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "images",
      readOnly: true,
    }),
    defineField({
      name: "fileReference3",
      title: "Image 3",
      type: "image",
      group: "images",
    }),
    defineField({
      name: "scriptHeadline",
      title: "Image 3 script  headline",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "sansSerifHeadline",
      title: "Image 3 sans serif headline",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "imageLink3",
      title: "Image link 3",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "link3",
      title: "Link 3",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "linkTitle3",
      title: "Link text 3",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "fileReference4AemPath",
      title: "Image 4 (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "images",
      readOnly: true,
    }),
    defineField({
      name: "fileReference4",
      title: "Image 4",
      type: "image",
      group: "images",
    }),
    defineField({
      name: "imageLink4",
      title: "Image link 4",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "link4",
      title: "Link 4",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "linkTitle4",
      title: "Link text 4",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "fileReference5AemPath",
      title: "Image 5 (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "images",
      readOnly: true,
    }),
    defineField({
      name: "fileReference5",
      title: "Image 5",
      type: "image",
      group: "images",
    }),
    defineField({
      name: "imageLink5",
      title: "Image link 5",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "link5",
      title: "Link 5",
      type: "string",
      group: "images",
    }),
    defineField({
      name: "linkTitle5",
      title: "Link text 5",
      type: "string",
      group: "images",
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
  ],
});
