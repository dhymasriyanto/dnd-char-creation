'use strict'

import {response} from '../../helper/response.mjs'
import {db} from '../../database/index.mjs'

const safeJson = (val, fallback = []) => {
	if (val == null) return fallback
	if (typeof val === 'string') {
		try {
			const parsed = JSON.parse(val)
			if (typeof parsed === 'string') {
				try { return JSON.parse(parsed) } catch (e) { return parsed }
			}
			return parsed
		} catch (e) {
			return fallback
		}
	}
	return val
}

const STANDARD_MULTICLASS_REQ = {
	barbarian: { str: 13 },
	bard: { cha: 13 },
	cleric: { wis: 13 },
	druid: { wis: 13 },
	fighter: { or: [{ str: 13, dex: 13 }] },
	monk: { dex: 13, wis: 13 },
	paladin: { str: 13, cha: 13 },
	ranger: { dex: 13, wis: 13 },
	rogue: { dex: 13 },
	sorcerer: { cha: 13 },
	warlock: { cha: 13 },
	wizard: { int: 13 },
	artificer: { int: 13 }
}

function formatClassResult(fullClass) {
	const cl = fullClass.class[0]
	const hdFaces = parseInt((cl.hit_dice || 'd8').replace('d', ''), 10) || 8
	const formattedClass = {
		id: cl.id,
		name: cl.name,
		edition: cl.edition,
		source: cl.source,
		page: cl.page,
		hd: { number: 1, faces: hdFaces },
		proficiency: safeJson(cl.saving_throws, []),
		spellcastingAbility: cl.spellcasting_ability,
		subclassTitle: cl.subclass_title || 'Subclass',
		primaryAbility: cl.primary_ability,
		startingProficiencies: {
			armor: safeJson(cl.armor_proficiencies, []),
			weapons: safeJson(cl.weapon_proficiencies, []),
			tools: safeJson(cl.tool_proficiencies, []),
			skills: safeJson(cl.skill_choices, [])
		},
		startingEquipment: safeJson(cl.starting_equipment, cl.startingEquipment || null),
		multiclassing: cl.multiclassing ? safeJson(cl.multiclassing, null) : null,
		entries: safeJson(cl.entries, [])
	}

	const formattedFeatures = (fullClass.classFeature || []).map(cf => ({
		id: cf.id,
		name: cf.name,
		level: Number(cf.level),
		source: cf.source,
		page: cf.page,
		className: cl.name,
		classSource: cl.source,
		entries: safeJson(cf.entries, [])
	}))

	const formattedSubclasses = (fullClass.subclass || []).map(sc => ({
		id: sc.id,
		name: sc.name,
		shortName: sc.short_name || sc.name,
		source: sc.source,
		page: sc.page,
		className: cl.name,
		classSource: cl.source,
		spellcastingAbility: sc.spellcasting_ability,
		entries: safeJson(sc.entries, [])
	}))

	return {
		class: [formattedClass],
		classFeature: formattedFeatures,
		subclass: formattedSubclasses
	}
}

export let characterClass = {
	all: async (req, res, next) => {
		const edition = req.query.edition || '2024'
		const CORE_2024_CLASSES = ['barbarian', 'bard', 'cleric', 'druid', 'fighter', 'monk', 'paladin', 'ranger', 'rogue', 'sorcerer', 'warlock', 'wizard']

		try {
			const dbClasses = await db.compendium.getClasses({ edition })
			if (dbClasses && dbClasses.length > 0) {
				const map = {}
				for (const c of dbClasses) {
					const cKey = c.name.toLowerCase()
					if (edition === '2024' && !CORE_2024_CLASSES.includes(cKey)) continue
					if (edition === '2014' && (['mystic', 'sidekick'].includes(cKey) || cKey.includes('sidekick'))) continue
					map[cKey] = `class-${cKey}.json`
				}
				return response.ok('success', 'Retrieved all data', map, res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium class query failed:', err.message)
		}

		return response.ok('success', 'Retrieved all data', {}, res)
	},

	find: async (req, res, next) => {
		const value = req.params.value
		const edition = req.query.edition || '2024'

		try {
			const fullClass = await db.compendium.getFullClass(value, edition)
			if (fullClass && fullClass.class?.[0]) {
				const resObj = formatClassResult(fullClass)
				if (resObj.class[0]) {
					if (!resObj.class[0].multiclassing) {
						resObj.class[0].multiclassing = {}
					}
					if (!resObj.class[0].multiclassing.requirements) {
						resObj.class[0].multiclassing.requirements = STANDARD_MULTICLASS_REQ[value.toLowerCase()]
					}
				}
				return response.ok('success', 'Retrieved all data', resObj, res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium class find failed:', err.message)
		}

		return response.notFound('error', 'Not Found', '', res)
	}
}
