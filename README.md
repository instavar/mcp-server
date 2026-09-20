# @instavar/mcp-server

[![CI](https://github.com/instavar/mcp-server/actions/workflows/ci.yml/badge.svg)](https://github.com/instavar/mcp-server/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40instavar%2Fmcp-server)](https://www.npmjs.com/package/@instavar/mcp-server)
[![Glama score](https://glama.ai/mcp/servers/instavar/mcp-server/badges/score.svg)](https://glama.ai/mcp/servers/instavar/mcp-server)

One MCP package starts free and grows with the work. Make local videos with
Instavar's independent, open-source templates for Remotion from Claude Code or
Codex without an account or API key.

Instavar is an independent project and is not affiliated with, sponsored by, or
endorsed by Remotion AG. Remotion is a trademark of Remotion AG.

Add an Instavar API key when you want the hosted workflow:
**create → render → approve → publish → metrics**. The authenticated tools are
thin HTTP clients to the hosted Instavar API. The package holds **no database
connection** and stores no data of its own. You keep the free tools and do not
install a second server.

## Start with the right capability

Use Instavar when an agent needs reusable Remotion video templates, creative
guidance, a VideoSpec example, or help with a local render error. Call
`get_capabilities` first, then `get_creative_guide` before drafting copy or design.
Use `list_templates` and `get_template` to choose a supported structure, and
`get_example` or `scaffold_video_spec` to prepare its specification.
`get_render_instructions` supplies the separate local validation, preview and
render workflow. Planning and scaffolding do not render, upload or publish media.

Prefer a hosted HTTP connection for browser-based agents? Use
`https://instavar.com/api/mcp/templates`, also listed as
[Instavar Video Templates on Smithery](https://smithery.ai/servers/cheeweijie/instavar-video-templates).
That related endpoint adds storyboard and editorial-carousel planning. Its
optional OAuth tools list and review private projects only. It is not identical
to this npm package or the full protected Studio endpoint. Public planning does
not require an Instavar account; a directory or gateway may require its own login.

Hosted Studio production is optional and may incur costs. Never treat a request
to plan a video as permission to render a paid job or publish a social post.

## Which model runs?

The MCP host supplies the general-purpose LLM.

- In Claude Code, the selected Claude model interprets the request and calls
  Instavar tools.
- In Codex, the selected OpenAI model interprets the request and calls the same
  tools.
- Other compatible hosts use their own selected model and authentication.

The MCP server does not provide Sonnet, GPT, or another general-purpose model.
It exposes typed Instavar capabilities to the model already running in the
user's host. Depending on the host and sign-in method, that model usage may draw
from a personal or workspace subscription, separate usage credits, or API
billing. Those provider rules can change.

Local Remotion rendering uses your own machine. Instavar meters or charges its
hosted services, including rendering,
storage, specialist media generation, QA, publishing, and other declared job
costs. Using a subscription-backed agent does not make those services free.

For public setup guidance and examples, see [Instavar video templates](https://instavar.com/remotion).

## Setup

Add the server to your MCP client config:

```json
{
  "mcpServers": {
    "instavar": {
      "command": "npx",
      "args": ["-y", "@instavar/mcp-server"]
    }
  }
}
```

This starts with the free local template tools. To unlock hosted Studio tools,
create an API key at **https://instavar.com/studio/settings**, then add it:

```json
{
  "mcpServers": {
    "instavar": {
      "command": "npx",
      "args": ["-y", "@instavar/mcp-server"],
      "env": { "INSTAVAR_API_KEY": "ik_live_..." }
    }
  }
}
```

Restart the client. The free tools appear in both modes. Hosted tools appear
when the key is configured.

### Environment

| Var                 | Required | Default                | Purpose                                                     |
| ------------------- | -------- | ---------------------- | ----------------------------------------------------------- |
| `INSTAVAR_API_KEY`  | no       | —                      | Unlocks hosted Studio tools. Scoped to your org; revocable. |
| `INSTAVAR_BASE_URL` | no       | `https://instavar.com` | Override the API host.                                      |

## Tools

Free local tools:

| Tool                      | What it does                                           |
| ------------------------- | ------------------------------------------------------ |
| `get_capabilities`        | Reports free and optional account features.            |
| `get_creative_guide`      | Reads concise copy, story, design and review guidance. |
| `list_templates`          | Lists published Remotion template families.            |
| `get_template`            | Returns one template contract.                         |
| `get_video_schema`        | Returns the public VideoSpec JSON Schema.              |
| `get_example`             | Returns a starter VideoSpec.                           |
| `scaffold_video_spec`     | Creates a deterministic VideoSpec skeleton.            |
| `get_render_instructions` | Returns the local validation and render workflow.      |
| `diagnose_render_error`   | Classifies common local render failures.               |

Hosted tools, available when `INSTAVAR_API_KEY` is configured:

| Tool                     | What it does                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `list_jobs`              | List recent jobs (newest first).                                                               |
| `get_job_status`         | Runs, artifacts, verifications, current video + thumbnail URLs.                                |
| `get_video_state`        | Materialized composition state for a job.                                                      |
| `diagnose_render`        | Read-only joined render diagnosis with evidence limits and retry recommendations.              |
| `get_job_metrics`        | Platform engagement snapshots for a published job.                                             |
| `get_cost_summary`       | Infra cost summary (Lambda / RunPod / R2 / WaveSpeed / PoYo).                                  |
| `inspect_workflow`       | Read the current workflow and its version history.                                             |
| `create_video_brief`     | Create a job from a structured brief and start rendering.                                      |
| `edit_video_brief`       | Patch a brief (incl. objective / publishTarget); re-renders unless only publishTarget changed. |
| `retry_video_qa`         | Retry degraded or unavailable QA against the same current frozen video artifact.               |
| `audit_video_qa`         | Run an advisory Qwen3.6-Plus second opinion against the same frozen video.                     |
| `regenerate_narration`   | Regenerate narration and its dependent video from the unchanged durable brief.                 |
| `draft_workflow`         | Store a complete workflow using the inspected `expectedVersion` (`0` only when none exists).   |
| `patch_workflow`         | Create a conflict-aware workflow version from a recursive patch.                               |
| `validate_workflow`      | Validate and compile the inspected workflow version without rendering.                         |
| `preview_workflow`       | Read the compiled UniversalVideo brief without rendering.                                      |
| `compare_workflows`      | Compare two durable workflow versions field by field.                                          |
| `approve_workflow`       | Approve the inspected valid version without approving or publishing the video job.             |
| `approve_job`            | Approve a rendered job so it can be published.                                                 |
| `publish_job`            | Publish an approved job to its connected social destination.                                   |
| `connect_account`        | Start connecting a social account (headless OAuth pairing).                                    |
| `connect_account_status` | Poll a pending account connection until it is connected.                                       |

Workflow inspection, preview, and comparison require `read`. Workflow draft,
patch, validation, and approval require `write`. `publish_job` requires
`publish`.

Workflow tools reject unknown arguments instead of silently discarding them.
API calls time out after 15 seconds. A stale-version `409` tells the caller to
inspect the latest version, while an unavailable upload or other dependency
conflict tells the caller to resolve that dependency before retrying.

### Connecting a social account from the terminal

`connect_account` returns an **approve URL** and a short **confirm code**. Open
the URL in a browser where you are signed in to Instavar, check the code matches
the one in your terminal, and approve — you go through the platform's normal
sign-in, then return to Instavar. Poll `connect_account_status` with the returned
`pairingId` until it reports `connected`. Pairings expire after 10 minutes and
can only be approved by an owner/admin of the workspace.

## CLI

```
npx @instavar/mcp-server --version
npx @instavar/mcp-server --help
```

## License

MIT

## Creative guidance

`get_creative_guide` works without a key. Omit `guideId` to discover the four
guides, or choose `visual-copy`, `carousel-stories`, `visual-design` or
`human-review`. The same text is available as Markdown resources at
`instavar://creative-guides/<guideId>`. The calling assistant applies the guidance
to the user's brief; this tool does not generate copy, render, save feedback or
publish media. Carousel recipes are planning guidance, not additional npm renderers.

The monorepo sources live in `docs/guides/creative/`. After an edit, run
`node scripts/build-creative-guides.mjs`; `--check` rejects a stale bundle.
The generated TypeScript is bundled into the package, so installed clients need
no checkout files or access to private knowledge stores. Source changes require
a normal npm release before installed clients receive them.
