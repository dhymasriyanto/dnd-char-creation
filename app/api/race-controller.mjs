'use strict'

import {response} from '../../helper/response.mjs'
import {getData} from '../service/getData.mjs'
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
			const dbRaces = await db.compendium.getRaces({ edition })
			if (dbRaces && dbRaces.length > 0) {
				const filtered = edition === '2024'
					? dbRaces.filter(r => r.source === 'XPHB')
					: dbRaces.filter(r => r.source !== 'XPHB')
				return response.ok('success', 'Retrieved all data', filtered.map(formatRace), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium race query failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('races.json', edition)
		if (!datas || !datas.race) {
			return response.ok('success', 'No races found', [], res)
		}

		const races = edition === '2024'
			? datas.race.filter(r => r.source === 'XPHB')
			: datas.race.filter(r => r.edition !== 'one' && r.source !== 'XPHB')

		return response.ok('success', 'Retrieved all data', races, res)
	},

	find: async (req, res, next) => {
		const name = req.params.name
		const source = req.params.source
		const page = req.params.page
		const edition = req.query.edition || '2024'

		try {
			const dbRace = await db.compendium.getRaceByName(name, edition)
			if (dbRace) {
				return response.ok('success', 'Retrieved all data', [formatRace(dbRace)], res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium race query failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('races.json', edition)
		if (!datas || !datas.race) {
			return response.ok('success', 'Not Found', [], res)
		}

		const raceData = datas.race.filter((data) => {
			return data.name.toLowerCase() === name.toLowerCase() &&
				data.source.toLowerCase() === source.toLowerCase() &&
				data.page?.toString() === page
		})

		return response.ok('success', raceData.length > 0 ? 'Retrieved all data' : 'Not Found', raceData, res)
	}
}
