import { db } from '../index.mjs'

async function migrate() {
  console.log('Running characteristics & image_url migration...')
  await db.none(`
    ALTER TABLE characters ADD COLUMN IF NOT EXISTS image_url TEXT;
    ALTER TABLE characters ADD COLUMN IF NOT EXISTS characteristics JSONB DEFAULT '{}'::jsonb;
  `)
  console.log('Migration completed successfully!')
  process.exit(0)
}

migrate().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
