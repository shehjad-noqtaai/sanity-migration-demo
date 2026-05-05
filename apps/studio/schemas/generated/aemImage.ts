import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/aem-integration/components/image
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const aemImage = defineType({
  name: "aemImage",
  title: "Image",
  type: "object",
  preview: {
    prepare() {
      return { title: "Image" };
    },
  },
  fields: [
    defineField({ name: "fit", title: "Image fit type", type: "string" }),
    defineField({ name: "fullWidth", type: "boolean", initialValue: true }),
    defineField({ name: "bg", title: "Background color", type: "string" }),
  ],
});
