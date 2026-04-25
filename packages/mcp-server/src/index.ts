import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";

const HUB_URL = process.env.MCP_HUB_URL || "http://localhost:3003";
const TOKEN = process.env.MCP_INTERNAL_TOKEN?.trim() || "";
const IS_PROD = process.env.NODE_ENV === "production";

if (!TOKEN) {
  if (IS_PROD) {
    console.error("[mcp-server] MCP_INTERNAL_TOKEN is required.");
    process.exit(1);
  }
  console.warn("[mcp-server] MCP_INTERNAL_TOKEN is not set; skipping MCP server startup in development.");
  process.exit(0);
}

async function hubFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${HUB_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      ...options.headers
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hub API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

function textResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({
  name: "guildora-landing",
  version: "0.1.0"
});

// ─── Read Tools ──────────────────────────────────────────────────────────

server.registerTool(
  "landing_get_page",
  {
    description: "Get the full landing page configuration including sections, templates, and page settings.",
    inputSchema: z.object({})
  },
  async () => {
    const data = await hubFetch("/api/internal/landing/page");
    return textResult(data);
  }
);

server.registerTool(
  "landing_get_sections",
  {
    description: "Get all landing page sections with their content and configuration.",
    inputSchema: z.object({})
  },
  async () => {
    const data = await hubFetch("/api/internal/landing/sections");
    return textResult(data);
  }
);

server.registerTool(
  "landing_get_available_blocks",
  {
    description: "List all available block types that can be used on the landing page, with names, descriptions, and icons.",
    inputSchema: z.object({})
  },
  async () => {
    const data = await hubFetch("/api/admin/landing/blocks");
    return textResult(data);
  }
);

server.registerTool(
  "landing_get_templates",
  {
    description: "List all available landing page templates.",
    inputSchema: z.object({})
  },
  async () => {
    const data = await hubFetch("/api/admin/landing/templates");
    return textResult(data);
  }
);

// ─── Write Tools ─────────────────────────────────────────────────────────

server.registerTool(
  "landing_update_section",
  {
    description: "Update the content or configuration of a specific landing page section. Content is localized: { en: {...}, de: {...} }.",
    inputSchema: z.object({
      sectionId: z.string().describe("UUID of the section to update"),
      content: z.record(z.string(), z.unknown()).optional().describe("Localized content object, e.g. { en: { heading: '...' }, de: { heading: '...' } }"),
      config: z.record(z.string(), z.unknown()).optional().describe("Block configuration object"),
      visible: z.boolean().optional().describe("Whether the section is visible on the landing page")
    })
  },
  async ({ sectionId, content, config, visible }) => {
    const body: Record<string, unknown> = {};
    if (content !== undefined) body.content = content;
    if (config !== undefined) body.config = config;
    if (visible !== undefined) body.visible = visible;
    const data = await hubFetch(`/api/internal/landing/sections/${sectionId}`, {
      method: "PUT",
      body: JSON.stringify(body)
    });
    return textResult(data);
  }
);

server.registerTool(
  "landing_add_section",
  {
    description: "Add a new section/block to the landing page. Use landing_get_available_blocks to see available block types.",
    inputSchema: z.object({
      blockType: z.string().describe("Block type identifier, e.g. 'hero', 'features', 'cta'"),
      sortOrder: z.number().describe("Position in the page (0 = first)"),
      content: z.record(z.string(), z.unknown()).describe("Localized content: { en: {...}, de: {...} }"),
      config: z.record(z.string(), z.unknown()).optional().describe("Block configuration"),
      visible: z.boolean().optional().describe("Whether the section is visible (default: true)")
    })
  },
  async ({ blockType, sortOrder, content, config, visible }) => {
    const data = await hubFetch("/api/internal/landing/sections", {
      method: "POST",
      body: JSON.stringify({ blockType, sortOrder, content, config, visible })
    });
    return textResult(data);
  }
);

server.registerTool(
  "landing_remove_section",
  {
    description: "Remove a section from the landing page. This action cannot be undone.",
    inputSchema: z.object({
      sectionId: z.string().describe("UUID of the section to remove")
    })
  },
  async ({ sectionId }) => {
    const data = await hubFetch(`/api/internal/landing/sections/${sectionId}`, {
      method: "DELETE"
    });
    return textResult(data);
  }
);

server.registerTool(
  "landing_reorder_sections",
  {
    description: "Reorder landing page sections. Provide an array of { id, sortOrder } pairs.",
    inputSchema: z.object({
      order: z.array(z.object({
        id: z.string().describe("Section UUID"),
        sortOrder: z.number().describe("New sort order position")
      }))
    })
  },
  async ({ order }) => {
    const data = await hubFetch("/api/internal/landing/sections/reorder", {
      method: "PUT",
      body: JSON.stringify({ order })
    });
    return textResult(data);
  }
);

server.registerTool(
  "landing_switch_template",
  {
    description: "Switch the active landing page template. Content is preserved — only layout/styling changes.",
    inputSchema: z.object({
      templateId: z.string().describe("Template ID to switch to, e.g. 'default', 'cyberpunk', 'esports'")
    })
  },
  async ({ templateId }) => {
    const data = await hubFetch("/api/admin/landing/template", {
      method: "PUT",
      body: JSON.stringify({ templateId })
    });
    return textResult(data);
  }
);

server.registerTool(
  "landing_update_page",
  {
    description: "Update landing page settings: custom CSS, meta title, and meta description.",
    inputSchema: z.object({
      customCss: z.string().nullable().optional().describe("Custom CSS to inject into the landing page"),
      metaTitle: z.string().nullable().optional().describe("SEO meta title"),
      metaDescription: z.string().nullable().optional().describe("SEO meta description")
    })
  },
  async ({ customCss, metaTitle, metaDescription }) => {
    const body: Record<string, unknown> = {};
    if (customCss !== undefined) body.customCss = customCss;
    if (metaTitle !== undefined) body.metaTitle = metaTitle;
    if (metaDescription !== undefined) body.metaDescription = metaDescription;
    const data = await hubFetch("/api/admin/landing/page", {
      method: "PUT",
      body: JSON.stringify(body)
    });
    return textResult(data);
  }
);

server.registerTool(
  "landing_publish",
  {
    description: "Publish all draft landing page sections, making them visible to visitors. Creates a version snapshot before publishing.",
    inputSchema: z.object({})
  },
  async () => {
    const data = await hubFetch("/api/internal/landing/publish", { method: "POST" });
    return textResult(data);
  }
);

server.registerTool(
  "landing_reset_to_template",
  {
    description: "Reset the landing page to the default template state. WARNING: This removes all custom content and cannot be undone. A snapshot is created before reset.",
    inputSchema: z.object({})
  },
  async () => {
    const data = await hubFetch("/api/admin/landing/reset", { method: "POST" });
    return textResult(data);
  }
);

// ─── Start ───────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
