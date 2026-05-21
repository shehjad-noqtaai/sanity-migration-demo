import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/structure/page
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const structurePage = defineType({
  name: "structurePage",
  title: "Unified Experience Platform Page",
  type: "object",
  groups: [
    { name: "advanced", title: "Advanced" },
    { name: "settings", title: "Settings" },
    { name: "configuration", title: "Configuration" },
    { name: "spaConfiguration", title: "SPA configuration" },
    { name: "templatesSettings", title: "Templates Settings" },
    { name: "addDrNumber", title: "Add DR Number" },
    { name: "authenticationRequirement", title: "Authentication Requirement" },
    { name: "export", title: "Export" },
    { name: "seo", title: "SEO" },
    { name: "images", title: "Images" },
    { name: "featuredImage", title: "Featured Image" },
    { name: "thumbnail", title: "Thumbnail" },
    { name: "customPageProperties", title: "Custom Page Properties" },
    {
      name: "pagePermissionsForUserGroup",
      title: "Page Permissions for User Group",
    },
    { name: "pageInformationDetails", title: "Page Information Details" },
    { name: "uepNews", title: "UEP News" },
    { name: "customerReady", title: "Customer Ready" },
    { name: "watermark", title: "Watermark" },
  ],
  preview: {
    select: {
      prMedia: "cqFeaturedimageFileReference",
    },
    prepare({ prMedia }) {
      return {
        title: "Unified Experience Platform Page",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "jcrLanguage",
      title: "Language",
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "cqIsLanguageRoot",
      description: "Must be checked if page is the root of a language copy.",
      type: "boolean",
      group: "settings",
      initialValue: true,
    }),
    defineField({
      name: "cqRedirectTarget",
      title: "Redirect",
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "cqRedirectPermanent",
      description: "Can be checked to enable permanent redirect.",
      type: "boolean",
      group: "settings",
      initialValue: true,
    }),
    defineField({
      name: "cqDesignPath",
      title: "Design",
      description:
        'TODO: no Sanity mapping for AEM resource type "wcm/designer/gui/components/designfield". Falling back to string.',
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "slingAlias",
      title: "Alias",
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "cqConf",
      title: "Cloud Configuration",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/cloudconfig/components/admin/configpathbrowser". Falling back to string.',
      type: "string",
      group: "configuration",
    }),
    defineField({
      name: "remoteUrl",
      title: "Remote APP URL",
      type: "string",
      group: "spaConfiguration",
    }),
    defineField({
      name: "cqAllowedTemplates",
      title: "Allowed Templates",
      description:
        "Click 'Add Field' to add a template or a list of templates to be allowed as child pages. Each value in the list must be an absolute path to a template or use '/.*' to allow all templates below this path.",
      type: "array",
      group: "templatesSettings",
      of: [
        {
          type: "object",
          title: "Allowed Templates",
          fields: [defineField({ name: "cqAllowedTemplates", type: "string" })],
        },
      ],
    }),
    defineField({
      name: "drNumber",
      title: "ADD DR Number",
      description: "Click 'Add DR' to add DR Number",
      type: "array",
      group: "addDrNumber",
      of: [
        {
          type: "object",
          title: "ADD DR Number",
          fields: [defineField({ name: "drNumber", type: "string" })],
        },
      ],
    }),
    defineField({
      name: "cugconfigwarning",
      title: "cugconfigwarning",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/siteadmin/admin/properties/cugconfigwarning". Falling back to string.',
      type: "string",
      group: "authenticationRequirement",
    }),
    defineField({
      name: "enable",
      title: "enable",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/siteadmin/admin/properties/authrequirement". Falling back to string.',
      type: "string",
      group: "authenticationRequirement",
    }),
    defineField({
      name: "cqLoginPath",
      title: "Login Page",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/siteadmin/admin/properties/loginpath". Falling back to string.',
      type: "string",
      group: "authenticationRequirement",
    }),
    defineField({
      name: "cqExportTemplate",
      title: "Export Configuration",
      type: "string",
      group: "export",
    }),
    defineField({
      name: "cqCanonicalUrl",
      title: "Canonical Url",
      description:
        "Use this field to overwrite the page's canonical url. If not set the page's url will be its canonical url.",
      type: "string",
      group: "seo",
    }),
    defineField({
      name: "cqRobotsTags",
      title: "Robots Tags",
      description:
        "Select the robots tags to control search engine crawler behavior. Keep in mind that some of the options conflict with each other. In that case the more permissive options take precedence.",
      type: "string",
      group: "seo",
      options: {
        list: [
          { title: "index", value: "index" },
          { title: "noindex", value: "noindex" },
          { title: "follow", value: "follow" },
          { title: "nofollow", value: "nofollow" },
          { title: "noarchive", value: "noarchive" },
          { title: "nosnippet", value: "nosnippet" },
          { title: "noimageindex", value: "noimageindex" },
          { title: "notranslate", value: "notranslate" },
        ],
      },
    }),
    defineField({
      name: "slingSitemapRoot",
      description:
        "If checked, a sitemap.xml will be created for this page and its descendants.",
      type: "boolean",
      group: "seo",
      initialValue: true,
    }),
    defineField({
      name: "cqFeaturedimageFileReference",
      title: "Image",
      type: "image",
      group: "featuredImage",
    }),
    defineField({
      name: "cqFeaturedimageFileReferenceAemPath",
      title: "Image Preview (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "featuredImage",
      readOnly: true,
    }),
    defineField({
      name: "imagePreview",
      title: "Image Preview",
      description:
        "Used in components referencing the page (e.g. teaser, list of pages)",
      type: "image",
      group: "featuredImage",
    }),
    defineField({
      name: "cqFeaturedimageAlt",
      title: "Alternative Text",
      description:
        "Textual alternative of the meaning or function of the image, for visually impaired readers.",
      type: "string",
      group: "featuredImage",
    }),
    defineField({
      name: "cqFeaturedimageAltValueFromDam",
      description:
        "When checked, populate the image's alt attribute with the value of the dc:description metadata in DAM.",
      type: "boolean",
      group: "featuredImage",
      initialValue: true,
    }),
    defineField({
      name: "thumbnail",
      title: "thumbnail",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/common/wcm/pagethumbnail". Falling back to string.',
      type: "string",
      group: "thumbnail",
    }),
    defineField({
      name: "pageId",
      title: "Page Id",
      description: "Page Id for the current page.",
      type: "string",
      group: "pagePermissionsForUserGroup",
    }),
    defineField({
      name: "pagePermission",
      title: "Set Permission for Page",
      description:
        "This property allows to define which user group can access the Page as defined in the Permission Management System.",
      type: "string",
      group: "pagePermissionsForUserGroup",
      options: {
        list: [
          { title: "False", value: "False" },
          { title: "True", value: "True" },
        ],
      },
    }),
    defineField({
      name: "componentPermission",
      title: "Set Permission for Components on the Page",
      description:
        "This property allows me to define which user group can access the Components configured on the page as defined in the Permission Management System.",
      type: "string",
      group: "pagePermissionsForUserGroup",
      options: {
        list: [
          { title: "False", value: "False" },
          { title: "True", value: "True" },
        ],
      },
    }),
    defineField({
      name: "pageType",
      title: "Page Type",
      description:
        'TODO: no Sanity mapping for AEM resource type "cq/gui/components/coral/common/form/tagfield". Falling back to string.',
      type: "string",
      group: "pageInformationDetails",
    }),
    defineField({
      name: "authorName",
      title: "Author Name",
      type: "string",
      group: "pageInformationDetails",
    }),
    defineField({
      name: "contentOwnersEmail",
      title: "Content Owners Email Address",
      description:
        "Enter content owner’s email to display page ownership in admin tools and reports, including feedback and comment dashboards.",
      type: "string",
      group: "pageInformationDetails",
    }),
    defineField({
      name: "publishedDate",
      title: "Published Date",
      type: "datetime",
      group: "pageInformationDetails",
    }),
    defineField({
      name: "pinPage",
      description:
        "Select the checkbox if this page has to be pinned and shown on the top of the news results.",
      type: "boolean",
      group: "pageInformationDetails",
      initialValue: true,
    }),
    defineField({
      name: "rankSeller",
      title: "Rank for Seller",
      type: "number",
      group: "uepNews",
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "rankServicer",
      title: "Rank for Servicer",
      type: "number",
      group: "uepNews",
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "rankCorporate",
      title: "Rank for Corporate",
      type: "number",
      group: "uepNews",
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "rankSellerCr",
      title: "Rank for Seller",
      type: "number",
      group: "customerReady",
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "rankServicerCr",
      title: "Rank for Servicer",
      type: "number",
      group: "customerReady",
      validation: (Rule) => Rule.min(1),
    }),
    defineField({
      name: "iconId",
      title: "Icons",
      description:
        'TODO: no Sanity mapping for AEM resource type "/apps/uxp/components/commons/authoring/iconSelect/v1/iconSelect". Falling back to string.',
      type: "string",
      group: "pageInformationDetails",
    }),
    defineField({
      name: "disableCache",
      type: "boolean",
      group: "pageInformationDetails",
      initialValue: true,
    }),
    defineField({
      name: "expirationDate",
      title: "Expiration Date",
      type: "date",
      group: "pageInformationDetails",
    }),
    defineField({
      name: "notificationList",
      title: "Archive Notification List *",
      type: "array",
      group: "pageInformationDetails",
      of: [
        {
          type: "object",
          title: "Archive Notification List *",
          fields: [
            defineField({
              name: "email",
              title: "Email Address",
              type: "string",
              validation: (Rule) => Rule.required(),
            }),
          ],
        },
      ],
    }),
    defineField({
      name: "triggerNotification",
      description:
        "Check this box to notify the page subscriber when the page is published.",
      type: "boolean",
      group: "pageInformationDetails",
      initialValue: true,
    }),
    defineField({
      name: "pageBlurb",
      title: "Page Blurb",
      description:
        "Add a message to accompany the page link and description when promoted in Viva Engage",
      type: "array",
      group: "pageInformationDetails",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "cancelInheritance",
      description: "Select to cancel inheritence from parent page.",
      type: "boolean",
      group: "watermark",
      initialValue: true,
    }),
    defineField({
      name: "watermarkState",
      title: "Turn on/off watermark",
      type: "string",
      group: "watermark",
      options: {
        list: [
          { title: "Turn on", value: "turnOn" },
          { title: "Turn off", value: "turnOff" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "graniteRendercondition",
      title: "graniteRendercondition",
      description:
        'TODO: no Sanity mapping for AEM resource type "utils/granite/rendercondition/simple/platform-governance". Falling back to string.',
      type: "string",
    }),
    defineField({ name: "items", title: "Items", type: "pageBuilder" }),
  ],
});
