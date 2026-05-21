import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/text
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentText = defineType({
  name: "proxyContentText",
  title: "Text",
  type: "object",
  groups: [
    { name: "properties", title: "Properties" },
    { name: "display", title: "Display" },
    { name: "color", title: "Color" },
  ],
  preview: {
    prepare() {
      return { title: "Text" };
    },
  },
  fields: [
    defineField({
      name: "text",
      type: "array",
      group: "properties",
      of: [{ type: "block" }],
    }),
    defineField({ name: "marginTop", title: "Margin Top", type: "string" }),
    defineField({
      name: "marginBottom",
      title: "Margin Bottom",
      type: "string",
    }),
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
    defineField({
      name: "contentToggle",
      title: "Enable Content Toggle",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "showLess",
      title: "Label for Show Less",
      type: "string",
      group: "display",
    }),
    defineField({
      name: "showMore",
      title: "Label for Show More",
      type: "string",
      group: "display",
    }),
    defineField({
      name: "previewcontent",
      title: "Preview Content",
      type: "array",
      group: "display",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "datasource",
      title: "datasource",
      description:
        'TODO: no Sanity mapping for AEM resource type "acs-commons/components/utilities/genericlist/datasource". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "inherit",
      title: "inherit",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "left",
      title: "left",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "center",
      title: "center",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "right",
      title: "right",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "colorTextSource",
      title: "Source:",
      description:
        "Select from pre-defined quick access colors, brand palettes, or a custom hex value.",
      type: "string",
      group: "color",
      options: {
        list: [
          { title: "Default", value: "default" },
          { title: "Palette", value: "palette" },
          { title: "Custom", value: "custom" },
        ],
      },
    }),
    defineField({
      name: "colorText",
      title: "Color:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "color",
    }),
    defineField({
      name: "colorTextPalette",
      title: "Palette color:",
      description:
        "Select from pre-approved brand and grayscale color palettes. Keep on 'default' to inherit colors from parent component.",
      type: "string",
      group: "color",
    }),
    defineField({
      name: "colorTextCustom",
      title: "Hex value:",
      description: "Select a custom color to use for typography.",
      type: "string",
      group: "color",
    }),
  ],
});
