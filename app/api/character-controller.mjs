'use strict'

// const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {db} from '../../database/index.mjs'
import {response} from '../../helper/response.mjs'
import {computeVttSheet} from '../service/vtt-sheet.mjs'
import {buildAvraeData} from '../service/avrae-export.mjs'

function safeEntries(val) {
	if (!val) return []
	if (Array.isArray(val)) return val
	if (typeof val === 'string') {
		try {
			let parsed = JSON.parse(val)
			while (typeof parsed === 'string') {
				try {
					parsed = JSON.parse(parsed)
				} catch {
					break
				}
			}
			return Array.isArray(parsed) ? parsed : [parsed]
		} catch {
			return [val]
		}
	}
	return [val]
}

async function enrichWithCompendiumEntries(datas) {
	if (!datas) return
	const edition = datas.edition || '2024'

	try {
		// Class features
		if (Array.isArray(datas.class_feature) && datas.class_feature.length > 0) {
			const names = datas.class_feature.map(f => f.name.toLowerCase())
			const compRows = await db.any(
				`SELECT name, entries FROM compendium_class_features 
				 WHERE LOWER(name) = ANY($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
				[names, edition]
			)
			const cMap = new Map()
			for (const r of compRows) {
				const k = r.name.toLowerCase()
				if (!cMap.has(k)) {
					cMap.set(k, safeEntries(r.entries))
				}
			}
			for (const cf of datas.class_feature) {
				if (!cf.entries || cf.entries.length === 0) {
					cf.entries = cMap.get(cf.name.toLowerCase()) || []
				}
			}
		}

		// Subclass features
		if (Array.isArray(datas.sub_class_feature) && datas.sub_class_feature.length > 0) {
			const names = datas.sub_class_feature.map(f => f.name.toLowerCase())
			const compRows = await db.any(
				`SELECT name, entries FROM compendium_sub_class_features 
				 WHERE LOWER(name) = ANY($1)
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
				[names, edition]
			)
			const scMap = new Map()
			for (const r of compRows) {
				const k = r.name.toLowerCase()
				if (!scMap.has(k)) {
					scMap.set(k, safeEntries(r.entries))
				}
			}
			for (const scf of datas.sub_class_feature) {
				if (!scf.entries || scf.entries.length === 0) {
					scf.entries = scMap.get(scf.name.toLowerCase()) || []
				}
			}
		}

		// Feats
		if (Array.isArray(datas.feat) && datas.feat.length > 0) {
			const rawNames = datas.feat.map(f => (f.name || '').trim().toLowerCase())
			const baseNames = datas.feat.map(f => (f.name || '').split(/[-;(]/)[0].trim().toLowerCase()).filter(Boolean)
			const allLookup = [...new Set([...rawNames, ...baseNames])]
			const compRows = await db.any(
				`SELECT name, entries FROM compendium_feats 
				 WHERE LOWER(name) = ANY($1)
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
				[allLookup, edition]
			)
			const fMap = new Map()
			for (const r of compRows) {
				const k = r.name.toLowerCase()
				if (!fMap.has(k)) {
					fMap.set(k, safeEntries(r.entries))
				}
			}
			for (const ft of datas.feat) {
				if (!ft.entries || ft.entries.length === 0) {
					const exact = (ft.name || '').toLowerCase()
					const base = (ft.name || '').split(/[-;(]/)[0].trim().toLowerCase()
					ft.entries = fMap.get(exact) || fMap.get(base) || []
				}
			}
		}

		// Background features
		if (Array.isArray(datas.feature) && datas.feature.length > 0 && datas.background) {
			const compBg = await db.oneOrNone(
				`SELECT entries FROM compendium_backgrounds 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.background, edition]
			)
			if (compBg) {
				const bgEntries = safeEntries(compBg.entries)
				const bgEntriesMap = new Map()
				for (const item of bgEntries) {
					if (item && item.name) {
						bgEntriesMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
						bgEntriesMap.set(item.name.toLowerCase().replace(/^feature:\s*/i, ''), safeEntries(item.entries || [item]))
					}
				}
				for (const bf of datas.feature) {
					if (!bf.entries || bf.entries.length === 0) {
						bf.entries = bgEntriesMap.get(bf.name.toLowerCase()) || bgEntries
					}
				}
			}
		}

		// Racial traits
		if (datas.race?.name) {
			const compRace = await db.oneOrNone(
				`SELECT entries, traits, speed, fly_speed, swim_speed, climb_speed FROM compendium_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.race.name, edition]
			)
			if (compRace) {
				if (compRace.fly_speed) datas.race.fly_speed = Number(compRace.fly_speed)
				if (compRace.swim_speed) datas.race.swim_speed = Number(compRace.swim_speed)
				if (compRace.climb_speed) datas.race.climb_speed = Number(compRace.climb_speed)
				if (compRace.speed && !datas.speed) datas.race.speed = Number(compRace.speed)
				datas.compendium_race_entries = safeEntries(compRace.entries)
				const raceEntries = datas.compendium_race_entries
				const raceEntriesMap = new Map()
				for (const item of raceEntries) {
					if (item && item.name) {
						raceEntriesMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
					}
				}
				if (!Array.isArray(datas.trait)) datas.trait = []
				if (datas.trait.length > 0) {
					for (const rt of datas.trait) {
						if (!rt.entries || rt.entries.length === 0) {
							rt.entries = raceEntriesMap.get(rt.name.toLowerCase()) || []
						}
					}
				} else {
					const fluff = ['age', 'size', 'alignment', 'speed', 'languages', 'language']
					for (const item of raceEntries) {
						if (item && item.name && !fluff.includes(item.name.toLowerCase())) {
							datas.trait.push({
								name: item.name,
								entries: safeEntries(item.entries || [item])
							})
						}
					}
				}
			}
		}

		// Subrace traits
		if (datas.sub_race?.name) {
			const compSubRace = await db.oneOrNone(
				`SELECT entries FROM compendium_sub_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.sub_race.name, edition]
			)
			if (compSubRace) {
				datas.compendium_sub_race_entries = safeEntries(compSubRace.entries)
				const srEntries = datas.compendium_sub_race_entries
				const srMap = new Map()
				for (const item of srEntries) {
					if (item && item.name) {
						srMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
					}
				}
				if (!Array.isArray(datas.trait)) datas.trait = []
				for (const rt of datas.trait) {
					if (!rt.entries || rt.entries.length === 0) {
						const found = srMap.get(rt.name.toLowerCase())
						if (found) rt.entries = found
					}
				}
				for (const item of srEntries) {
					if (item && item.name && !datas.trait.some(t => (t.name || '').toLowerCase() === item.name.toLowerCase())) {
						datas.trait.push({
							name: item.name,
							entries: safeEntries(item.entries || [item])
						})
					}
				}
			}
		}

		// Classes (enrich spellcasting_ability, hit_dice, saving_throws from compendium)
		const classList = Array.isArray(datas.class) ? datas.class : (datas.class ? [datas.class] : [])
		if (classList.length > 0) {
			const classNames = classList.map(c => (c.name || '').toLowerCase()).filter(Boolean)
			if (classNames.length > 0) {
				const compClasses = await db.any(
					`SELECT name, spellcasting_ability, hit_dice, saving_throws FROM compendium_classes 
					 WHERE LOWER(name) = ANY($1) 
					 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
					[classNames, edition]
				)
				const ccMap = new Map()
				for (const cc of compClasses) {
					if (!ccMap.has(cc.name.toLowerCase())) {
						ccMap.set(cc.name.toLowerCase(), cc)
					}
				}
				for (const c of classList) {
					const found = ccMap.get((c.name || '').toLowerCase())
					if (found) {
						if (!c.spellcasting_ability) c.spellcasting_ability = found.spellcasting_ability
						if (!c.hit_dice) c.hit_dice = found.hit_dice
						if (!c.saving_throws) c.saving_throws = found.saving_throws
					}
				}
			}
		}

		// Equipment (enrich base_ac, item_type, ac_dex_bonus from compendium)
		const eqList = Array.isArray(datas.equipment) ? datas.equipment : []
		if (eqList.length > 0) {
			const eqNames = eqList.map(e => (e.name || '').toLowerCase()).filter(Boolean)
			if (eqNames.length > 0) {
				const compItems = await db.any(
					`SELECT name, item_type, base_ac, ac_dex_bonus, equip_type, container_capacity FROM compendium_items 
					 WHERE LOWER(name) = ANY($1) 
					 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
					[eqNames, edition]
				)
				const itMap = new Map()
				for (const it of compItems) {
					if (!itMap.has(it.name.toLowerCase())) {
						itMap.set(it.name.toLowerCase(), it)
					}
				}
				for (const eq of eqList) {
					const found = itMap.get((eq.name || '').toLowerCase())
					if (found) {
						if (eq.base_ac == null && found.base_ac != null) eq.base_ac = Number(found.base_ac)
						if (!eq.item_type && found.item_type) eq.item_type = found.item_type
						if (eq.ac_dex_bonus == null && found.ac_dex_bonus != null) eq.ac_dex_bonus = found.ac_dex_bonus
						if (!eq.equip_type && found.equip_type) eq.equip_type = found.equip_type
						if (eq.container_capacity == null && found.container_capacity != null) eq.container_capacity = Number(found.container_capacity)
					}
				}
			}
		}
	} catch (e) {
		console.warn('Could not enrich features with compendium entries:', e.message)
	}
}

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
