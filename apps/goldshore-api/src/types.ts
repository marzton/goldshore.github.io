export interface WebhookEnv {
  // Add any properties needed by the OpenAPI spec here
}

export interface EventQueueMessage {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  subject?: string;
  issuedAt: number;
  metadata?: Record<string, unknown>;
}

export interface Env extends WebhookEnv {
  KV_SESSIONS: KVNamespace;
  KV_CACHE: KVNamespace;
  DO_SESSIONS: DurableObjectNamespace;
  Q_EVENTS: Queue<EventQueueMessage>;
  GOLDSHORE_ENV: string;
  GOLDSHORE_ORIGIN?: string;
  GOLDSHORE_CORS?: string;
  GOLDSHORE_JWT_SECRET: string;
  JWT_AUDIENCE?: string;
  JWT_ISSUER?: string;
  RATE_LIMIT_MAX?: string;
  RATE_LIMIT_WINDOW?: string;
}
