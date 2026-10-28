import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { describe, expect, it } from "vitest";

import {
  PAIRED_ANNOUNCEMENT_INSTRUCTIONS,
  pairedAnnouncementInstructions,
} from "../paired-announcement";
import { PAIRED_FAMILIES } from "../paired-templates/catalogue";
import { hyperframesVideoSpecFiles } from "../paired-templates/hyperframes-videospec";
import {
  pairedTemplatesEnabled,
  prepareVideoTemplate,
} from "../paired-templates/prepare-video-template";
import { REMOTION_TEMPLATES } from "../paired-templates/remotion-videospec";
import { springSamples } from "../paired-templates/spring";
import { SPRING_TABLES } from "../paired-templates/spring-tables";
import {
  pairedTimeline,
  validatePairedVideoSpec,
  type PairedVideoSpec,
} from "../paired-templates/videospec-contract";
import {
  registerPublicTemplateTools,
  scaffoldVideoSpec,
} from "../public-templates";

const families = [
  "qa-ad",
  "proof-walkthrough",
  "announcement-brief",
  "social-remix",
  "finance-brief",
] as const;

function spec(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "1.0",
    id: "paired-check",
    templateFamily: "announcement-brief",
    meta: { title: "Paired check" },
    target: { aspect: "9:16", fps: 30, durationMode: "auto" },
    style: { theme: "default" },
    audio: { mode: "silent" },
    scenes: [
      {
        id: "hero",
        kind: "hero",
        content: { title: "A <clear> headline", subtitle: "One promise" },
        timing: { durationMs: 1500 },
      },
      {
        id: "points",
        kind: "points",
        content: { title: "What changes", points: ["First", "Second"] },
        timing: { durationMs: 1800 },
      },
      {
        id: "cta",
        kind: "cta",
        content: { line1: "Try it today" },
        timing: { durationMs: 1500 },
      },
    ],
    ...overrides,
  };
}

function issueCodes(raw: unknown): string[] {
  const result = validatePairedVideoSpec(raw);
  return result.ok ? [] : result.issues.map((issue) => issue.code);
}

function ready(raw: unknown) {
  const output = prepareVideoTemplate(raw);
  expect(output.isError).toBe(false);
  expect(output.result.status).toBe("ready");
  return output.result as {
    project: { framework: string; spec: PairedVideoSpec; contract: string };
    files: Record<string, string>;
    commands: string[];
    reason: string;
    timeline: { durationInFrames: number };
  };
}

describe("paired VideoSpec contract", () => {
  it("accepts every published family scaffold once safe-area metadata is baseline", () => {
    for (const templateId of families) {
      const scaffold = scaffoldVideoSpec({
        templateId,
        title: "A paired template",
        aspect: "4:5",
      }) as { style: Record<string, unknown> };
      expect(issueCodes(scaffold)).toContain("unsupported-safe-area");
      scaffold.style.safeAreaProfile = "baseline";
      expect(issueCodes(scaffold)).toEqual([]);
      // With the gate on the scaffold already passes unchanged.
      expect(
        issueCodes(
          scaffoldVideoSpec(
            { templateId, title: "A paired template", aspect: "4:5" },
            { pairedTemplates: true }
          )
        )
      ).toEqual([]);
    }
  });

  it("rejects fields neither renderer honours instead of dropping them", () => {
    const cases: Array<[Record<string, unknown>, string]> = [
      [{ target: { aspect: "9:16", fps: 300 } }, "unsupported-fps"],
      [{ style: { variant: "bold" } }, "unsupported-style-variant"],
      [{ assets: { logoSrc: "public/logo.png" } }, "unsupported-asset"],
      [{ extra: true }, "unsupported-field"],
      [
        { target: { aspect: "9:16", fixedDurationSec: 9 } },
        "fixed-duration-unused",
      ],
      [
        { target: { aspect: "9:16", durationMode: "fixed" } },
        "fixed-duration-missing",
      ],
      [
        {
          target: {
            aspect: "9:16",
            durationMode: "fixed",
            fixedDurationSec: 2,
          },
        },
        "fixed-duration-truncates",
      ],
      [
        { audio: { mode: "silent", musicSrc: "public/music.wav" } },
        "audio-mode-conflict",
      ],
      [{ audio: { mode: "narration" } }, "narration-source-missing"],
      [
        { audio: { mode: "auto", narrationText: "Hello" } },
        "narration-text-not-rendered",
      ],
    ];
    for (const [override, code] of cases)
      expect(issueCodes(spec(override))).toContain(code);
  });

  it("rejects unsupported scene content with a path", () => {
    const scenes = (scene: Record<string, unknown>) =>
      spec({
        scenes: [
          { id: "one", ...scene },
          { id: "two", kind: "cta", content: { title: "Next" } },
        ],
      });
    // The public renderer draws custom as a statement card, so both do.
    const result = validatePairedVideoSpec(
      scenes({ kind: "custom", content: { title: "Anything" } })
    );
    expect(result.ok).toBe(true);
    if (result.ok)
      expect(result.qualityNotes).toContainEqual(
        expect.objectContaining({ code: "custom-renders-as-statement" })
      );
    expect(
      issueCodes(scenes({ kind: "custom", content: { component: "Spin" } }))
    ).toContain("unsupported-field");
    expect(
      issueCodes(scenes({ kind: "hero", content: { title: "A", line1: "B" } }))
    ).toContain("ambiguous-copy-field");
    expect(
      issueCodes(
        scenes({ kind: "hero", content: { title: "A", animation: "spin" } })
      )
    ).toContain("unsupported-field");
    expect(
      issueCodes(scenes({ kind: "mechanism", content: { title: "How" } }))
    ).toContain("invalid-videospec");
    expect(
      issueCodes(
        scenes({
          kind: "video-window",
          content: { title: "Clip", src: "https://example.com/a.mp4" },
        })
      )
    ).toContain("invalid-videospec");
    expect(
      issueCodes(
        scenes({
          kind: "video-window",
          content: { title: "Clip", src: "public/../secret.mp4" },
        })
      )
    ).toContain("invalid-videospec");
    expect(
      issueCodes(
        scenes({ kind: "statement", content: { title: "A", label: "Hero" } })
      )
    ).toContain("implementation-label");
    expect(
      issueCodes(
        spec({
          scenes: [
            { id: "same", kind: "cta", content: { title: "A" } },
            { id: "same", kind: "cta", content: { title: "B" } },
          ],
        })
      )
    ).toContain("duplicate-scene-id");
  });

  it("checks narration timing as strictly as the public schema", () => {
    const timing = (segments: unknown[], durationMs: number) => ({
      audio: {
        mode: "auto",
        narrationTiming: {
          schemaVersion: "1.0",
          source: "segmented-synthesis",
          durationMs,
          segments,
        },
      },
    });
    const segment = (sceneId: string, startMs: number, endMs: number) => ({
      sceneId,
      startMs,
      endMs,
      durationMs: endMs - startMs,
    });
    expect(
      issueCodes(
        spec(
          timing(
            [
              segment("hero", 0, 1000),
              segment("points", 1000, 2500),
              segment("cta", 2500, 3000),
            ],
            3000
          )
        )
      )
    ).toEqual([]);
    expect(
      issueCodes(
        spec(
          timing(
            [
              segment("hero", 0, 1000),
              segment("points", 1200, 2500),
              segment("cta", 2500, 3000),
            ],
            3000
          )
        )
      )
    ).toContain("invalid-videospec");
    expect(
      issueCodes(
        spec(
          timing([segment("hero", 0, 1000), segment("cta", 1000, 3000)], 3000)
        )
      )
    ).toContain("narration-timing-scene-mismatch");
  });

  it("mirrors the public renderer's frame rounding", () => {
    const result = validatePairedVideoSpec(
      spec({
        scenes: ["a", "b", "c"].map((id) => ({
          id,
          kind: "cta",
          content: { title: id },
          timing: { durationMs: 1010 },
        })),
      })
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Each scene rounds to 30 frames, but the total rounds 3.03 s to 91.
    expect(result.timeline.durationInFrames).toBe(91);
    expect(result.timeline.scenes.map((scene) => scene.startFrame)).toEqual([
      0, 30, 60,
    ]);
    const fixed = pairedTimeline({
      ...result.spec,
      target: {
        ...result.spec.target,
        durationMode: "fixed",
        fixedDurationSec: 4,
      },
    });
    expect(fixed.durationInFrames).toBe(120);
  });
});

describe("prepare_video_template", () => {
  it("asks for a framework instead of inferring one", () => {
    expect(prepareVideoTemplate({ spec: spec() }).result.status).toBe(
      "needs-selection"
    );
    const result = ready({ spec: spec(), framework: "no-preference" });
    expect(result.project.framework).toBe("remotion");
    expect(result.reason).toBe("visible-default");
  });

  it("validates identically before either realisation", () => {
    for (const framework of ["remotion", "hyperframes"]) {
      const output = prepareVideoTemplate({
        spec: spec({ style: { variant: "bold" } }),
        framework,
      });
      expect(output.isError).toBe(true);
      expect(output.result.status).toBe("rejected");
      expect(output.result).not.toHaveProperty("files");
    }
  });

  it("switches frameworks without changing the content document", () => {
    const remotion = ready({ spec: spec(), framework: "remotion" });
    expect(remotion.commands).toContain(
      `git checkout ${REMOTION_TEMPLATES.commit}`
    );
    expect(Object.keys(remotion.files).sort()).toEqual([
      "preflight.mjs",
      "video.json",
    ]);
    const hyperframes = ready({
      project: remotion.project,
      framework: "hyperframes",
    });
    expect(hyperframes.project.spec).toEqual(remotion.project.spec);
    expect(hyperframes.files["video.json"]).toBe(remotion.files["video.json"]);
    const continued = ready({ project: hyperframes.project });
    expect(continued.reason).toBe("existing-project");
    expect(continued.project.framework).toBe("hyperframes");
    expect(() =>
      prepareVideoTemplate({ spec: spec(), project: remotion.project })
    ).toThrow(/not both/);
  });

  it("generates escaped, timed HyperFrames scenes with the pinned spring", () => {
    const result = ready({
      spec: spec({ target: { aspect: "1:1", fps: 24 } }),
      framework: "hyperframes",
    });
    const files = result.files;
    expect(
      Object.keys(files).filter((name) => name.startsWith("compositions/"))
    ).toHaveLength(3);
    expect(files["compositions/scene-1.html"]).toContain(
      "A &lt;clear&gt; headline"
    );
    expect(files["compositions/scene-1.html"]).not.toContain("<clear>");
    expect(files["compositions/scene-1.html"]).toContain(
      JSON.stringify(SPRING_TABLES[24])
    );
    // 1.5 s at 24 fps is 36 frames; the second scene starts there.
    expect(files["index.html"]).toContain(
      'data-composition-src="compositions/scene-2.html" data-start="1.5"'
    );
    expect(files["index.html"]).toContain('data-height="1080"');
    expect(JSON.parse(files["package.json"]).scripts.render).toBe(
      "hyperframes render --fps 24 --video-frame-format png --output video.mp4"
    );
    expect(files["setup.mjs"]).toContain("sha256");
  });

  it("ships one media preflight that refuses untagged video and mono audio", () => {
    const withMedia = spec({
      templateFamily: "qa-ad",
      scenes: [
        {
          id: "clip",
          kind: "video-window",
          content: { title: "In context", src: "public/clip.mp4" },
          timing: { durationMs: 2000 },
        },
      ],
    });
    const remotion = ready({ spec: withMedia, framework: "remotion" });
    const hyperframes = ready({ spec: withMedia, framework: "hyperframes" });
    expect(remotion.files["preflight.mjs"]).toBe(
      hyperframes.files["preflight.mjs"]
    );
    expect(remotion.files["preflight.mjs"]).toContain(
      "must be tagged BT.709 SDR"
    );
    expect(remotion.files["preflight.mjs"]).toContain("must be stereo");
    expect(remotion.files["preflight.mjs"]).toContain('"minSeconds": 2');
  });

  it("never styles a whole scene through a content class named after its kind", () => {
    const result = ready({
      spec: spec({
        templateFamily: "proof-walkthrough",
        scenes: [
          {
            id: "working",
            kind: "equation",
            content: { title: "Work it", latexBlocks: ["a + b"] },
          },
        ],
      }),
      framework: "hyperframes",
    });
    const css = result.files["compositions/scene-1.html"].match(
      /<style>([\s\S]*?)<\/style>/
    )![1];
    for (const kind of [
      "hero",
      "statement",
      "mechanism",
      "points",
      "equation",
      "video-window",
      "cta",
    ])
      for (const match of css.matchAll(
        new RegExp(`(\\S{0,7})\\.${kind}(?![\\w-])`, "g")
      ))
        expect(match[1], `.${kind}`).toMatch(/\.layout$/);
  });

  it("ducks music by the public renderer's fixed factor", () => {
    const validated = validatePairedVideoSpec(
      spec({
        audio: {
          mode: "narration",
          narrationSrc: "public/narration.wav",
          musicSrc: "public/music.wav",
          musicVolume: 0.5,
          narrationVolume: 0.8,
        },
      })
    );
    expect(validated.ok).toBe(true);
    if (!validated.ok) return;
    const html = hyperframesVideoSpecFiles(validated.spec, validated.timeline)[
      "index.html"
    ];
    expect(html).toContain('id="music" src="public/music.wav"');
    expect(html).toContain('data-volume="0.16"');
    expect(html).toContain('data-volume="0.8"');
  });
});

describe("exposure gate", () => {
  const names = (paired: boolean) => {
    const registered: Array<{ name: string; description?: string }> = [];
    registerPublicTemplateTools(
      {
        registerResource: () => {},
        registerTool: (name: string, config: { description?: string }) => {
          registered.push({ name, description: config.description });
        },
      } as unknown as McpServer,
      { pairedTemplates: paired }
    );
    return registered;
  };

  it("is on unless the environment turns it off exactly", () => {
    expect(pairedTemplatesEnabled({})).toBe(true);
    expect(pairedTemplatesEnabled({ INSTAVAR_PAIRED_TEMPLATES: "1" })).toBe(
      true
    );
    expect(pairedTemplatesEnabled({ INSTAVAR_PAIRED_TEMPLATES: "false" })).toBe(
      true
    );
    expect(pairedTemplatesEnabled({ INSTAVAR_PAIRED_TEMPLATES: "0" })).toBe(
      false
    );
  });

  it("leaves the published tool list and descriptions unchanged when off", () => {
    const off = names(false);
    expect(off.map((tool) => tool.name)).not.toContain(
      "prepare_video_template"
    );
    expect(
      off.find((tool) => tool.name === "prepare_announcement")?.description
    ).toContain(PAIRED_ANNOUNCEMENT_INSTRUCTIONS);
    const on = names(true);
    expect(on.map((tool) => tool.name)).toContain("prepare_video_template");
    expect(
      on.find((tool) => tool.name === "prepare_announcement")?.description
    ).not.toContain("Remotion-only");
    expect(pairedAnnouncementInstructions(true)).toContain(
      "prepare_video_template"
    );
  });

  it("lists every paired family in both frameworks", () => {
    expect(PAIRED_FAMILIES.map((family) => family.id).sort()).toEqual(
      [...families].sort()
    );
    for (const family of PAIRED_FAMILIES)
      expect(family.frameworks).toEqual(["remotion", "hyperframes"]);
  });
});

describe("ported Remotion spring", () => {
  it("matches the samples taken from remotion 4.0.502", () => {
    for (const fps of [24, 30, 60] as const)
      expect(springSamples(fps)).toEqual(SPRING_TABLES[fps]);
  });

  it("covers other whole frame rates in both frameworks", () => {
    for (const fps of [1, 25, 50, 240]) {
      const samples = springSamples(fps);
      expect(samples).toHaveLength(Math.round(fps * 0.7) + 2);
      expect(samples[0]).toBe(0);
      expect(samples.at(-1)).toBe(1);
    }
  });
});
