# @instavar/mcp-server

Drive the full [Instavar Studio](https://instavar.com) video workflow —
**create → render → approve → publish → metrics** — from Claude Code or Codex,
without leaving your terminal.

The server is a thin HTTP client: it authenticates with a per-user API key and
talks to the hosted Instavar API. It holds **no database connection** and stores
no data of its own.

## Setup

1. Create an API key at **https://instavar.com/studio/settings** (shown once —
   copy it).
2. Add the server to your MCP client config:

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

3. Restart the client. The `instavar` tools appear.

### Environment

| Var                 | Required | Default                | Purpose                                                          |
| ------------------- | -------- | ---------------------- | ---------------------------------------------------------------- |
| `INSTAVAR_API_KEY`  | yes      | —                      | Your key from `/studio/settings`. Scoped to your org; revocable. |
| `INSTAVAR_BASE_URL` | no       | `https://instavar.com` | Override the API host.                                           |

## Tools

| Tool                     | What it does                                                                                   |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| `list_jobs`              | List recent jobs (newest first).                                                               |
| `get_job_status`         | Runs, artifacts, verifications, current video + thumbnail URLs.                                |
| `get_video_state`        | Materialized composition state for a job.                                                      |
| `get_job_metrics`        | Platform engagement snapshots for a published job.                                             |
| `get_cost_summary`       | Infra cost summary (Lambda / RunPod / R2 / WaveSpeed / PoYo).                                  |
| `create_video_brief`     | Create a job from a structured brief and start rendering.                                      |
| `edit_video_brief`       | Patch a brief (incl. objective / publishTarget); re-renders unless only publishTarget changed. |
| `approve_job`            | Approve a rendered job so it can be published.                                                 |
| `publish_job`            | Publish an approved job to its connected social destination.                                   |
| `connect_account`        | Start connecting a social account (headless OAuth pairing).                                    |
| `connect_account_status` | Poll a pending account connection until it is connected.                                       |

Writes require a key with the `write` scope; `publish_job` requires `publish`.

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
