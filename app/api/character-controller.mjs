'use strict'

// const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {db} from '../../database/index.mjs'
import {response} from '../../helper/response.mjs'
import {computeVttSheet} from '../service/vtt-sheet.mjs'
import {buildAvraeData} from '../service/avrae-export.mjs'

import {safeEntries, enrichWithCompendiumEntries} from '../service/character-enricher.mjs'

export async function loadFullCharacter(characterId) {
	let datas = await db.character.findId(characterId)
		.then(rows => rows ? rows[0] : null)
		.catch(() => null)

	if (!datas) return null
	const realId = datas.id

	datas.race = await db.character.findRace(realId)
		.then(rows => rows ? rows[0] : null)
		.catch(() => null)

	datas.sub_race = await db.character.findSubRace(realId)
		.then(rows => rows ? rows[0] : null)
		.catch(() => null)

	datas.class = await db.character.findClass(realId)
		.catch(() => [])

	datas.class_feature = await db.character.findClassFeature(realId)
		.catch(() => [])

	datas.sub_class = await db.character.findSubClass(realId)
		.catch(() => [])

	datas.sub_class_feature = await db.character.findSubClassFeature(realId)
		.catch(() => [])

	// Ensure subclass features are populated if character has subclass(es)
	if (Array.isArray(datas.sub_class) && datas.sub_class.length > 0) {
		const existingNames = new Set((datas.sub_class_feature || []).map(f => (f.name || '').trim().toLowerCase()))
		for (const sc of datas.sub_class) {
			const parentClass = (datas.class || []).find(c => c.id === sc.class_id) || (datas.class || [])[0]
			const cLvl = parentClass?.level || datas.level || 1
			const parentClassName = (parentClass?.name || '').trim()
			const compScf = await db.any(
				`SELECT DISTINCT ON (LOWER(scf.name)) scf.name, scf.source, scf.page, scf.level, scf.entries
				 FROM compendium_sub_class_features scf
				 JOIN compendium_sub_classes csc ON csc.id = scf.sub_class_id
				 JOIN compendium_classes cc ON cc.id = csc.class_id
				 WHERE (
					LOWER(csc.name) = LOWER($1)
					OR LOWER(csc.short_name) = LOWER($1)
					OR ($4 != '' AND (LOWER(csc.name) = LOWER($4) OR LOWER(csc.short_name) = LOWER($4)))
				 ) AND ($5 = '' OR LOWER(cc.name) = LOWER($5))
				   AND scf.level <= $2
				 ORDER BY LOWER(scf.name), CASE WHEN scf.edition = $3 THEN 0 ELSE 1 END, scf.level ASC`,
				[sc.name, cLvl, datas.edition || '2024', sc.short_name || sc.shortName || '', parentClassName]
			).catch(() => [])

			for (const sf of compScf) {
				const k = (sf.name || '').trim().toLowerCase()
				if (!k || existingNames.has(k)) continue
				existingNames.add(k)
				const newRow = await db.oneOrNone(
					`INSERT INTO character_sub_class_features (character_id, sub_class_id, name, source, page, level)
					 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
					[realId, sc.id, sf.name, sf.source || null, sf.page ? String(sf.page) : null, sf.level || 1]
				).catch(() => null)
				datas.sub_class_feature.push(newRow ? { ...newRow, entries: safeEntries(sf.entries) } : {
					character_id: realId,
					sub_class_id: sc.id,
					name: sf.name,
					source: sf.source,
					page: sf.page,
					level: sf.level,
					entries: safeEntries(sf.entries)
				})
			}
		}
	}

	datas.ability_score = await db.character.findAbilityScore(realId)
		.then(rows => rows ? rows[0] : {})
		.catch(() => ({}))

	datas.saving_throw = await db.character.findSavingThrow(realId)
		.then(rows => rows ? rows[0] : {})
		.catch(() => ({}))

	datas.skill_proficiency = await db.character.findSkillProficiency(realId)
		.then(rows => rows ? rows[0] : {})
		.catch(() => ({}))

	datas.skill_expertise = await db.character.findSkillExpertise(realId)
		.then(rows => rows ? rows[0] : {})
		.catch(() => ({}))

	datas.sense = await db.character.findSense(realId)
		.catch(() => [])

	datas.feat = await db.character.findFeat(realId)
		.catch(() => [])

	datas.trait = await db.character.findTrait(realId)
		.catch(() => [])

	datas.feature = await db.character.findFeature(realId)
		.catch(() => [])

	datas.proficiency = await db.character.findProficiency(realId)
		.catch(() => [])

	datas.language = await db.character.findLanguage(realId)
		.catch(() => [])

	datas.treasure = await db.character.findTreasure(realId)
		.then(rows => rows ? rows[0] : {})
		.catch(() => ({}))

	datas.equipment = await db.character.findEquipment(realId)
		.catch(() => [])

	datas.spells = await db.character.findSpell(realId)
		.then(rows => {
			return (rows || []).map(r => ({
				...r,
				sourceFeat: r.source_feat || r.sourceFeat || null,
				is_feat_spell: Boolean(r.is_feat_spell || r.source_feat || r.sourceFeat)
			}))
		})
		.catch(() => [])

	datas.encumbrance = await db.character.findEncumbrance(realId)
		.then(rows => rows ? rows[0] : {})
		.catch(() => ({}))

	await enrichWithCompendiumEntries(datas)
	datas.vtt = computeVttSheet(datas)

	return datas
}

export let character = {
	all: (req, res, next) => {
		const userId = req.user?.id
		if (!userId) {
			return response.notAuthenticated('error', 'Authentication required', null, res)
		}
		db.character.all(userId)
			.then(rows => {
				return response.ok(
					'success',
					'Retrieved all data',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	add: (req, res, next) => {
		const userId = req.user?.id
		if (!userId) {
			return response.notAuthenticated('error', 'Authentication required', null, res)
		}
		db.character.add(req.body, userId)
			.then(rows => {
				return response.ok(
					'success',
					'Data inserted',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	update: async (req, res, next) => {
		try {
			const target = await db.character.findId(req.params.id).then(r => r?.[0]).catch(() => null)
			if (!target) {
				return res.status(404).json({ status: 'error', message: 'Character not found' })
			}
			const userId = req.user?.id
			if (target.user_id && (!userId || String(userId) !== String(target.user_id))) {
				return response.notAuthenticated('error', 'You do not have permission to edit this character', null, res)
			}
			const rows = await db.character.update(req.body, target.id)
			return response.ok('success', 'Data updated', rows, res)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	delete: async (req, res, next) => {
		try {
			const target = await db.character.findId(req.params.id).then(r => r?.[0]).catch(() => null)
			if (!target) {
				return res.status(404).json({ status: 'error', message: 'Character not found' })
			}
			const userId = req.user?.id
			if (target.user_id && (!userId || String(userId) !== String(target.user_id))) {
				return response.notAuthenticated('error', 'You do not have permission to delete this character', null, res)
			}
			const rows = await db.character.delete(target.id)
			return response.ok('success', 'Data deleted', rows, res)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	findId: async (req, res, next) => {
		try {
			const datas = await loadFullCharacter(req.params.id)
			if (!datas) {
				return res.status(404).json({
					status: 'error',
					message: 'Character not found',
					data: null
				})
			}
			const isOwner = req.user && String(req.user.id) === String(datas.user_id)
			const isNumeric = /^\d+$/.test(String(req.params.id).trim())
			if (isNumeric && datas.user_id && !isOwner && datas.is_public === false) {
				return res.status(404).json({
					status: 'error',
					message: 'Character not found. Access via unique character ID is required.',
					data: null
				})
			}
			if (datas.is_public === false && !isOwner) {
				return res.status(403).json({
					status: 'error',
					message: 'This character is private',
					data: null
				})
			}
			return response.ok(
				'success',
				'Retrieved all data',
				datas,
				res
			)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	exportAvrae: async (req, res, next) => {
		try {
			const datas = await loadFullCharacter(req.params.id)
			if (!datas) {
				return res.status(404).json({
					status: 'error',
					message: 'Character not found'
				})
			}
			const isOwner = req.user && String(req.user.id) === String(datas.user_id)
			const isNumeric = /^\d+$/.test(String(req.params.id).trim())
			if (isNumeric && datas.user_id && !isOwner && datas.is_public === false) {
				return res.status(404).json({
					status: 'error',
					message: 'Character not found. Access via unique character ID is required.'
				})
			}
			if (datas.is_public === false && !isOwner) {
				return res.status(403).json({
					status: 'error',
					message: 'This character is private'
				})
			}
			const host = req.get('host') || 'localhost'
			const origin = `${req.protocol}://${host}`
			const avraeData = buildAvraeData(datas, origin)
			return res.json(avraeData)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	find: (req, res, next) => {
		db.character.find(req.params.value)
			.then(rows => {
				return response.ok(
					'success',
					'Retrieved similar data',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	uploadImage: (req, res, next) => {
		if (!req.file) {
			return next(response.badRequest(new Error('No image file provided')))
		}
		const relativeUrl = `/uploads/characters/${req.file.filename}`
		return response.ok(
			'success',
			'Image uploaded successfully',
			{ url: relativeUrl, filename: req.file.filename },
			res
		)
	},

	// about: (req, res) => {
	// 	let aboutInfo = {
	// 		name: properties.name,
	// 		version: properties.version,
	// 	}
	// 	res.json({
	// 		status: 'success',
	// 		data: aboutInfo,
	// 		message: 'Retrieved about info of the character'
	// 	})
	// },
}
