import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/image
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentImage = defineType({
  name: "proxyContentImage",
  title: "Image",
  type: "object",
  groups: [
    { name: "asset", title: "Asset" },
    { name: "metadata", title: "Metadata" },
    { name: "display", title: "Display" },
  ],
  preview: {
    select: {
      prMedia: "file",
    },
    prepare({ prMedia }) {
      return {
        title: "Image",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({ name: "file", type: "file", group: "asset" }),
    defineField({
      name: "imageFromPageImage",
      description:
        "Use the featured image defined in the properties of the linked page, or in the properties of the current page when no link is defined.",
      type: "boolean",
      group: "asset",
      initialValue: true,
    }),
    defineField({
      name: "titleValueFromDam",
      description:
        "When checked, populate the image's caption with the value of the dc:description metadata in DAM.",
      type: "boolean",
      group: "metadata",
      initialValue: true,
    }),
    defineField({
      name: "disableImageOnViewport",
      title: "Disable image on viewport:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({ name: "marginTop", title: "Margin Top", type: "string" }),
    defineField({
      name: "marginBottom",
      title: "Margin Bottom",
      type: "string",
    }),
  ],
});
