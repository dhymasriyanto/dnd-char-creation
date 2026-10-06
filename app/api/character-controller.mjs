'use strict'

// const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {db} from '../../database/index.mjs'
import {response} from '../../helper/response.mjs'
import {computeVttSheet} from '../service/vtt-sheet.mjs'

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
		if (Array.isArray(datas.trait) && datas.trait.length > 0 && datas.race?.name) {
			const compRace = await db.oneOrNone(
				`SELECT entries, traits FROM compendium_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.race.name, edition]
			)
			if (compRace) {
				const raceEntries = safeEntries(compRace.entries)
				const raceEntriesMap = new Map()
				for (const item of raceEntries) {
					if (item && item.name) {
						raceEntriesMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
					}
				}
				for (const rt of datas.trait) {
					if (!rt.entries || rt.entries.length === 0) {
						rt.entries = raceEntriesMap.get(rt.name.toLowerCase()) || []
					}
				}
			}
		}

		// Subrace traits
		if (Array.isArray(datas.trait) && datas.sub_race?.name) {
			const compSubRace = await db.oneOrNone(
				`SELECT entries FROM compendium_sub_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.sub_race.name, edition]
			)
			if (compSubRace) {
				const srEntries = safeEntries(compSubRace.entries)
				const srMap = new Map()
				for (const item of srEntries) {
					if (item && item.name) {
						srMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
					}
				}
				for (const rt of datas.trait) {
					if (!rt.entries || rt.entries.length === 0) {
						const found = srMap.get(rt.name.toLowerCase())
						if (found) rt.entries = found
					}
				}
			}
		}
	} catch (e) {
		console.warn('Could not enrich features with compendium entries:', e.message)
	}
}

export let character = {
	all: (req, res, next) => {
		db.character.all()
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
		db.character.add(req.body)
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

	update: (req, res, next) => {
		db.character.update(req.body, req.params.id)
			.then(rows => {
				return response.ok(
					'success',
					'Data updated',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	delete: (req, res, next) => {
		db.character.delete(req.params.id)
			.then(rows => {
				return response.ok(
					'success',
					'Data deleted',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	findId: async (req, res, next) => {
		let datas = await db.character.findId(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.race = await db.character.findRace(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sub_race = await db.character.findSubRace(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.class = await db.character.findClass(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.class_feature = await db.character.findClassFeature(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sub_class = await db.character.findSubClass(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sub_class_feature = await db.character.findSubClassFeature(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.ability_score = await db.character.findAbilityScore(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.saving_throw = await db.character.findSavingThrow(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.skill_proficiency = await db.character.findSkillProficiency(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.skill_expertise = await db.character.findSkillExpertise(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sense = await db.character.findSense(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.feat = await db.character.findFeat(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.trait = await db.character.findTrait(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.feature = await db.character.findFeature(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.proficiency = await db.character.findProficiency(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.language = await db.character.findLanguage(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.treasure = await db.character.findTreasure(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.equipment = await db.character.findEquipment(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.spells = await db.character.findSpell(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return []
			})

		datas.encumbrance = await db.character.findEncumbrance(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		if (datas) {
			await enrichWithCompendiumEntries(datas)
			datas.vtt = computeVttSheet(datas)
		}

		return response.ok(
			'success',
			'Retrieved all data',
			datas,
			res
		)

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
