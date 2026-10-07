'use strict'

import crypto from 'crypto'

export class CampaignRepository {
	constructor(db, pgp) {
		this.db = db
		this.pgp = pgp
	}

	async create({ userId, dmName, name, description = '' }) {
		return this.db.tx('create-campaign', async t => {
			let inviteCode = ''
			let isUnique = false
			while (!isUnique) {
				inviteCode = crypto.randomBytes(3).toString('hex').toUpperCase()
				const existing = await t.oneOrNone('SELECT id FROM campaigns WHERE invite_code = $1', [inviteCode])
				if (!existing) isUnique = true
			}

			const campaign = await t.one(
				`INSERT INTO campaigns (user_id, dm_name, name, description, invite_code)
				 VALUES ($1, $2, $3, $4, $5)
				 RETURNING *`,
				[+userId, dmName, name, description || '', inviteCode]
			)

			await t.none(
				`INSERT INTO campaign_members (campaign_id, user_id, role)
				 VALUES ($1, $2, 'dm')
				 ON CONFLICT (campaign_id, user_id) DO NOTHING`,
				[campaign.id, +userId]
			)

			return campaign
		})
	}

	async listByUser(userId) {
		return this.db.any(
			`SELECT c.*,
				(c.user_id = $1) AS is_dm,
				COUNT(DISTINCT cm.user_id)::int AS member_count,
				COUNT(DISTINCT ch.id)::int AS character_count
			 FROM campaigns c
			 LEFT JOIN campaign_members cm ON cm.campaign_id = c.id
			 LEFT JOIN characters ch ON ch.campaign_id = c.id
			 WHERE c.user_id = $1
			    OR c.id IN (SELECT campaign_id FROM campaign_members WHERE user_id = $1)
			 GROUP BY c.id
			 ORDER BY c.updated_at DESC, c.id DESC`,
			[+userId]
		)
	}

	async findById(campaignId, userId = null) {
		const campaign = await this.db.oneOrNone(
			`SELECT c.*,
				(c.user_id = $2) AS is_dm
			 FROM campaigns c
			 WHERE c.id = $1`,
			[+campaignId, userId ? +userId : null]
		)
		if (!campaign) return null

		const members = await this.db.any(
			`SELECT cm.id, cm.user_id, u.username, cm.role, cm.created_at
			 FROM campaign_members cm
			 JOIN users u ON u.id = cm.user_id
			 WHERE cm.campaign_id = $1
			 ORDER BY (cm.role = 'dm') DESC, cm.created_at ASC`,
			[+campaignId]
		)

		const characters = await this.db.any(
			`SELECT c.id, c.user_id, u.username AS player_name, c.name, c.level, c.edition, c.hp, c.max_hp, c.ac, c.temp_hp,
			        cc.name AS class_name, cr.name AS race_name
			 FROM characters c
			 LEFT JOIN users u ON u.id = c.user_id
			 LEFT JOIN LATERAL (
			     SELECT string_agg(
			         CASE WHEN (SELECT count(*) FROM character_classes WHERE character_id = c.id) > 1 THEN CONCAT(name, ' ', level) ELSE name END, ' / '
			     ) AS name FROM character_classes WHERE character_id = c.id
			 ) cc ON true
			 LEFT JOIN LATERAL (
			     SELECT name FROM character_races WHERE character_id = c.id LIMIT 1
			 ) cr ON true
			 WHERE c.campaign_id = $1
			 ORDER BY c.id ASC`,
			[+campaignId]
		)

		return {
			...campaign,
			members,
			characters
		}
	}

	async findByInviteCode(code) {
		return this.db.oneOrNone(
			'SELECT * FROM campaigns WHERE UPPER(invite_code) = UPPER($1)',
			[code ? code.trim() : '']
		)
	}

	async join({ campaignId, userId }) {
		return this.db.none(
			`INSERT INTO campaign_members (campaign_id, user_id, role)
			 VALUES ($1, $2, 'player')
			 ON CONFLICT (campaign_id, user_id) DO NOTHING`,
			[+campaignId, +userId]
		)
	}

	async leave({ campaignId, userId }) {
		return this.db.tx('leave-campaign', async t => {
			await t.none(
				'DELETE FROM campaign_members WHERE campaign_id = $1 AND user_id = $2',
				[+campaignId, +userId]
			)
			await t.none(
				'UPDATE characters SET campaign_id = NULL, campaign_name = NULL WHERE campaign_id = $1 AND user_id = $2',
				[+campaignId, +userId]
			)
		})
	}

	async linkCharacter({ campaignId, characterId, userId }) {
		return this.db.tx('link-character', async t => {
			const chara = await t.oneOrNone(
				'SELECT id, name FROM characters WHERE id = $1 AND user_id = $2',
				[+characterId, +userId]
			)
			if (!chara) {
				throw new Error('Character not found or does not belong to you')
			}

			const camp = await t.oneOrNone(
				'SELECT id, name FROM campaigns WHERE id = $1',
				[+campaignId]
			)
			if (!camp) {
				throw new Error('Campaign not found')
			}

			// Ensure user is member
			await t.none(
				`INSERT INTO campaign_members (campaign_id, user_id, role)
				 VALUES ($1, $2, 'player')
				 ON CONFLICT (campaign_id, user_id) DO NOTHING`,
				[+campaignId, +userId]
			)

			await t.none(
				'UPDATE characters SET campaign_id = $1, campaign_name = $2 WHERE id = $3',
				[+campaignId, camp.name, +characterId]
			)

			return { success: true }
		})
	}

	async unlinkCharacter({ campaignId, characterId, userId }) {
		await this.db.none(
			'UPDATE characters SET campaign_id = NULL, campaign_name = NULL WHERE id = $1 AND user_id = $2 AND campaign_id = $3',
			[+characterId, +userId, +campaignId]
		)
		return { success: true }
	}

	async delete(campaignId, userId) {
		return this.db.tx('delete-campaign', async t => {
			const camp = await t.oneOrNone(
				'SELECT id FROM campaigns WHERE id = $1 AND user_id = $2',
				[+campaignId, +userId]
			)
			if (!camp) {
				throw new Error('Campaign not found or you are not the DM')
			}

			await t.none('UPDATE characters SET campaign_id = NULL, campaign_name = NULL WHERE campaign_id = $1', [+campaignId])
			await t.none('DELETE FROM campaigns WHERE id = $1', [+campaignId])
			return { success: true }
		})
	}

	async getMessages({ campaignId, limit = 100, afterId = null }) {
		if (afterId) {
			return this.db.any(
				`SELECT * FROM campaign_messages
				 WHERE campaign_id = $1 AND id > $2
				 ORDER BY id ASC LIMIT $3`,
				[+campaignId, +afterId, +limit]
			)
		}
		return this.db.any(
			`SELECT * FROM campaign_messages
			 WHERE campaign_id = $1
			 ORDER BY id ASC LIMIT $2`,
			[+campaignId, +limit]
		)
	}

	async addMessage({ campaignId, userId, characterId = null, senderName, message, messageType = 'chat', rollData = null }) {
		return this.db.one(
			`INSERT INTO campaign_messages (campaign_id, user_id, character_id, sender_name, message, message_type, roll_data)
			 VALUES ($1, $2, $3, $4, $5, $6, $7)
			 RETURNING *`,
			[
				+campaignId,
				userId ? +userId : null,
				characterId ? +characterId : null,
				senderName,
				message || '',
				messageType,
				rollData ? JSON.stringify(rollData) : null
			]
		)
	}
}
