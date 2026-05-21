import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/shortcuts
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentShortcuts = defineType({
  name: "proxyContentShortcuts",
  title: "Shortcuts",
  type: "object",
  groups: [
    { name: "display", title: "Display" },
    { name: "content", title: "Content" },
  ],
  preview: {
    prepare() {
      return { title: "Shortcuts" };
    },
  },
  fields: [
    defineField({
      name: "type",
      title: "Shortcut Type",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Navigation", value: "navigation" },
          { title: "Tab", value: "tab" },
          { title: "Grid", value: "grid" },
          { title: "Resource", value: "resource" },
        ],
      },
    }),
    defineField({
      name: "navisSticky",
      title: "Navigation is Sticky",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "isInverse",
      title: "Inverse Text Styles (dark mode)",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "tabisSticky",
      title: "Navigation is Sticky",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "gridMobile",
      title: "Mobile columns:",
      description: "The default number of columns to start with.",
      type: "number",
      group: "display",
      initialValue: 2,
      validation: (Rule) => Rule.min(1).max(99),
    }),
    defineField({
      name: "gridTablet",
      title: "Tablet columns:",
      description: "The number of columns on tablet viewports.",
      type: "number",
      group: "display",
      initialValue: 4,
      validation: (Rule) => Rule.min(0).max(99),
    }),
    defineField({
      name: "gridDesktop",
      title: "Desktop columns:",
      description:
        "The number of columns on desktop viewports. Keep empty to inherit from previous viewport.",
      type: "number",
      group: "display",
      validation: (Rule) => Rule.min(0).max(99),
    }),
    defineField({
      name: "path",
      title: "Navigation Root",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/pagefield". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "depth",
      title: "Child Depth:",
      description: "The child depth of navigation to be displayed.",
      type: "number",
      group: "display",
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "visibilityToggleTextOpen",
      title: "Visibility Toggle Text to Open",
      description:
        "The text to display in the Visiblity Toggle button when the related navigation is close.",
      type: "string",
      group: "display",
    }),
    defineField({
      name: "visibilityToggleTextClose",
      title: "Visibility Toggle Text to Close",
      description:
        "The text to display in the Visiblity Toggle button when the related navigation is open.",
      type: "string",
      group: "display",
    }),
    defineField({
      name: "resisSticky",
      title: "Navigation is Sticky",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "links",
      type: "array",
      group: "content",
      of: [
        {
          type: "object",
          fields: [
            defineField({
              name: "text",
              title: "Text",
              description: "The text to display.",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "link",
              title: "Link",
              description:
                'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/pagefield". Falling back to string.',
              type: "string",
            }),
            defineField({
              name: "anchor",
              title: "Anchor ID",
              description:
                "Do not add hashtags. The ID of the component to scroll to is all that is needed.",
              type: "string",
            }),
            defineField({
              name: "icon",
              title: "Icon",
              description:
                'TODO: no Sanity mapping for AEM resource type "/apps/uxp/components/commons/authoring/iconSelect/v1/iconSelect". Falling back to string.',
              type: "string",
            }),
            defineField({
              name: "linkTarget",
              description:
                "If links are scroll to section on same page, the target will be ignored.",
              type: "boolean",
              initialValue: false,
            }),
          ],
        },
      ],
    }),
  ],
});
