import { db } from './db';
import { sql } from 'drizzle-orm';

async function run() {
  await db.execute(sql`ALTER TABLE partner_developers ADD COLUMN IF NOT EXISTS auto_send_enabled boolean NOT NULL DEFAULT true`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS partner_developer_sends (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      developer_id varchar NOT NULL,
      deal_id varchar NOT NULL,
      sent_at timestamp NOT NULL DEFAULT now(),
      classification varchar,
      address text,
      UNIQUE(developer_id, deal_id)
    )
  `);
  console.log('Migration OK');
}

run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
