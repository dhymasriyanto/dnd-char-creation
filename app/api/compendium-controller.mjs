'use strict'

import { response } from '../../helper/response.mjs'
import { db } from '../../database/index.mjs'

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

const normalizeCompendiumName = (s) => (s || '').toLowerCase()
	.replace(/['’]/g, '')
	.replace(/s\b/g, '')
	.replace(/[\s-_]+/g, ' ')
	.trim()

function formatPrerequisite(prereq) {
	if (!prereq) return null
	if (typeof prereq === 'string') {
		try {
			let parsed = JSON.parse(prereq)
			while (typeof parsed === 'string') {
				try {
					parsed = JSON.parse(parsed)
				} catch (_) {
					break
				}
			}
			if (typeof parsed === 'object' && parsed !== null) {
				return formatPrerequisite(parsed)
			}
		} catch (_) {
			void _
		}
		return prereq
	}
	if (!Array.isArray(prereq)) prereq = [prereq]

	const ordinal = (n) => {
		const s = ['th', 'st', 'nd', 'rd']
		const v = n % 100
		return n + (s[(v - 20) % 10] || s[v] || s[0])
	}

	const cleanItem = (str) => {
		if (typeof str !== 'string') return ''
		return str.split('|')[0].replace(/#c$/, ' cantrip').trim()
	}

	const parts = []
	for (const p of prereq) {
		if (!p) continue
		if (typeof p === 'string') {
			parts.push(cleanItem(p))
			continue
		}

		const sub = []

		if (p.level != null) {
			if (typeof p.level === 'number') {
				sub.push(`${ordinal(p.level)} Level`)
			} else if (typeof p.level === 'object') {
				const lvl = p.level.level ? `${ordinal(p.level.level)}-level` : ''
				const cls = p.level.class?.name || ''
				const subcls = p.level.subclass?.name ? ` (${p.level.subclass.name})` : ''
				sub.push(`${lvl} ${cls}${subcls}`.trim())
			}
		}

		if (p.ability && Array.isArray(p.ability)) {
			const abNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' }
			const abParts = []
			for (const abObj of p.ability) {
				const pairs = Object.entries(abObj).map(([k, val]) => `${abNames[k.toLowerCase()] || k.toUpperCase()} ${val}`)
				if (pairs.length) abParts.push(pairs.join(' or '))
			}
			if (abParts.length) sub.push(`${abParts.join(', ')} or higher`)
		}

		if (p.race && Array.isArray(p.race)) {
			const rNames = p.race.map(r => {
				let name = r.name || ''
				name = name.charAt(0).toUpperCase() + name.slice(1)
				if (r.subrace) name += ` (${r.subrace.charAt(0).toUpperCase() + r.subrace.slice(1)})`
				return name
			})
			if (rNames.length) sub.push(rNames.join(' or '))
		}

		if (p.spell && Array.isArray(p.spell)) {
			const spNames = p.spell.map(sp => {
				if (typeof sp === 'string') {
					const isCantrip = sp.endsWith('#c')
					const name = sp.replace(/#c$/, '').split('|')[0]
					const title = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
					return isCantrip ? `${title} cantrip` : title
				}
				if (typeof sp === 'object' && sp !== null) {
					return sp.entry || sp.entrySummary || 'a Spell'
				}
				return String(sp)
			})
			if (spNames.length) sub.push(spNames.join(' or '))
		}

		if (p.feat && Array.isArray(p.feat)) {
			const fNames = p.feat.map(f => {
				const raw = String(f).split('|')[0]
				return raw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
			})
			if (fNames.length) sub.push(fNames.join(' or '))
		}

		if (p.proficiency && Array.isArray(p.proficiency)) {
			const profs = p.proficiency.map(pr => {
				if (pr.armor) return `Proficiency with ${pr.armor} armor`
				if (pr.weapon) return `Proficiency with ${pr.weapon} weapons`
				return Object.entries(pr).map(([k, v]) => `Proficiency with ${v} ${k}`).join(', ')
			})
			if (profs.length) sub.push(profs.join(', '))
		}

		if (p.spellcasting || p.spellcastingFeature || p.spellcasting2020) {
			sub.push('Spellcasting or Pact Magic feature')
		}

		if (p.pact) sub.push(`Pact of the ${p.pact}`)
		if (p.patron) sub.push(`${p.patron} patron`)
		if (p.feature && Array.isArray(p.feature)) sub.push(p.feature.join(', '))
		if (p.item && Array.isArray(p.item)) sub.push(p.item.join(' or '))
		if (p.background && Array.isArray(p.background)) sub.push(p.background.map(b => b.name).filter(Boolean).join(' or '))
		if (p.campaign && Array.isArray(p.campaign)) sub.push(`${p.campaign.join('/')} campaign`)
		if (p.other) sub.push(p.other)
		if (p.otherSummary) sub.push(typeof p.otherSummary === 'object' ? (p.otherSummary.entry || p.otherSummary.entrySummary || '') : p.otherSummary)

		if (sub.length) parts.push(sub.join(', '))
	}

	return parts.filter(Boolean).join('; ')
}

function formatBackground(b) {
	return {
		id: b.id,
		name: b.name,
		edition: b.edition,
		source: b.source,
		page: b.page,
		ability: safeJson(b.ability_bonuses, []),
		feats: safeJson(b.feats, []),
		skillProficiencies: safeJson(b.skill_proficiencies, []),
		toolProficiencies: safeJson(b.tool_proficiencies, []),
		languageProficiencies: safeJson(b.languages, []),
		startingEquipment: safeJson(b.equipment, []),
		entries: safeJson(b.entries, [])
	}
}

function formatFeat(f) {
	return {
		id: f.id,
		name: f.name,
		edition: f.edition,
		source: f.source,
		page: f.page,
		category: f.category,
		prerequisite: formatPrerequisite(f.prerequisite),
		ability: safeJson(f.ability_bonus, []),
		repeatable: f.repeatable,
		entries: safeJson(f.entries, [])
	}
}

function formatOptionalFeature(of) {
	return {
		id: of.id,
		name: of.name,
		edition: of.edition,
		source: of.source,
		page: of.page,
		featureType: safeJson(of.feature_type, []),
		prerequisite: formatPrerequisite(of.prerequisite),
		entries: safeJson(of.entries, [])
	}
}

function formatRule(r) {
	return {
		id: r.id,
		name: r.name,
		edition: r.edition,
		source: r.source,
		page: r.page,
		type: r.type,
		category: r.category,
		entries: safeJson(r.entries, [])
	}
}

function formatMonster(m) {
	return {
		id: m.id,
		name: m.name,
		edition: m.edition,
		source: m.source,
		page: m.page,
		cr: m.cr,
		size: safeJson(m.size, ['M']),
		type: safeJson(m.type, 'humanoid'),
		alignment: safeJson(m.alignment, ['U']),
		ac: safeJson(m.ac, []),
		hp: safeJson(m.hp, {}),
		speed: safeJson(m.speed, {}),
		str: m.str,
		dex: m.dex,
		con: m.con,
		int: m.int,
		wis: m.wis,
		cha: m.cha,
		save: safeJson(m.save, null),
		skill: safeJson(m.skill, null),
		passive: m.passive,
		languages: safeJson(m.languages, []),
		senses: safeJson(m.senses, []),
		trait: safeJson(m.trait, []),
		action: safeJson(m.action, []),
		bonus: safeJson(m.bonus, []),
		reaction: safeJson(m.reaction, []),
		legendary: safeJson(m.legendary, []),
		spellcasting: safeJson(m.spellcasting, []),
		environment: safeJson(m.environment, []),
		raw_data: safeJson(m.raw_data, null)
	}
}

function formatSpell(s) {
	return {
		id: s.id,
		name: s.name,
		edition: s.edition,
		source: s.source,
		page: s.page,
		level: Number(s.level),
		school: s.school,
		time: [{ number: 1, unit: s.casting_time || '1 action' }],
		range: { type: s.range || 'Self' },
		components: s.components,
		duration: [{ type: s.duration || 'Instantaneous', concentration: s.concentration }],
		meta: { ritual: s.ritual },
		damageInflict: s.damage_type ? s.damage_type.split(', ') : [],
		savingThrow: s.save_ability ? s.save_ability.split(', ') : [],
		classes: { fromClassList: safeJson(s.classes, []) },
		entries: safeJson(s.entries, []),
		entriesHigherLevel: safeJson(s.higher_levels, [])
	}
}

function formatItem(it) {
	return {
		id: it.id,
		name: it.name,
		edition: it.edition,
		source: it.source,
		page: it.page,
		type: it.item_type,
		rarity: it.rarity,
		value: Number(it.cost_cp),
		weight: Number(it.weight),
		dmg1: it.damage_dice,
		dmgType: it.damage_type,
		dmg2: it.versatile_dice,
		mastery: it.mastery ? [it.mastery] : [],
		ac: Number(it.base_ac),
		dexMod: it.ac_dex_bonus === 'yes',
		stealth: it.stealth_disadvantage,
		strength: Number(it.strength_requirement),
		property: safeJson(it.properties, []),
		entries: safeJson(it.entries, [])
	}
}

const cleanText = (text) => {
	if (typeof text !== 'string') return ''
	let result = text
	let iterations = 0
	while (/\{@([a-zA-Z0-9_]+)(?: ([^{}]+))?\}/.test(result) && iterations < 10) {
		result = result.replace(/\{@([a-zA-Z0-9_]+)(?: ([^{}]+))?\}/g, (match, tag, content) => {
			if (!content) return ''
			const parts = content.split('|')
			const lowerTag = tag.toLowerCase()
			if (lowerTag === 'filter') return parts[0]
			if (lowerTag === 'b' || lowerTag === 'i' || lowerTag === 'strike' || lowerTag === 's' || lowerTag === 'u') return parts[0]
			if (lowerTag === 'dice' || lowerTag === 'damage' || lowerTag === 'd20') return parts[0]
			if (lowerTag === 'classfeature') return parts[5] || parts[0]
			if (lowerTag === 'subclassfeature') return parts[7] || parts[0]
			if (lowerTag === 'optfeature' || lowerTag === 'optionalfeature') return parts[2] || parts[0]
			if (lowerTag === 'quickref' && parts[4]) return parts[4]
			if (parts.length >= 3 && parts[2]) return parts[2]
			return parts[0]
		})
		iterations++
	}
	return result.replace(/\s+/g, ' ').trim()
}

const flattenEntries = (entries) => {
	if (!entries) return []
	const lines = []
	const walk = (item) => {
		if (!item) return
		if (typeof item === 'string') {
			lines.push(cleanText(item))
		} else if (Array.isArray(item)) {
			item.forEach(walk)
		} else if (typeof item === 'object') {
			if (item.type === 'abilityDc') {
				const attrs = (item.attributes || []).map(a => a.toUpperCase()).join(' or ')
				lines.push(`${item.name ? item.name + ' ' : ''}save DC = 8 + proficiency bonus + ${attrs} modifier`)
			} else if (item.type === 'abilityAttackMod') {
				const attrs = (item.attributes || []).map(a => a.toUpperCase()).join(' or ')
				lines.push(`${item.name ? item.name + ' ' : ''}attack modifier = proficiency bonus + ${attrs} modifier`)
			} else if (item.type === 'refOptionalfeature') {
				lines.push(cleanText(`{@optfeature ${item.optionalfeature}}`))
			} else if (item.type === 'refClassFeature') {
				lines.push(cleanText(`{@classFeature ${item.classFeature}}`))
			} else if (item.type === 'refSubclassFeature') {
				lines.push(cleanText(`{@subclassFeature ${item.subclassFeature}}`))
			} else if (item.type === 'refFeat') {
				lines.push(cleanText(`{@feat ${item.feat}}`))
			} else if (item.name && item.entry) {
				lines.push(`${cleanText(item.name)}: ${cleanText(item.entry)}`)
			} else if (item.name && item.entries) {
				lines.push(cleanText(item.name))
				walk(item.entries)
			} else if (item.entries) {
				walk(item.entries)
			} else if (item.items) {
				walk(item.items)
			}
		}
	}
	walk(entries)
	return lines
}

export const compendium = {
	backgrounds: async (req, res) => {
		const edition = req.query.edition || '2024'
		const search = req.query.search || null

		try {
			const bgs = await db.compendium.getBackgrounds({ edition, search })
			if (bgs && bgs.length > 0) {
				const filtered = edition === '2024'
					? bgs.filter(b => b.source === 'XPHB')
					: bgs.filter(b => b.source !== 'XPHB')
				return response.ok('success', 'Retrieved backgrounds', (filtered.length > 0 ? filtered : bgs).map(formatBackground), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium backgrounds query failed:', err.message)
		}

		return response.ok('success', 'Retrieved backgrounds', [], res)
	},

	feats: async (req, res) => {
		const edition = req.query.edition || '2024'
		const category = req.query.category || null
		const search = req.query.search || null
		const source = req.query.source || null
		const limit = req.query.limit ? Number(req.query.limit) : null
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const feats = await db.compendium.getFeats({ edition, category, search, source, limit, offset })
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
			const spells = await db.compendium.getSpells({ edition, level, maxLevel, school: schoolRaw, className, search, source, limit, offset })
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
		const limit = req.query.limit ? Number(req.query.limit) : 300
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const ofs = await db.compendium.getOptionalFeatures({ edition, featureType: featureTypeRaw, search, source, limit, offset })
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
		const limit = req.query.limit ? Number(req.query.limit) : 80
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const monsters = await db.compendium.getMonsters({ edition, cr, type, search, source, limit, offset })
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
		const limit = req.query.limit ? Number(req.query.limit) : 80
		const offset = req.query.offset ? Number(req.query.offset) : 0

		try {
			const items = await db.compendium.getItems({ edition, itemType, mastery, search, source, limit, offset })
			return response.ok('success', 'Retrieved items', (items || []).map(formatItem), res)
		} catch (err) {
			console.warn('[WARN] DB compendium items query failed:', err.message)
			return response.ok('success', 'Retrieved items', [], res)
		}
	},

	rules: async (req, res) => {
		const edition = req.query.edition || '2024'
		const search = req.query.search ? req.query.search.toLowerCase().trim() : null
		const category = req.query.category ? req.query.category.toLowerCase().trim() : null
		const source = req.query.source ? req.query.source.toUpperCase().trim() : null
		const catRaw = category
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
				} else {
					sqlQ += 'AND LOWER(type) = $2 '
					params.push(catRaw)
				}
				if (source) {
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
				rules = await db.compendium.getRules({ edition, search, source, limit, offset })
			}
			return response.ok('success', 'Retrieved rules and glossary', (rules || []).map(formatRule), res)
		} catch (err) {
			console.warn('[WARN] DB compendium rules query failed:', err.message)
			return response.ok('success', 'Retrieved rules and glossary', [], res)
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
					return response.ok('success', 'Found item', {
						name: dbItem.name,
						type: 'item',
						edition: dbItem.edition,
						source: dbItem.source,
						itemType: dbItem.item_type || 'Item',
						damage: dbItem.damage_dice ? `${dbItem.damage_dice} ${dbItem.damage_type || ''}`.trim() : null,
						ac: dbItem.base_ac ? String(dbItem.base_ac) : null,
						properties: Array.isArray(safeJson(dbItem.properties)) ? safeJson(dbItem.properties).join(', ') : null,
						mastery: dbItem.mastery || null,
						weight: dbItem.weight ? `${dbItem.weight} lb` : null,
						cost: dbItem.cost_cp ? (Number(dbItem.cost_cp) >= 100 ? `${Number(dbItem.cost_cp) / 100} gp` : `${dbItem.cost_cp} cp`) : null,
						entries: safeJson(dbItem.entries, [])
					}, res)
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

		// 5. Rule & Rules-based Entities (Condition, Action, Skill, Sense, Language, Vehicle, Trap, Hazard, etc.)
		const ruleLikeTypes = ['rule', 'variantrule', 'skill', 'sense', 'action', 'condition', 'status', 'disease', 'language', 'vehicle', 'trap', 'hazard']
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
				return response.ok('success', 'Found item', {
					name: fbItem.name,
					type: 'item',
					edition: fbItem.edition,
					source: fbItem.source,
					itemType: fbItem.item_type || 'Item',
					damage: fbItem.damage_dice ? `${fbItem.damage_dice} ${fbItem.damage_type || ''}`.trim() : null,
					ac: fbItem.base_ac ? String(fbItem.base_ac) : null,
					properties: Array.isArray(safeJson(fbItem.properties)) ? safeJson(fbItem.properties).join(', ') : null,
					mastery: fbItem.mastery || null,
					weight: fbItem.weight ? `${fbItem.weight} lb` : null,
					cost: fbItem.cost_cp ? (Number(fbItem.cost_cp) >= 100 ? `${Number(fbItem.cost_cp) / 100} gp` : `${fbItem.cost_cp} cp`) : null,
					entries: safeJson(fbItem.entries, [])
				}, res)
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
		} catch (err) {
			console.warn('[WARN] Universal lookup DB query failed:', err.message)
		}

		return response.ok('not_found', 'No detail found', null, res)
	}
}
