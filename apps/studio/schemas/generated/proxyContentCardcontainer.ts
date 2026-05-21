import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/cardcontainer
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentCardcontainer = defineType({
  name: "proxyContentCardcontainer",
  title: "Card Container",
  type: "object",
  groups: [
    { name: "display", title: "Display" },
    { name: "spacing", title: "Spacing" },
    { name: "backgroundColor", title: "Background Color" },
  ],
  preview: {
    prepare() {
      return { title: "Card Container" };
    },
  },
  fields: [
    defineField({
      name: "gridType",
      title: "Grid type:",
      description:
        "Do you want choose from a custom or pre-defined/fixed grid layout?",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Custom", value: "custom" },
          { title: "Fixed", value: "fixed" },
        ],
      },
    }),
    defineField({
      name: "mobileColumn",
      title: "Mobile/Default columns:",
      description: "The default number of columns to start with.",
      type: "number",
      group: "display",
      initialValue: 1,
      validation: (Rule) => Rule.min(1).max(2),
    }),
    defineField({
      name: "tabletColumn",
      title: "Tablet columns:",
      description:
        "The number of columns on tablet viewports. Keep empty to inherit from previous viewport.",
      type: "number",
      group: "display",
      validation: (Rule) => Rule.min(1).max(8),
    }),
    defineField({
      name: "desktopColumn",
      title: "Desktop columns:",
      description:
        "The number of columns on desktop viewports. Keep empty to inherit from previous viewport.",
      type: "number",
      group: "display",
      validation: (Rule) => Rule.min(1).max(12),
    }),
    defineField({
      name: "fixedLayoutDropdown",
      title: "Fixed grid type:",
      description:
        "Select from fixed layouts. A grid area will be created where cards will be placed into an area based on the order they are in. The option in the dropdown indicates the percentage of width occupied by each card in a row. e.g. 30/70 defines that 30% width to be occupied by first card and 70% width to be occupied by second card.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "20/80", value: "1fr 4fr" },
          { title: "30/70", value: "3fr 7fr" },
          { title: "40/60", value: "2fr 3fr" },
          { title: "60/40", value: "3fr 2fr" },
          { title: "70/30", value: "7fr 3fr" },
          { title: "80/20", value: "4fr 1fr" },
        ],
      },
    }),
    defineField({
      name: "gutter",
      title: "Gutter:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "spacing",
    }),
    defineField({
      name: "colorBackgroundSource",
      title: "Source:",
      description:
        "Select from pre-defined quick access colors, brand palettes, or a custom hex value.",
      type: "string",
      group: "backgroundColor",
      options: {
        list: [
          { title: "Default", value: "default" },
          { title: "Palette", value: "palette" },
          { title: "Custom", value: "custom" },
        ],
      },
    }),
    defineField({
      name: "colorBackground",
      title: "Color:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "backgroundColor",
    }),
    defineField({
      name: "colorBackgroundPalette",
      title: "Palette color:",
      description:
        "Select from pre-approved brand and grayscale color palettes. Keep on 'default' to inherit colors from parent component.",
      type: "string",
      group: "backgroundColor",
    }),
    defineField({
      name: "colorBackgroundCustom",
      title: "Hex value:",
      description: "Select a custom color to use for typography.",
      type: "string",
      group: "backgroundColor",
    }),
    defineField({
      name: "promocard",
      title: "promocard",
      type: "proxyContentPromocard",
    }),
    defineField({ name: "table", title: "table", type: "proxyContentTable" }),
    defineField({
      name: "actioncard",
      title: "actioncard",
      type: "proxyContentActioncard",
    }),
    defineField({
      name: "actioncardCopy",
      title: "actioncard_copy",
      type: "proxyContentActioncard",
    }),
    defineField({
      name: "promocardCopy",
      title: "promocard_copy",
      type: "proxyContentPromocard",
    }),
    defineField({ name: "image", title: "image", type: "proxyContentImage" }),
    defineField({
      name: "wrapper",
      title: "wrapper",
      type: "proxyContentWrapper",
    }),
  ],
});
