interface HttpResultLike {
  ok: boolean;
  status: number;
  body: unknown;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function rows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.map(record).filter((row): row is Record<string, unknown> => !!row)
    : [];
}

function string(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function currentVideoArtifact(status: Record<string, unknown> | null) {
  return (
    rows(status?.artifacts).find(
      (artifact) =>
        artifact.artifactType === "video" && artifact.isCurrent === true
    ) ?? null
  );
}

function verificationMatches(
  verifications: Record<string, unknown>[],
  pattern: RegExp
) {
  return verifications.filter((verification) =>
    pattern.test(
      [
        verification.phase,
        verification.checkKey,
        verification.verifier,
        JSON.stringify(verification.detailsJson ?? null),
      ]
        .map((value) => String(value ?? ""))
        .join(" ")
    )
  );
}

/**
 * Build one bounded, read-only troubleshooting snapshot from the existing job
 * status and video-state APIs. It reports missing evidence explicitly and does
 * not pretend that metadata checks amount to visual inspection.
 */
export function buildRenderDiagnosticSnapshot(params: {
  jobStatus: HttpResultLike;
  videoState: HttpResultLike;
}) {
  const failed = [params.jobStatus, params.videoState].find(
    (result) => !result.ok
  );
  if (failed) return failed;

  const status = record(params.jobStatus.body);
  const stateResponse = record(params.videoState.body);
  const state = record(stateResponse?.state);
  const runs = rows(status?.runs);
  const latestRunId = string(status?.latestRunId);
  const latestRun =
    runs.find((run) => string(run.id) === latestRunId) ?? runs[0] ?? null;
  const videoArtifact = currentVideoArtifact(status);
  const artifactMetadata = record(videoArtifact?.metadataJson);
  const verifications = rows(status?.verificationTimeline);
  const blankChecks = verificationMatches(verifications, /blank|black frame/i);
  const placeholderChecks = verificationMatches(
    verifications,
    /placeholder|source clip|source asset/i
  );
  const rightsChecks = verificationMatches(
    verifications,
    /rights|licen[cs]|clearance/i
  );

  const currentVideoArtifactId = string(videoArtifact?.id);
  const stateVideoArtifactId = string(state?.currentVideoArtifactId);
  const expectedDurationSeconds =
    number(state?.durationSeconds) ?? number(status?.durationSec);
  const actualDurationSeconds =
    number(videoArtifact?.durationSeconds) ??
    number(artifactMetadata?.durationSeconds) ??
    number(artifactMetadata?.durationSec) ??
    number(artifactMetadata?.duration);

  return {
    ok: true,
    status: 200,
    body: {
      job: {
        id: string(status?.id),
        title: string(status?.title),
        status: string(status?.status),
        latestRunId,
      },
      latestRun: latestRun
        ? {
            id: string(latestRun.id),
            runType: string(latestRun.runType),
            status: string(latestRun.status),
            errorCode: string(latestRun.errorCode),
            errorMessage: string(latestRun.errorMessage),
          }
        : null,
      artifactBinding: {
        jobCurrentVideoArtifactId: currentVideoArtifactId,
        videoStateCurrentArtifactId: stateVideoArtifactId,
        matches:
          currentVideoArtifactId && stateVideoArtifactId
            ? currentVideoArtifactId === stateVideoArtifactId
            : null,
        currentVideoUrl:
          string(status?.currentVideoUrl) ?? string(state?.currentVideoUrl),
      },
      duration: {
        expectedSeconds: expectedDurationSeconds,
        actualSeconds: actualDurationSeconds,
        deltaSeconds:
          expectedDurationSeconds !== null && actualDurationSeconds !== null
            ? Math.round(
                (actualDurationSeconds - expectedDurationSeconds) * 1000
              ) / 1000
            : null,
      },
      retryRecommendations: Array.isArray(status?.retryRecommendations)
        ? status?.retryRecommendations
        : [],
      evidence: {
        rights: rightsChecks,
        blankFrames: blankChecks,
        placeholders: placeholderChecks,
        videoState: state,
      },
      evidenceLimits: {
        visualContentInspection:
          blankChecks.length || placeholderChecks.length
            ? "verification_rows_available"
            : "not_evaluated",
        note: "No blank or placeholder verdict is inferred when the current verification timeline contains no matching check. Inspect the video artifact visually before deciding on an edit.",
      },
    },
  } satisfies HttpResultLike;
}
