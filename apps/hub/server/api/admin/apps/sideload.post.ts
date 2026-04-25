import { z } from "zod";
import { requireSuperadminSession } from "../../../utils/auth";
import { readBodyWithSchema } from "../../../utils/http";
import { installAppFromUrl } from "../../../utils/app-sideload";

const sideloadSchema = z.object({
  githubUrl: z.string().url(),
  activate: z.boolean().optional(),
  verified: z.boolean().optional()
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!import.meta.dev && !config.enableSideloading) {
    throw createError({ statusCode: 403, statusMessage: "Sideloading is not enabled." });
  }
  const session = await requireSuperadminSession(event);
  const parsedBody = await readBodyWithSchema(event, sideloadSchema, "Invalid sideload payload.");

  const { appId } = await installAppFromUrl(parsedBody.githubUrl, {
    activate: parsedBody.activate,
    verified: parsedBody.verified,
    createdBy: session.user.id,
    preserveAutoUpdate: false
  });

  console.log(JSON.stringify({ event: "app.installed", appId, source: "sideload", userId: session.user.id }));

  return { ok: true, appId };
});
