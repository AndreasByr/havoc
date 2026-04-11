import type { MatrixClient } from "matrix-bot-sdk";

/**
 * Fetch the rooms in a Matrix space via the hierarchy API.
 * Falls back to an empty array if the API is not available.
 */
export async function getSpaceHierarchy(
  client: MatrixClient,
  spaceId: string
): Promise<Array<{ room_id: string; name?: string; room_type?: string; canonical_alias?: string }>> {
  try {
    // The space hierarchy endpoint is available on most Synapse versions
    const response = await (client as any).doRequest(
      "GET",
      `/_matrix/client/v1/rooms/${encodeURIComponent(spaceId)}/hierarchy`,
      { limit: 50 }
    );
    return response?.rooms ?? [];
  } catch {
    return [];
  }
}
