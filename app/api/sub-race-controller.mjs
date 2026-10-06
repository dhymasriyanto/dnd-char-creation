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
			const dbSubRaces = await db.compendium.getSubRaces({ edition })
			if (dbSubRaces && dbSubRaces.length > 0) {
				return response.ok('success', 'Retrieved all data', dbSubRaces.map(formatSubRace), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subrace query failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('races.json', edition)
		return response.ok(
			'success',
			'Retrieved all data',
			datas?.subrace || [],
			res
		)
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
			const filtered = dbSubRaces.filter(sr => {
				const selfMatch = (!name || sr.name.toLowerCase() === name.toLowerCase()) &&
					(!source || sr.source.toLowerCase() === source.toLowerCase()) &&
					(!page || sr.page?.toString() === page)
				return selfMatch
			})
			if (filtered.length > 0) {
				return response.ok('success', 'Retrieved all data', filtered.map(formatSubRace), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subrace find failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('races.json', edition)
		if (!datas || !datas.subrace) {
			return response.ok('error', 'Not Found', [], res)
		}

		const matchSource = (s1, s2) => {
			if (!s1 || !s2) return true
			const a = s1.toLowerCase()
			const b = s2.toLowerCase()
			if (a === b) return true
			if ((a === 'xphb' && b === 'phb') || (a === 'phb' && b === 'xphb')) return true
			return false
		}

		const subRaceData = datas.subrace.filter((data) => {
			const pName = data.raceName || data._copy?.raceName
			const pSource = data.raceSource || data._copy?.raceSource
			const parentMatch = pName?.toLowerCase() === raceName.toLowerCase() && matchSource(pSource, raceSource)
			const selfMatch = (!name || data.name?.toLowerCase() === name.toLowerCase()) &&
				(!source || data.source?.toLowerCase() === source.toLowerCase()) &&
				(!page || data.page?.toString() === page)
			return parentMatch && selfMatch
		})

		return response.ok(
			'success',
			subRaceData.length > 0 ? 'Retrieved all data' : 'Not Found',
			subRaceData,
			res
		)
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
			console.warn('[WARN] DB compendium subrace get failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('races.json', edition)
		if (!datas || !datas.subrace) {
			return response.ok('error', 'Not Found', [], res)
		}

		const matchSource = (s1, s2) => {
			if (!s1 || !s2) return true
			const a = s1.toLowerCase()
			const b = s2.toLowerCase()
			if (a === b) return true
			if ((a === 'xphb' && b === 'phb') || (a === 'phb' && b === 'xphb')) return true
			return false
		}

		const subRaceData = datas.subrace.filter((data) => {
			const pName = data.raceName || data._copy?.raceName
			const pSource = data.raceSource || data._copy?.raceSource
			const parentMatch = pName?.toLowerCase() === raceName.toLowerCase() && matchSource(pSource, raceSource)
			return parentMatch && data.name
		})

		return response.ok(
			'success',
			subRaceData.length > 0 ? 'Retrieved all data' : 'Not Found',
			subRaceData,
			res
		)
	}
}
