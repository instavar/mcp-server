import { mediaRequirements, preflightScript } from "./media-preflight";
import type { PairedTimeline, PairedVideoSpec } from "./videospec-contract";

/**
 * The Remotion realisation is the public remotion-templates renderer itself,
 * pinned to the commit the paired HyperFrames port was verified against.
 */
export const REMOTION_TEMPLATES = {
  repository: "https://github.com/instavar/remotion-templates",
  commit: "a9092254937d28a05a277a9b6ecfd4ebea864245",
  remotion: "4.0.502",
} as const;

export function remotionVideoSpecFiles(
  spec: PairedVideoSpec,
  timeline: PairedTimeline
): Record<string, string> {
  return {
    "video.json": JSON.stringify(spec, null, 2) + "\n",
    "preflight.mjs": preflightScript(
      mediaRequirements(spec, timeline),
      timeline.fps
    ),
  };
}

export function remotionVideoSpecCommands(spec: PairedVideoSpec): string[] {
  return [
    `git clone ${REMOTION_TEMPLATES.repository}.git`,
    "cd remotion-templates",
    `git checkout ${REMOTION_TEMPLATES.commit}`,
    "npm ci",
    "# Save video.json and preflight.mjs here and place each referenced media file at its public/ path.",
    "node preflight.mjs",
    "npm run video:validate -- video.json",
    "npm run video:preview -- video.json",
    `npm run video:render -- video.json out/${spec.id}.mp4`,
  ];
}
