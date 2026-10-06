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
		prerequisite: f.prerequisite,
		ability: safeJson(f.ability_bonus, []),
		repeatable: f.repeatable,
		entries: safeJson(f.entries, [])
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

		try {
			const feats = await db.compendium.getFeats({ edition, category, search })
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

		if (search) {
			const s = search.toLowerCase()
			feats = feats.filter(f => f.name?.toLowerCase().includes(s))
		}

		return response.ok('success', 'Retrieved feats', feats, res)
	},

	spells: async (req, res) => {
		const edition = req.query.edition || '2024'
		const level = req.query.level != null ? parseInt(req.query.level, 10) : null
		const maxLevel = req.query.maxLevel != null ? parseInt(req.query.maxLevel, 10) : null
		const school = req.query.school || null
		const search = req.query.search || null
		let className = req.query.className || null

		// Subclasses using wizard list
		if (className && (className.toLowerCase().includes('eldritch knight') || className.toLowerCase().includes('arcane trickster'))) {
			className = 'Wizard'
		}

		try {
			const spells = await db.compendium.getSpells({ edition, level, maxLevel, school, className, search })
			if (spells && spells.length > 0) {
				return response.ok('success', 'Retrieved spells', spells.map(formatSpell), res)
			}
		} catch (err) {
			console.warn('[WARN] DB compendium spells query failed, falling back to JSON:', err.message)
		}

		const file = edition === '2024' ? 'spells/spells-xphb.json' : 'spells/spells-phb.json'
		const datas = await getData.all(file, edition)
		let spells = datas?.spell || []

		if (level != null) {
			spells = spells.filter(s => s.level === level)
		}

		if (maxLevel != null) {
			spells = spells.filter(s => s.level <= maxLevel)
		}

		if (school) {
			const sch = school.toLowerCase()
			spells = spells.filter(s => s.school?.toLowerCase() === sch)
		}

		if (className) {
			const lookupData = await getData.all('generated/gendata-spell-source-lookup.json', edition) || {}
			const targetClass = className.toLowerCase()
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
								if (Object.keys(clsObj).some(c => c.toLowerCase() === targetClass)) {
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

		return response.ok('success', 'Retrieved spells', spells, res)
	},

	items: async (req, res) => {
		const edition = req.query.edition || '2024'
		const itemType = req.query.type || null
		const mastery = req.query.mastery || null
		const search = req.query.search || null
		const source = req.query.source || null
		const limit = req.query.limit ? Number(req.query.limit) : 40
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
		let items = [...baseItems, ...(datas?.item || [])]

		if (edition === '2024') {
			items = items.filter(i => i.edition === 'one' || i.source === 'XPHB' || i.mastery)
		}

		if (mastery) {
			const m = mastery.toLowerCase()
			items = items.filter(i => Array.isArray(i.mastery) && i.mastery.some(x => x.toLowerCase().startsWith(m)))
		}

		if (itemType) {
			const t = itemType.toLowerCase()
			if (t === 'weapon') items = items.filter(i => i.weaponCategory || i.dmg1)
			else if (t === 'armor') items = items.filter(i => i.armorCategory || i.ac)
		}

		if (search) {
			const s = search.toLowerCase()
			items = items.filter(i => i.name?.toLowerCase().includes(s))
		}

		const paged = items.slice(offset, offset + limit)
		return response.ok('success', 'Retrieved items', paged, res)
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
						components: found.components ? Object.entries(found.components).filter(([k, v]) => v).map(([k, v]) => typeof v === 'string' ? `M (${v})` : k.toUpperCase()).join(', ') : 'None',
						entries: flattenEntries(found.entries)
					}, res)
				}
			}
		}

		// 2. Items Lookup
		if (type === 'item') {
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
			let foundItem = (baseData?.baseitem || []).find(i => i.name?.toLowerCase() === qName)
			if (!foundItem) {
				const allItems = await getData.all('items.json', edition)
				foundItem = (allItems?.item || []).find(i => i.name?.toLowerCase() === qName)
			}
			if (!foundItem) {
				const otherBase = await getData.all('items-base.json', otherEdition)
				foundItem = (otherBase?.baseitem || []).find(i => i.name?.toLowerCase() === qName)
			}
			if (!foundItem) {
				const otherItems = await getData.all('items.json', otherEdition)
				foundItem = (otherItems?.item || []).find(i => i.name?.toLowerCase() === qName)
			}
			if (foundItem) {
				return response.ok('success', 'Found item', {
					name: foundItem.name,
					type: 'item',
					edition,
					source: foundItem.source,
					itemType: foundItem.weaponCategory ? `${foundItem.weaponCategory} weapon` : (foundItem.armorCategory ? `${foundItem.armorCategory} armor` : (foundItem.type || 'Adventuring Gear')),
					damage: foundItem.dmg1 ? `${foundItem.dmg1} ${foundItem.dmgType || ''}`.trim() : null,
					ac: foundItem.ac ? String(foundItem.ac) : null,
					properties: Array.isArray(foundItem.property) ? foundItem.property.map(p => p.split('|')[0]).join(', ') : null,
					mastery: Array.isArray(foundItem.mastery) ? foundItem.mastery.map(m => m.split('|')[0]).join(', ') : null,
					weight: foundItem.weight ? `${foundItem.weight} lb` : null,
					cost: foundItem.value ? (foundItem.value >= 100 ? `${foundItem.value / 100} gp` : `${foundItem.value} cp`) : null,
					entries: flattenEntries(foundItem.entries)
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

		// 4. Condition Lookup
		if (type === 'condition') {
			const otherEdition = edition === '2024' ? '2014' : '2024'
			const condData = await getData.all('conditionsdiseases.json', edition)
			let foundCond = (condData?.condition || []).find(c => c.name?.toLowerCase() === qName)
			if (!foundCond) {
				const otherData = await getData.all('conditionsdiseases.json', otherEdition)
				foundCond = (otherData?.condition || []).find(c => c.name?.toLowerCase() === qName)
			}
			if (foundCond) {
				return response.ok('success', 'Found condition', {
					name: foundCond.name,
					type: 'condition',
					edition,
					source: foundCond.source,
					entries: flattenEntries(foundCond.entries)
				}, res)
			}
		}

		// 5. Optional Feature Lookup
		if (type === 'optfeature' || type === 'optionalfeature') {
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
			const ruleData = await getData.all('variantrules.json', edition)
			let foundRule = (ruleData?.variantrule || []).find(r => r.name?.toLowerCase() === qName)
			if (!foundRule) {
				const otherEdition = edition === '2024' ? '2014' : '2024'
				const otherData = await getData.all('variantrules.json', otherEdition)
				foundRule = (otherData?.variantrule || []).find(r => r.name?.toLowerCase() === qName)
			}
			if (foundRule) {
				return response.ok('success', 'Found rule', {
					name: foundRule.name,
					type: 'variantrule',
					edition,
					source: foundRule.source,
					category: 'Variant Rule',
					entries: flattenEntries(foundRule.entries)
				}, res)
			}
		}

		return response.ok('not_found', 'No detail found', null, res)
	}
}
