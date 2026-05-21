import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/accordion
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentAccordion = defineType({
  name: "proxyContentAccordion",
  title: "Accordion",
  type: "object",
  groups: [
    { name: "content", title: "Content" },
    { name: "theme", title: "Theme" },
  ],
  preview: {
    prepare() {
      return { title: "Accordion" };
    },
  },
  fields: [
    defineField({
      name: "icon",
      type: "array",
      group: "content",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "accordionNumber",
              title: "Accordion Number",
              description: "Which accordion should icon apply to?",
              type: "number",
              validation: (Rule) => Rule.min(1).required(),
            }),
            defineField({
              name: "iconId",
              title: "Icon ID",
              description:
                'TODO: no Sanity mapping for AEM resource type "/apps/uxp/components/commons/authoring/iconSelect/v1/iconSelect". Falling back to string.',
              type: "string",
            }),
            defineField({
              name: "label",
              title: "Aria Label",
              description:
                "If accessibility is enabled, you can enter a custom aria-label to be associated with the icon.",
              type: "string",
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "isInverse",
      description: "When enabled, the accordion colors will be inversed.",
      type: "boolean",
      group: "theme",
      initialValue: true,
    }),
    defineField({
      name: "isSplit",
      description:
        "When enabled, the accordion will be split into two columns on desktop\n",
      type: "boolean",
      group: "theme",
      initialValue: true,
    }),
    defineField({
      name: "hasDivider",
      description:
        "If enabled, a divider will be added between the accordion items.",
      type: "boolean",
      group: "theme",
      initialValue: true,
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
  ],
});
