'use strict'

import { response } from '../../helper/response.mjs'
import { db } from '../../database/index.mjs'
import {
	safeJson,
	normalizeCompendiumName,
	formatBackground,
	formatFeat,
	formatOptionalFeature,
	formatRule,
	formatRace,
	formatClass,
	buildClassProgression,
	formatMonster,
	formatSpell,
	formatItem,
	formatLookupItem,
	flattenEntries
} from '../service/compendium-formatter.mjs'

export const compendium = {
	backgrounds: async (req, res) => {
		const edition = req.query.edition || '2024'
		const search = req.query.search || null
		const source = req.query.source ? req.query.source.toUpperCase().trim() : null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : null
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const bgs = await db.compendium.getBackgrounds({ edition, search, source, sources, limit, offset })
			return response.ok('success', 'Retrieved backgrounds', (bgs || []).map(formatBackground), res)
		} catch (err) {
			console.warn('[WARN] DB compendium backgrounds query failed:', err.message)
			return response.ok('success', 'Retrieved backgrounds', [], res)
		}
	},

	feats: async (req, res) => {
		const edition = req.query.edition || '2024'
		const category = req.query.category || null
		const search = req.query.search || null
		const source = req.query.source || null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : null
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const feats = await db.compendium.getFeats({ edition, category, search, source, sources, limit, offset })
			return response.ok('success', 'Retrieved feats', (feats || []).map(formatFeat), res)
		} catch (err) {
			console.warn('[WARN] DB compendium feats query failed:', err.message)
			return response.ok('success', 'Retrieved feats', [], res)
		}
	},

	spells: async (req, res) => {
		const edition = req.query.edition || '2024'
		const levelRaw = req.query.level != null ? String(req.query.level).trim() : null
		const maxLevel = req.query.maxLevel != null ? parseInt(req.query.maxLevel, 10) : null
		const schoolRaw = req.query.school || null
		const search = req.query.search || null
		const source = req.query.source || null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : null
		const offset = req.query.offset ? Number(req.query.offset) : 0
		let className = req.query.className || req.query.class || null

		// Subclasses using wizard list
		if (className && (className.toLowerCase().includes('eldritch knight') || className.toLowerCase().includes('arcane trickster'))) {
			className = 'Wizard'
		}

		const level = (levelRaw != null && !isNaN(parseInt(levelRaw, 10)) && !levelRaw.includes(';') && !levelRaw.includes(',') && levelRaw !== '!0')
			? parseInt(levelRaw, 10)
			: null

		try {
			const spells = await db.compendium.getSpells({ edition, level, maxLevel, school: schoolRaw, className, search, source, sources, limit, offset })
			let result = spells || []
			if (levelRaw === '!0') {
				result = result.filter(s => s.level !== 0)
			} else if (levelRaw != null && (levelRaw.includes(';') || levelRaw.includes(','))) {
				const allowedLevels = levelRaw.split(/[;,]/).map(l => parseInt(l.trim(), 10)).filter(n => !isNaN(n))
				if (allowedLevels.length > 0) {
					result = result.filter(s => allowedLevels.includes(s.level))
				}
			}
			const damage = (req.query.damage || '').toLowerCase().trim()
			if (damage) {
				result = result.filter(s => {
					const dt = (s.damage_type || '').toLowerCase()
					return dt.includes(damage)
				})
			}
			return response.ok('success', 'Retrieved spells', result.map(formatSpell), res)
		} catch (err) {
			console.warn('[WARN] DB compendium spells query failed:', err.message)
			return response.ok('success', 'Retrieved spells', [], res)
		}
	},

	optionalfeatures: async (req, res) => {
		const edition = req.query.edition || '2024'
		const featureTypeRaw = (req.query['feature type'] || req.query.featureType || '').toUpperCase().trim()
		const search = (req.query.search || '').toLowerCase().trim()
		const source = req.query.source || null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : 300
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const ofs = await db.compendium.getOptionalFeatures({ edition, featureType: featureTypeRaw, search, source, sources, limit, offset })
			return response.ok('success', 'Retrieved optional features', (ofs || []).map(formatOptionalFeature), res)
		} catch (err) {
			console.warn('[WARN] DB compendium optional features query failed:', err.message)
			return response.ok('success', 'Retrieved optional features', [], res)
		}
	},

	monsters: async (req, res) => {
		const edition = req.query.edition || '2024'
		const cr = req.query.cr || null
		const type = req.query.type || null
		const search = req.query.search || null
		const source = req.query.source || null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : 80
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const monsters = await db.compendium.getMonsters({ edition, cr, type, search, source, sources, limit, offset })
			if (monsters && monsters.length > 0) {
				return response.ok('success', 'Retrieved monsters', monsters.map(formatMonster), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium monsters query failed:', err.message)
		}

		return response.ok('success', 'Retrieved monsters', [], res)
	},

	items: async (req, res) => {
		const edition = req.query.edition || '2024'
		const itemType = req.query.type || req.query.itemType || null
		const category = req.query.category || null
		const mastery = req.query.mastery || null
		const search = req.query.search || null
		const source = req.query.source || null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : 80
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const items = await db.compendium.getItems({ edition, itemType, mastery, search, source, sources, limit, offset })
			return response.ok('success', 'Retrieved items', (items || []).map(formatItem), res)
		} catch (err) {
			console.warn('[WARN] DB compendium items query failed:', err.message)
			return response.ok('success', 'Retrieved items', [], res)
		}
	},

	rules: async (req, res) => {
		const edition = req.query.edition || '2024'
		const search = req.query.search ? req.query.search.toLowerCase().trim() : null
		const catRaw = req.query.category ? req.query.category.toLowerCase().trim() : null
		const source = req.query.source ? req.query.source.toUpperCase().trim() : null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : 400
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			let rules = []
			if (catRaw && catRaw !== 'all') {
				let sqlQ = 'SELECT * FROM compendium_rules WHERE edition = $1 '
				const params = [edition]
				if (catRaw === 'rule' || catRaw === 'variantrule') {
					sqlQ += 'AND (LOWER(type) = $2 OR LOWER(category) LIKE $3) '
					params.push('rule', '%rule%')
				} else if (catRaw === 'condition' || catRaw === 'status') {
					sqlQ += 'AND (LOWER(type) = $2 OR LOWER(type) = $3) '
					params.push('condition', 'status')
				} else if (catRaw === 'hazard' || catRaw === 'trap') {
					sqlQ += 'AND (LOWER(type) = $2 OR LOWER(type) = $3) '
					params.push('hazard', 'trap')
				} else if (catRaw === 'vehicle' || catRaw === 'ship') {
					sqlQ += 'AND (LOWER(type) = $2 OR LOWER(category) IN ($3, $4, $5, $6, $7, $8, $9)) '
					params.push('vehicle', 'ship', 'air', 'spelljammer', 'elemental_airship', 'infwar', 'object', 'creature')
				} else {
					sqlQ += 'AND (LOWER(type) = $2 OR LOWER(category) = $2) '
					params.push(catRaw)
				}
				if (sources && sources.length) {
					params.push(sources)
					sqlQ += `AND UPPER(source) = ANY($${params.length}) `
				} else if (source) {
					params.push(source)
					sqlQ += `AND UPPER(source) = $${params.length} `
				}

				if (search) {
					params.push(`%${search}%`)
					sqlQ += `AND LOWER(name) LIKE $${params.length} `
				}
				sqlQ += `ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
				params.push(limit, offset)
				rules = await db.any(sqlQ, params)
			} else {
				rules = await db.compendium.getRules({ edition, search, source, sources, limit, offset })
			}
			return response.ok('success', 'Retrieved rules and glossary', (rules || []).map(formatRule), res)
		} catch (err) {
			console.warn('[WARN] DB compendium rules query failed:', err.message)
			return response.ok('success', 'Retrieved rules and glossary', [], res)
		}
	},

	races: async (req, res) => {
		const edition = req.query.edition || '2024'
		const search = req.query.search ? req.query.search.toLowerCase().trim() : null
		const source = req.query.source ? req.query.source.toUpperCase().trim() : null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : 200
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			let sqlQ = 'SELECT * FROM compendium_races WHERE edition = $1 '
			const params = [edition]
			if (sources && sources.length) {
				params.push(sources)
				sqlQ += `AND UPPER(source) = ANY($${params.length}) `
			} else if (source) {
				params.push(source)
				sqlQ += `AND UPPER(source) = $${params.length} `
			}
			if (search) {
				params.push(`%${search}%`)
				sqlQ += `AND LOWER(name) LIKE $${params.length} `
			}
			sqlQ += `ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
			params.push(limit, offset)
			const races = await db.any(sqlQ, params)

			const formatted = []
			for (const r of races) {
				let srSql = 'SELECT * FROM compendium_sub_races WHERE race_id = $1 AND edition = $2 '
				const srParams = [r.id, edition]
				if (sources && sources.length) {
					srParams.push(sources)
					srSql += `AND UPPER(source) = ANY($${srParams.length}) `
				}
				srSql += 'ORDER BY name ASC'
				const subraces = await db.any(srSql, srParams)
				formatted.push(formatRace(r, subraces))
			}
			return response.ok('success', 'Retrieved races', formatted, res)
		} catch (err) {
			console.warn('[WARN] DB compendium races query failed:', err.message)
			return response.ok('success', 'Retrieved races', [], res)
		}
	},

	classes: async (req, res) => {
		const edition = req.query.edition || '2024'
		const search = req.query.search ? req.query.search.toLowerCase().trim() : null
		const source = req.query.source ? req.query.source.toUpperCase().trim() : null
		const sources = req.query.sources ? req.query.sources.split(',').map(s => s.trim().toUpperCase()).filter(Boolean) : (source ? [source] : null)
		const limit = req.query.limit ? Number(req.query.limit) : 100
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			let sqlQ = 'SELECT * FROM compendium_classes WHERE edition = $1 '
			const params = [edition]
			if (sources && sources.length) {
				params.push(sources)
				sqlQ += `AND UPPER(source) = ANY($${params.length}) `
			} else if (source) {
				params.push(source)
				sqlQ += `AND UPPER(source) = $${params.length} `
			}
			if (search) {
				params.push(`%${search}%`)
				sqlQ += `AND LOWER(name) LIKE $${params.length} `
			}
			sqlQ += `ORDER BY name ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`
			params.push(limit, offset)
			const classes = await db.any(sqlQ, params)

			const formatted = []
			for (const cl of classes) {
				let scSql = 'SELECT * FROM compendium_sub_classes WHERE class_id = $1 AND edition = $2 '
				const scParams = [cl.id, edition]
				if (sources && sources.length) {
					scParams.push(sources)
					scSql += `AND UPPER(source) = ANY($${scParams.length}) `
				}
				scSql += 'ORDER BY name ASC'
				const subclasses = await db.any(scSql, scParams)
				formatted.push(formatClass(cl, subclasses))
			}
			return response.ok('success', 'Retrieved classes', formatted, res)
		} catch (err) {
			console.warn('[WARN] DB compendium classes query failed:', err.message)
			return response.ok('success', 'Retrieved classes', [], res)
		}
	},

	lookup: async (req, res) => {
		const type = (req.query.type || '').toLowerCase().trim()
		const name = (req.query.name || '').trim()
		let edition = req.query.edition || '2024'
		const source = (req.query.source || '').toUpperCase().trim()

		const sources2014 = ['PHB', 'DMG', 'MM', 'XGE', 'TCE', 'VGM', 'MTF', 'MPMM', 'SCAG', 'EGW', 'FTD', 'ERLW']
		const sources2024 = ['XPHB', 'XDMG']
		if (sources2014.includes(source)) {
			edition = '2014'
		} else if (sources2024.includes(source)) {
			edition = '2024'
		}
		const defaultSource = edition === '2024' ? 'XPHB' : 'PHB'

		if (!name) {
			return response.badRequest('error', 'Name parameter is required', null, res)
		}

		// 0a. Class Feature & Subclass Feature Lookup
		if (type === 'classfeature' || type === 'subclassfeature') {
			try {
				let feature = null
				if (type === 'classfeature') {
					feature = await db.oneOrNone(
						`SELECT cf.*, c.name as class_name 
						 FROM compendium_class_features cf
						 JOIN compendium_classes c ON c.id = cf.class_id
						 WHERE LOWER(cf.name) = LOWER($1)
						 ORDER BY
							(CASE WHEN cf.edition = $3 THEN 0 ELSE 1 END) ASC,
							(CASE WHEN $2 != '' AND UPPER(cf.source) = $2 THEN 0 ELSE 1 END) ASC,
							(CASE WHEN UPPER(cf.source) = $4 THEN 0 ELSE 1 END) ASC,
							cf.level ASC
						 LIMIT 1`,
						[name, source, edition, defaultSource]
					)
				} else {
					feature = await db.oneOrNone(
						`SELECT scf.*, sc.name as subclass_name, c.name as class_name
						 FROM compendium_sub_class_features scf
						 JOIN compendium_sub_classes sc ON sc.id = scf.sub_class_id
						 JOIN compendium_classes c ON c.id = sc.class_id
						 WHERE LOWER(scf.name) = LOWER($1)
						 ORDER BY
							(CASE WHEN scf.edition = $3 THEN 0 ELSE 1 END) ASC,
							(CASE WHEN $2 != '' AND UPPER(scf.source) = $2 THEN 0 ELSE 1 END) ASC,
							(CASE WHEN UPPER(scf.source) = $4 THEN 0 ELSE 1 END) ASC,
							scf.level ASC
						 LIMIT 1`,
						[name, source, edition, defaultSource]
					)
				}

				if (!feature) {
					if (type === 'classfeature') {
						feature = await db.oneOrNone(
							`SELECT scf.*, sc.name as subclass_name, c.name as class_name
							 FROM compendium_sub_class_features scf
							 JOIN compendium_sub_classes sc ON sc.id = scf.sub_class_id
							 JOIN compendium_classes c ON c.id = sc.class_id
							 WHERE LOWER(scf.name) = LOWER($1)
							 ORDER BY
								(CASE WHEN $2 != '' AND UPPER(scf.source) = $2 THEN 0 ELSE 1 END) ASC,
								(CASE WHEN scf.edition = $3 THEN 0 ELSE 1 END) ASC,
								(CASE WHEN UPPER(scf.source) = $4 THEN 0 ELSE 1 END) ASC,
								scf.level ASC
							 LIMIT 1`,
							[name, source, edition, defaultSource]
						)
					} else {
						feature = await db.oneOrNone(
							`SELECT cf.*, c.name as class_name 
							 FROM compendium_class_features cf
							 JOIN compendium_classes c ON c.id = cf.class_id
							 WHERE LOWER(cf.name) = LOWER($1)
							 ORDER BY
								(CASE WHEN $2 != '' AND UPPER(cf.source) = $2 THEN 0 ELSE 1 END) ASC,
								(CASE WHEN cf.edition = $3 THEN 0 ELSE 1 END) ASC,
								(CASE WHEN UPPER(cf.source) = $4 THEN 0 ELSE 1 END) ASC,
								cf.level ASC
							 LIMIT 1`,
							[name, source, edition, defaultSource]
						)
					}
				}

				if (feature) {
					const subDesc = feature.subclass_name 
						? `${feature.class_name} (${feature.subclass_name}) • Level ${feature.level}`
						: `${feature.class_name || 'Class'} • Level ${feature.level}`
					return response.ok('success', 'Found feature', {
						name: feature.name,
						type: feature.subclass_name ? 'Subclass Feature' : 'Class Feature',
						edition: feature.edition,
						source: feature.source,
						category: subDesc,
						entries: safeJson(feature.entries, [])
					}, res)
				}
			} catch (err) {
				console.warn('[WARN] Feature lookup DB query failed:', err.message)
			}
		}

		// 0b. Monsters Lookup
		if (type === 'monster' || type === 'creature' || type === 'bestiary') {
			try {
				let dbMonster = await db.compendium.getMonsterByName(name, edition, source)
				if (!dbMonster) {
					const otherEdition = edition === '2024' ? '2014' : '2024'
					dbMonster = await db.compendium.getMonsterByName(name, otherEdition, source)
				}
				if (dbMonster) {
					return response.ok('success', 'Found monster', formatMonster(dbMonster), res)
				}
			} catch (err) {
				// DB fallback
			}
		}

		// 1. Spells Lookup
		if (type === 'spell') {
			try {
				let dbSpell = await db.oneOrNone(
					`SELECT * FROM compendium_spells 
					 WHERE LOWER(name) = LOWER($1) 
					 ORDER BY
						(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
					 LIMIT 1`,
					[name, source, edition, defaultSource]
				)
				if (dbSpell) {
					return response.ok('success', 'Found spell', {
						name: dbSpell.name,
						type: 'spell',
						edition: dbSpell.edition,
						source: dbSpell.source,
						level: Number(dbSpell.level) === 0 ? 'Cantrip' : `Level ${dbSpell.level}`,
						school: dbSpell.school || 'Magic',
						castingTime: dbSpell.casting_time || '1 action',
						range: dbSpell.range || 'Self',
						duration: `${dbSpell.concentration ? 'Concentration, ' : ''}${dbSpell.duration || 'Instantaneous'}`,
						components: dbSpell.components || 'V, S',
						entries: safeJson(dbSpell.entries, [])
					}, res)
				}
			} catch (err) {
				console.warn('[WARN] Spell lookup DB query failed:', err.message)
			}
		}

		// 2. Items Lookup
		if (type === 'item') {
			const raw = name.toLowerCase()
			const singular = raw.replace(/s$/, '')
			const plural = raw + 's'
			const norm = raw.replace(/['"“”]/g, '').replace(/[\s_-]+/g, '').replace(/s(?=tool)/g, '').replace(/s$/, '')
			try {
				let dbItem = await db.oneOrNone(
					`SELECT * FROM compendium_items
					 WHERE (
						LOWER(name) = $1
						OR LOWER(name) = $2
						OR LOWER(name) = $3
						OR REPLACE(REPLACE(REPLACE(REPLACE(RTRIM(LOWER(name), 's'), '''', ''), ' ', ''), '_', ''), 'stool', 'tool') = $4
						OR LOWER(name) ILIKE $5
					 )
					 ORDER BY
						(CASE WHEN $6 != '' AND UPPER(source) = $6 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN edition = $7 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(source) = $8 THEN 0 ELSE 1 END) ASC
					 LIMIT 1`,
					[raw, singular, plural, norm, `%${raw.replace(/['’]/g, '').trim()}%`, source, edition, defaultSource]
				)
				if (dbItem) {
					return response.ok('success', 'Found item', formatLookupItem(dbItem), res)
				}
			} catch (err) {
				console.warn('[WARN] Item lookup DB query failed:', err.message)
			}
		}

		// 3. Feats Lookup
		if (type === 'feat') {
			try {
				let dbFeat = await db.oneOrNone(
					`SELECT * FROM compendium_feats 
					 WHERE LOWER(name) = LOWER($1) 
					 ORDER BY
						(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
					 LIMIT 1`,
					[name, source, edition, defaultSource]
				)
				if (dbFeat) {
					return response.ok('success', 'Found feat', {
						name: dbFeat.name,
						type: 'feat',
						edition: dbFeat.edition,
						source: dbFeat.source,
						category: dbFeat.category === 'O' ? 'Origin Feat' : (dbFeat.category === 'G' ? 'General Feat' : (dbFeat.category || 'Feat')),
						entries: safeJson(dbFeat.entries, [])
					}, res)
				}
			} catch (err) {
				console.warn('[WARN] Feat lookup DB query failed:', err.message)
			}
		}

		// 4. Optional Feature Lookup
		if (type === 'optfeature' || type === 'optionalfeature') {
			try {
				let dbOpt = await db.compendium.getOptionalFeatureByName(name, edition, source)
				if (!dbOpt) {
					const otherEdition = edition === '2024' ? '2014' : '2024'
					dbOpt = await db.compendium.getOptionalFeatureByName(name, otherEdition, source)
				}
				if (dbOpt) {
					return response.ok('success', 'Found optional feature', {
						name: dbOpt.name,
						type: 'optionalfeature',
						edition: dbOpt.edition,
						source: dbOpt.source,
						category: 'Optional Feature',
						prerequisite: formatPrerequisite(dbOpt.prerequisite),
						entries: safeJson(dbOpt.entries, [])
					}, res)
				}
			} catch (err) {
				console.warn('[WARN] Optional feature lookup DB query failed:', err.message)
			}
		}

		// 5. Rule & Rules-based Entities (Condition, Action, Skill, Sense, Language, Vehicle, Trap, Hazard, Object, Ship, etc.)
		const ruleLikeTypes = ['rule', 'variantrule', 'skill', 'sense', 'action', 'condition', 'status', 'disease', 'language', 'vehicle', 'trap', 'hazard', 'object', 'ship']
		if (ruleLikeTypes.includes(type)) {
			try {
				let dbRule = await db.compendium.getRuleByName(name, null, edition, source)
				if (!dbRule) {
					const otherEdition = edition === '2024' ? '2014' : '2024'
					dbRule = await db.compendium.getRuleByName(name, null, otherEdition, source)
				}
				if (dbRule) {
					return response.ok('success', `Found ${dbRule.type.toLowerCase()}`, {
						name: dbRule.name,
						type: dbRule.type || 'Rule',
						edition: dbRule.edition,
						source: dbRule.source,
						category: dbRule.category || dbRule.type || 'Rule',
						entries: safeJson(dbRule.entries, [])
					}, res)
				}
			} catch (err) {
				console.warn('[WARN] Rule lookup DB query failed:', err.message)
			}
		}

		// 5b. Background Lookup
		if (type === 'background') {
			try {
				let dbBg = await db.oneOrNone(
					`SELECT * FROM compendium_backgrounds 
					 WHERE LOWER(name) = LOWER($1) 
					 ORDER BY
						(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
					 LIMIT 1`,
					[name, source, edition, defaultSource]
				)
				if (dbBg) {
					return response.ok('success', 'Found background', formatBackground(dbBg), res)
				}
			} catch (err) {
				console.warn('[WARN] Background lookup DB query failed:', err.message)
			}
		}

		// 5c. Race & Species Lookup
		if (type === 'race' || type === 'subrace' || type === 'species') {
			try {
				let dbRace = await db.oneOrNone(
					`SELECT * FROM compendium_races 
					 WHERE LOWER(name) = LOWER($1) 
					 ORDER BY
						(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
					 LIMIT 1`,
					[name, source, edition, defaultSource]
				)
				if (dbRace) {
					const subraces = await db.any(
						'SELECT * FROM compendium_sub_races WHERE race_id = $1 AND edition = $2 ORDER BY name ASC',
						[dbRace.id, dbRace.edition]
					)
					return response.ok('success', 'Found race', formatRace(dbRace, subraces), res)
				}

				let dbSubRace = await db.oneOrNone(
					`SELECT sr.*, r.name as parent_race_name, r.source as parent_race_source
					 FROM compendium_sub_races sr
					 JOIN compendium_races r ON sr.race_id = r.id
					 WHERE LOWER(sr.name) = LOWER($1)
					 ORDER BY
						(CASE WHEN $2 != '' AND UPPER(sr.source) = $2 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN sr.edition = $3 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(sr.source) = $4 THEN 0 ELSE 1 END) ASC 
					 LIMIT 1`,
					[name, source, edition, defaultSource]
				)
				if (dbSubRace) {
					return response.ok('success', 'Found subrace', {
						name: dbSubRace.name,
						type: 'subrace',
						edition: dbSubRace.edition,
						source: dbSubRace.source,
						category: `${dbSubRace.parent_race_name} Subrace`,
						abilityBonuses: safeJson(dbSubRace.ability_bonuses, []),
						traits: safeJson(dbSubRace.traits, []),
						entries: safeJson(dbSubRace.entries, [])
					}, res)
				}
			} catch (err) {
				console.warn('[WARN] Race lookup DB query failed:', err.message)
			}
		}

		// 6. Universal Database Fallback
		const otherEdition = edition === '2024' ? '2014' : '2024'
		try {
			let fbRule = await db.compendium.getRuleByName(name, null, edition, source)
			if (!fbRule) fbRule = await db.compendium.getRuleByName(name, null, otherEdition, source)
			if (fbRule) {
				return response.ok('success', 'Found rule', {
					name: fbRule.name,
					type: fbRule.type || 'Rule',
					edition: fbRule.edition,
					source: fbRule.source,
					category: fbRule.category || 'Rule',
					entries: safeJson(fbRule.entries, [])
				}, res)
			}

			const raw = name.toLowerCase()
			const singular = raw.replace(/s$/, '')
			const plural = raw + 's'
			const norm = raw.replace(/['"“”]/g, '').replace(/[\s_-]+/g, '').replace(/s(?=tool)/g, '').replace(/s$/, '')
			let fbItem = await db.oneOrNone(
				`SELECT * FROM compendium_items
				 WHERE (
					LOWER(name) = $1
					OR LOWER(name) = $2
					OR LOWER(name) = $3
					OR REPLACE(REPLACE(REPLACE(REPLACE(RTRIM(LOWER(name), 's'), '''', ''), ' ', ''), '_', ''), 'stool', 'tool') = $4
					OR LOWER(name) ILIKE $5
				 )
				 ORDER BY
					(CASE WHEN $6 != '' AND UPPER(source) = $6 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN edition = $7 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN UPPER(source) = $8 THEN 0 ELSE 1 END) ASC
				 LIMIT 1`,
				[raw, singular, plural, norm, `%${raw.replace(/['’]/g, '').trim()}%`, source, edition, defaultSource]
			)
			if (fbItem) {
				return response.ok('success', 'Found item', formatLookupItem(fbItem), res)
			}

			let fbFeat = await db.oneOrNone(
				`SELECT * FROM compendium_feats 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY
					(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
				 LIMIT 1`,
				[name, source, edition, defaultSource]
			)
			if (fbFeat) {
				return response.ok('success', 'Found feat', {
					name: fbFeat.name,
					type: 'feat',
					edition: fbFeat.edition,
					source: fbFeat.source,
					category: fbFeat.category === 'O' ? 'Origin Feat' : (fbFeat.category === 'G' ? 'General Feat' : (fbFeat.category || 'Feat')),
					entries: safeJson(fbFeat.entries, [])
				}, res)
			}

			let fbOpt = await db.compendium.getOptionalFeatureByName(name, edition, source)
			if (!fbOpt) fbOpt = await db.compendium.getOptionalFeatureByName(name, otherEdition, source)
			if (fbOpt) {
				return response.ok('success', 'Found optional feature', {
					name: fbOpt.name,
					type: 'optionalfeature',
					edition: fbOpt.edition,
					source: fbOpt.source,
					category: 'Optional Feature',
					prerequisite: formatPrerequisite(fbOpt.prerequisite),
					entries: safeJson(fbOpt.entries, [])
				}, res)
			}

			let fbSpell = await db.oneOrNone(
				`SELECT * FROM compendium_spells 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY
					(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
				 LIMIT 1`,
				[name, source, edition, defaultSource]
			)
			if (fbSpell) {
				return response.ok('success', 'Found spell', {
					name: fbSpell.name,
					type: 'spell',
					edition: fbSpell.edition,
					source: fbSpell.source,
					level: Number(fbSpell.level) === 0 ? 'Cantrip' : `Level ${fbSpell.level}`,
					school: fbSpell.school || 'Magic',
					castingTime: fbSpell.casting_time || '1 action',
					range: fbSpell.range || 'Self',
					duration: `${fbSpell.concentration ? 'Concentration, ' : ''}${fbSpell.duration || 'Instantaneous'}`,
					components: fbSpell.components || 'V, S',
					entries: safeJson(fbSpell.entries, [])
				}, res)
			}

			let fbMon = await db.compendium.getMonsterByName(name, edition, source)
			if (!fbMon) fbMon = await db.compendium.getMonsterByName(name, otherEdition, source)
			if (fbMon) {
				return response.ok('success', 'Found monster', formatMonster(fbMon), res)
			}

			let fbCf = await db.oneOrNone(
				`SELECT scf.*, sc.name as subclass_name, c.name as class_name
				 FROM compendium_sub_class_features scf
				 JOIN compendium_sub_classes sc ON sc.id = scf.sub_class_id
				 JOIN compendium_classes c ON c.id = sc.class_id
				 WHERE LOWER(scf.name) = LOWER($1)
				 ORDER BY
					(CASE WHEN $2 != '' AND UPPER(scf.source) = $2 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN scf.edition = $3 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN UPPER(scf.source) = $4 THEN 0 ELSE 1 END) ASC,
					scf.level ASC
				 LIMIT 1`,
				[name, source, edition, defaultSource]
			)
			if (!fbCf) {
				fbCf = await db.oneOrNone(
					`SELECT cf.*, c.name as class_name
					 FROM compendium_class_features cf
					 JOIN compendium_classes c ON c.id = cf.class_id
					 WHERE LOWER(cf.name) = LOWER($1)
					 ORDER BY
						(CASE WHEN $2 != '' AND UPPER(cf.source) = $2 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN cf.edition = $3 THEN 0 ELSE 1 END) ASC,
						(CASE WHEN UPPER(cf.source) = $4 THEN 0 ELSE 1 END) ASC,
						cf.level ASC
					 LIMIT 1`,
					[name, source, edition, defaultSource]
				)
			}
			if (fbCf) {
				const subDesc = fbCf.subclass_name
					? `${fbCf.class_name} (${fbCf.subclass_name}) • Level ${fbCf.level}`
					: `${fbCf.class_name || 'Class'} • Level ${fbCf.level}`
				return response.ok('success', 'Found feature', {
					name: fbCf.name,
					type: fbCf.subclass_name ? 'Subclass Feature' : 'Class Feature',
					edition: fbCf.edition,
					source: fbCf.source,
					category: subDesc,
					entries: safeJson(fbCf.entries, [])
				}, res)
			}

			let fbBg = await db.oneOrNone(
				`SELECT * FROM compendium_backgrounds 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY
					(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
				 LIMIT 1`,
				[name, source, edition, defaultSource]
			)
			if (fbBg) {
				return response.ok('success', 'Found background', formatBackground(fbBg), res)
			}

			let fbRace = await db.oneOrNone(
				`SELECT * FROM compendium_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY
					(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
					(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC 
				 LIMIT 1`,
				[name, source, edition, defaultSource]
			)
			if (fbRace) {
				const subraces = await db.any(
					'SELECT * FROM compendium_sub_races WHERE race_id = $1 AND edition = $2 ORDER BY name ASC',
					[fbRace.id, fbRace.edition]
				)
				return response.ok('success', 'Found race', formatRace(fbRace, subraces), res)
			}
		} catch (err) {
			console.warn('[WARN] Universal lookup DB query failed:', err.message)
		}

		return response.ok('not_found', 'No detail found', null, res)
	},

	classTable: async (req, res) => {
		const name = (req.query.name || req.query.class || '').trim()
		let edition = req.query.edition || '2024'
		if (!name) {
			return response.badRequest('Class name is required', null, res)
		}

		try {
			let cl = await db.oneOrNone(
				'SELECT * FROM compendium_classes WHERE LOWER(name) = LOWER($1) AND edition = $2 LIMIT 1',
				[name, edition]
			)
			if (!cl) {
				const fallbackEdition = edition === '2024' ? '2014' : '2024'
				cl = await db.oneOrNone(
					'SELECT * FROM compendium_classes WHERE LOWER(name) = LOWER($1) AND edition = $2 LIMIT 1',
					[name, fallbackEdition]
				)
			}
			if (!cl) {
				return response.ok('not_found', 'Class not found', null, res)
			}

			const dbFeatures = await db.any(
				'SELECT * FROM compendium_class_features WHERE class_id = $1 ORDER BY level ASC, name ASC',
				[cl.id]
			)

			const progression = buildClassProgression(cl, dbFeatures)
			return response.ok('success', 'Retrieved class progression table', progression, res)
		} catch (err) {
			console.error('Failed to get class table:', err)
			return response.badRequest(err.message, null, res)
		}
	},

	subclassDetail: async (req, res) => {
		const id = req.query.id ? Number(req.query.id) : null
		const name = (req.query.name || '').trim()
		const classId = req.query.class_id ? Number(req.query.class_id) : null
		const className = (req.query.class_name || req.query.class || '').trim()
		let edition = req.query.edition || '2024'

		try {
			let sc = null
			if (id) {
				sc = await db.oneOrNone('SELECT * FROM compendium_sub_classes WHERE id = $1', [id])
			} else if (name) {
				if (classId) {
					sc = await db.oneOrNone(
						'SELECT * FROM compendium_sub_classes WHERE (LOWER(name) = LOWER($1) OR LOWER(short_name) = LOWER($1)) AND class_id = $2 AND edition = $3 LIMIT 1',
						[name, classId, edition]
					)
				} else if (className) {
					sc = await db.oneOrNone(
						`SELECT sc.* FROM compendium_sub_classes sc
						 JOIN compendium_classes c ON c.id = sc.class_id
						 WHERE (LOWER(sc.name) = LOWER($1) OR LOWER(sc.short_name) = LOWER($1)) AND LOWER(c.name) = LOWER($2) AND sc.edition = $3 LIMIT 1`,
						[name, className, edition]
					)
				} else {
					sc = await db.oneOrNone(
						'SELECT * FROM compendium_sub_classes WHERE (LOWER(name) = LOWER($1) OR LOWER(short_name) = LOWER($1)) AND edition = $2 LIMIT 1',
						[name, edition]
					)
				}
				if (!sc) {
					const fallbackEdition = edition === '2024' ? '2014' : '2024'
					if (className) {
						sc = await db.oneOrNone(
							`SELECT sc.* FROM compendium_sub_classes sc
							 JOIN compendium_classes c ON c.id = sc.class_id
							 WHERE (LOWER(sc.name) = LOWER($1) OR LOWER(sc.short_name) = LOWER($1)) AND LOWER(c.name) = LOWER($2) AND sc.edition = $3 LIMIT 1`,
							[name, className, fallbackEdition]
						)
					} else {
						sc = await db.oneOrNone(
							'SELECT * FROM compendium_sub_classes WHERE (LOWER(name) = LOWER($1) OR LOWER(short_name) = LOWER($1)) AND edition = $2 LIMIT 1',
							[name, fallbackEdition]
						)
					}
				}
			}

			if (!sc) {
				return response.ok('not_found', 'Subclass not found', null, res)
			}

			const features = await db.any(
				'SELECT * FROM compendium_sub_class_features WHERE sub_class_id = $1 ORDER BY level ASC, name ASC',
				[sc.id]
			)

			let subclassEntries = safeJson(sc.entries, [])
			let displayFeatures = features

			const introFeat = features.find(f => (f.name || '').trim().toLowerCase() === (sc.name || '').trim().toLowerCase())
			if (introFeat) {
				const introParsed = safeJson(introFeat.entries, [])
				const textEntries = introParsed.filter(e => typeof e === 'string' || (typeof e === 'object' && !e.name))
				if (!subclassEntries.length && textEntries.length) {
					subclassEntries = textEntries
				}
				const otherFeatures = features.filter(f => f.id !== introFeat.id)
				if (otherFeatures.length > 0) {
					displayFeatures = otherFeatures
				}
			}

			const formatted = {
				id: sc.id,
				classId: sc.class_id,
				name: sc.name,
				shortName: sc.short_name,
				edition: sc.edition,
				source: sc.source,
				page: sc.page,
				spellcastingAbility: sc.spellcasting_ability,
				entries: subclassEntries,
				features: displayFeatures.map(f => ({
					id: f.id,
					name: f.name,
					level: f.level,
					edition: f.edition,
					source: f.source,
					page: f.page,
					entries: safeJson(f.entries, [])
				}))
			}

			return response.ok('success', 'Retrieved subclass detail', formatted, res)
		} catch (err) {
			console.error('Failed to get subclass detail:', err)
			return response.badRequest(err.message, null, res)
		}
	},

	saveHomebrew: async (req, res) => {
		const { category, data } = req.body || {}
		if (!category || !data || !data.name) {
			return response.badRequest('category, data, and data.name are required', null, res)
		}

		const cat = String(category).toLowerCase().trim()
		const edition = data.edition || '2024'
		const source = (data.source || 'Homebrew').trim()
		const name = data.name.trim()

		try {
			let result = null
			if (cat === 'spell') {
				result = await db.one(`
					INSERT INTO compendium_spells (
						name, edition, source, level, school, casting_time, range, components,
						duration, concentration, ritual, damage_type, damage_dice, save_ability,
						classes, entries, higher_levels, page
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8,
						$9, $10, $11, $12, $13, $14,
						$15, $16, $17, $18
					)
					ON CONFLICT (name, source, edition) DO UPDATE SET
						level = EXCLUDED.level,
						school = EXCLUDED.school,
						casting_time = EXCLUDED.casting_time,
						range = EXCLUDED.range,
						components = EXCLUDED.components,
						duration = EXCLUDED.duration,
						concentration = EXCLUDED.concentration,
						ritual = EXCLUDED.ritual,
						damage_type = EXCLUDED.damage_type,
						damage_dice = EXCLUDED.damage_dice,
						save_ability = EXCLUDED.save_ability,
						classes = EXCLUDED.classes,
						entries = EXCLUDED.entries,
						higher_levels = EXCLUDED.higher_levels
					RETURNING *
				`, [
					name, edition, source, Number(data.level) || 0, data.school || 'evocation',
					data.casting_time || '1 action', data.range || '60 ft.', data.components || 'V, S',
					data.duration || 'Instantaneous', Boolean(data.concentration), Boolean(data.ritual),
					data.damage_type || null, data.damage_dice || null, data.save_ability || null,
					JSON.stringify(Array.isArray(data.classes) ? data.classes : (data.classes ? [data.classes] : [])),
					JSON.stringify(Array.isArray(data.entries) ? data.entries : (data.entries ? [data.entries] : [])),
					JSON.stringify(Array.isArray(data.higher_levels) ? data.higher_levels : []),
					data.page || null
				])
				return response.ok('success', 'Homebrew spell saved', formatSpell(result), res)
			}

			if (cat === 'item') {
				result = await db.one(`
					INSERT INTO compendium_items (
						name, edition, source, item_type, rarity, cost_cp, weight,
						damage_dice, damage_type, versatile_dice, mastery,
						base_ac, ac_dex_bonus, stealth_disadvantage, strength_requirement,
						properties, entries, equip_type, page
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7,
						$8, $9, $10, $11,
						$12, $13, $14, $15,
						$16, $17, $18, $19
					)
					ON CONFLICT (name, source, edition) DO UPDATE SET
						item_type = EXCLUDED.item_type,
						rarity = EXCLUDED.rarity,
						cost_cp = EXCLUDED.cost_cp,
						weight = EXCLUDED.weight,
						damage_dice = EXCLUDED.damage_dice,
						damage_type = EXCLUDED.damage_type,
						versatile_dice = EXCLUDED.versatile_dice,
						mastery = EXCLUDED.mastery,
						base_ac = EXCLUDED.base_ac,
						ac_dex_bonus = EXCLUDED.ac_dex_bonus,
						stealth_disadvantage = EXCLUDED.stealth_disadvantage,
						strength_requirement = EXCLUDED.strength_requirement,
						properties = EXCLUDED.properties,
						entries = EXCLUDED.entries,
						equip_type = EXCLUDED.equip_type
					RETURNING *
				`, [
					name, edition, source, data.item_type || 'gear', data.rarity || 'none',
					Number(data.cost_cp) || 0, data.weight ? String(data.weight) : null,
					data.damage_dice || null, data.damage_type || null, data.versatile_dice || null,
					data.mastery || null, Number(data.base_ac) || null, Boolean(data.ac_dex_bonus),
					Boolean(data.stealth_disadvantage), Number(data.strength_requirement) || null,
					JSON.stringify(Array.isArray(data.properties) ? data.properties : []),
					JSON.stringify(Array.isArray(data.entries) ? data.entries : (data.entries ? [data.entries] : [])),
					data.equip_type || null, data.page || null
				])
				return response.ok('success', 'Homebrew item saved', formatItem(result), res)
			}

			if (cat === 'monster') {
				result = await db.one(`
					INSERT INTO compendium_monsters (
						name, edition, source, cr, size, type, alignment,
						ac, hp, speed, str, dex, con, int, wis, cha,
						save, skill, passive, languages, senses,
						trait, action, bonus, reaction, legendary,
						spellcasting, environment, page, raw_data
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7,
						$8, $9, $10, $11, $12, $13, $14, $15, $16,
						$17, $18, $19, $20, $21,
						$22, $23, $24, $25, $26,
						$27, $28, $29, $30
					)
					ON CONFLICT (name, source, edition) DO UPDATE SET
						cr = EXCLUDED.cr, size = EXCLUDED.size, type = EXCLUDED.type, alignment = EXCLUDED.alignment,
						ac = EXCLUDED.ac, hp = EXCLUDED.hp, speed = EXCLUDED.speed,
						str = EXCLUDED.str, dex = EXCLUDED.dex, con = EXCLUDED.con,
						int = EXCLUDED.int, wis = EXCLUDED.wis, cha = EXCLUDED.cha,
						trait = EXCLUDED.trait, action = EXCLUDED.action, bonus = EXCLUDED.bonus,
						reaction = EXCLUDED.reaction, raw_data = EXCLUDED.raw_data
					RETURNING *
				`, [
					name, edition, source, String(data.cr || '1'),
					JSON.stringify(Array.isArray(data.size) ? data.size : [data.size || 'M']),
					JSON.stringify(typeof data.type === 'object' ? data.type : (data.type || 'humanoid')),
					JSON.stringify(Array.isArray(data.alignment) ? data.alignment : [data.alignment || 'U']),
					JSON.stringify(Array.isArray(data.ac) ? data.ac : [{ ac: Number(data.ac) || 10 }]),
					JSON.stringify(typeof data.hp === 'object' ? data.hp : { average: Number(data.hp) || 10 }),
					JSON.stringify(typeof data.speed === 'object' ? data.speed : { walk: Number(data.speed) || 30 }),
					Number(data.str) || 10, Number(data.dex) || 10, Number(data.con) || 10,
					Number(data.int) || 10, Number(data.wis) || 10, Number(data.cha) || 10,
					JSON.stringify(data.save || null), JSON.stringify(data.skill || null),
					Number(data.passive) || 10, JSON.stringify(data.languages || []), JSON.stringify(data.senses || []),
					JSON.stringify(Array.isArray(data.trait) ? data.trait : []),
					JSON.stringify(Array.isArray(data.action) ? data.action : []),
					JSON.stringify(Array.isArray(data.bonus) ? data.bonus : []),
					JSON.stringify(Array.isArray(data.reaction) ? data.reaction : []),
					JSON.stringify(Array.isArray(data.legendary) ? data.legendary : []),
					JSON.stringify(Array.isArray(data.spellcasting) ? data.spellcasting : []),
					JSON.stringify(Array.isArray(data.environment) ? data.environment : []),
					data.page || null, JSON.stringify(data.raw_data || {})
				])
				return response.ok('success', 'Homebrew monster saved', formatMonster(result), res)
			}

			if (cat === 'feat') {
				result = await db.one(`
					INSERT INTO compendium_feats (
						name, edition, source, category, prerequisite, ability_bonus, repeatable, entries, page
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8, $9
					)
					ON CONFLICT (name, source, edition) DO UPDATE SET
						category = EXCLUDED.category,
						prerequisite = EXCLUDED.prerequisite,
						ability_bonus = EXCLUDED.ability_bonus,
						repeatable = EXCLUDED.repeatable,
						entries = EXCLUDED.entries
					RETURNING *
				`, [
					name, edition, source, data.category || 'G',
					data.prerequisite || null, JSON.stringify(data.ability_bonus || []),
					Boolean(data.repeatable), JSON.stringify(Array.isArray(data.entries) ? data.entries : [data.entries || '']),
					data.page || null
				])
				return response.ok('success', 'Homebrew feat saved', formatFeat(result), res)
			}

			if (cat === 'subclass') {
				let classId = Number(data.class_id)
				if (!classId && data.class_name) {
					const parentCl = await db.oneOrNone('SELECT id FROM compendium_classes WHERE LOWER(name) = LOWER($1) AND edition = $2 LIMIT 1', [data.class_name, edition])
					if (parentCl) classId = parentCl.id
				}
				if (!classId) {
					return response.badRequest('Valid class_id or class_name is required for subclass', null, res)
				}
				result = await db.one(`
					INSERT INTO compendium_sub_classes (
						class_id, name, short_name, edition, source, spellcasting_ability, entries, page
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8
					)
					ON CONFLICT (class_id, name, source, edition) DO UPDATE SET
						short_name = EXCLUDED.short_name,
						spellcasting_ability = EXCLUDED.spellcasting_ability,
						entries = EXCLUDED.entries
					RETURNING *
				`, [
					classId, name, data.short_name || name, edition, source,
					data.spellcasting_ability || null, JSON.stringify(Array.isArray(data.entries) ? data.entries : (data.entries ? [data.entries] : [])),
					data.page || null
				])

				if (Array.isArray(data.features) && data.features.length > 0) {
					for (const feat of data.features) {
						if (!feat.name) continue
						await db.none(`
							INSERT INTO compendium_sub_class_features (
								sub_class_id, name, level, edition, source, entries, page
							) VALUES ($1, $2, $3, $4, $5, $6, $7)
							ON CONFLICT (sub_class_id, name, level, source, edition) DO UPDATE SET
								entries = EXCLUDED.entries
						`, [
							result.id, feat.name, Number(feat.level) || 3, edition, source,
							JSON.stringify(Array.isArray(feat.entries) ? feat.entries : (feat.entries ? [feat.entries] : [])),
							feat.page || null
						])
					}
				}

				return response.ok('success', 'Homebrew subclass saved', result, res)
			}

			if (cat === 'subrace') {
				let raceId = Number(data.race_id)
				if (!raceId && data.race_name) {
					const parentR = await db.oneOrNone('SELECT id FROM compendium_races WHERE LOWER(name) = LOWER($1) AND edition = $2 LIMIT 1', [data.race_name, edition])
					if (parentR) raceId = parentR.id
				}
				if (!raceId) {
					return response.badRequest('Valid race_id or race_name is required for subrace', null, res)
				}
				result = await db.one(`
					INSERT INTO compendium_sub_races (
						race_id, name, edition, source, ability_bonuses, traits, entries, page
					) VALUES (
						$1, $2, $3, $4, $5, $6, $7, $8
					)
					ON CONFLICT (race_id, name, source, edition) DO UPDATE SET
						ability_bonuses = EXCLUDED.ability_bonuses,
						traits = EXCLUDED.traits,
						entries = EXCLUDED.entries
					RETURNING *
				`, [
					raceId, name, edition, source,
					JSON.stringify(data.ability_bonuses || []),
					JSON.stringify(data.traits || []),
					JSON.stringify(Array.isArray(data.entries) ? data.entries : (data.entries ? [data.entries] : [])),
					data.page || null
				])
				return response.ok('success', 'Homebrew subrace saved', result, res)
			}

			return response.badRequest(`Unknown homebrew category: ${cat}`, null, res)
		} catch (err) {
			console.error('Failed to save homebrew:', err)
			return response.badRequest(err.message, null, res)
		}
	},

	deleteHomebrew: async (req, res) => {
		const { category, id } = req.params
		const cat = (category || '').toLowerCase().trim()
		const itemNumId = Number(id)
		if (!itemNumId) {
			return response.badRequest('Valid numeric ID required', null, res)
		}

		const tableMap = {
			spell: 'compendium_spells',
			item: 'compendium_items',
			monster: 'compendium_monsters',
			feat: 'compendium_feats',
			subclass: 'compendium_sub_classes',
			subrace: 'compendium_sub_races'
		}

		const table = tableMap[cat]
		if (!table) {
			return response.badRequest(`Unknown category: ${cat}`, null, res)
		}

		try {
			await db.none(`DELETE FROM ${table} WHERE id = $1`, [itemNumId])
			return response.ok('success', `Homebrew ${cat} deleted`, { id: itemNumId }, res)
		} catch (err) {
			console.error('Failed to delete homebrew:', err)
			return response.badRequest(err.message, null, res)
		}
	}
}
