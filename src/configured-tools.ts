import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { registerPublicTemplateTools } from "./public-templates";
import { registerTools } from "./tools";

export function registerConfiguredTools(
  server: McpServer,
  apiKey = process.env.INSTAVAR_API_KEY
): void {
  registerPublicTemplateTools(server);
  if (apiKey?.trim()) {
    registerTools(server);
  }
}
