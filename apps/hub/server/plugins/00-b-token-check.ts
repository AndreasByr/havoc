// ─── Startup Token Validation ──────────────────────────────────────────────────
// Runs after 00-a-load-env.ts (env vars loaded) and before 00-db-migrate.ts.
// Fails loud if BOT_INTERNAL_TOKEN is missing or a placeholder value.
// MCP_INTERNAL_TOKEN is optional (absent = feature disabled); fails only if set to a placeholder.
// Addresses F-11 (SEC-06): "Fail Loud, Never Fake" at process startup.

const PLACEHOLDER_PREFIXES = [
  "replace_with_",
  "changeme",
  "your_token_here",
  "dev-"
];

function isInvalidToken(value: string): boolean {
  if (!value || value.length === 0) return true;
  const lower = value.toLowerCase();
  return PLACEHOLDER_PREFIXES.some((p) => lower.startsWith(p));
}

export default defineNitroPlugin(() => {
  const config = useRuntimeConfig();

  const botToken = String(config.botInternalToken || "");
  if (isInvalidToken(botToken)) {
    console.error(
      "[token-check] Startup aborted: BOT_INTERNAL_TOKEN is missing or contains a placeholder value. Set a real secret in .env."
    );
    process.exit(1);
  }

  // MCP token is optional — only fail if explicitly set to a placeholder string.
  // An absent token means MCP feature is disabled, which is a valid configuration.
  const mcpToken = String(config.mcpInternalToken || "");
  if (mcpToken.length > 0 && isInvalidToken(mcpToken)) {
    console.error(
      "[token-check] Startup aborted: MCP_INTERNAL_TOKEN contains a placeholder value. Use a real secret or remove the variable."
    );
    process.exit(1);
  }
});
