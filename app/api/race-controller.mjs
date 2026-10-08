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

function formatRace(r) {
	const traits = safeJson(r.traits, [])
	const ability = safeJson(r.ability_bonuses, null)
	const creatureTypes = safeJson(r.creature_types, ['humanoid'])
	const entries = safeJson(r.entries, [])

	let sizeArr = ['Medium']
	if (r.size) {
		const parsedSize = safeJson(r.size, r.size)
		sizeArr = Array.isArray(parsedSize) ? parsedSize : [String(parsedSize)]
	}

	return {
		id: r.id,
		name: r.name,
		edition: r.edition,
		source: r.source,
		page: r.page,
		size: sizeArr,
		speed: {
			walk: Number(r.speed || 30),
			fly: Number(r.fly_speed || 0),
			swim: Number(r.swim_speed || 0),
			climb: Number(r.climb_speed || 0)
		},
		darkvision: Number(r.darkvision || 0),
		creatureTypes: Array.isArray(creatureTypes) ? creatureTypes : ['humanoid'],
		ability: Array.isArray(ability) && ability.length > 0 ? ability : null,
		traitTags: Array.isArray(traits) ? traits : (traits ? [String(traits)] : []),
		entries: Array.isArray(entries) ? entries : []
	}
}

	export let race = {
		all: async (req, res, next) => {
			const edition = req.query.edition || '2024'

			try {
				// In 2024 mode, retrieve all races (2024 + 2014 compatible), letting frontend source toggles filter
				const dbRaces = await db.compendium.getRaces({ edition: edition === '2024' ? null : '2014' })
				if (dbRaces && dbRaces.length > 0) {
					return response.ok('success', 'Retrieved all data', dbRaces.map(formatRace), res)
				}
			} catch (err) {
				console.warn('[WARN] DB compendium race query failed:', err.message)
			}

			return response.ok('success', 'No races found', [], res)
		},

		find: async (req, res, next) => {
			const name = req.params.name
			const edition = req.query.edition || '2024'

			try {
				let dbRace = await db.compendium.getRaceByName(name, edition)
				if (!dbRace && edition === '2024') {
					dbRace = await db.compendium.getRaceByName(name, '2014')
				}
				if (dbRace) {
					return response.ok('success', 'Retrieved all data', [formatRace(dbRace)], res)
				}
			} catch (err) {
				console.warn('[WARN] DB compendium race find failed:', err.message)
			}

			return response.ok('success', 'Not Found', [], res)
		}
	}
