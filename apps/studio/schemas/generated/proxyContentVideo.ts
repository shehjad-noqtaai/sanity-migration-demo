import { defineField, defineType } from "sanity";

/**
 * Generated from AEM component: /apps/uxp/components/proxy/content/video
 * DO NOT EDIT BY HAND — regenerate via `pnpm migrate:schema`.
 */
export const proxyContentVideo = defineType({
  name: "proxyContentVideo",
  title: "Video",
  type: "object",
  groups: [
    { name: "content", title: "Content" },
    { name: "display", title: "Display" },
    { name: "transcript", title: "Transcript" },
    { name: "background", title: "Background" },
  ],
  preview: {
    select: {
      prMedia: "videoAsset",
    },
    prepare({ prMedia }) {
      return {
        title: "Video",
        media: prMedia,
      };
    },
  },
  fields: [
    defineField({
      name: "videoSource",
      title: "Video source",
      description:
        "Build out card using pre-defined fields or rely on parsys. If this field is disabled, then your card style only supports a specific source tyoe.",
      type: "string",
      group: "content",
      options: {
        list: [
          { title: "YouTube", value: "youtube" },
          { title: "Vimeo", value: "vimeo" },
          { title: "Asset", value: "asset" },
          { title: "Clips", value: "clips" },
        ],
      },
    }),
    defineField({
      name: "titleDisplayed",
      title: "Visually display title?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "content",
    }),
    defineField({
      name: "title",
      title: "Video title:",
      description:
        "The title to be associated with the video. Not applicable for video source Clips.",
      type: "string",
      group: "content",
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: "youTubeId",
      title: "YouTube ID:",
      description: "The ID associated with the YouTube video to play.",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "youtubeTimeStamp",
      title: "TimeStamp",
      description:
        "Provide no of seconds from which the YouTube video to start play.",
      type: "number",
      group: "content",
      validation: (Rule) => Rule.min(0),
    }),
    defineField({
      name: "youtubeDisableSuggestedVideo",
      title: "Disable Suggested Video",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "content",
    }),
    defineField({
      name: "vimeoId",
      title: "Vimeo ID:",
      description: "The ID associated with the Vimeo video to play.",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "videoAsset",
      title: "Video asset:",
      description: "Select a video from the asset library to play. From DAM",
      type: "image",
      group: "content",
    }),
    defineField({
      name: "clipsId",
      title: "Clips URL Parameter",
      description:
        "Enter the Clips URL parameter, example, clip=XiCwi17LzUh2 or playlist=XiCwi17LzUh2",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "clipsCaption",
      title: "Clips Caption",
      description: "Enter Clips Caption",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "ariaLabelForPlayButton",
      title: "Aria Label For Play Button",
      description: "Not applicable for Clips",
      type: "string",
      group: "content",
    }),
    defineField({
      name: "showVideoTriggerOnly",
      title: "Video Trigger Only?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "display",
    }),
    defineField({
      name: "fieldShowHideSwitch",
      title: "Enable transcript?",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/switch". Falling back to string.',
      type: "string",
      group: "transcript",
    }),
    defineField({
      name: "transcriptLabel",
      title: "Transcript Label:",
      description:
        "This is a field for specifying the label which shows up for Transcript.",
      type: "string",
      group: "transcript",
    }),
    defineField({
      name: "transcriptText",
      title: "Transcript",
      type: "array",
      group: "transcript",
      of: [{ type: "block" }],
    }),
    defineField({
      name: "settingsLabel",
      title: "Settings",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "background",
    }),
    defineField({
      name: "disableImageOnViewport",
      title: "Disable background image on viewport:",
      description:
        'TODO: no Sanity mapping for AEM resource type "granite/ui/components/coral/foundation/form/buttongroup". Falling back to string.',
      type: "string",
      group: "background",
    }),
  ],
});
