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

function formatSubClassResult(fullSubClass) {
	const cl = fullSubClass.class[0]
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
		entries: safeJson(cl.entries, [])
	}

	const seenCf = new Set()
	const formattedFeatures = []
	for (const cf of fullSubClass.classFeature || []) {
		const k = (cf.name || '').trim().toLowerCase()
		if (seenCf.has(k)) continue
		seenCf.add(k)
		formattedFeatures.push({
			id: cf.id,
			name: cf.name,
			level: Number(cf.level),
			source: cf.source,
			page: cf.page,
			className: cl.name,
			classSource: cl.source,
			entries: safeJson(cf.entries, [])
		})
	}

	const formattedSubclasses = (fullSubClass.subClass || []).map(sc => ({
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

	const seenScf = new Set()
	const formattedSubClassFeatures = []
	for (const scf of fullSubClass.subClassFeature || []) {
		const k = (scf.name || '').trim().toLowerCase()
		if (seenScf.has(k)) continue
		seenScf.add(k)
		formattedSubClassFeatures.push({
			id: scf.id,
			name: scf.name,
			level: Number(scf.level),
			source: scf.source,
			page: scf.page,
			className: cl.name,
			classSource: cl.source,
			subclassShortName: fullSubClass.subClass?.[0]?.short_name || '',
			subclassSource: fullSubClass.subClass?.[0]?.source || '',
			entries: safeJson(scf.entries, [])
		})
	}

	return {
		class: [formattedClass],
		classFeature: formattedFeatures,
		subClass: formattedSubclasses,
		subClassFeature: formattedSubClassFeatures
	}
}

export let subClass = {
	all: async (req, res, next) => {
		const className = req.params.className
		const classSource = req.params.classSource
		const edition = req.query.edition || '2024'

		try {
			const fullSubClass = await db.compendium.getFullSubClass({ className, classSource, edition })
			if (fullSubClass && fullSubClass.class.length > 0) {
				return response.ok('success', 'Retrieved all data', formatSubClassResult(fullSubClass), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subclass query failed:', err.message)
		}

		return response.notFound('error', 'Not Found', '', res)
	},

	find: async (req, res, next) => {
		const className = req.params.className
		const classSource = req.params.classSource
		const name = req.params.name
		const source = req.params.source
		const shortName = req.params.shortName
		const page = req.params.page
		const edition = req.query.edition || '2024'

		try {
			const fullSubClass = await db.compendium.getFullSubClass({
				className,
				classSource,
				name,
				source,
				shortName,
				page,
				edition
			})
			if (fullSubClass && fullSubClass.class.length > 0) {
				return response.ok('success', 'Retrieved all data', formatSubClassResult(fullSubClass), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium subclass find failed:', err.message)
		}

		return response.notFound('error', 'Not Found', '', res)
	}
}
