/**
 * Minimal mock hub API server for Playwright smoke tests.
 * Serves GET /api/public/landing with template data based on
 * the X-Test-Template header (default: "default").
 */

import { createServer } from "node:http";

const TEMPLATE_COLORS = {
  default: {
    background: "#0a0a0a", surface: "#141414", text: "#fafafa",
    textMuted: "#a1a1aa", accent: "#7c3aed", accentText: "#ffffff", border: "#27272a",
  },
  cyberpunk: {
    background: "#0a0a12", surface: "#12122a", text: "#e0e0ff",
    textMuted: "#7a7a9e", accent: "#00f0ff", accentText: "#0a0a12", border: "#1e1e3a",
  },
  esports: {
    background: "#0b0e14", surface: "#131720", text: "#f0f2f5",
    textMuted: "#8a92a0", accent: "#e53e3e", accentText: "#ffffff", border: "#1f2533",
  },
};

let activeTemplate = "default";

function makeSections(templateId) {
  return [
    {
      id: "hero-1", blockType: "hero", sortOrder: 0,
      config: { layoutVariant: templateId },
      content: {
        eyebrowLabel: `${templateId}-eyebrow`,
        heading: `${templateId}-heading`,
        subheading: `${templateId}-subheading`,
        ctaText: "Apply Now", ctaLink: "/apply", ctaExploreLabel: "Learn More",
      },
    },
    {
      id: "features-1", blockType: "features", sortOrder: 1,
      config: { columns: 3, styleVariant: "normal" },
      content: {
        sectionTitle: `${templateId}-features-title`,
        features: [
          { icon: "trophy", title: "Feature A", description: "Desc A" },
          { icon: "swords", title: "Feature B", description: "Desc B" },
        ],
      },
    },
    {
      id: "cta-1", blockType: "cta", sortOrder: 2,
      config: { variant: "accent", styleVariant: "accent" },
      content: {
        heading: `${templateId}-cta-heading`,
        description: "CTA description here",
        buttonText: "Go", buttonLink: "/apply",
      },
    },
    {
      id: "stats-1", blockType: "stats", sortOrder: 3,
      config: { styleVariant: "warning" },
      content: {
        sectionTitle: `${templateId}-stats-title`,
        stats: [{ value: "300+", label: "Members" }, { value: "42", label: "Wins" }],
      },
    },
  ];
}

const server = createServer((req, res) => {
  const url = new URL(req.url, "http://localhost:3003");

  // Allow tests to switch template
  if (url.pathname === "/_test/set-template") {
    const t = url.searchParams.get("id") || "default";
    activeTemplate = t;
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, template: activeTemplate }));
    return;
  }

  if (url.pathname === "/api/public/landing") {
    const data = {
      sections: makeSections(activeTemplate),
      template: { id: activeTemplate, name: activeTemplate },
      customCss: null,
      meta: { title: `Guildora – ${activeTemplate}` },
      colors: TEMPLATE_COLORS[activeTemplate] ?? TEMPLATE_COLORS.default,
    };
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(data));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

server.listen(3003, () => {
  console.log("Mock hub API running on http://localhost:3003");
});
