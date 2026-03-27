// @guildora/app-sdk — Types for Guildora app plugins

// ─── Bot hook payloads ───────────────────────────────────────────────────────

export interface VoiceActivityPayload {
  guildId: string;
  memberId: string;
  /** "join" | "leave" | "move" */
  action: "join" | "leave" | "move";
  channelId: string | null;
  previousChannelId: string | null;
  /** Seconds spent in the previous channel (only present on leave/move) */
  durationSeconds?: number;
  occurredAt: string;
}

export interface RoleChangePayload {
  guildId: string;
  memberId: string;
  addedRoles: string[];
  removedRoles: string[];
}

export interface MemberJoinPayload {
  guildId: string;
  memberId: string;
  username: string;
  joinedAt: string | null;
}

export interface InteractionPayload {
  guildId: string | null;
  memberId: string;
  commandName: string;
  channelId: string | null;
  occurredAt: string;
}

export interface MessagePayload {
  guildId: string;
  channelId: string;
  messageId: string;
  memberId: string;
  content: string;
  occurredAt: string;
  /** If this message is a reply, the ID of the replied-to message. */
  replyToMessageId?: string;
  /** If this message is a reply, the user ID of the replied-to message's author. */
  replyToUserId?: string;
}

// ─── App KV store ────────────────────────────────────────────────────────────

export interface AppDb {
  /** Get a value by key (returns null if missing). */
  get(key: string): Promise<unknown | null>;
  /** Set a value for a key. */
  set(key: string, value: unknown): Promise<void>;
  /** Delete a key. */
  delete(key: string): Promise<void>;
  /** List all entries whose key starts with a given prefix. */
  list(prefix: string): Promise<Array<{ key: string; value: unknown }>>;
}

// ─── Bot client ──────────────────────────────────────────────────────────────

export interface BotClient {
  /** Send a message to a Discord channel by ID. */
  sendMessage(channelId: string, content: string): Promise<void>;
  /** Create a voice channel inside a category. Returns the created channel info or null. */
  createVoiceChannel(name: string, parentId: string): Promise<{ id: string; name: string } | null>;
  /** Delete a channel by ID. Returns true if deleted. */
  deleteChannel(channelId: string): Promise<boolean>;
  /** Fetch a channel by ID. */
  getChannel(channelId: string): Promise<{ id: string; name: string; parentId: string | null; memberCount: number | null } | null>;
  /** Rename a channel. Returns true on success. */
  setChannelName(channelId: string, name: string): Promise<boolean>;
  /** Move a guild member to a voice channel. Guild is derived from the channel. */
  moveMemberToChannel(memberId: string, channelId: string): Promise<boolean>;
  /** Get the voice channel ID a member is currently in. */
  getMemberVoiceChannelId(memberId: string): Promise<string | null>;
  /** List voice channels in a category. Guild is derived from the category. */
  listVoiceChannelsByCategory(categoryId: string): Promise<Array<{ id: string; name: string; parentId: string | null; memberCount: number | null }>>;
  /** List all text channels in the guild. */
  listTextChannels(): Promise<Array<{ id: string; name: string }>>;
}

// ─── Bot context ─────────────────────────────────────────────────────────────

export interface BotContext {
  /** App config values as set by the guild admin. */
  config: Record<string, unknown>;
  /** Scoped KV store for this app. */
  db: AppDb;
  /** Discord bot client. */
  bot: BotClient;
  /** The bot's own Discord user ID. */
  botUserId: string;
}

// ─── Hub context (injected into event.context.guildora) ──────────────────

export interface HubAppContext {
  /** Authenticated user's ID. */
  userId: string;
  /** Authenticated user's permission roles. */
  userRoles: string[];
  /** Current guild ID (null for global routes). */
  guildId: string | null;
  /** App config values. */
  config: Record<string, unknown>;
  /** Scoped KV store for this app. */
  db: AppDb;
  /** Persist updated app config values (merges with or replaces the stored config). */
  saveConfig(config: Record<string, unknown>): Promise<void>;
}
