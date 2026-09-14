import { describe, expect, it } from "vitest";

import { buildRenderDiagnosticSnapshot } from "../render-diagnostics";

describe("render diagnostic snapshot", () => {
  it("joins failure, artifact, duration, rights, and retry evidence", () => {
    const result = buildRenderDiagnosticSnapshot({
      jobStatus: {
        ok: true,
        status: 200,
        body: {
          id: "job-1",
          title: "Launch video",
          status: "failed",
          latestRunId: "run-2",
          currentVideoUrl: "https://cdn.example/video.mp4",
          runs: [
            {
              id: "run-2",
              runType: "adaptation",
              status: "failed",
              errorCode: "rights_clearance_required",
              errorMessage: "Review the matched source phrase.",
            },
          ],
          artifacts: [
            {
              id: "video-2",
              artifactType: "video",
              isCurrent: true,
              metadataJson: { durationSeconds: 12.4 },
            },
          ],
          retryRecommendations: [{ retryTarget: "human_review" }],
          verificationTimeline: [
            {
              phase: "pre_render",
              checkKey: "rights_clearance",
              status: "fail",
              detailsJson: { matchedField: "directions" },
            },
          ],
        },
      },
      videoState: {
        ok: true,
        status: 200,
        body: {
          state: {
            currentVideoArtifactId: "video-2",
            durationSeconds: 12,
          },
        },
      },
    });

    expect(result.ok).toBe(true);
    expect(result.body).toMatchObject({
      latestRun: {
        errorCode: "rights_clearance_required",
      },
      artifactBinding: { matches: true },
      duration: {
        expectedSeconds: 12,
        actualSeconds: 12.4,
        deltaSeconds: 0.4,
      },
      retryRecommendations: [{ retryTarget: "human_review" }],
      evidence: {
        rights: [expect.objectContaining({ checkKey: "rights_clearance" })],
      },
    });
  });

  it("does not infer a visual pass when no matching checks exist", () => {
    const result = buildRenderDiagnosticSnapshot({
      jobStatus: {
        ok: true,
        status: 200,
        body: { id: "job-1", artifacts: [], verificationTimeline: [] },
      },
      videoState: { ok: true, status: 200, body: { state: {} } },
    });

    expect(result.body).toMatchObject({
      evidence: { blankFrames: [], placeholders: [] },
      evidenceLimits: { visualContentInspection: "not_evaluated" },
    });
  });

  it("preserves the first upstream API failure", () => {
    const failure = { ok: false, status: 423, body: { error: "restricted" } };
    expect(
      buildRenderDiagnosticSnapshot({
        jobStatus: failure,
        videoState: { ok: true, status: 200, body: {} },
      })
    ).toBe(failure);
  });
});
