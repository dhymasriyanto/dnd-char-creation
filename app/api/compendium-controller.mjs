'use strict'

import { response } from '../../helper/response.mjs'
import { getData } from '../service/getData.mjs'
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
			const parsed = JSON.parse(prereq)
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
			if (item.name && item.entry) {
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
			console.warn('[WARN] DB compendium backgrounds query failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('backgrounds.json', edition)
		let bgs = datas?.background || []

		if (edition === '2024') {
			bgs = bgs.filter(b => b.edition === 'one' || b.source === 'XPHB' || b.source === 'EFA')
		} else {
			bgs = bgs.filter(b => b.edition !== 'one' && b.source !== 'XPHB')
		}

		if (search) {
			const s = search.toLowerCase()
			bgs = bgs.filter(b => b.name?.toLowerCase().includes(s))
		}

		return response.ok('success', 'Retrieved backgrounds', bgs, res)
	},

	feats: async (req, res) => {
		const edition = req.query.edition || '2024'
		const category = req.query.category || null
		const search = req.query.search || null
		const source = req.query.source || null

		try {
			const feats = await db.compendium.getFeats({ edition, category, search, source })
			if (feats && feats.length > 0) {
				return response.ok('success', 'Retrieved feats', feats.map(formatFeat), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium feats query failed, falling back to JSON:', err.message)
		}

		const datas = await getData.all('feats.json', edition)
		let feats = datas?.feat || []

		if (edition === '2024') {
			feats = feats.filter(f => f.edition === 'one' || f.source === 'XPHB' || f.category)
		} else {
			feats = feats.filter(f => f.edition !== 'one' && f.source !== 'XPHB' && !f.category)
		}

		if (category) {
			const cat = category.toLowerCase()
			feats = feats.filter(f => f.category?.toLowerCase() === cat)
		}

		if (source) {
			const s = source.toLowerCase()
			feats = feats.filter(f => (f.source || '').toLowerCase() === s)
		}

		if (search) {
			const s = search.toLowerCase()
			feats = feats.filter(f => f.name?.toLowerCase().includes(s))
		}

		return response.ok('success', 'Retrieved feats', feats, res)
	},

	spells: async (req, res) => {
		const edition = req.query.edition || '2024'
		const levelRaw = req.query.level != null ? String(req.query.level).trim() : null
		const maxLevel = req.query.maxLevel != null ? parseInt(req.query.maxLevel, 10) : null
		const schoolRaw = req.query.school || null
		const search = req.query.search || null
		const source = req.query.source || null
		let className = req.query.className || req.query.class || null

		// Subclasses using wizard list
		if (className && (className.toLowerCase().includes('eldritch knight') || className.toLowerCase().includes('arcane trickster'))) {
			className = 'Wizard'
		}

		const level = (levelRaw != null && !isNaN(parseInt(levelRaw, 10)) && !levelRaw.includes(';') && !levelRaw.includes(',') && levelRaw !== '!0')
			? parseInt(levelRaw, 10)
			: null

		try {
			const spells = await db.compendium.getSpells({ edition, level, maxLevel, school: schoolRaw, className, search, source })
			if (spells && spells.length > 0) {
				return response.ok('success', 'Retrieved spells', spells.map(formatSpell), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium spells query failed, falling back to JSON:', err.message)
		}

		const file = edition === '2024' ? 'spells/spells-xphb.json' : 'spells/spells-phb.json'
		const datas = await getData.all(file, edition)
		let spells = datas?.spell || []

		// Fallback to PHB if 2024 file is empty or missing
		if (spells.length === 0 && edition === '2024') {
			const fallbackDatas = await getData.all('spells/spells-phb.json', '2014')
			spells = fallbackDatas?.spell || []
		}

		if (levelRaw != null && levelRaw !== '') {
			if (levelRaw === '!0') {
				spells = spells.filter(s => s.level !== 0)
			} else {
				const allowedLevels = levelRaw.split(/[;,]/).map(l => parseInt(l.trim(), 10)).filter(n => !isNaN(n))
				if (allowedLevels.length > 0) {
					spells = spells.filter(s => allowedLevels.includes(s.level))
				}
			}
		}

		if (maxLevel != null) {
			spells = spells.filter(s => s.level <= maxLevel)
		}

		if (schoolRaw) {
			const schoolCodes = {
				a: 'abjuration',
				c: 'conjuration',
				d: 'divination',
				e: 'evocation',
				en: 'enchantment',
				i: 'illusion',
				n: 'necromancy',
				t: 'transmutation'
			}
			const requestedSchools = schoolRaw.toLowerCase().split(/[;,]/).map(code => schoolCodes[code.trim()] || code.trim()).filter(Boolean)
			spells = spells.filter(s => {
				const sc = (s.school || '').toLowerCase()
				const fullSc = schoolCodes[sc] || sc
				return requestedSchools.some(reqSc => fullSc.startsWith(reqSc) || sc.startsWith(reqSc))
			})
		}

		if (className) {
			const lookupData = await getData.all('generated/gendata-spell-source-lookup.json', edition) || {}
			const targetClasses = className.toLowerCase().split(/[;,]/).map(c => c.trim()).filter(Boolean)
			spells = spells.filter(s => {
				const spellName = (s.name || '').toLowerCase()
				for (const spellsObj of Object.values(lookupData)) {
					const entry = spellsObj?.[spellName]
					if (!entry) continue
					for (const dict of [entry.class, entry.classVariant]) {
						if (!dict) continue
						for (const [book, clsObj] of Object.entries(dict)) {
							const is2024 = book === 'XPHB' || book === 'EFA' || book === 'AU' || book === 'FRHoF'
							if (edition === '2024' ? is2024 : !is2024) {
								const classesInObj = Object.keys(clsObj).map(c => c.toLowerCase())
								if (targetClasses.some(tc => classesInObj.includes(tc))) {
									return true
								}
							}
						}
					}
				}
				return false
			})
		}

		if (search) {
			const q = search.toLowerCase()
			spells = spells.filter(sp => sp.name?.toLowerCase().includes(q))
		}

		const damage = (req.query.damage || '').toLowerCase().trim()
		if (damage) {
			spells = spells.filter(s => {
				const dt = (s.damage_type || '').toLowerCase()
				const dmgInflict = Array.isArray(s.damageInflict) ? s.damageInflict.map(d => String(d).toLowerCase()) : []
				return dt.includes(damage) || dmgInflict.includes(damage)
			})
		}

		return response.ok('success', 'Retrieved spells', spells, res)
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
			if (ofs && ofs.length > 0) {
				return response.ok('success', 'Retrieved optional features', ofs.map(formatOptionalFeature), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium optional features query failed, falling back to JSON:', err.message)
		}

		const otherEdition = edition === '2024' ? '2014' : '2024'
		const datas = await getData.all('optionalfeatures.json', edition)
		let list = datas?.optionalfeature || []
		if (list.length === 0) {
			const fallback = await getData.all('optionalfeatures.json', otherEdition)
			list = fallback?.optionalfeature || []
		}
		if (featureTypeRaw) {
			const types = featureTypeRaw.split(/[;,]/).map(t => t.trim())
			list = list.filter(o => {
				const ft = Array.isArray(o.featureType) ? o.featureType : (o.featureType ? [o.featureType] : [])
				return types.some(t => ft.map(x => String(x).toUpperCase()).includes(t))
			})
		}
		if (search) {
			list = list.filter(o => o.name?.toLowerCase().includes(search))
		}
		return response.ok('success', 'Retrieved optional features', list.map(o => ({
			...o,
			prerequisite: formatPrerequisite(o.prerequisite)
		})), res)
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
			if (items && items.length > 0) {
				return response.ok('success', 'Retrieved items', items.map(formatItem), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium items query failed, falling back to JSON:', err.message)
		}

		const baseDatas = await getData.all('items-base.json', edition)
		const datas = await getData.all('items.json', edition)
		const baseItems = (baseDatas?.baseitem || []).map(b => ({
			...b,
			itemType: b.weaponCategory ? 'weapon' : (b.armorCategory ? 'armor' : 'item')
		}))
		const typeItems = (baseDatas?.itemType || []).map(t => ({
			name: t.name,
			edition,
			source: t.source || (edition === '2024' ? 'XPHB' : 'PHB'),
			itemType: 'tool',
			type: t.abbreviation || 'Tool',
			entries: t.entries || []
		}))
		const groupItems = (datas?.itemGroup || []).map(g => ({
			name: g.name,
			edition,
			source: g.source || (edition === '2024' ? 'XPHB' : 'PHB'),
			itemType: 'tool',
			type: g.type || 'Tool',
			entries: g.entries || [],
			items: g.items || []
		}))
		let items = [...baseItems, ...(datas?.item || []), ...typeItems, ...groupItems]

		const seenNames = new Set()
		items = items.filter(it => {
			const k = (it.name || '').toLowerCase()
			if (!k || seenNames.has(k)) return false
			seenNames.add(k)
			return true
		})

		if (edition === '2024') {
			items = items.filter(i => i.edition === 'one' || i.edition === '2024' || i.source === 'XPHB' || i.mastery || i.itemType === 'tool')
		}

		if (mastery) {
			const m = mastery.toLowerCase()
			items = items.filter(i => Array.isArray(i.mastery) && i.mastery.some(x => x.toLowerCase().startsWith(m)))
		}

		if (itemType) {
			const t = itemType.toLowerCase()
			if (t.includes('simple')) items = items.filter(i => (i.weaponCategory || '').toLowerCase() === 'simple' || (i.type || '').toLowerCase().includes('simple'))
			else if (t.includes('martial')) items = items.filter(i => (i.weaponCategory || '').toLowerCase() === 'martial' || (i.type || '').toLowerCase().includes('martial'))
			else if (t.includes('instrument') || t === 'ins') items = items.filter(i => i.type === 'INS' || (i.name || '').toLowerCase().includes('instrument'))
			else if (t.includes('shield')) items = items.filter(i => i.type === 'S' || (i.name || '').toLowerCase().includes('shield'))
			else if (t.includes('armor')) {
				if (t.includes('light')) items = items.filter(i => (i.armorCategory || '').toLowerCase() === 'light')
				else if (t.includes('medium')) items = items.filter(i => (i.armorCategory || '').toLowerCase() === 'medium')
				else if (t.includes('heavy')) items = items.filter(i => (i.armorCategory || '').toLowerCase() === 'heavy')
				else items = items.filter(i => i.armorCategory || i.ac)
			}
			else if (t === 'weapon') items = items.filter(i => i.weaponCategory || i.dmg1)
			else if (t === 'armor') items = items.filter(i => i.armorCategory || i.ac)
		}

		if (category) {
			const cat = category.toLowerCase()
			items = items.filter(i => (i.category || '').toLowerCase() === cat || (i.type || '').toLowerCase() === cat)
		}

		if (search) {
			const s = search.toLowerCase()
			items = items.filter(i => i.name?.toLowerCase().includes(s))
		}

		const paged = items.slice(offset, offset + limit)
		return response.ok('success', 'Retrieved items', paged, res)
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
				if (source) {
					const src = source.toUpperCase()
					items = items.filter(i => (i.source || '').toUpperCase() === src)
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
			if (rules && rules.length > 0) {
				return response.ok('success', 'Retrieved rules and glossary', rules.map(formatRule), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium rules query failed, falling back to JSON:', err.message)
		}

		const otherEdition = edition === '2024' ? '2014' : '2024'

		const [vrMain, actMain, condMain, skillMain, senseMain] = await Promise.all([
			getData.all('variantrules.json', edition),
			getData.all('actions.json', edition),
			getData.all('conditionsdiseases.json', edition),
			getData.all('skills.json', edition),
			getData.all('senses.json', edition)
		])

		let list = []

		if (!category || category === 'rule' || category === 'variantrule') {
			(vrMain?.variantrule || []).forEach(r => {
				list.push({
					id: `rule-${r.name}-${r.source}`,
					name: r.name,
					type: 'Rule',
					category: 'Variant Rule',
					source: r.source,
					edition,
					entries: flattenEntries(r.entries)
				})
			})
		}

		if (!category || category === 'action') {
			(actMain?.action || []).forEach(a => {
				list.push({
					id: `action-${a.name}-${a.source}`,
					name: a.name,
					type: 'Action',
					category: a.time ? (Array.isArray(a.time) ? a.time[0] : a.time) : 'Action',
					source: a.source,
					edition,
					entries: flattenEntries(a.entries)
				})
			})
		}

		if (!category || category === 'condition' || category === 'status') {
			(condMain?.condition || []).forEach(c => {
				list.push({
					id: `cond-${c.name}-${c.source}`,
					name: c.name,
					type: 'Condition',
					category: 'Condition',
					source: c.source,
					edition,
					entries: flattenEntries(c.entries)
				})
			})
			;(condMain?.status || []).forEach(s => {
				list.push({
					id: `status-${s.name}-${s.source}`,
					name: s.name,
					type: 'Status',
					category: 'Status',
					source: s.source,
					edition,
					entries: flattenEntries(s.entries)
				})
			})
		}

		if (!category || category === 'skill') {
			(skillMain?.skill || []).forEach(s => {
				list.push({
					id: `skill-${s.name}-${s.source}`,
					name: s.name,
					type: 'Skill',
					category: 'Skill',
					source: s.source,
					edition,
					entries: flattenEntries(s.entries)
				})
			})
		}

		if (!category || category === 'sense') {
			(senseMain?.sense || []).forEach(s => {
				list.push({
					id: `sense-${s.name}-${s.source}`,
					name: s.name,
					type: 'Sense',
					category: 'Sense',
					source: s.source,
					edition,
					entries: flattenEntries(s.entries)
				})
			})
		}

		if (list.length === 0) {
			const vrOther = await getData.all('variantrules.json', otherEdition)
			;(vrOther?.variantrule || []).forEach(r => {
				list.push({
					id: `rule-${r.name}-${r.source}`,
					name: r.name,
					type: 'Rule',
					category: 'Variant Rule',
					source: r.source,
					edition: otherEdition,
					entries: flattenEntries(r.entries)
				})
			})
		}

		const seen = new Set()
		list = list.filter(item => {
			const key = `${item.name.toLowerCase()}::${(item.source || '').toLowerCase()}`
			if (seen.has(key)) return false
			seen.add(key)
			return true
		})

		if (search) {
			list = list.filter(item =>
				item.name.toLowerCase().includes(search) ||
				item.type.toLowerCase().includes(search) ||
				item.category.toLowerCase().includes(search) ||
				(Array.isArray(item.entries) ? item.entries.join(' ').toLowerCase().includes(search) : false)
			)
		}

		return response.ok('success', 'Retrieved rules and glossary', list, res)
	},

	lookup: async (req, res) => {
		const type = (req.query.type || '').toLowerCase().trim()
		const name = (req.query.name || '').trim()
		const edition = req.query.edition || '2024'
		const source = (req.query.source || '').toLowerCase().trim()

		if (!name) {
			return response.badRequest('Name parameter is required', res)
		}

		const cleanText = (str) => {
			if (typeof str !== 'string') return ''
			let result = str
			let iterations = 0
			while (/\{@([a-zA-Z0-9_]+)(?: ([^{}]+))?\}/.test(result) && iterations < 10) {
				result = result.replace(/\{@([a-zA-Z0-9_]+)(?: ([^{}]+))?\}/g, (match, tag, content) => {
					if (!content) return ''
					const parts = content.split('|')
					const lowerTag = tag.toLowerCase()
					if (lowerTag === 'filter') return parts[0]
					if (lowerTag === 'b' || lowerTag === 'i' || lowerTag === 'strike' || lowerTag === 's' || lowerTag === 'u') return parts[0]
					if (lowerTag === 'dice' || lowerTag === 'damage' || lowerTag === 'd20') return parts[0]
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
					if (item.name && item.entry) {
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

		const qName = name.toLowerCase()

		// 0. Monsters Lookup
		if (type === 'monster' || type === 'creature' || type === 'bestiary') {
			try {
				let dbMonster = await db.compendium.getMonsterByName(name, edition)
				if (!dbMonster) {
					const otherEdition = edition === '2024' ? '2014' : '2024'
					dbMonster = await db.compendium.getMonsterByName(name, otherEdition)
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
					'SELECT * FROM compendium_spells WHERE LOWER(name) = LOWER($1) AND edition = $2',
					[name, edition]
				)
				if (!dbSpell) {
					dbSpell = await db.oneOrNone(
						'SELECT * FROM compendium_spells WHERE LOWER(name) = LOWER($1) ORDER BY (CASE WHEN edition = $2 THEN 0 ELSE 1 END) ASC LIMIT 1',
						[name, edition]
					)
				}
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
						entries: flattenEntries(safeJson(dbSpell.entries, []))
					}, res)
				}
			} catch (err) {
				// DB fallback to JSON
			}

			let spellFiles = []
			if (source) spellFiles.push(`spells/spells-${source}.json`)
			if (edition === '2024') {
				spellFiles.push('spells/spells-xphb.json', 'spells/spells-phb.json')
			} else {
				spellFiles.push('spells/spells-phb.json', 'spells/spells-xphb.json')
			}

			for (const file of spellFiles) {
				const datas = await getData.all(file, edition)
				const found = (datas?.spell || []).find(s => s.name?.toLowerCase() === qName)
				if (found) {
					const schoolMap = {
						A: 'Abjuration', C: 'Conjuration', D: 'Divination',
						E: 'Evocation', EN: 'Enchantment', I: 'Illusion',
						N: 'Necromancy', T: 'Transmutation'
					}
					return response.ok('success', 'Found spell', {
						name: found.name,
						type: 'spell',
						edition,
						source: found.source,
						level: found.level === 0 ? 'Cantrip' : `Level ${found.level}`,
						school: schoolMap[found.school] || found.school || 'Magic',
						castingTime: found.time?.[0] ? `${found.time[0].number} ${found.time[0].unit}` : '1 action',
						range: found.range?.distance?.amount ? `${found.range.distance.amount} ${found.range.distance.type || 'feet'}` : (found.range?.type || 'Self'),
						duration: found.duration?.[0] ? `${found.duration[0].concentration ? 'Concentration, ' : ''}${found.duration[0].duration?.amount || ''} ${found.duration[0].duration?.type || found.duration[0].type || ''}`.trim() : 'Instantaneous',
						components: found.components ? Object.entries(found.components).filter(([, v]) => v).map(([k, v]) => typeof v === 'string' ? `M (${v})` : k.toUpperCase()).join(', ') : 'None',
						entries: flattenEntries(found.entries)
					}, res)
				}
			}
		}

		// 2. Items Lookup
		if (type === 'item') {
			const qNorm = normalizeCompendiumName(name)
			try {
				let dbItem = await db.oneOrNone(
					'SELECT * FROM compendium_items WHERE LOWER(name) = LOWER($1) AND edition = $2',
					[name, edition]
				)
				if (!dbItem) {
					dbItem = await db.oneOrNone(
						'SELECT * FROM compendium_items WHERE LOWER(name) = LOWER($1) ORDER BY (CASE WHEN edition = $2 THEN 0 ELSE 1 END) ASC LIMIT 1',
						[name, edition]
					)
				}
				if (!dbItem) {
					const stripped = name.replace(/['’]/g, '')
					dbItem = await db.oneOrNone(
						'SELECT * FROM compendium_items WHERE LOWER(name) ILIKE $1 ORDER BY (CASE WHEN edition = $2 THEN 0 ELSE 1 END) ASC LIMIT 1',
						[`%${stripped}%`, edition]
					)
				}
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
						entries: flattenEntries(safeJson(dbItem.entries, []))
					}, res)
				}
			} catch (err) {
				// DB fallback to JSON
			}

			const otherEdition = edition === '2024' ? '2014' : '2024'
			const baseData = await getData.all('items-base.json', edition)
			const allItems = await getData.all('items.json', edition)
			const otherBase = await getData.all('items-base.json', otherEdition)
			const otherItems = await getData.all('items.json', otherEdition)

			const poolCurr = [
				...(baseData?.baseitem || []),
				...(baseData?.itemType || []),
				...(allItems?.item || []),
				...(allItems?.itemGroup || [])
			]
			const poolOther = [
				...(otherBase?.baseitem || []),
				...(otherBase?.itemType || []),
				...(otherItems?.item || []),
				...(otherItems?.itemGroup || [])
			]

			const matchItem = (i) => {
				const iname = (i.name || '').toLowerCase()
				if (iname === qName) return true
				if (normalizeCompendiumName(iname) === qNorm) return true
				return false
			}

			let foundItem = poolCurr.find(matchItem) || poolOther.find(matchItem)

			if (foundItem) {
				const entries = flattenEntries(foundItem.entries || [])
				if (Array.isArray(foundItem.items) && foundItem.items.length > 0) {
					const subList = foundItem.items.map(it => typeof it === 'string' ? it.split('|')[0] : it.name).join(', ')
					entries.push(`Includes: ${subList}`)
				}

				return response.ok('success', 'Found item', {
					name: foundItem.name,
					type: 'item',
					edition,
					source: foundItem.source || (edition === '2024' ? 'XPHB' : 'PHB'),
					itemType: foundItem.weaponCategory
						? `${foundItem.weaponCategory} weapon`
						: (foundItem.armorCategory
							? `${foundItem.armorCategory} armor`
							: (foundItem.type || foundItem.abbreviation || 'Tool / Equipment')),
					damage: foundItem.dmg1 ? `${foundItem.dmg1} ${foundItem.dmgType || ''}`.trim() : null,
					ac: foundItem.ac ? String(foundItem.ac) : null,
					properties: Array.isArray(foundItem.property) ? foundItem.property.map(p => p.split('|')[0]).join(', ') : null,
					mastery: Array.isArray(foundItem.mastery) ? foundItem.mastery.map(m => m.split('|')[0]).join(', ') : null,
					weight: foundItem.weight ? `${foundItem.weight} lb` : null,
					cost: foundItem.value ? (foundItem.value >= 100 ? `${foundItem.value / 100} gp` : `${foundItem.value} cp`) : null,
					entries
				}, res)
			}
		}

		// 3. Feats Lookup
		if (type === 'feat') {
			try {
				let dbFeat = await db.oneOrNone(
					'SELECT * FROM compendium_feats WHERE LOWER(name) = LOWER($1) AND edition = $2',
					[name, edition]
				)
				if (!dbFeat) {
					dbFeat = await db.oneOrNone(
						'SELECT * FROM compendium_feats WHERE LOWER(name) = LOWER($1) ORDER BY (CASE WHEN edition = $2 THEN 0 ELSE 1 END) ASC LIMIT 1',
						[name, edition]
					)
				}
				if (dbFeat) {
					return response.ok('success', 'Found feat', {
						name: dbFeat.name,
						type: 'feat',
						edition: dbFeat.edition,
						source: dbFeat.source,
						category: dbFeat.category === 'O' ? 'Origin Feat' : (dbFeat.category === 'G' ? 'General Feat' : (dbFeat.category || 'Feat')),
						entries: flattenEntries(safeJson(dbFeat.entries, []))
					}, res)
				}
			} catch (err) {
				// DB fallback to JSON
			}

			const otherEdition = edition === '2024' ? '2014' : '2024'
			const featData = await getData.all('feats.json', edition)
			let foundFeat = (featData?.feat || []).find(f => f.name?.toLowerCase() === qName)
			if (!foundFeat) {
				const otherData = await getData.all('feats.json', otherEdition)
				foundFeat = (otherData?.feat || []).find(f => f.name?.toLowerCase() === qName)
			}
			if (foundFeat) {
				return response.ok('success', 'Found feat', {
					name: foundFeat.name,
					type: 'feat',
					edition,
					source: foundFeat.source,
					category: foundFeat.category === 'O' ? 'Origin Feat' : (foundFeat.category === 'G' ? 'General Feat' : (foundFeat.category || 'Feat')),
					entries: flattenEntries(foundFeat.entries)
				}, res)
			}
		}

		// 4. Condition / Status / Disease Lookup
		if (type === 'condition' || type === 'status' || type === 'disease') {
			const otherEdition = edition === '2024' ? '2014' : '2024'
			const condData = await getData.all('conditionsdiseases.json', edition)
			const getCondList = (d) => [
				...(d?.condition || []),
				...(d?.status || []),
				...(d?.disease || [])
			]
			let foundCond = getCondList(condData).find(c => c.name?.toLowerCase() === qName)
			if (!foundCond) {
				const otherData = await getData.all('conditionsdiseases.json', otherEdition)
				foundCond = getCondList(otherData).find(c => c.name?.toLowerCase() === qName)
			}
			if (foundCond) {
				return response.ok('success', 'Found condition or status', {
					name: foundCond.name,
					type: type || 'condition',
					edition,
					source: foundCond.source,
					entries: flattenEntries(foundCond.entries)
				}, res)
			}
		}

		// 5. Optional Feature Lookup
		if (type === 'optfeature' || type === 'optionalfeature') {
			try {
				let dbOpt = await db.compendium.getOptionalFeatureByName(name, edition)
				if (!dbOpt) {
					const otherEdition = edition === '2024' ? '2014' : '2024'
					dbOpt = await db.compendium.getOptionalFeatureByName(name, otherEdition)
				}
				if (dbOpt) {
					return response.ok('success', 'Found optional feature', {
						name: dbOpt.name,
						type: 'optionalfeature',
						edition: dbOpt.edition,
						source: dbOpt.source,
						category: 'Optional Feature',
						prerequisite: formatPrerequisite(dbOpt.prerequisite),
						entries: flattenEntries(safeJson(dbOpt.entries, []))
					}, res)
				}
			} catch (err) {
				void err
			}

			const otherEdition = edition === '2024' ? '2014' : '2024'
			const optData = await getData.all('optionalfeatures.json', edition)
			let foundOpt = (optData?.optionalfeature || []).find(o => o.name?.toLowerCase() === qName)
			if (!foundOpt) {
				const otherData = await getData.all('optionalfeatures.json', otherEdition)
				foundOpt = (otherData?.optionalfeature || []).find(o => o.name?.toLowerCase() === qName)
			}
			if (foundOpt) {
				return response.ok('success', 'Found optional feature', {
					name: foundOpt.name,
					type: 'optionalfeature',
					edition,
					source: foundOpt.source,
					category: 'Optional Feature',
					entries: flattenEntries(foundOpt.entries)
				}, res)
			}
		}

		// 5. Rule & Variant Rule Lookup
		if (type === 'rule' || type === 'variantrule') {
			try {
				let dbRule = await db.compendium.getRuleByName(name, null, edition)
				if (!dbRule) {
					const otherEdition = edition === '2024' ? '2014' : '2024'
					dbRule = await db.compendium.getRuleByName(name, null, otherEdition)
				}
				if (dbRule) {
					return response.ok('success', 'Found rule', {
						name: dbRule.name,
						type: dbRule.type || 'Rule',
						edition: dbRule.edition,
						source: dbRule.source,
						category: dbRule.category || 'Rule',
						entries: flattenEntries(safeJson(dbRule.entries, []))
					}, res)
				}
			} catch (err) {
				void err
			}

			const ruleData = await getData.all('variantrules.json', edition)
			const qNorm = normalizeCompendiumName(name)
			const matchRule = (r) => {
				const rn = r.name?.toLowerCase()
				return rn === qName || rn === qName + 's' || rn.replace(/s$/, '') === qName.replace(/s$/, '') || normalizeCompendiumName(rn) === qNorm
			}
			let foundRule = (ruleData?.variantrule || []).find(matchRule)
			if (!foundRule) {
				const otherEdition = edition === '2024' ? '2014' : '2024'
				const otherData = await getData.all('variantrules.json', otherEdition)
				foundRule = (otherData?.variantrule || []).find(matchRule)
			}
			// If not found in variant rules, cross-check actions and conditions
			if (!foundRule) {
				const [actData, condData] = await Promise.all([
					getData.all('actions.json', edition),
					getData.all('conditionsdiseases.json', edition)
				])
				const altList = [
					...(actData?.action || []),
					...(condData?.condition || []),
					...(condData?.status || [])
				]
				foundRule = altList.find(matchRule)
			}
			if (foundRule) {
				return response.ok('success', 'Found rule', {
					name: foundRule.name,
					type: 'variantrule',
					edition,
					source: foundRule.source,
					category: foundRule.time ? 'Action' : (foundRule.type || 'Rule'),
					entries: flattenEntries(foundRule.entries)
				}, res)
			}
		}

		// 6. Skill Lookup
		if (type === 'skill') {
			const otherEdition = edition === '2024' ? '2014' : '2024'
			const skillData = await getData.all('skills.json', edition)
			let foundSkill = (skillData?.skill || []).find(s => s.name?.toLowerCase() === qName)
			if (!foundSkill) {
				const otherData = await getData.all('skills.json', otherEdition)
				foundSkill = (otherData?.skill || []).find(s => s.name?.toLowerCase() === qName)
			}
			if (foundSkill) {
				return response.ok('success', 'Found skill', {
					name: foundSkill.name,
					type: 'skill',
					edition,
					source: foundSkill.source,
					category: 'Skill',
					entries: flattenEntries(foundSkill.entries)
				}, res)
			}
		}

		// 7. Sense Lookup
		if (type === 'sense') {
			const otherEdition = edition === '2024' ? '2014' : '2024'
			const senseData = await getData.all('senses.json', edition)
			let foundSense = (senseData?.sense || []).find(s => s.name?.toLowerCase() === qName)
			if (!foundSense) {
				const otherData = await getData.all('senses.json', otherEdition)
				foundSense = (otherData?.sense || []).find(s => s.name?.toLowerCase() === qName)
			}
			if (foundSense) {
				return response.ok('success', 'Found sense', {
					name: foundSense.name,
					type: 'sense',
					edition,
					source: foundSense.source,
					category: 'Sense',
					entries: flattenEntries(foundSense.entries)
				}, res)
			}
		}

		// 8. Action Lookup
		if (type === 'action') {
			const otherEdition = edition === '2024' ? '2014' : '2024'
			const actionData = await getData.all('actions.json', edition)
			let foundAction = (actionData?.action || []).find(a => a.name?.toLowerCase() === qName)
			if (!foundAction) {
				const otherData = await getData.all('actions.json', otherEdition)
				foundAction = (otherData?.action || []).find(a => a.name?.toLowerCase() === qName)
			}
			if (foundAction) {
				return response.ok('success', 'Found action', {
					name: foundAction.name,
					type: 'action',
					edition,
					source: foundAction.source,
					category: 'Action',
					entries: flattenEntries(foundAction.entries)
				}, res)
			}
		}

		// 9. Universal Fallback (search conditions, statuses, variant rules, skills, senses, actions, optfeatures)
		const otherEdition = edition === '2024' ? '2014' : '2024'
		const condData = await getData.all('conditionsdiseases.json', edition)
		const condListAll = [
			...(condData?.condition || []),
			...(condData?.status || []),
			...(condData?.disease || [])
		]
		let fb = condListAll.find(c => c.name?.toLowerCase() === qName)
		if (!fb) {
			const otherCond = await getData.all('conditionsdiseases.json', otherEdition)
			const otherCondListAll = [
				...(otherCond?.condition || []),
				...(otherCond?.status || []),
				...(otherCond?.disease || [])
			]
			fb = otherCondListAll.find(c => c.name?.toLowerCase() === qName)
		}
		if (fb) {
			return response.ok('success', 'Found condition or status', {
				name: fb.name,
				type: 'condition',
				edition,
				source: fb.source,
				entries: flattenEntries(fb.entries)
			}, res)
		}

		const ruleData = await getData.all('variantrules.json', edition)
		fb = (ruleData?.variantrule || []).find(r => r.name?.toLowerCase() === qName)
		if (!fb) {
			const otherRule = await getData.all('variantrules.json', otherEdition)
			fb = (otherRule?.variantrule || []).find(r => r.name?.toLowerCase() === qName)
		}
		if (fb) {
			return response.ok('success', 'Found rule', {
				name: fb.name,
				type: 'variantrule',
				edition,
				source: fb.source,
				category: 'Variant Rule',
				entries: flattenEntries(fb.entries)
			}, res)
		}

		const skillData = await getData.all('skills.json', edition)
		fb = (skillData?.skill || []).find(s => s.name?.toLowerCase() === qName)
		if (fb) {
			return response.ok('success', 'Found skill', {
				name: fb.name,
				type: 'skill',
				edition,
				source: fb.source,
				category: 'Skill',
				entries: flattenEntries(fb.entries)
			}, res)
		}

		const senseData = await getData.all('senses.json', edition)
		fb = (senseData?.sense || []).find(s => s.name?.toLowerCase() === qName)
		if (fb) {
			return response.ok('success', 'Found sense', {
				name: fb.name,
				type: 'sense',
				edition,
				source: fb.source,
				category: 'Sense',
				entries: flattenEntries(fb.entries)
			}, res)
		}

		const actionData = await getData.all('actions.json', edition)
		fb = (actionData?.action || []).find(a => a.name?.toLowerCase() === qName)
		if (fb) {
			return response.ok('success', 'Found action', {
				name: fb.name,
				type: 'action',
				edition,
				source: fb.source,
				category: 'Action',
				entries: flattenEntries(fb.entries)
			}, res)
		}

		try {
			let fbRule = await db.compendium.getRuleByName(name, null, edition)
			if (!fbRule) fbRule = await db.compendium.getRuleByName(name, null, otherEdition)
			if (fbRule) {
				return response.ok('success', 'Found rule', {
					name: fbRule.name,
					type: fbRule.type || 'Rule',
					edition: fbRule.edition,
					source: fbRule.source,
					category: fbRule.category || 'Rule',
					entries: flattenEntries(safeJson(fbRule.entries, []))
				}, res)
			}
			let fbOpt = await db.compendium.getOptionalFeatureByName(name, edition)
			if (!fbOpt) fbOpt = await db.compendium.getOptionalFeatureByName(name, otherEdition)
			if (fbOpt) {
				return response.ok('success', 'Found optional feature', {
					name: fbOpt.name,
					type: 'optionalfeature',
					edition: fbOpt.edition,
					source: fbOpt.source,
					category: 'Optional Feature',
					prerequisite: formatPrerequisite(fbOpt.prerequisite),
					entries: flattenEntries(safeJson(fbOpt.entries, []))
				}, res)
			}
			let fbMon = await db.compendium.getMonsterByName(name, edition)
			if (!fbMon) fbMon = await db.compendium.getMonsterByName(name, otherEdition)
			if (fbMon) {
				return response.ok('success', 'Found monster', formatMonster(fbMon), res)
			}
		} catch (_) {
			void _
		}

		return response.ok('not_found', 'No detail found', null, res)
	}
}
