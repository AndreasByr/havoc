import { z } from "zod";
import { requireAdminSession } from "../../../utils/auth";
import { readBodyWithSchema } from "../../../utils/http";
import { installAppFromLocalPath } from "../../../utils/app-sideload";
import { isDevRoleSwitcherEnabled } from "../../../utils/dev-role-switcher";

const bodySchema = z.object({
  localPath: z.string().min(1, "localPath is required"),
  activate: z.boolean().default(false)
});

export default defineEventHandler(async (event) => {
  if (!isDevRoleSwitcherEnabled(event)) {
    throw createError({ statusCode: 403, statusMessage: "Sideloading is only available in development mode." });
  }
  await requireAdminSession(event);
  const { localPath, activate } = await readBodyWithSchema(event, bodySchema, "Invalid request body.");

  const result = await installAppFromLocalPath(localPath, {
    activate,
    preserveConfig: true
  });

  return { ok: true, appId: result.appId };
});
