import { db } from '../index.mjs'

async function migrate() {
  console.log('Running campaign migration...')
  await db.none(`
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS invite_code VARCHAR(50) UNIQUE;

    CREATE TABLE IF NOT EXISTS campaign_members (
      id BIGSERIAL PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL DEFAULT 'player',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(campaign_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS campaign_messages (
      id BIGSERIAL PRIMARY KEY,
      campaign_id BIGINT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
      character_id BIGINT REFERENCES characters(id) ON DELETE SET NULL,
      sender_name VARCHAR(255) NOT NULL,
      message TEXT,
      message_type VARCHAR(50) NOT NULL DEFAULT 'chat',
      roll_data JSONB,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_campaign_members_cid ON campaign_members(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_members_uid ON campaign_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_messages_cid ON campaign_messages(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_characters_cid ON characters(campaign_id);
  `)
  console.log('Campaign migration completed successfully!')
  process.exit(0)
}

migrate().catch(err => {
  console.error('Campaign migration failed:', err)
  process.exit(1)
})
