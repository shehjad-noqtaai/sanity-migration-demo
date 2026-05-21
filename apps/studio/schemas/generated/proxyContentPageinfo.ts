import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/pageinfo
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentPageinfo = defineType({
  name: "proxyContentPageinfo",
  title: "Page Information",
  type: "object",
  preview: {
    prepare() {
      return { title: "Page Information" };
    },
  },
  fields: [
    defineField({
      name: "disablePageTitleToggle",
      title: "Disable Page Title",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "disableAuthorToggle",
      title: "Disable Author Name ",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "disablePublishDateToggle",
      title: "Disable Published Date",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "disablePageId",
      title: "Disable Page Id",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "disablePageDescriptionToggle",
      title: "Disable Page Description",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
    }),
  ],
});
