import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/spacer
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentSpacer = defineType({
  name: "proxyContentSpacer",
  title: "Spacer",
  type: "object",
  preview: {
    prepare() {
      return { title: "Spacer" };
    },
  },
  fields: [
    defineField({
      name: "size",
      title: "Size",
      type: "string",
      options: {
        list: [
          { title: "Spacer-0 (0px)", value: "dre-spacer-0" },
          { title: "Spacer-1 (8px)", value: "dre-spacer-1" },
          { title: "Spacer-2 (16px)", value: "dre-spacer-2" },
          { title: "Spacer-3 (24px)", value: "dre-spacer-3" },
          { title: "Spacer-4 (32px)", value: "dre-spacer-4" },
          { title: "Spacer-5 (40px)", value: "dre-spacer-5" },
          { title: "Spacer-7 (56px)", value: "dre-spacer-7" },
          { title: "Spacer-8 (64px)", value: "dre-spacer-8" },
          { title: "Spacer-10 (80px)", value: "dre-spacer-10" },
          { title: "Spacer-12 (96px)", value: "dre-spacer-12" },
          { title: "Spacer-20 (160px)", value: "dre-spacer-20" },
        ],
      },
    }),
  ],
});
