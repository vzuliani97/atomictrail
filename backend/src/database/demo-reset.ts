import { Pool } from 'pg';

/**
 * Refuses to go on unless the connected database is the one named in DEMO_DATABASE_CONFIRMATION. The public
 * demo wipes its data on every boot, so a wrong DATABASE_URL must stop the API instead of emptying a real base.
 */
export async function assertDemoDatabase(pool: Pool, expected: string | undefined): Promise<void> {
  const { rows } = await pool.query<{ name: string }>('SELECT current_database() AS name');
  if (!expected || rows[0].name !== expected) {
    throw new Error('Refusing to start: the connected database is not the one named in DEMO_DATABASE_CONFIRMATION');
  }
}

/** Empties every business table in one transaction, so the seed and the live feed can load fresh data. */
export async function resetDemoData(pool: Pool): Promise<void> {
  await pool.query(
    `TRUNCATE balance_movements, bets, casino_transactions, selections, sports_events, sales, partners, users,
       products, points_of_sale RESTART IDENTITY CASCADE`,
  );
}
