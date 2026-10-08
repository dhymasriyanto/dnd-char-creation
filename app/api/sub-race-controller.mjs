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

function formatSubRace(sr) {
	const traits = safeJson(sr.traits, [])
	const ability = safeJson(sr.ability_bonuses, null)
	const entries = safeJson(sr.entries, [])

	return {
		id: sr.id,
		raceId: sr.race_id,
		raceName: sr.parent_race_name,
		raceSource: sr.parent_race_source,
		name: sr.name,
		edition: sr.edition,
		source: sr.source,
		page: sr.page,
		ability: Array.isArray(ability) && ability.length > 0 ? ability : null,
		traitTags: Array.isArray(traits) ? traits : (traits ? [String(traits)] : []),
		entries: Array.isArray(entries) ? entries : []
	}
}

	export let subRace = {
	all: async (req, res, next) => {
		const edition = req.query.edition || '2024'

		try {
			let dbSubRaces = await db.compendium.getSubRaces({ edition })
			if ((!dbSubRaces || dbSubRaces.length === 0) && edition === '2024') {
				dbSubRaces = await db.compendium.getSubRaces({ edition: '2014' })
			}
			if (dbSubRaces && dbSubRaces.length > 0) {
				return response.ok('success', 'Retrieved all data', dbSubRaces.map(formatSubRace), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subrace query failed:', err.message)
		}

		return response.ok('success', 'Retrieved all data', [], res)
	},

	find: async (req, res, next) => {
		const raceName = req.params.raceName
		const raceSource = req.params.raceSource
		const name = req.params.name
		const source = req.params.source
		const page = req.params.page
		const edition = req.query.edition || '2024'

		try {
			const dbSubRaces = await db.compendium.getSubRacesByParent({ raceName, raceSource, edition })
			const filtered = (dbSubRaces || []).filter(sr => {
				const selfMatch = (!name || sr.name.toLowerCase() === name.toLowerCase()) &&
					(!source || sr.source.toLowerCase() === source.toLowerCase()) &&
					(!page || sr.page?.toString() === page)
				return selfMatch
			})
			if (filtered.length > 0) {
				return response.ok('success', 'Retrieved all data', filtered.map(formatSubRace), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subrace find failed:', err.message)
		}

		return response.ok('error', 'Not Found', [], res)
	},

	get: async (req, res, next) => {
		const raceName = req.params.raceName
		const raceSource = req.params.raceSource
		const edition = req.query.edition || '2024'

		try {
			const dbSubRaces = await db.compendium.getSubRacesByParent({ raceName, raceSource, edition })
			if (dbSubRaces && dbSubRaces.length > 0) {
				return response.ok('success', 'Retrieved all data', dbSubRaces.map(formatSubRace), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subrace get failed:', err.message)
		}

		return response.ok('error', 'Not Found', [], res)
	}
}
