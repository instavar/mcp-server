# Changelog

Each release has a section headed by its version. The section becomes the
GitHub Release notes on the public mirror, and the release tests fail when the
current version has none.

## 0.9.1

Free Remotion and HyperFrames video templates, creative guides, storyboard and carousel planning for AI agents. Fifteen tools work without an Instavar account or API key; `INSTAVAR_API_KEY` is optional and unlocks separate hosted Studio workflows.

Changes in 0.9.1:

- No change to the tools, resources or their answers. This release exercises the new release path: one tag now publishes to npm, the official MCP registry and the public mirror's GitHub Release.
- The package gains release scripts (`release:prepare`, `listings:sync`, `listings:verify`, `listings:lobehub`) and a test that stops a release whose version, changelog or LobeHub declaration disagree.

Install: `npx -y @instavar/mcp-server@0.9.1`

## 0.9.0

Free Remotion and HyperFrames video templates, creative guides, storyboard and carousel planning for AI agents. Fifteen tools work without an Instavar account or API key; `INSTAVAR_API_KEY` is optional and unlocks separate hosted Studio workflows.

Changes in 0.9.0:

- `get_template` and `list_templates` return `usualSceneKinds` in place of `requiredSceneKinds`. The scene kinds were never enforced, so the new name says what they are: the usual shape of a template, not a rule.
- `propose_video_storyboard` routes calculation, derivation, theorem and worked-example briefs to the `proof-walkthrough` template.
- The `proof-walkthrough` storyboard beats are rewritten for calculations: state the question, show the step that matters, land the result.

Install: `npx -y @instavar/mcp-server@0.9.0`
