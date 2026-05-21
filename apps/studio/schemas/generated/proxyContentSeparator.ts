import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/separator
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentSeparator = defineType({
  name: "proxyContentSeparator",
  title: "Separator",
  type: "object",
  groups: [
    { name: "general", title: "General" },
    { name: "properties", title: "Properties" },
  ],
  preview: {
    prepare() {
      return { title: "Separator" };
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
          { title: "Initial", value: "tdds-divider--initial" },
          { title: "Brand", value: "tdds-divider--branded" },
          { title: "Gray (light)", value: "tdds-divider--graylight" },
          { title: "Gray (dark)", value: "tdds-divider--strong" },
        ],
      },
    }),
    defineField({
      name: "orientation",
      title: "Orientation",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "Horizontal", value: "horizontal" },
          { title: "Vertical", value: "vertical" },
        ],
      },
    }),
    defineField({
      name: "weight",
      title: "Weight",
      type: "string",
      group: "general",
      options: {
        list: [
          { title: "Default", value: "tdds-divider--default" },
          { title: "Thin", value: "tdds-divider--thin" },
          { title: "Thick", value: "tdds-divider--thick" },
        ],
      },
    }),
  ],
});
