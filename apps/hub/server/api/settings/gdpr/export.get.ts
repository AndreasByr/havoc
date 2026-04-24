import { requireSession } from "../../../utils/auth";
import { assembleUserDataExport } from "../../../utils/gdpr-erasure";

export default defineEventHandler(async (event) => {
  const session = await requireSession(event);

  const dataExport = await assembleUserDataExport(session.user.id);
  if (!dataExport.profile?.id) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found."
    });
  }

  setHeader(event, "Content-Disposition", "attachment; filename=\"guildora-data-export.json\"");

  return dataExport;
});
