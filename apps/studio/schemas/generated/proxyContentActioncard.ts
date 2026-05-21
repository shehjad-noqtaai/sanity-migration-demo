import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/actioncard
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentActioncard = defineType({
  name: "proxyContentActioncard",
  title: "Action Card",
  type: "object",
  groups: [
    { name: "textLink", title: "Text Link" },
    { name: "text", title: "Text" },
    { name: "icons", title: "Icons" },
    { name: "display", title: "Display" },
  ],
  preview: {
    prepare() {
      return { title: "Action Card" };
    },
  },
  fields: [
    defineField({
      name: "linksNote",
      title: "linksNote",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/text". Falling back to string.',
      type: "string",
      group: "textLink",
    }),
    defineField({
      name: "linkUrl",
      title: "Link",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/pagefield". Falling back to string.',
      type: "string",
      group: "textLink",
    }),
    defineField({
      name: "linkTarget",
      description: "If checked the link will be opened in a new browser tab.",
      type: "boolean",
      group: "textLink",
      initialValue: false,
    }),
    defineField({
      name: "actions",
      title: "Call-to-actions",
      description:
        "Allows to link the teaser to multiple destinations. The page linked in the first call to action is used when inheriting the teaser title, description or image.",
      type: "array",
      group: "textLink",
      of: [
        {
          type: "object",
          title: "Call-to-actions",
          fields: [
            defineField({
              name: "link",
              title: "link",
              description:
                'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/pagefield". Falling back to string.',
              type: "string",
            }),
            defineField({
              name: "linkTarget",
              description:
                "If checked the link will be opened in a new browser tab.",
              type: "boolean",
              initialValue: false,
            }),
            defineField({
              name: "text",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "copySuccessMessage",
      title: "Success copy message ",
      description:
        "Enter the message to be shown after code is copied. For Example: Copied successfully.",
      type: "string",
      group: "textLink",
    }),
    defineField({
      name: "enableCopy",
      description: "If enabled SOC code type and SOC code would be displayed.",
      type: "boolean",
      group: "textLink",
      initialValue: true,
    }),
    defineField({
      name: "socDetails",
      title: "SOC Details",
      description: "Allows to add SOC code type and SOC code.",
      type: "array",
      group: "textLink",
      of: [
        {
          type: "object",
          title: "SOC Details",
          fields: [
            defineField({
              name: "socType",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
            defineField({
              name: "socCode",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "jcrTitle",
      title: "Title",
      description: "A title to display as the headline for the teaser.",
      type: "string",
      group: "text",
      initialValue: "${cqDesign._jcr_description}",
    }),
    defineField({
      name: "titleType",
      title: "Heading Element",
      description: "The heading HTML element used for the teaser's title type.",
      type: "string",
      group: "text",
    }),
    defineField({
      name: "titleType2",
      title: "Title Type",
      type: "string",
      group: "text",
      options: {
        list: [
          { title: "H1", value: "h1" },
          { title: "H2", value: "h2" },
          { title: "H3", value: "h3" },
          { title: "H4", value: "h4" },
          { title: "H5", value: "h5" },
          { title: "H6", value: "h6" },
        ],
      },
    }),
    defineField({
      name: "titleFromPage",
      description:
        "When checked, populate the title with the linked page's title.",
      type: "boolean",
      group: "text",
      initialValue: true,
    }),
    defineField({
      name: "jcrDescription",
      title: "Description",
      description:
        "A description to display as the subheadline for the teaser.",
      type: "array",
      group: "text",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "descriptionFromPage",
      description:
        "When checked, populate the description with the linked page's description.",
      type: "boolean",
      group: "text",
      initialValue: true,
    }),
    defineField({
      name: "legalText",
      title: "Legal Text",
      description: "Allows the author to give Legal Text",
      type: "string",
      group: "text",
    }),
    defineField({
      name: "pretitle",
      title: "pretitle",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "text",
    }),
    defineField({
      name: "id",
      title: "id",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "text",
    }),
    defineField({
      name: "image",
      title: "Asset",
      description:
        'TODO: no Sanity mapping for AEM resource type "core/wcm/components/include/imagedelegate". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "icon",
      title: "Icon",
      description:
        'TODO: no Sanity mapping for AEM resource type "/apps/uxp/components/commons/authoring/iconSelect/v1/iconSelect". Falling back to string.',
      type: "string",
      group: "icons",
    }),
    defineField({
      name: "asset",
      title: "Asset",
      description:
        'TODO: no Sanity mapping for AEM resource type "core/wcm/components/include/imagedelegate". Falling back to string.',
      type: "string",
      group: "icons",
    }),
    defineField({
      name: "graniteRendercondition",
      title: "graniteRendercondition",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/renderconditions/hasallowedstyles". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "styleSelector",
      title: "styleSelector",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/authoring/dialog/style/styleselector". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "primary",
      title: "primary",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "secondary",
      title: "secondary",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "tertiary",
      title: "tertiary",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "addShadow",
      description: "If checked, will add shadow to the card.",
      type: "boolean",
      group: "display",
      initialValue: true,
    }),
    defineField({
      name: "addRoundedBorder",
      description: "If checked, will add rounded border to the card.",
      type: "boolean",
      group: "display",
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
