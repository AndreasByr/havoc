import type { ZodTypeAny, input, output } from "zod";

type ReadValidatedBodyOptions<TSchema extends ZodTypeAny> = {
  emptyBodyValue?: input<TSchema>;
};

export async function readBodyWithSchema<TSchema extends ZodTypeAny>(
  event: Parameters<typeof readBody>[0],
  schema: TSchema,
  invalidStatusMessage: string,
  options?: ReadValidatedBodyOptions<TSchema>
): Promise<output<TSchema>> {
  const rawBody = await readBody(event);
  const body = rawBody == null && options?.emptyBodyValue !== undefined ? options.emptyBodyValue : rawBody;

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw createError({ statusCode: 400, statusMessage: invalidStatusMessage });
  }

  return parsed.data;
}

export function requireRouterParam(
  event: Parameters<typeof getRouterParam>[0],
  paramName: string,
  missingStatusMessage: string
): string {
  const value = getRouterParam(event, paramName);
  if (!value) {
    throw createError({ statusCode: 400, statusMessage: missingStatusMessage });
  }
  return value;
}

export function requirePositiveIntRouterParam(
  event: Parameters<typeof getRouterParam>[0],
  paramName: string,
  invalidStatusMessage: string
): number {
  const raw = requireRouterParam(event, paramName, invalidStatusMessage);
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw createError({ statusCode: 400, statusMessage: invalidStatusMessage });
  }
  return parsed;
}

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

export function parsePaginationQuery(query: Record<string, unknown>) {
  const page = Math.max(1, Number.parseInt(typeof query.page === "string" ? query.page : "1", 10) || 1);
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(typeof query.limit === "string" ? query.limit : String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  return { page, limit };
}

export function paginateArray<T>(items: T[], page: number, limit: number) {
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  return {
    items: items.slice(offset, offset + limit),
    pagination: { page, limit, total, totalPages }
  };
}
