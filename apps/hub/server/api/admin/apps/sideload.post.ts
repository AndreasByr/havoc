import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import { readBodyWithSchema } from "../../../utils/http";
import { installAppFromUrl } from "../../../utils/app-sideload";
import { isDevRoleSwitcherEnabled } from "../../../utils/dev-role-switcher";

const sideloadSchema = z.object({
  githubUrl: z.string().url(),
  activate: z.boolean().optional(),
  verified: z.boolean().optional()
});

export default defineEventHandler(async (event) => {
  if (!isDevRoleSwitcherEnabled(event)) {
    throw createError({ statusCode: 403, statusMessage: "Sideloading is only available in development mode." });
  }
  const session = await requireAdminSession(event);
  const parsedBody = await readBodyWithSchema(event, sideloadSchema, "Invalid sideload payload.");

  const { appId } = await installAppFromUrl(parsedBody.githubUrl, {
    activate: parsedBody.activate,
    verified: parsedBody.verified,
    createdBy: session.user.id,
    preserveAutoUpdate: false
  });

  return { ok: true, appId };
});
