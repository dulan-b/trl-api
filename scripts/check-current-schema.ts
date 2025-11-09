import postgres from 'postgres';
import { getEnvConfig } from '@trl/shared';

const config = getEnvConfig();
const sql = postgres(config.DATABASE_URL);

async function checkCurrentSchema() {
  try {
    console.log('🔍 Checking what tables ACTUALLY exist in the Neon database...\n');

    // Get all tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `;

    console.log(`📊 Found ${tables.length} tables:\n`);

    for (const table of tables) {
      console.log(`\n📋 Table: ${table.table_name}`);
      console.log('─'.repeat(80));

      // Get columns for this table
      const columns = await sql`
        SELECT
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = ${table.table_name}
        ORDER BY ordinal_position;
      `;

      columns.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const def = col.column_default ? `DEFAULT ${col.column_default}` : '';
        console.log(`  ${col.column_name.padEnd(30)} ${col.data_type.padEnd(20)} ${nullable.padEnd(10)} ${def}`);
      });
    }

    console.log('\n\n' + '='.repeat(80));
    console.log('✅ Schema check complete!\n');

    await sql.end();
  } catch (error) {
    console.error('❌ Error checking schema:', error);
    process.exit(1);
  }
}

checkCurrentSchema();
