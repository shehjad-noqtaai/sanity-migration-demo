import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/promocard
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentPromocard = defineType({
  name: "proxyContentPromocard",
  title: "Promo Card",
  type: "object",
  groups: [
    { name: "content", title: "Content" },
    { name: "legal", title: "Legal" },
    { name: "display", title: "Display" },
    { name: "color", title: "Color" },
    { name: "background", title: "Background" },
    { name: "asset", title: "Asset" },
    { name: "image", title: "Image" },
    { name: "settings", title: "Settings" },
  ],
  preview: {
    select: {
      prSubtitle: "eyebrow",
      prMedia: "fileReference",
    },
    prepare({ prSubtitle, prMedia }) {
      return {
        title: "Promo Card",
        subtitle:
          typeof prSubtitle === "string" && prSubtitle.trim()
            ? prSubtitle.trim()
            : undefined,
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "enableEyebrowGraphic",
      title: "Enable eyebrow graphic",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "content",
    }),
    defineField({
      name: "eyebrow",
      title: "Eyebrow",
      description:
        "Use basic html tags like <sup> <sub> , <b> , <i> , <nobr> .",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "title",
      title: "Title",
      description:
        "When using default content source, the title is a minimal requirement for the card to show.",
      type: "array",
      group: "content",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "size",
      title: "Size",
      description: "Set style of text to render as.",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "Display 1", value: "display-1" },
          { title: "Display 2", value: "display-2" },
          { title: "Title 1", value: "title-1" },
          { title: "Title 2", value: "title-2" },
          { title: "Subhead 1", value: "subhead-1" },
          { title: "Subhead 2", value: "subhead-2" },
        ],
      },
    }),
    defineField({
      name: "htmlElement",
      title: "HTML element",
      description:
        "No styles are associated with an html element. The element option is purely used for semantic and accessibility purposes.",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "Default", value: "h2" },
          { title: "H3", value: "h3" },
          { title: "H4", value: "h4" },
          { title: "H5", value: "h5" },
          { title: "H6", value: "h6" },
        ],
      },
    }),
    defineField({
      name: "copy",
      title: "Copy",
      description: "Hit enter for empty line break.",
      type: "array",
      group: "content",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "enablePrimaryButton",
      description:
        "When enabled, a button component element will be added to the card to edit.",
      type: "boolean",
      group: "content",
      initialValue: true,
    }),
    defineField({
      name: "enableSecondaryButton",
      description:
        "When enabled, a button component element will be added to the card to edit. If Button 2 is selected alone, it renders in the space of Button 1.",
      type: "boolean",
      group: "content",
      initialValue: true,
    }),
    defineField({
      name: "enableAppStoreButtons",
      description:
        "When enabled, an app store buttons component element will be added to card to edit.",
      type: "boolean",
      group: "content",
      initialValue: true,
    }),
    defineField({
      name: "excerpt",
      title: "Excerpt",
      description:
        "Short description or excerpt before seeing full terms in modal. Hit enter for empty line break. Switch to source control to modify markup.",
      type: "array",
      group: "legal",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "modalContent",
      title: "Modal content",
      description:
        "To display the content for See full term Label in Modal\nContent inside of modal. The title from card is automatically added to the modal. If no content is enterd, 'See full terms' label will not render either. Hit enter for empty line break. Switch to source control to modify markup.",
      type: "array",
      group: "legal",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "seeFullTermsLabel",
      title: "See full terms label",
      description:
        "The value used for seeing full terms. Suggested default text: 'See full terms'.",
      type: "string",
      group: "legal",
    }),
    defineField({
      name: "reduceExtraPadding",
      title: "Reduce extra padding/margin?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "addShadow",
      title: "Add shadow to card?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "containerAlignment",
      title: "Container alignment",
      description:
        "Should the container stay default (center), left, or right aligned?",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Center (default)", value: "center" },
          { title: "Left", value: "left" },
          { title: "Right", value: "right" },
        ],
      },
    }),
    defineField({
      name: "pushContent",
      title: "Push content:",
      description:
        "Push content to bottom creating white space between elements. An example would be pushing legal to the bottom. This only works when vertical alignment is set to 'stretch' and the card is taller than the content height.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "None", value: "none" },
          { title: "Title", value: "title" },
          { title: "Copy", value: "copy" },
          { title: "Image", value: "image" },
          { title: "App Buttons", value: "AppButtons" },
          { title: "CTA", value: "cta" },
          { title: "Legal", value: "legal" },
        ],
      },
    }),
    defineField({
      name: "inherit",
      title: "inherit",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "left",
      title: "left",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "center",
      title: "center",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "right",
      title: "right",
      description:
        'TODO: no Sanity mapping for AEM resource type "unknown". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "textAlignmentDesktop",
      title: "Text alignment (tablet & desktop):",
      description:
        "Align text to a specific side of card. Sometimes just aligning content is not enough. For more control, use text alignment to force text to align to a side.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Inherit", value: "tdds:ta-inherit" },
          { title: "Left", value: "tdds:ta-left" },
          { title: "Center", value: "tdds:ta-center" },
          { title: "Right", value: "tdds:ta-right" },
        ],
      },
    }),
    defineField({
      name: "horizontalAlignment",
      title: "Horizontal alignment",
      description:
        "Align content inside of card horizontally for mobile devices.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Left", value: "flex-start" },
          { title: "Right", value: "flex-end" },
          { title: "Center", value: "center" },
        ],
      },
    }),
    defineField({
      name: "horizontalAlignmentDesktop",
      title: "Horizontal alignment (tablet & desktop):",
      description:
        "Align content inside of card horizontally for tablet and desktop devices.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Left", value: "flex-start" },
          { title: "Right", value: "flex-end" },
          { title: "Center", value: "center" },
        ],
      },
    }),
    defineField({
      name: "verticalAlignment",
      title: "Vertical alignment",
      description:
        "Align content inside of card across the horizontal axis. For best results, card height needs to be taller than content height.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Stretch", value: "stretch" },
          { title: "Top", value: "flex-start" },
          { title: "Center", value: "center" },
          { title: "Bottom", value: "flex-end" },
        ],
      },
    }),
    defineField({
      name: "verticalAlignmentDesktop",
      title: "Vertical alignment (tablet & desktop):",
      description:
        "Align content inside of card across the horizontal axis. For best results, card height needs to be taller than content height.",
      type: "string",
      group: "display",
      options: {
        list: [
          { title: "Stretch", value: "stretch" },
          { title: "Top", value: "flex-start" },
          { title: "Center", value: "center" },
          { title: "Bottom", value: "flex-end" },
        ],
      },
    }),
    defineField({
      name: "accordionHeight",
      title: "accordionHeight",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/accordion". Falling back to string.',
      type: "string",
      group: "display",
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
      name: "colorTextSource",
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
      name: "colorText",
      title: "Color:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "color",
    }),
    defineField({
      name: "colorTextPalette",
      title: "Palette color:",
      description:
        "Select from pre-approved brand and grayscale color palettes. Keep on 'default' to inherit colors from parent component.",
      type: "string",
      group: "color",
    }),
    defineField({
      name: "colorTextCustom",
      title: "Hex value:",
      description: "Select a custom color to use for typography.",
      type: "string",
      group: "color",
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
      name: "enableForegroundImage",
      title: "Enable foreground image",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "image",
    }),
    defineField({
      name: "imageMaxHeight",
      title: "Image max-height:",
      description:
        "The max-height the image is allowed to grow up to. Leave empty to let image scale to its natural height if space in card allows.",
      type: "number",
      group: "image",
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: "imageMaxHeightUnit",
      title: "Unit:",
      description: "Unit to be used for your height value.",
      type: "string",
      group: "image",
      options: {
        list: [
          { title: "Pixels(px)", value: "px" },
          { title: "Percent(%)", value: "%" },
        ],
      },
    }),
    defineField({
      name: "cardStyle",
      title: "Card style",
      description:
        "Choosing 'default' keeps the image within the content. Choosing 'flood' will move the image above the content and stretch edge to edge.",
      type: "string",
      group: "settings",
      options: {
        list: [
          { title: "Default", value: "default" },
          { title: "Flood", value: "flood" },
        ],
      },
    }),
    defineField({
      name: "isSplit",
      description:
        "Is split? When checked, the card content and image will be side by side in a 50/50 layout only on tablet and desktop devices. Anything larger than 768px. On mobile it will be stacked.",
      type: "boolean",
      group: "settings",
      initialValue: true,
    }),
    defineField({
      name: "isFlipped",
      title: "Is flipped?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "hasRoundedCorners",
      title: "Has rounded corners?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "imageAlignment",
      title: "Image alignment:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "imageAspectRatio",
      title: "Image aspect ratio:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "settings",
    }),
    defineField({
      name: "warning",
      title: "warning",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/text". Falling back to string.',
      type: "string",
      group: "settings",
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
      name: "eyebrowImageDisplay",
      title: "eyebrowImageDisplay",
      type: "proxyContentImage",
    }),
    defineField({ name: "image", title: "image", type: "proxyContentImage" }),
  ],
});
