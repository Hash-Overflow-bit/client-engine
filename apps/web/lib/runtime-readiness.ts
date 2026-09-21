export type RuntimeEnvironment = 'development' | 'test' | 'preview' | 'production';
export type OperatingMode = 'development' | 'assisted';
export type AiProviderName = 'ollama' | 'openai';

export type RuntimeReadiness = Readonly<{
  ready: boolean;
  environment: RuntimeEnvironment | 'invalid';
  operatingMode: OperatingMode | 'invalid';
  aiProvider: AiProviderName | 'invalid';
  database: 'configured' | 'not_configured';
  issues: readonly string[];
}>;

const runtimeEnvironments = new Set<RuntimeEnvironment>(['development', 'test', 'preview', 'production']);
const operatingModes = new Set<OperatingMode>(['development', 'assisted']);
const aiProviders = new Set<AiProviderName>(['ollama', 'openai']);

/**
 * Validates configuration shape without making network calls or exposing values.
 * It deliberately reports missing Supabase configuration instead of crashing the
 * demo shell; production operators use `ready` as the deploy-time gate.
 */
export function getRuntimeReadiness(env: NodeJS.ProcessEnv = process.env): RuntimeReadiness {
  const issues: string[] = [];
  const configuredEnvironment = env.CLIENT_ENGINE_ENV ?? 'development';
  const environment = runtimeEnvironments.has(configuredEnvironment as RuntimeEnvironment)
    ? configuredEnvironment as RuntimeEnvironment
    : 'invalid';
  if (environment === 'invalid') issues.push('CLIENT_ENGINE_ENV must be development, test, preview, or production.');

  const configuredMode = env.CLIENT_ENGINE_OPERATING_MODE ?? (environment === 'development' ? 'development' : 'assisted');
  const operatingMode = operatingModes.has(configuredMode as OperatingMode)
    ? configuredMode as OperatingMode
    : 'invalid';
  if (operatingMode === 'invalid') issues.push('CLIENT_ENGINE_OPERATING_MODE must be development or assisted.');
  if (environment !== 'development' && operatingMode !== 'assisted') issues.push('Non-development deployments must use assisted mode.');

  const configuredProvider = env.AI_PROVIDER ?? 'ollama';
  const aiProvider = aiProviders.has(configuredProvider as AiProviderName)
    ? configuredProvider as AiProviderName
    : 'invalid';
  if (aiProvider === 'invalid') issues.push('AI_PROVIDER must be ollama or openai.');
  if (aiProvider === 'ollama' && (!env.OLLAMA_BASE_URL || !env.OLLAMA_MODEL)) issues.push('OLLAMA_BASE_URL and OLLAMA_MODEL are required when AI_PROVIDER=ollama.');
  if (aiProvider === 'openai') {
    for (const name of ['OPENAI_API_KEY', 'OPENAI_QUALIFICATION_ROUTINE_MODEL', 'OPENAI_QUALIFICATION_STRONG_MODEL']) {
      if (!env[name]) issues.push(`${name} is required when AI_PROVIDER=openai.`);
    }
  }

  const database = env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ? 'configured'
    : 'not_configured';
  if (environment === 'production' && database === 'not_configured') issues.push('Supabase URL and publishable key are required in production.');
  if (environment === 'production' && env.OUTBOUND_KILL_SWITCH !== 'true') issues.push('OUTBOUND_KILL_SWITCH must remain true for the assisted launch.');
  if (env.OUTREACH_SEND_ENABLED === 'true') issues.push('OUTREACH_SEND_ENABLED must remain false for the assisted launch.');
  if (env.LIVE_TEST_MODE === 'true' && (!env.LIVE_TEST_MAX_PROSPECTS || Number(env.LIVE_TEST_MAX_PROSPECTS) > 10)) issues.push('LIVE_TEST_MODE requires LIVE_TEST_MAX_PROSPECTS between 1 and 10.');

  return { ready: issues.length === 0, environment, operatingMode, aiProvider, database, issues };
}

export function assertProductionReadiness(env: NodeJS.ProcessEnv = process.env): RuntimeReadiness {
  const readiness = getRuntimeReadiness(env);
  if (!readiness.ready) throw new Error(`Runtime configuration is not ready: ${readiness.issues.join(' ')}`);
  return readiness;
}
