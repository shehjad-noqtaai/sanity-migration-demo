import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/wrapper
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentWrapper = defineType({
  name: "proxyContentWrapper",
  title: "Wrapper",
  type: "object",
  groups: [
    { name: "mobile", title: "Mobile" },
    { name: "tablet", title: "Tablet" },
    { name: "desktop", title: "Desktop" },
    { name: "display", title: "Display" },
    { name: "color", title: "Color" },
    { name: "background", title: "Background" },
    { name: "asset", title: "Asset" },
    { name: "accessibility", title: "Accessibility" },
  ],
  preview: {
    select: {
      prMedia: "fileReference",
    },
    prepare({ prMedia }) {
      return {
        title: "Wrapper",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "properties",
      title: "properties",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
    }),
    defineField({ name: "marginTop", title: "Margin Top", type: "string" }),
    defineField({
      name: "marginBottom",
      title: "Margin Bottom",
      type: "string",
    }),
    defineField({
      name: "mobilecolumnAlign",
      title: "Column vertical alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "mobile",
    }),
    defineField({
      name: "mobilecolumnJustify",
      title: "Column horizontal justification:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "mobile",
    }),
    defineField({
      name: "mobilecontentAlign",
      title: "Content alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "mobile",
    }),
    defineField({
      name: "mobileheightValue",
      title: "Height:",
      description:
        "The height of the wrapper. Leave empty to grow wrapper naturally based on content height.",
      type: "number",
      group: "mobile",
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: "mobileheightUnit",
      title: "Unit:",
      description: "Unit to be used for your height value.",
      type: "string",
      group: "mobile",
    }),
    defineField({
      name: "inheritPreviousScreenTablet",
      type: "string",
      group: "tablet",
      options: {
        list: [
          { title: "Inherit from previous screen size", value: "inherit" },
          { title: "Overwrite values for screen size", value: "overwrite" },
        ],
      },
    }),
    defineField({
      name: "tabletcolumnAlign",
      title: "Column vertical alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "tablet",
    }),
    defineField({
      name: "tabletcolumnJustify",
      title: "Column horizontal justification:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "tablet",
    }),
    defineField({
      name: "tabletcontentAlign",
      title: "Content alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "tablet",
    }),
    defineField({
      name: "tabletheightValue",
      title: "Height:",
      description:
        "The height of the wrapper. Leave empty to grow wrapper naturally based on content height.",
      type: "number",
      group: "tablet",
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: "tabletheightUnit",
      title: "Unit:",
      description: "Unit to be used for your height value.",
      type: "string",
      group: "tablet",
    }),
    defineField({
      name: "inheritPreviousScreenDesktop",
      type: "string",
      group: "desktop",
      options: {
        list: [
          { title: "Inherit from previous screen size", value: "inherit" },
          { title: "Overwrite values for screen size", value: "overwrite" },
        ],
      },
    }),
    defineField({
      name: "desktopcolumnAlign",
      title: "Column vertical alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "desktop",
    }),
    defineField({
      name: "desktopcolumnJustify",
      title: "Column horizontal justification:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "desktop",
    }),
    defineField({
      name: "desktopcontentAlign",
      title: "Content alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "desktop",
    }),
    defineField({
      name: "desktopheightValue",
      title: "Height:",
      description:
        "The height of the wrapper. Leave empty to grow wrapper naturally based on content height.",
      type: "number",
      group: "desktop",
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: "desktopheightUnit",
      title: "Unit:",
      description: "Unit to be used for your height value.",
      type: "string",
      group: "desktop",
    }),
    defineField({
      name: "spacingVertical",
      title: "Vertical spacing:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "spacingHorizontal",
      title: "Horizontal spacing:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "addRoundedCorners",
      description: "If checked, will add rounded corners to the wrapper.",
      type: "boolean",
      group: "display",
      initialValue: true,
    }),
    defineField({
      name: "masking",
      title: "Masking:",
      description:
        "Overlay and Gradient can be used to improve the accessibility of text over a background image or video. Overlay applies to the whole card while Gradient can be used to darken just the area behind the text to leave the rest of the background image visible.",
      type: "string",
      options: {
        list: [
          { title: "Disabled", value: "disabled" },
          { title: "Overlay", value: "overlay" },
          { title: "Gradient", value: "gradient" },
          { title: "Static", value: "static" },
        ],
      },
    }),
    defineField({
      name: "disableMaskingOn",
      title: "Disable masking (overlay/gradient) on:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "blendMode",
      title: "Blend mode:",
      description:
        "How should the mask (overlay/gradient) blend with the background color or image. https://developer.mozilla.org/en-US/docs/Web/CSS/mix-blend-mode",
      type: "string",
      options: {
        list: [
          { title: "Initial", value: "initial" },
          { title: "Normal", value: "normal" },
          { title: "Multiply", value: "multiply" },
          { title: "Screen", value: "screen" },
          { title: "Overlay", value: "overlay" },
          { title: "Darken", value: "darken" },
          { title: "Lighten", value: "lighten" },
          { title: "Color-Dodge", value: "color-dodge" },
          { title: "Color-Burn", value: "color-burn" },
          { title: "Hard-Light", value: "hard-light" },
          { title: "Soft-Light", value: "soft-light" },
          { title: "Difference", value: "difference" },
          { title: "Exclusion", value: "exclusion" },
          { title: "Hue", value: "hue" },
          { title: "Saturation", value: "saturation" },
          { title: "Color", value: "color" },
          { title: "Luminosity", value: "luminosity" },
        ],
      },
    }),
    defineField({
      name: "overlayColor",
      title: "Overlay color:",
      description:
        "The color of the overlay layer. Can be hex or rgba() based.",
      type: "string",
    }),
    defineField({
      name: "opacity",
      title: "Opacity:",
      description: "The level of opacity applied to the overlay.",
      type: "number",
      initialValue: 1,
      validation: (Rule) => Rule.min(0).max(1),
    }),
    defineField({
      name: "gradientColor1",
      title: "Color 1:",
      description:
        "The first color of the gradient layer. Can be hex or rgba() based.",
      type: "string",
    }),
    defineField({
      name: "gradientColor2",
      title: "Color 2:",
      description:
        "The second color of the gradient layer. Can be hex or rgba() based.",
      type: "string",
    }),
    defineField({
      name: "defaultAngle",
      title: "Default angle:",
      description:
        "The angle at which the gradient is rendered. [0/360=bottom, 90=left, 180=top, 270=right]",
      type: "number",
      initialValue: 360,
      validation: (Rule) => Rule.min(0).max(360),
    }),
    defineField({
      name: "defaultAngleStop1",
      title: "Stop 1:",
      description:
        "The stoping point of 1st color used on gradient. These values are in percent.",
      type: "number",
      initialValue: 0,
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "defaultAngleStop2",
      title: "Stop 2:",
      description:
        "The stoping point of 2nd color used on gradient. These values are in percent.",
      type: "number",
      initialValue: 100,
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "tabletAngle",
      title: "Tablet angle:",
      description:
        "The angle at which the gradient is rendered on tablet viewports. Leave empty to inherit from previous breakpoint.",
      type: "number",
      validation: (Rule) => Rule.min(0).max(360),
    }),
    defineField({
      name: "tabletAngleStop1",
      title: "Stop 1:",
      description:
        "The stoping point of 1st color used on gradient for tablet breakpoint. These values are in percent. Leave empty to inherit from previous breakpoint.",
      type: "number",
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "tabletAngleStop2",
      title: "Stop 2:",
      description:
        "The stoping point of 2nd color used on gradient for tablet breakpoint. These values are in percent. Leave empty to inherit from previous breakpoint.",
      type: "number",
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "desktopAngle",
      title: "Desktop angle:",
      description:
        "The angle at which the gradient is rendered on desktop viewports. Leave empty to inherit from previous breakpoint.",
      type: "number",
      validation: (Rule) => Rule.min(0).max(360),
    }),
    defineField({
      name: "desktopAngleStop1",
      title: "Stop 1:",
      description:
        "The stoping point of 1st color used on gradient for desktop breakpoint. These values are in percent. Leave empty to inherit from previous breakpoint.",
      type: "number",
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "desktopAngleStop2",
      title: "Stop 2:",
      description:
        "The stoping point of 2nd color used on gradient for desktop breakpoint. These values are in percent. Leave empty to inherit from previous breakpoint.",
      type: "number",
      validation: (Rule) => Rule.min(0).max(100),
    }),
    defineField({
      name: "staticStyle",
      title: "Style:",
      description: "Pick from a pre-defined style",
      type: "string",
      options: {
        list: [
          { title: "Disabled", value: "disabled" },
          { title: "Branded - Linear", value: "branded-linear" },
          { title: "Monochrome - Linear", value: "monochrome-linear" },
        ],
      },
    }),
    defineField({
      name: "staticAngle",
      title: "Angle:",
      description:
        "The angle at which to render the gradient for all viewports. If you want to change the angle, please use custom option.",
      type: "string",
      options: {
        list: [
          { title: "Default", value: "0" },
          { title: "Custom", value: "custom" },
          { title: "90°", value: "90" },
          { title: "180°", value: "180" },
          { title: "270°", value: "270" },
        ],
      },
    }),
    defineField({
      name: "staticMobileAngle",
      title: "Mobile angle:",
      description:
        "The angle at which the gradient is rendered. [0/360=bottom, 90=left, 180=top, 270=right]",
      type: "number",
      validation: (Rule) => Rule.min(0).max(360),
    }),
    defineField({
      name: "staticTabletAngle",
      title: "Tablet angle:",
      description:
        "To inherit, keep empty. The angle at which the gradient is rendered. [0/360=bottom, 90=left, 180=top, 270=right]",
      type: "number",
      validation: (Rule) => Rule.min(0).max(360),
    }),
    defineField({
      name: "staticDesktopAngle",
      title: "Desktop angle:",
      description:
        "To inherit, keep empty. The angle at which the gradient is rendered. [0/360=bottom, 90=left, 180=top, 270=right]",
      type: "number",
      validation: (Rule) => Rule.min(0).max(360),
    }),
    defineField({
      name: "maskingHtml",
      title: "maskingHtml",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
    }),
    defineField({
      name: "colorBackgroundSource",
      title: "Source:",
      description:
        "Select from pre-defined quick access colors, brand palettes, or a custom hex value.",
      type: "string",
      group: "color",
      options: {
        list: [
          { title: "Default", value: "default" },
          { title: "Palette", value: "palette" },
          { title: "Custom", value: "custom" },
        ],
      },
    }),
    defineField({
      name: "colorBackground",
      title: "Color:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "color",
    }),
    defineField({
      name: "colorBackgroundPalette",
      title: "Palette color:",
      description:
        "Select from pre-approved brand and grayscale color palettes. Keep on 'default' to inherit colors from parent component.",
      type: "string",
      group: "color",
    }),
    defineField({
      name: "colorBackgroundCustom",
      title: "Hex value:",
      description: "Select a custom color to use for typography.",
      type: "string",
      group: "color",
    }),
    defineField({
      name: "accordionSetting",
      title: "accordionSetting",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/accordion". Falling back to string.',
      type: "string",
      group: "background",
    }),
    defineField({
      name: "imageFromPageImage",
      description:
        "Use the featured image defined in the properties of the linked page, or in the properties of the current page when no link is defined.",
      type: "boolean",
      group: "asset",
      initialValue: true,
    }),
    defineField({
      name: "pageImageThumbnail",
      title: "pageImageThumbnail",
      description:
        'TODO: no Sanity mapping for AEM resource type "core/wcm/components/commons/editor/dialog/pageimagethumbnail/v1/pageimagethumbnail". Falling back to string.',
      type: "string",
      group: "asset",
    }),
    defineField({
      name: "fileReferenceAemPath",
      title: "fileReference (AEM DAM path)",
      description:
        "Original AEM path from migration (read-only). Use the Sanity asset field below for previews and delivery.",
      type: "string",
      group: "asset",
      readOnly: true,
    }),
    defineField({
      name: "fileReference",
      title: "fileReference",
      type: "image",
      group: "asset",
    }),
    defineField({
      name: "alt",
      title: "Alternative text for accessibility",
      description:
        "Textual alternative of the meaning or function of the image, for visually impaired readers.",
      type: "string",
      group: "asset",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "altValueFromPageImage",
      description:
        "Use the description defined on the referenced asset, or the alternative text defined in the page properties.",
      type: "boolean",
      group: "asset",
      initialValue: true,
    }),
    defineField({
      name: "altValueFromDam",
      description:
        "When checked, populate the image's alt attribute with the value of the dc:description metadata in DAM.",
      type: "boolean",
      group: "asset",
      initialValue: true,
    }),
    defineField({
      name: "isDecorative",
      description:
        "If the image is mostly decorative and doesn't convey additional meaning to a visitor, then it might be acceptable to not provide an alternative text, which will make the image ignored by assistive technology like screen readers.",
      type: "boolean",
      group: "asset",
      initialValue: true,
    }),
    defineField({
      name: "dmPresetType",
      title: "Preset Type",
      description: "Select either an Image Preset or Smart Crop rendition.",
      type: "string",
      group: "asset",
      options: {
        list: [
          { title: "Image Preset", value: "imagePreset" },
          { title: "Smart Crop", value: "smartCrop" },
        ],
        layout: "radio",
      },
    }),
    defineField({
      name: "imagePreset",
      title: "Image Preset",
      description: "Image Preset to use when rendering image.",
      type: "string",
      group: "asset",
    }),
    defineField({
      name: "smartCropRendition",
      title: "Rendition",
      description:
        "Select Auto for Dynamic Media to decide the best rendition. Else select a specific smart crop rendition.",
      type: "string",
      group: "asset",
    }),
    defineField({
      name: "imageModifiers",
      title: "Image Modifiers",
      description:
        "Additional Dynamic Media Image Serving commands separated by '&'.Field gives complete flexibility to change image effects.",
      type: "string",
      group: "asset",
    }),
    defineField({
      name: "disableLazyLoading",
      description:
        "When checked, image will be loaded eagerly, regardless of if the image is currently visible by the user.",
      type: "boolean",
      group: "asset",
      initialValue: true,
    }),
    defineField({
      name: "enableCustomMedia",
      description:
        "When enabled, breakpoint specific renditions can be applied. Default dynamic media behavior will be disabled that is provided by Adobe image component.",
      type: "boolean",
      group: "background",
      initialValue: true,
    }),
    defineField({
      name: "smartCropRenditionMobile",
      title: "Rendition",
      description:
        "Select Auto for Dynamic Media to decide the best rendition. Else select a specific smart crop rendition.",
      type: "string",
      group: "background",
    }),
    defineField({
      name: "modifierMobile",
      title: "Modifier:",
      description:
        "Additional Dynamic Media modifiers to pass to scene7. If left empty, it will inherit from previous breakpoint.",
      type: "string",
      group: "background",
    }),
    defineField({
      name: "inheritTablet",
      description:
        "If checked, the specific breakpoint will not be loaded and instead would rely on the previous breakpoint image.",
      type: "boolean",
      group: "background",
      initialValue: true,
    }),
    defineField({
      name: "smartCropRenditionTablet",
      title: "Rendition",
      description:
        "Select Auto for Dynamic Media to decide the best rendition. Else select a specific smart crop rendition.",
      type: "string",
      group: "background",
    }),
    defineField({
      name: "modifierTablet",
      title: "Modifier:",
      description:
        "Additional Dynamic Media modifiers to pass to scene7. If left empty, it will inherit from previous breakpoint.",
      type: "string",
      group: "background",
    }),
    defineField({
      name: "inheritDesktop",
      description:
        "If checked, the specific breakpoint will not be loaded and instead would rely on the previous breakpoint image.",
      type: "boolean",
      group: "background",
      initialValue: true,
    }),
    defineField({
      name: "smartCropRenditionDesktop",
      title: "Rendition",
      description:
        "Select Auto for Dynamic Media to decide the best rendition. Else select a specific smart crop rendition.",
      type: "string",
      group: "background",
    }),
    defineField({
      name: "modifierDesktop",
      title: "Modifier:",
      description:
        "Additional Dynamic Media modifiers to pass to scene7. If left empty, it will inherit from previous breakpoint.",
      type: "string",
      group: "background",
    }),
    defineField({
      name: "roleWrapper",
      title: "Role",
      description: "HTML ROLE attribute to apply to the component.",
      type: "string",
      group: "accessibility",
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
    defineField({
      name: "container",
      title: "container",
      type: "proxyContentContainer",
    }),
    defineField({ name: "text", title: "text", type: "proxyContentText" }),
    defineField({ name: "image", title: "image", type: "proxyContentImage" }),
    defineField({ name: "title", title: "title", type: "proxyContentTitle" }),
  ],
});
