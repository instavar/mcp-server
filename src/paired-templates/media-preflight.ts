import type { PairedTimeline, PairedVideoSpec } from "./videospec-contract";

export type MediaRequirement = {
  path: string;
  role: string;
  kind: "video" | "audio";
  /** The source must last at least this long, in seconds. */
  minSeconds?: number;
};

/**
 * Local media the spec references and the bounds both renderers need to
 * behave alike: video covers its scene, audio is stereo, and music covers the
 * whole video because HyperFrames has no loop primitive.
 */
export function mediaRequirements(
  spec: PairedVideoSpec,
  timeline: PairedTimeline
): MediaRequirement[] {
  const requirements: MediaRequirement[] = [];
  for (const scene of timeline.scenes) {
    const source = spec.scenes[scene.index];
    if (source.kind !== "video-window") continue;
    requirements.push({
      path: String(source.content.src),
      role: `scene ${scene.index + 1} video`,
      kind: "video",
      minSeconds: scene.visibleFrames / timeline.fps,
    });
  }
  if (spec.audio.narrationSrc)
    requirements.push({
      path: spec.audio.narrationSrc,
      role: "narration",
      kind: "audio",
    });
  if (spec.audio.musicSrc)
    requirements.push({
      path: spec.audio.musicSrc,
      role: "music",
      kind: "audio",
      minSeconds: timeline.durationInFrames / timeline.fps,
    });
  return requirements;
}

/** The same preflight ships with both framework realisations. */
export function preflightScript(
  requirements: MediaRequirement[],
  fps: number
): string {
  return `// Paired template media preflight. Run before rendering in either framework.
import { access } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const requirements = ${JSON.stringify(requirements, null, 2)};
const tolerance = ${0.5 / fps};
function probe(file) {
  try {
    return JSON.parse(
      execFileSync("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", file], { encoding: "utf8" })
    );
  } catch {
    throw new Error("ffprobe could not read " + file + ". Install FFmpeg and check the file.");
  }
}
for (const item of requirements) {
  try {
    await access(item.path);
  } catch {
    throw new Error("Missing " + item.role + " file " + item.path + ". Copy it to that path first.");
  }
  const info = probe(item.path);
  const duration = Number(info.format?.duration ?? 0);
  const stream = info.streams.find((entry) => entry.codec_type === item.kind);
  if (!stream) throw new Error(item.role + " file " + item.path + " has no " + item.kind + " stream.");
  if (item.kind === "audio" && stream.channels !== 2)
    throw new Error(item.role + " file " + item.path + " must be stereo. Convert it first, for example: ffmpeg -i input -ac 2 output.wav");
  // Untagged video is read as BT.709 by Remotion and BT.601 by HyperFrames,
  // so saturated colours differ. Only tagged BT.709 SDR video renders alike.
  if (item.kind === "video" && [stream.color_space, stream.color_primaries, stream.color_transfer].some((tag) => tag !== "bt709"))
    throw new Error(item.role + " file " + item.path + " must be tagged BT.709 SDR (colour space " + stream.color_space + ", primaries " + stream.color_primaries + ", transfer " + stream.color_transfer + "). Convert it first, for example: ffmpeg -i input -vf scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709 -c:v libx264 -crf 16 output.mp4");
  if (item.minSeconds !== undefined && duration + tolerance < item.minSeconds)
    throw new Error(item.role + " file " + item.path + " lasts " + duration + " s but must cover " + item.minSeconds + " s.");
}
console.log("Media preflight passed for " + requirements.length + " file(s).");
`;
}
