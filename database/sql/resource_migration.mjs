import { db } from '../index.mjs'

async function migrate() {
  console.log('Running sheet_resources migration...')
  await db.none(`
    ALTER TABLE characters ADD COLUMN IF NOT EXISTS sheet_resources JSONB DEFAULT '{}'::jsonb;
  `)
  console.log('Migration completed successfully!')
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
