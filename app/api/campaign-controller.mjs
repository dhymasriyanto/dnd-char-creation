'use strict'

import { db } from '../../database/index.mjs'
import { response } from '../../helper/response.mjs'

export const campaignController = {
	list: async (req, res) => {
		try {
			const userId = req.user.id
			const campaigns = await db.campaign.listByUser(userId)
			return response.ok('success', 'Campaigns retrieved', campaigns, res)
		} catch (err) {
			console.error('Failed to list campaigns', err)
			return response.badRequest('error', err.message || 'Failed to list campaigns', null, res)
		}
	},

	create: async (req, res) => {
		try {
			const userId = req.user.id
			const dmName = req.user.username
			const { name, description } = req.body

			if (!name || !name.trim()) {
				return response.badRequest('error', 'Campaign name is required', null, res)
			}

			const campaign = await db.campaign.create({
				userId,
				dmName,
				name: name.trim(),
				description: description ? description.trim() : ''
			})

			return response.ok('success', 'Campaign created', campaign, res)
		} catch (err) {
			console.error('Failed to create campaign', err)
			return response.badRequest('error', err.message || 'Failed to create campaign', null, res)
		}
	},

	detail: async (req, res) => {
		try {
			const campaignId = +req.params.id
			const userId = req.user?.id
			const data = await db.campaign.findById(campaignId, userId)
			if (!data) {
				return response.notFound('error', 'Campaign not found', null, res)
			}
			return response.ok('success', 'Campaign details retrieved', data, res)
		} catch (err) {
			console.error('Failed to get campaign details', err)
			return response.badRequest('error', err.message || 'Failed to get campaign details', null, res)
		}
	},

	join: async (req, res) => {
		try {
			const userId = req.user.id
			const code = req.body.code || req.body.invite_code
			if (!code || !code.trim()) {
				return response.badRequest('error', 'Invite code is required', null, res)
			}

			const camp = await db.campaign.findByInviteCode(code.trim())
			if (!camp) {
				return response.notFound('error', 'Campaign with that invite code not found', null, res)
			}

			await db.campaign.join({ campaignId: camp.id, userId })
			const details = await db.campaign.findById(camp.id, userId)
			return response.ok('success', 'Joined campaign successfully', details, res)
		} catch (err) {
			console.error('Failed to join campaign', err)
			return response.badRequest('error', err.message || 'Failed to join campaign', null, res)
		}
	},

	leave: async (req, res) => {
		try {
			const userId = req.user.id
			const campaignId = +req.params.id
			await db.campaign.leave({ campaignId, userId })
			return response.ok('success', 'Left campaign successfully', null, res)
		} catch (err) {
			console.error('Failed to leave campaign', err)
			return response.badRequest('error', err.message || 'Failed to leave campaign', null, res)
		}
	},

	delete: async (req, res) => {
		try {
			const userId = req.user.id
			const campaignId = +req.params.id
			await db.campaign.delete(campaignId, userId)
			return response.ok('success', 'Campaign deleted successfully', null, res)
		} catch (err) {
			console.error('Failed to delete campaign', err)
			return response.badRequest('error', err.message || 'Failed to delete campaign', null, res)
		}
	},

	linkCharacter: async (req, res) => {
		try {
			const userId = req.user.id
			const campaignId = +req.params.id
			const characterId = +req.body.character_id

			if (!characterId) {
				return response.badRequest('error', 'Character ID is required', null, res)
			}

			await db.campaign.linkCharacter({ campaignId, characterId, userId })
			const details = await db.campaign.findById(campaignId, userId)
			return response.ok('success', 'Character linked to campaign', details, res)
		} catch (err) {
			console.error('Failed to link character', err)
			return response.badRequest('error', err.message || 'Failed to link character', null, res)
		}
	},

	unlinkCharacter: async (req, res) => {
		try {
			const userId = req.user.id
			const campaignId = +req.params.id
			const characterId = +req.body.character_id

			if (!characterId) {
				return response.badRequest('error', 'Character ID is required', null, res)
			}

			await db.campaign.unlinkCharacter({ campaignId, characterId, userId })
			const details = await db.campaign.findById(campaignId, userId)
			return response.ok('success', 'Character unlinked from campaign', details, res)
		} catch (err) {
			console.error('Failed to unlink character', err)
			return response.badRequest('error', err.message || 'Failed to unlink character', null, res)
		}
	},

	getMessages: async (req, res) => {
		try {
			const campaignId = +req.params.id
			const limit = req.query.limit ? Math.min(200, Math.max(1, +req.query.limit)) : 100
			const afterId = req.query.after_id ? +req.query.after_id : null
			const messages = await db.campaign.getMessages({ campaignId, limit, afterId })
			return response.ok('success', 'Messages retrieved', messages, res)
		} catch (err) {
			console.error('Failed to get campaign messages', err)
			return response.badRequest('error', err.message || 'Failed to get messages', null, res)
		}
	},

	sendMessage: async (req, res) => {
		try {
			const campaignId = +req.params.id
			const userId = req.user.id
			const { message, character_id } = req.body

			if (!message || !message.trim()) {
				return response.badRequest('error', 'Message text cannot be empty', null, res)
			}

			let senderName = req.user.username
			let charId = character_id ? +character_id : null

			if (charId) {
				const charRow = await db.oneOrNone('SELECT name FROM characters WHERE id = $1', [charId])
				if (charRow) {
					senderName = `${charRow.name} (${req.user.username})`
				}
			}

			const msg = await db.campaign.addMessage({
				campaignId,
				userId,
				characterId: charId,
				senderName,
				message: message.trim(),
				messageType: 'chat'
			})

			return response.ok('success', 'Message sent', msg, res)
		} catch (err) {
			console.error('Failed to send message', err)
			return response.badRequest('error', err.message || 'Failed to send message', null, res)
		}
	},

	sendRoll: async (req, res) => {
		try {
			const campaignId = +req.params.id
			const userId = req.user?.id
			const { roll_name, roll_data, character_id } = req.body

			let senderName = req.user?.username || 'Player'
			let charId = character_id ? +character_id : null

			if (charId) {
				const charRow = await db.oneOrNone('SELECT name FROM characters WHERE id = $1', [charId])
				if (charRow) {
					senderName = `${charRow.name} (${senderName})`
				}
			}

			const rollTitle = roll_name || 'Dice Roll'
			const summary = roll_data?.notation
				? `${rollTitle}: ${roll_data.notation} = ${roll_data.total}`
				: `${rollTitle} = ${roll_data?.total ?? ''}`

			const msg = await db.campaign.addMessage({
				campaignId,
				userId,
				characterId: charId,
				senderName,
				message: summary,
				messageType: 'roll',
				rollData: {
					title: rollTitle,
					...roll_data
				}
			})

			return response.ok('success', 'Roll logged', msg, res)
		} catch (err) {
			console.error('Failed to send roll', err)
			return response.badRequest('error', err.message || 'Failed to send roll', null, res)
		}
	}
}
