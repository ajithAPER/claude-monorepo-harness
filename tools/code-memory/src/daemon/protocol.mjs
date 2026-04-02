import { z } from 'zod';

// --- Request envelope ---

export const DaemonRequestSchema = z.object({
  method: z.string(),
  params: z.record(z.any()).optional().default({}),
  id: z.string().optional(),
});

// --- Response envelope ---

export const DaemonResponseSchema = z.object({
  result: z.any().optional(),
  error: z.object({ code: z.number(), message: z.string() }).optional(),
  id: z.string().optional(),
});

// --- Per-method param schemas ---

const LanguageEnum = z.enum(['typescript', 'javascript', 'go', 'rust']);

const ProjectRootSchema = z.object({
  projectRoot: z.string(),
});

export const IndexParamsSchema = ProjectRootSchema.extend({
  path: z.string().optional(),
  force: z.boolean().optional(),
  language: LanguageEnum.optional(),
});

export const QueryParamsSchema = ProjectRootSchema.extend({
  term: z.string(),
  kind: z.string().optional(),
  exported: z.boolean().optional(),
  language: z.string().optional(),
});

export const FileParamsSchema = ProjectRootSchema.extend({
  file: z.string(),
});

export const DepsTreeParamsSchema = FileParamsSchema.extend({
  depth: z.number().optional(),
  direction: z.enum(['in', 'out', 'both']).optional(),
});

export const HubsParamsSchema = ProjectRootSchema.extend({
  top: z.number().optional(),
});

export const FilesParamsSchema = ProjectRootSchema.extend({
  glob: z.string().optional(),
  language: z.string().optional(),
});

export const FileChangeParamsSchema = ProjectRootSchema.extend({
  filePath: z.string(),
  eventType: z.enum(['change', 'delete']),
});

export const StatusParamsSchema = z.object({
  projectRoot: z.string().optional(),
});

export const UnloadRepoParamsSchema = ProjectRootSchema;

const EmptyParamsSchema = z.object({}).optional();

// --- Method → schema map ---

/** @type {Record<string, z.ZodType>} */
export const METHOD_SCHEMAS = {
  'index': IndexParamsSchema,
  'query': QueryParamsSchema,
  'exports': FileParamsSchema,
  'importers': FileParamsSchema,
  'dependencies': FileParamsSchema,
  'deps-tree': DepsTreeParamsSchema,
  'hubs': HubsParamsSchema,
  'files': FilesParamsSchema,
  'file-symbols': FileParamsSchema,
  'file-change': FileChangeParamsSchema,
  'list-repos': EmptyParamsSchema,
  'unload-repo': UnloadRepoParamsSchema,
  'ping': EmptyParamsSchema,
  'shutdown': EmptyParamsSchema,
  'status': StatusParamsSchema,
};

/**
 * Validate a daemon request, including method-specific params.
 * @param {unknown} raw
 * @returns {{ ok: true, request: { method: string, params: Record<string, any>, id?: string } } | { ok: false, error: string }}
 */
export function validateRequest(raw) {
  const envelopeResult = DaemonRequestSchema.safeParse(raw);
  if (!envelopeResult.success) {
    return { ok: false, error: `Invalid request: ${envelopeResult.error.message}` };
  }

  const { method, params, id } = envelopeResult.data;
  const paramsSchema = METHOD_SCHEMAS[method];

  if (!paramsSchema) {
    return { ok: false, error: `Unknown method: ${method}` };
  }

  const paramsResult = paramsSchema.safeParse(params);
  if (!paramsResult.success) {
    return { ok: false, error: `Invalid params for ${method}: ${paramsResult.error.message}` };
  }

  return { ok: true, request: { method, params: paramsResult.data, id } };
}

/**
 * Validate a daemon response.
 * @param {unknown} raw
 * @returns {{ ok: true, response: { result?: any, error?: { code: number, message: string }, id?: string } } | { ok: false, error: string }}
 */
export function validateResponse(raw) {
  const result = DaemonResponseSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: `Invalid response: ${result.error.message}` };
  }
  return { ok: true, response: result.data };
}
