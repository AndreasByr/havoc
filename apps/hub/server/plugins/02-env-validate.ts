export default defineNitroPlugin(() => {
  const requiredEnvVars = ["DATABASE_URL", "NUXT_SESSION_PASSWORD"] as const;

  for (const envVarName of requiredEnvVars) {
    const value = process.env[envVarName];
    if (!value || value.trim().length === 0) {
      const message = `[env-validate] FATAL: ${envVarName} is not set. Set it in your .env file before starting the hub.`;
      console.error(message);
      throw new Error(message);
    }
  }
});
