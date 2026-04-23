import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/button
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const button = defineType({
  name: "button",
  title: "Button",
  type: "object",
  groups: [{ name: "general", title: "General" }],
  preview: {
    prepare() {
      return { title: "Button" };
    },
  },
  fields: [
    defineField({
      name: "color",
      title: "Color",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "Nickel", value: "gray500" },
          { title: "gray700", value: "gray700" },
          { title: "DBI Black", value: "gray800" },
          { title: "Spanish Crimson", value: "primary" },
          { title: "primaryDark", value: "primaryDark" },
          { title: "Mocassin", value: "secondary" },
          { title: "Seashell", value: "secondaryLight" },
        ],
      },
    }),
    defineField({
      name: "variant",
      title: "Variant",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "solid", value: "solid" },
          { title: "outlined", value: "outlined" },
          { title: "flat", value: "flat" },
          { title: "link", value: "link" },
          { title: "underlined", value: "underlined" },
        ],
      },
    }),
    defineField({
      name: "measure",
      title: "Measure",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "sm", value: "sm" },
          { title: "md", value: "md" },
        ],
      },
    }),
  ],
});
