import { getRuntimeReadiness } from '../../../lib/runtime-readiness';

export const dynamic = 'force-dynamic';

/**
 * Configuration health only: it never calls AI providers or exposes secrets.
 * Database reachability remains a staging/hosted smoke-test concern because an
 * authenticated workspace is required for meaningful RLS validation.
 */
export function GET() {
  const readiness = getRuntimeReadiness();
  const body = {
    status: readiness.ready ? 'ok' : 'degraded',
    database: readiness.database,
    aiProvider: readiness.aiProvider,
    environment: readiness.environment,
    operatingMode: readiness.operatingMode,
    issues: readiness.issues,
  };
  return Response.json(body, { status: readiness.ready ? 200 : 503 });
}
