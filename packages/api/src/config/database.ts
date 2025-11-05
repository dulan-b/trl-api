import postgres from 'postgres';
import { getEnvConfig } from '@trl/shared';

const config = getEnvConfig();

// Create postgres connection
export const sql = postgres(config.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

// Test connection
export async function testConnection() {
  try {
    await sql`SELECT 1`;
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}
