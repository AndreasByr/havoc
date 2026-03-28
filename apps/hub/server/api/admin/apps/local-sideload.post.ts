import { z } from "zod";
import { requireSuperadminSession } from "../../../utils/auth";
import { readBodyWithSchema } from "../../../utils/http";
import { installAppFromLocalPath } from "../../../utils/app-sideload";

const bodySchema = z.object({
  localPath: z.string().min(1, "localPath is required"),
  activate: z.boolean().default(false)
});

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  if (!import.meta.dev && !config.enableSideloading) {
    throw createError({ statusCode: 403, statusMessage: "Sideloading is not enabled." });
  }
  await requireSuperadminSession(event);
  const { localPath, activate } = await readBodyWithSchema(event, bodySchema, "Invalid request body.");

  const result = await installAppFromLocalPath(localPath, {
    activate,
    preserveConfig: true
  });

  return { ok: true, appId: result.appId };
});
