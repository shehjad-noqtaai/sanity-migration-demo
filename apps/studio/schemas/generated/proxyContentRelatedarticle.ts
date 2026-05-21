import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/relatedarticle
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentRelatedarticle = defineType({
  name: "proxyContentRelatedarticle",
  title: "Related Article",
  type: "object",
  groups: [{ name: "general", title: "General" }],
  preview: {
    prepare() {
      return { title: "Related Article" };
    },
  },
  fields: [
    defineField({
      name: "title",
      title: "Title",
      type: "string",
      group: "general",
    }),
    defineField({
      name: "pageType",
      title: "Page Type",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/tagfield". Falling back to string.',
      type: "string",
      group: "general",
    }),
    defineField({
      name: "topic",
      title: "Topic",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/tagfield". Falling back to string.',
      type: "string",
      group: "general",
    }),
    defineField({
      name: "pathHierarchy",
      title: "Hierarchy",
      type: "array",
      group: "general",
      of: [
        {
          type: "object",
          title: "Hierarchy",
          fields: [
            defineField({
              name: "parentPage",
              title: "Path Field",
              description:
                'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/pagefield". Falling back to string.',
              type: "string",
            }),
          ],
        },
      ],
    }),
  ],
});
