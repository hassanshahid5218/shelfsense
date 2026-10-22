import 'dotenv/config';

const env = process.env;
export const config = {
  port: Number(env.PORT || 3001),
  mongoUri: env.MONGODB_URI,
  dbName: env.DB_NAME || 'shelfsense',
  clientOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  demoToken: env.DEMO_ACCESS_TOKEN,
  nodeEnv: env.NODE_ENV || 'development',
  timezone: env.APP_TIMEZONE || 'UTC'
};

export function assertConfig(c = config) {
  const problems = [];
  if (!c.mongoUri) problems.push('MONGODB_URI is required');
  if (!c.demoToken || c.demoToken.length < 16) problems.push('DEMO_ACCESS_TOKEN is required (min 16 characters)');
  if (c.clientOrigins.includes('*')) problems.push('CLIENT_ORIGIN must list explicit origins, not "*"');
  if (problems.length) throw new Error(`Invalid configuration:\n - ${problems.join('\n - ')}`);
}
