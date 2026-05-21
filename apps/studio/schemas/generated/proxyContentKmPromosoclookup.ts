import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/km/promosoclookup
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentKmPromosoclookup = defineType({
  name: "proxyContentKmPromosoclookup",
  title: "Promo SOC Lookup",
  type: "object",
  groups: [{ name: "properties", title: "Properties" }],
  preview: {
    prepare() {
      return { title: "Promo SOC Lookup" };
    },
  },
  fields: [
    defineField({
      name: "promoId",
      title: "Promo ID",
      description:
        "Promo ID can be retrieved from UXP Admin Portal Promo Editor. Only published Promo has Promo ID assigned.",
      type: "string",
      group: "properties",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "showAllEligibleSoCs",
      type: "boolean",
      group: "properties",
      initialValue: true,
    }),
  ],
});
