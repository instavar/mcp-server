import {
  HYPERFRAMES_RUNTIME,
  hyperframesVideoSpecFiles,
} from "./hyperframes-videospec";
import {
  REMOTION_TEMPLATES,
  remotionVideoSpecCommands,
  remotionVideoSpecFiles,
} from "./remotion-videospec";
import {
  PAIRED_TEMPLATE_FAMILIES,
  PAIRED_VIDEOSPEC_CONTRACT,
  validatePairedVideoSpec,
  type PairedIssue,
  type PairedTimeline,
  type QualityNote,
} from "./videospec-contract";

export type Framework = "remotion" | "hyperframes";
export const FRAMEWORKS: readonly Framework[] = ["remotion", "hyperframes"];

export type Realisation = {
  files: Record<string, string>;
  commands: string[];
  runtime: Record<string, string>;
};
export type ValidatedDocument = {
  ok: true;
  document: Record<string, unknown> & { id: string };
  timeline: PairedTimeline;
  qualityNotes: QualityNote[];
  /** Every family must realise in both frameworks to be listed. */
  realise(framework: Framework): Realisation;
};

/**
 * One framework-independent content contract with a realiser per framework.
 * A new family, for example a motion graphics template, plugs in by adding a
 * contract here and naming it from PAIRED_FAMILIES. Validation must not
 * depend on the framework, so the same document is accepted or rejected
 * identically in both.
 */
export type PairedContract = {
  id: string;
  validate(
    raw: unknown
  ): ValidatedDocument | { ok: false; issues: PairedIssue[] };
};

const videoSpecContract: PairedContract = {
  id: PAIRED_VIDEOSPEC_CONTRACT,
  validate(raw) {
    const result = validatePairedVideoSpec(raw);
    if (!result.ok) return result;
    const { spec, timeline, qualityNotes } = result;
    return {
      ok: true,
      document: spec,
      timeline,
      qualityNotes,
      realise: (framework) =>
        framework === "remotion"
          ? {
              files: remotionVideoSpecFiles(spec, timeline),
              commands: remotionVideoSpecCommands(spec),
              runtime: { ...REMOTION_TEMPLATES },
            }
          : {
              files: hyperframesVideoSpecFiles(spec, timeline),
              commands: [
                "npm install",
                "npm run setup",
                "npm run check",
                "npm run preview",
                "npm run render",
              ],
              runtime: { ...HYPERFRAMES_RUNTIME },
            },
    };
  },
};

export type PairedFamily = {
  id: string;
  name: string;
  contract: string;
  frameworks: readonly Framework[];
};

const familyNames: Record<(typeof PAIRED_TEMPLATE_FAMILIES)[number], string> = {
  "qa-ad": "Question and answer ad",
  "proof-walkthrough": "Proof walkthrough",
  "announcement-brief": "Announcement brief",
  "social-remix": "Social remix",
  "finance-brief": "Data and finance brief",
};

export const PAIRED_CONTRACTS: Record<string, PairedContract> = {
  [videoSpecContract.id]: videoSpecContract,
};
export const PAIRED_FAMILIES: readonly PairedFamily[] =
  PAIRED_TEMPLATE_FAMILIES.map((id) => ({
    id,
    name: familyNames[id],
    contract: PAIRED_VIDEOSPEC_CONTRACT,
    frameworks: FRAMEWORKS,
  }));

export function contractForFamily(
  templateFamily: unknown
): PairedContract | undefined {
  const family = PAIRED_FAMILIES.find((item) => item.id === templateFamily);
  return family ? PAIRED_CONTRACTS[family.contract] : undefined;
}
