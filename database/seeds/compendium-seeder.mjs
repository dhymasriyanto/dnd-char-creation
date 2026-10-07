'use strict'

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdir, readFile } from 'fs/promises'
import { db, pgp } from '../index.mjs'

const __dirname = fileURLToPath(dirname(import.meta.url))
const ROOT = join(__dirname, '../../')
const DIR_2014 = join(ROOT, '2014_data')
const DIR_2024 = join(ROOT, '2024_data')

async function readJson(path) {
	try {
		const raw = await readFile(path, 'utf8')
		return JSON.parse(raw)
	} catch (err) {
		console.warn(`[WARN] Skipping ${path}: ${err.message}`)
		return null
	}
}

async function batchInsert(table, cs, data, chunkSize = 500) {
	if (!data || data.length === 0) return
	for (let i = 0; i < data.length; i += chunkSize) {
		const chunk = data.slice(i, i + chunkSize)
		const query = pgp.helpers.insert(chunk, cs) + ' ON CONFLICT DO NOTHING'
		await db.none(query)
	}
}

function parseSpeed(spd) {
	if (typeof spd === 'number') return { walk: spd, fly: 0, swim: 0, climb: 0 }
	if (!spd || typeof spd !== 'object') return { walk: 30, fly: 0, swim: 0, climb: 0 }
	return {
		walk: typeof spd.walk === 'number' ? spd.walk : 30,
		fly: typeof spd.fly === 'number' ? spd.fly : 0,
		swim: typeof spd.swim === 'number' ? spd.swim : 0,
		climb: typeof spd.climb === 'number' ? spd.climb : 0
	}
}

function parseSize(sz) {
	if (Array.isArray(sz)) return sz.join(', ')
	return sz || 'Medium'
}

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
		} catch (_) {}
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

// -------------------------------------------------------------
// 1. RACES & SUBRACES
// -------------------------------------------------------------
async function seedRaces() {
	console.log('--- Seeding Races & Subraces ---')
	const csRace = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'size',
		'speed', 'fly_speed', 'swim_speed', 'climb_speed',
		'darkvision', 'creature_types:json', 'ability_bonuses:json',
		'traits:json', 'entries:json'
	], { table: 'compendium_races' })

	const racesToInsert = []

	// 2014 Races
	const data2014 = await readJson(join(DIR_2014, 'races.json'))
	if (data2014?.race) {
		for (const r of data2014.race) {
			const spd = parseSpeed(r.speed)
			racesToInsert.push({
				name: r.name,
				edition: '2014',
				source: r.source || 'PHB',
				page: r.page ? String(r.page) : null,
				size: parseSize(r.size),
				speed: spd.walk,
				fly_speed: spd.fly,
				swim_speed: spd.swim,
				climb_speed: spd.climb,
				darkvision: r.darkvision || 0,
				creature_types: JSON.stringify(r.creatureTypes || ['humanoid']),
				ability_bonuses: r.ability ? JSON.stringify(r.ability) : null,
				traits: JSON.stringify(r.traitTags || []),
				entries: JSON.stringify(r.entries || [])
			})
		}
	}

	// 2024 Races (edition === 'one' or source === 'XPHB')
	const data2024 = await readJson(join(DIR_2024, 'races.json'))
	if (data2024?.race) {
		for (const r of data2024.race) {
			const is2024 = r.edition === 'one' || r.source === 'XPHB' || r.source === 'EFA' || r.source === 'RHW'
			if (!is2024) continue
			const spd = parseSpeed(r.speed)
			racesToInsert.push({
				name: r.name,
				edition: '2024',
				source: r.source || 'XPHB',
				page: r.page ? String(r.page) : null,
				size: parseSize(r.size),
				speed: spd.walk,
				fly_speed: spd.fly,
				swim_speed: spd.swim,
				climb_speed: spd.climb,
				darkvision: r.darkvision || 0,
				creature_types: JSON.stringify(r.creatureTypes || ['humanoid']),
				ability_bonuses: null, // 2024 species ASI is moved to Background
				traits: JSON.stringify(r.traitTags || []),
				entries: JSON.stringify(r.entries || [])
			})
		}
	}

	await batchInsert('compendium_races', csRace, racesToInsert)
	console.log(`Inserted ${racesToInsert.length} races.`)

	// Subraces
	const csSubRace = new pgp.helpers.ColumnSet([
		'race_id', 'name', 'edition', 'source', 'page',
		'ability_bonuses:json', 'traits:json', 'entries:json'
	], { table: 'compendium_sub_races' })

	const dbRaces = await db.any('SELECT id, name, edition, source FROM compendium_races')
	const raceMap = new Map()
	for (const r of dbRaces) {
		raceMap.set(`${r.name.toLowerCase()}|${r.edition}`, r.id)
	}

	const subRacesToInsert = []
	const processSubrace = (srList, edition) => {
		for (const sr of srList) {
			const parentName = sr.raceName || sr._copy?.raceName
			if (!parentName) continue
			let srName = sr.name
			if (!srName) {
				if (parentName.toLowerCase() === 'human') {
					srName = 'Standard'
				} else {
					continue
				}
			}
			const raceId = raceMap.get(`${parentName.toLowerCase()}|${edition}`)
			if (!raceId) continue

			subRacesToInsert.push({
				race_id: raceId,
				name: srName,
				edition,
				source: sr.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: sr.page ? String(sr.page) : null,
				ability_bonuses: sr.ability ? JSON.stringify(sr.ability) : null,
				traits: JSON.stringify(sr.traitTags || []),
				entries: JSON.stringify(sr.entries || [])
			})
		}
	}

	if (data2014?.subrace) processSubrace(data2014.subrace, '2014')
	if (data2024?.subrace) {
		const sr2024 = data2024.subrace.filter(s => s.edition === 'one' || s.source === 'XPHB')
		processSubrace(sr2024, '2024')
	}

	await batchInsert('compendium_sub_races', csSubRace, subRacesToInsert)
	console.log(`Inserted ${subRacesToInsert.length} subraces.`)
}

// -------------------------------------------------------------
// 2. CLASSES, SUBCLASSES, & FEATURES
// -------------------------------------------------------------
async function seedClasses() {
	console.log('--- Seeding Classes, Subclasses & Features ---')
	const csClass = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'hit_dice',
		'primary_ability', 'saving_throws:json', 'spellcasting_ability',
		'subclass_title', 'subclass_level', 'armor_proficiencies:json',
		'weapon_proficiencies:json', 'tool_proficiencies:json',
		'skill_choices:json', 'starting_equipment:json', 'entries:json'
	], { table: 'compendium_classes' })

	const csSubClass = new pgp.helpers.ColumnSet([
		'class_id', 'name', 'short_name', 'edition', 'source', 'page',
		'spellcasting_ability', 'entries:json'
	], { table: 'compendium_sub_classes' })

	const csClassFeature = new pgp.helpers.ColumnSet([
		'class_id', 'name', 'level', 'edition', 'source', 'page', 'entries:json'
	], { table: 'compendium_class_features' })

	const csSubClassFeature = new pgp.helpers.ColumnSet([
		'sub_class_id', 'name', 'level', 'edition', 'source', 'page', 'entries:json'
	], { table: 'compendium_sub_class_features' })

	const classFiles = (await readdir(join(DIR_2024, 'class')))
		.filter(f => f.startsWith('class-') && f.endsWith('.json'))

	for (const file of classFiles) {
		const cData = await readJson(join(DIR_2024, 'class', file))
		if (!cData?.class) continue

		// Classes (both 2014 and 2024 can exist in cData.class)
		for (const cl of cData.class) {
			const is2024 = cl.edition === 'one' || cl.source === 'XPHB'
			const edition = is2024 ? '2024' : '2014'

			const hitDice = cl.hd ? `d${cl.hd.faces}` : 'd8'
			const savingThrows = cl.proficiency || []
			const subLevel = is2024 ? 3 : (cl.subclassTitle ? 3 : 1)

			const insertedClass = await db.oneOrNone(`
				INSERT INTO compendium_classes (
					name, edition, source, page, hit_dice, primary_ability,
					saving_throws, spellcasting_ability, subclass_title,
					subclass_level, armor_proficiencies, weapon_proficiencies,
					tool_proficiencies, skill_choices, starting_equipment, entries
				) VALUES (
					$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
				)
				ON CONFLICT (name, source, edition) DO UPDATE SET hit_dice = EXCLUDED.hit_dice, starting_equipment = EXCLUDED.starting_equipment
				RETURNING id
			`, [
				cl.name, edition, cl.source || (is2024 ? 'XPHB' : 'PHB'),
				cl.page ? String(cl.page) : null, hitDice,
				cl.primaryAbility ? JSON.stringify(cl.primaryAbility) : null,
				JSON.stringify(savingThrows), cl.spellcastingAbility || null,
				cl.subclassTitle || 'Subclass', subLevel,
				JSON.stringify(cl.startingProficiencies?.armor || []),
				JSON.stringify(cl.startingProficiencies?.weapons || []),
				JSON.stringify(cl.startingProficiencies?.tools || []),
				JSON.stringify(cl.startingProficiencies?.skills || []),
				JSON.stringify(cl.startingEquipment || null),
				JSON.stringify(cl.fluff || cl.entries || [])
			])

			const classId = insertedClass?.id
			if (!classId) continue

			// Class Features
			if (cData.classFeature) {
				const featuresToInsert = []
				for (const cf of cData.classFeature) {
					const cfIs2024 = cf.classSource === 'XPHB' || cf.source === 'XPHB'
					if (cfIs2024 !== is2024 || cf.className !== cl.name) continue

					featuresToInsert.push({
						class_id: classId,
						name: cf.name,
						level: cf.level || 1,
						edition,
						source: cf.source || cl.source,
						page: cf.page ? String(cf.page) : null,
						entries: JSON.stringify(cf.entries || [])
					})
				}
				await batchInsert('compendium_class_features', csClassFeature, featuresToInsert)
			}

			// Subclasses
			if (cData.subclass) {
				for (const sc of cData.subclass) {
					const scSource = (sc.source || '').toUpperCase()
					// For 2024 edition, prioritize XPHB and exclude 2014 PHB legacy copy duplicates
					if (is2024 && scSource === 'PHB') continue
					const scIs2024 = sc.edition === 'one' || scSource === 'XPHB' || (is2024 && sc.classSource === 'XPHB' && scSource !== 'PHB')
					if (scIs2024 !== is2024 || sc.className !== cl.name) continue

					const insertedSub = await db.oneOrNone(`
						INSERT INTO compendium_sub_classes (
							class_id, name, short_name, edition, source, page,
							spellcasting_ability, entries
						) VALUES (
							$1, $2, $3, $4, $5, $6, $7, $8
						)
						ON CONFLICT (class_id, name, source, edition) DO UPDATE SET short_name = EXCLUDED.short_name
						RETURNING id
					`, [
						classId, sc.name, sc.shortName || sc.name, edition,
						sc.source || cl.source, sc.page ? String(sc.page) : null,
						sc.spellcastingAbility || null, JSON.stringify(sc.entries || [])
					])

					const subClassId = insertedSub?.id
					if (!subClassId || !cData.subclassFeature) continue

					// Subclass Features (strictly match subclass source and deduplicate)
					const scFeaturesToInsert = []
					const seenFeatureKeys = new Set()
					for (const scf of cData.subclassFeature) {
						if (scf.className !== cl.name) continue
						if (scf.subclassShortName !== sc.shortName && scf.subclassShortName !== sc.name) continue

						const scfSource = (scf.subclassSource || scf.source || '').toUpperCase()
						const targetSource = (sc.source || cl.source || '').toUpperCase()
						if (scfSource && targetSource && scfSource !== targetSource) continue

						const fKey = `${scf.name.trim().toLowerCase()}|${scf.level || subLevel}`
						if (seenFeatureKeys.has(fKey)) continue
						seenFeatureKeys.add(fKey)

						scFeaturesToInsert.push({
							sub_class_id: subClassId,
							name: scf.name,
							level: scf.level || subLevel,
							edition,
							source: scf.source || sc.source,
							page: scf.page ? String(scf.page) : null,
							entries: JSON.stringify(scf.entries || [])
						})
					}
					await batchInsert('compendium_sub_class_features', csSubClassFeature, scFeaturesToInsert)
				}
			}
		}
	}
	console.log('Classes, Subclasses, and Features seeded.')
}

// -------------------------------------------------------------
// 3. BACKGROUNDS
// -------------------------------------------------------------
function resolveBg(bg, bgMap, visited = new Set()) {
	if (!bg._copy) return { ...bg }
	const copyKey = `${bg._copy.name}|${bg._copy.source || ''}`.toLowerCase()
	if (visited.has(copyKey)) return { ...bg }
	visited.add(copyKey)

	let parent = bgMap.get(copyKey)
	if (!parent) {
		for (const [k, v] of bgMap.entries()) {
			if (k.startsWith(`${bg._copy.name.toLowerCase()}|`)) {
				parent = v
				break
			}
		}
	}
	if (!parent) return { ...bg }

	const resolvedParent = resolveBg(parent, bgMap, new Set(visited))
	const result = {
		...JSON.parse(JSON.stringify(resolvedParent)),
		...bg,
		name: bg.name,
		source: bg.source || resolvedParent.source,
		page: bg.page || resolvedParent.page
	}

	if (!bg.skillProficiencies && resolvedParent.skillProficiencies) {
		result.skillProficiencies = JSON.parse(JSON.stringify(resolvedParent.skillProficiencies))
	}
	if (!bg.toolProficiencies && resolvedParent.toolProficiencies) {
		result.toolProficiencies = JSON.parse(JSON.stringify(resolvedParent.toolProficiencies))
	}
	if (!bg.languageProficiencies && resolvedParent.languageProficiencies) {
		result.languageProficiencies = JSON.parse(JSON.stringify(resolvedParent.languageProficiencies))
	}
	if (!bg.startingEquipment && resolvedParent.startingEquipment) {
		result.startingEquipment = JSON.parse(JSON.stringify(resolvedParent.startingEquipment))
	}
	if (!bg.ability && resolvedParent.ability) {
		result.ability = JSON.parse(JSON.stringify(resolvedParent.ability))
	}
	if (!bg.feats && resolvedParent.feats) {
		result.feats = JSON.parse(JSON.stringify(resolvedParent.feats))
	}

	let entries = JSON.parse(JSON.stringify(resolvedParent.entries || []))
	if (bg.entries && bg.entries.length > 0) {
		entries = JSON.parse(JSON.stringify(bg.entries))
	}

	if (bg._copy._mod?.entries) {
		const rawMods = bg._copy._mod.entries
		const mods = Array.isArray(rawMods) ? rawMods : [rawMods]
		for (const m of mods) {
			const items = Array.isArray(m.items) ? m.items : (m.items ? [m.items] : [])
			if (m.mode === 'replaceArr') {
				if (typeof m.replace === 'string') {
					const idx = entries.findIndex(e => e && (e.name === m.replace || e === m.replace))
					if (idx !== -1) entries.splice(idx, 1, ...items)
				} else if (typeof m.replace === 'object' && typeof m.replace.index === 'number') {
					const idx = m.replace.index
					if (idx >= 0 && idx < entries.length) entries.splice(idx, 1, ...items)
				}
			} else if (m.mode === 'insertArr') {
				const idx = typeof m.index === 'number' ? m.index : entries.length
				entries.splice(idx, 0, ...items)
			} else if (m.mode === 'appendArr') {
				entries.push(...items)
			} else if (m.mode === 'prependArr') {
				entries.unshift(...items)
			} else if (m.mode === 'removeArr') {
				if (typeof m.names === 'string') {
					entries = entries.filter(e => !e || e.name !== m.names)
				} else if (Array.isArray(m.names)) {
					entries = entries.filter(e => !e || !m.names.includes(e.name))
				}
			}
		}
	}
	result.entries = entries
	return result
}

async function seedBackgrounds() {
	console.log('--- Seeding Backgrounds ---')
	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'ability_bonuses:json',
		'feats:json', 'skill_proficiencies:json', 'tool_proficiencies:json',
		'languages:json', 'equipment:json', 'entries:json'
	], { table: 'compendium_backgrounds' })

	const bgsToInsert = []

	// 2014
	const data2014 = await readJson(join(DIR_2014, 'backgrounds.json'))
	if (data2014?.background) {
		const bgMap2014 = new Map()
		for (const b of data2014.background) {
			bgMap2014.set(`${b.name}|${b.source || ''}`.toLowerCase(), b)
		}

		for (const rawB of data2014.background) {
			const b = resolveBg(rawB, bgMap2014)
			bgsToInsert.push({
				name: b.name,
				edition: '2014',
				source: b.source || 'PHB',
				page: b.page ? String(b.page) : null,
				ability_bonuses: null,
				feats: null,
				skill_proficiencies: JSON.stringify(b.skillProficiencies || []),
				tool_proficiencies: JSON.stringify(b.toolProficiencies || []),
				languages: JSON.stringify(b.languageProficiencies || []),
				equipment: JSON.stringify(b.startingEquipment || []),
				entries: JSON.stringify(b.entries || [])
			})
		}
	}

	// 2024
	const data2024 = await readJson(join(DIR_2024, 'backgrounds.json'))
	if (data2024?.background) {
		const bgMap2024 = new Map()
		for (const b of data2024.background) {
			bgMap2024.set(`${b.name}|${b.source || ''}`.toLowerCase(), b)
		}

		for (const rawB of data2024.background) {
			const is2024 = rawB.edition === 'one' || rawB.source === 'XPHB' || rawB.source === 'EFA'
			if (!is2024) continue
			const b = resolveBg(rawB, bgMap2024)

			bgsToInsert.push({
				name: b.name,
				edition: '2024',
				source: b.source || 'XPHB',
				page: b.page ? String(b.page) : null,
				ability_bonuses: JSON.stringify(b.ability || []),
				feats: JSON.stringify(b.feats || []),
				skill_proficiencies: JSON.stringify(b.skillProficiencies || []),
				tool_proficiencies: JSON.stringify(b.toolProficiencies || []),
				languages: JSON.stringify(b.languageProficiencies || []),
				equipment: JSON.stringify(b.startingEquipment || []),
				entries: JSON.stringify(b.entries || [])
			})
		}
	}

	await db.none('DELETE FROM compendium_backgrounds')
	await batchInsert('compendium_backgrounds', cs, bgsToInsert)
	console.log(`Inserted ${bgsToInsert.length} backgrounds.`)
}

// -------------------------------------------------------------
// 4. FEATS
// -------------------------------------------------------------
async function seedFeats() {
	console.log('--- Seeding Feats ---')
	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'category',
		'prerequisite', 'ability_bonus:json', 'repeatable', 'entries:json'
	], { table: 'compendium_feats' })

	const featsToInsert = []
	const catMap = {
		'O': 'Origin',
		'G': 'General',
		'FS': 'Fighting Style',
		'EB': 'Epic Boon'
	}

	// 2014
	const data2014 = await readJson(join(DIR_2014, 'feats.json'))
	if (data2014?.feat) {
		for (const f of data2014.feat) {
			featsToInsert.push({
				name: f.name,
				edition: '2014',
				source: f.source || 'PHB',
				page: f.page ? String(f.page) : null,
				category: 'General',
				prerequisite: f.prerequisite ? formatPrerequisite(f.prerequisite) : null,
				ability_bonus: JSON.stringify(f.ability || []),
				repeatable: false,
				entries: JSON.stringify(f.entries || [])
			})
		}
	}

	// 2024
	const data2024 = await readJson(join(DIR_2024, 'feats.json'))
	if (data2024?.feat) {
		for (const f of data2024.feat) {
			const is2024 = f.edition === 'one' || f.source === 'XPHB' || f.category
			if (!is2024) continue

			const rawCat = f.category || 'G'
			const category = catMap[rawCat] || rawCat

			featsToInsert.push({
				name: f.name,
				edition: '2024',
				source: f.source || 'XPHB',
				page: f.page ? String(f.page) : null,
				category,
				prerequisite: f.prerequisite ? formatPrerequisite(f.prerequisite) : null,
				ability_bonus: JSON.stringify(f.ability || []),
				repeatable: !!f.repeatable,
				entries: JSON.stringify(f.entries || [])
			})
		}
	}

	await batchInsert('compendium_feats', cs, featsToInsert)
	console.log(`Inserted ${featsToInsert.length} feats.`)
}

// -------------------------------------------------------------
// 5. SPELLS
// -------------------------------------------------------------
async function seedSpells() {
	console.log('--- Seeding Spells ---')
	const spellLookup = await readJson(join(DIR_2024, 'generated', 'gendata-spell-source-lookup.json')) || {}

	function getClassesForSpell(spellName, edition) {
		const k = spellName.toLowerCase()
		const classes = new Set()
		for (const [src, spells] of Object.entries(spellLookup)) {
			const entry = spells[k]
			if (!entry) continue
			const checkObj = (obj) => {
				for (const [book, clsObj] of Object.entries(obj)) {
					const is2024 = book === 'XPHB' || book === 'EFA' || book === 'AU' || book === 'FRHoF'
					if (edition === '2024' ? is2024 : !is2024) {
						for (const c of Object.keys(clsObj)) classes.add(c)
					}
				}
			}
			if (entry.class) checkObj(entry.class)
			if (entry.classVariant) checkObj(entry.classVariant)
		}
		return Array.from(classes)
	}

	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'level', 'school',
		'casting_time', 'range', 'components', 'duration',
		'concentration', 'ritual', 'damage_dice', 'damage_type',
		'save_ability', 'classes:json', 'entries:json', 'higher_levels:json'
	], { table: 'compendium_spells' })

	const spellsToInsert = []

	const processSpell = (spellList, edition) => {
		for (const s of spellList) {
			const timeStr = Array.isArray(s.time)
				? s.time.map(t => `${t.number} ${t.unit}`).join(', ')
				: '1 action'

			const rangeStr = s.range ? (s.range.distance ? `${s.range.distance.amount || ''} ${s.range.distance.type || ''}`.trim() : s.range.type) : 'Self'

			let compStr = ''
			if (s.components) {
				const parts = []
				if (s.components.v) parts.push('V')
				if (s.components.s) parts.push('S')
				if (s.components.m) parts.push(typeof s.components.m === 'string' ? `M (${s.components.m})` : 'M')
				compStr = parts.join(', ')
			}

			let durationStr = 'Instantaneous'
			let concentration = false
			if (Array.isArray(s.duration) && s.duration[0]) {
				const d = s.duration[0]
				concentration = !!d.concentration
				durationStr = d.type === 'timed' ? `${d.duration?.amount || 1} ${d.duration?.type || 'round'}` : d.type
				if (concentration) durationStr = `Concentration, up to ${durationStr}`
			}

			const derivedClasses = getClassesForSpell(s.name, edition)

			spellsToInsert.push({
				name: s.name,
				edition,
				source: s.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: s.page ? String(s.page) : null,
				level: s.level || 0,
				school: s.school || 'A',
				casting_time: timeStr,
				range: rangeStr,
				components: compStr,
				duration: durationStr,
				concentration,
				ritual: !!(s.meta?.ritual),
				damage_dice: s.scalingLevelDice ? JSON.stringify(s.scalingLevelDice) : null,
				damage_type: s.damageInflict ? s.damageInflict.join(', ') : null,
				save_ability: s.savingThrow ? s.savingThrow.join(', ') : null,
				classes: JSON.stringify(derivedClasses),
				entries: JSON.stringify(s.entries || []),
				higher_levels: JSON.stringify(s.entriesHigherLevel || [])
			})
		}
	}

	const dataPhb = await readJson(join(DIR_2024, 'spells', 'spells-phb.json'))
	if (dataPhb?.spell) processSpell(dataPhb.spell, '2014')

	const dataXphb = await readJson(join(DIR_2024, 'spells', 'spells-xphb.json'))
	if (dataXphb?.spell) processSpell(dataXphb.spell, '2024')

	await batchInsert('compendium_spells', cs, spellsToInsert)
	console.log(`Inserted ${spellsToInsert.length} spells.`)
}

// -------------------------------------------------------------
// 6. ITEMS & WEAPON MASTERY
// -------------------------------------------------------------
async function seedItems() {
	console.log('--- Seeding Items ---')
	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'item_type',
		'rarity', 'cost_cp', 'weight', 'damage_dice', 'damage_type',
		'versatile_dice', 'mastery', 'base_ac', 'ac_dex_bonus',
		'stealth_disadvantage', 'strength_requirement', 'properties:json',
		'entries:json'
	], { table: 'compendium_items' })

	const itemsToInsert = []

	const processItems = (itemList, edition) => {
		for (const it of itemList || []) {
			const isWeapon = it.weaponCategory || it.dmg1
			const isArmor = it.armorCategory || it.ac
			let itemType = 'gear'
			if (isWeapon) itemType = 'weapon'
			else if (isArmor) itemType = 'armor'
			else if (['AT', 'T', 'GS', 'INS'].includes(it.type)) itemType = 'tool'
			else if (it.type === 'P' || it.type === 'SC') itemType = 'consumable'
			else if (it.wondrous) itemType = 'wondrous'

			let mastery = null
			if (Array.isArray(it.mastery) && it.mastery.length > 0) {
				const first = it.mastery[0]
				const mStr = typeof first === 'string' ? first : (first?.uid || first?.mastery || '')
				mastery = mStr ? mStr.split('|')[0] : null
			}

			itemsToInsert.push({
				name: it.name,
				edition,
				source: it.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: it.page ? String(it.page) : null,
				item_type: itemType,
				rarity: it.rarity || 'none',
				cost_cp: it.value ? (Number(it.value) || 0) : 0,
				weight: it.weight ? (Number(it.weight) || 0) : 0,
				damage_dice: it.dmg1 || null,
				damage_type: it.dmgType || null,
				versatile_dice: it.dmg2 || null,
				mastery,
				base_ac: it.ac ? (Number(it.ac) || 0) : 0,
				ac_dex_bonus: it.dexMod ? 'yes' : null,
				stealth_disadvantage: !!it.stealth,
				strength_requirement: it.strength ? (Number(it.strength) || 0) : 0,
				properties: it.property || [],
				entries: it.entries || []
			})
		}
	}

	const processItemGroups = (groupList, edition) => {
		for (const grp of groupList || []) {
			itemsToInsert.push({
				name: grp.name,
				edition,
				source: grp.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: grp.page ? String(grp.page) : null,
				item_type: 'tool',
				rarity: grp.rarity || 'none',
				cost_cp: typeof grp.value === 'number' ? grp.value : 0,
				weight: typeof grp.weight === 'number' ? grp.weight : 0,
				damage_dice: null,
				damage_type: null,
				versatile_dice: null,
				mastery: null,
				base_ac: 0,
				ac_dex_bonus: null,
				stealth_disadvantage: false,
				strength_requirement: 0,
				properties: grp.property || [],
				entries: grp.entries || (grp.items ? ['Includes: ' + grp.items.map(s => String(s).split('|')[0]).join(', ')] : [])
			})
		}
	}

	const processItemTypes = (typeList, edition) => {
		for (const t of typeList || []) {
			if (!t.name || !t.entries) continue
			itemsToInsert.push({
				name: t.name,
				edition,
				source: t.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: t.page ? String(t.page) : null,
				item_type: 'tool',
				rarity: 'none',
				cost_cp: 0,
				weight: 0,
				damage_dice: null,
				damage_type: null,
				versatile_dice: null,
				mastery: null,
				base_ac: 0,
				ac_dex_bonus: null,
				stealth_disadvantage: false,
				strength_requirement: 0,
				properties: [],
				entries: t.entries || []
			})
		}
	}

	for (const ed of ['2014', '2024']) {
		const dir = ed === '2014' ? DIR_2014 : DIR_2024
		const itemsData = await readJson(join(dir, 'items.json'))
		const baseData = await readJson(join(dir, 'items-base.json'))

		if (itemsData?.item) {
			const list = ed === '2024'
				? itemsData.item.filter(i => i.edition === 'one' || i.source === 'XPHB' || i.mastery)
				: itemsData.item
			processItems(list, ed)
		}
		if (itemsData?.itemGroup) processItemGroups(itemsData.itemGroup, ed)
		if (baseData?.baseitem) {
			const bList = ed === '2024'
				? baseData.baseitem.filter(i => i.edition === 'one' || i.source === 'XPHB' || i.source === 'XDMG' || i.mastery)
				: baseData.baseitem.filter(i => i.edition !== 'one' && i.source !== 'XPHB' && i.source !== 'XDMG')
			processItems(bList, ed)
		}
		if (baseData?.itemType) processItemTypes(baseData.itemType, ed)
	}

	// Deduplicate by name, source, edition
	const seen = new Set()
	const deduped = itemsToInsert.filter(i => {
		const key = `${i.name}|${i.source}|${i.edition}`.toLowerCase()
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	await db.none('DELETE FROM compendium_items')
	await batchInsert('compendium_items', cs, deduped)
	console.log(`Inserted ${deduped.length} items.`)
}

// -------------------------------------------------------------
// 7. RULES (Variant Rules, Rules Glossary, Actions, Conditions, Senses, Skills, Languages, Vehicles, Traps/Hazards, Builtins)
// -------------------------------------------------------------
async function seedRules() {
	console.log('--- Seeding Rules ---')
	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'type', 'category', 'entries:json'
	], { table: 'compendium_rules' })

	const rulesToInsert = []

	const processRules = async (edition) => {
		const dir = edition === '2014' ? DIR_2014 : DIR_2024

		// 1. Variant Rules & Rules Glossary
		const vrData = await readJson(join(dir, 'variantrules.json'))
		for (const r of vrData?.variantrule || []) {
			const is2024 = r.ruleType === 'C' || r.source === 'XPHB' || edition === '2024'
			const cat = r.ruleType === 'C' ? 'Rules Glossary' : (r.type || 'Variant Rule')
			rulesToInsert.push({
				name: r.name,
				edition: is2024 ? '2024' : '2014',
				source: r.source || (is2024 ? 'XPHB' : 'DMG'),
				page: r.page ? String(r.page) : null,
				type: 'Rule',
				category: cat,
				entries: r.entries || []
			})
		}

		// 2. Actions
		const actData = await readJson(join(dir, 'actions.json'))
		for (const a of actData?.action || []) {
			rulesToInsert.push({
				name: a.name,
				edition,
				source: a.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: a.page ? String(a.page) : null,
				type: 'Action',
				category: a.time?.[0]?.unit ? `${a.time[0].unit} Action` : 'Action',
				entries: a.entries || []
			})
		}

		// 3. Conditions, Statuses, & Diseases
		const condData = await readJson(join(dir, 'conditionsdiseases.json'))
		for (const c of condData?.condition || []) {
			rulesToInsert.push({
				name: c.name,
				edition,
				source: c.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: c.page ? String(c.page) : null,
				type: 'Condition',
				category: 'Condition',
				entries: c.entries || []
			})
		}
		for (const s of condData?.status || []) {
			rulesToInsert.push({
				name: s.name,
				edition,
				source: s.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: s.page ? String(s.page) : null,
				type: 'Status',
				category: 'Status',
				entries: s.entries || []
			})
		}
		for (const d of condData?.disease || []) {
			rulesToInsert.push({
				name: d.name,
				edition,
				source: d.source || (edition === '2024' ? 'XDMG' : 'DMG'),
				page: d.page ? String(d.page) : null,
				type: 'Disease',
				category: 'Disease',
				entries: d.entries || []
			})
		}

		// 4. Senses
		const senseData = await readJson(join(dir, 'senses.json'))
		for (const sn of senseData?.sense || []) {
			rulesToInsert.push({
				name: sn.name,
				edition,
				source: sn.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: sn.page ? String(sn.page) : null,
				type: 'Sense',
				category: 'Sense',
				entries: sn.entries || []
			})
		}

		// 5. Skills
		const skillData = await readJson(join(dir, 'skills.json'))
		for (const sk of skillData?.skill || []) {
			rulesToInsert.push({
				name: sk.name,
				edition,
				source: sk.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: sk.page ? String(sk.page) : null,
				type: 'Skill',
				category: 'Skill',
				entries: sk.entries || []
			})
		}

		// 6. Languages
		const langData = await readJson(join(dir, 'languages.json'))
		for (const l of langData?.language || []) {
			const lEntries = l.entries || (l.typicalSpeakers ? ['Typical speakers: ' + l.typicalSpeakers.map(s => String(s).split('|')[0].replace(/^\{@[a-zA-Z]+\s+/, '').replace(/\}$/, '')).join(', ')] : [`A language spoken in the worlds of D&D.`])
			rulesToInsert.push({
				name: l.name,
				edition,
				source: l.source || (edition === '2024' ? 'XPHB' : 'PHB'),
				page: l.page ? String(l.page) : null,
				type: 'Language',
				category: l.type ? `${l.type} Language` : 'Language',
				entries: lEntries
			})
		}

		// 7. Vehicles
		const vehData = await readJson(join(dir, 'vehicles.json'))
		for (const v of vehData?.vehicle || []) {
			rulesToInsert.push({
				name: v.name,
				edition,
				source: v.source || (edition === '2024' ? 'XDMG' : 'DMG'),
				page: v.page ? String(v.page) : null,
				type: 'Vehicle',
				category: v.vehicleType || 'Vehicle',
				entries: v.entries || []
			})
		}

		// 8. Traps & Hazards
		const trapData = await readJson(join(dir, 'trapshazards.json'))
		for (const t of trapData?.trap || []) {
			rulesToInsert.push({
				name: t.name,
				edition,
				source: t.source || (edition === '2024' ? 'XDMG' : 'DMG'),
				page: t.page ? String(t.page) : null,
				type: 'Trap',
				category: t.trapHazType || 'Trap',
				entries: t.entries || []
			})
		}
		for (const h of trapData?.hazard || []) {
			rulesToInsert.push({
				name: h.name,
				edition,
				source: h.source || (edition === '2024' ? 'XDMG' : 'DMG'),
				page: h.page ? String(h.page) : null,
				type: 'Hazard',
				category: h.trapHazType || 'Hazard',
				entries: h.entries || []
			})
		}
	}

	await processRules('2014')
	await processRules('2024')

	// 9. Built-in Core Rules & Damage Types
	const CORE_RULES_DATA = [
		{ name: "Artisan's Tools", type: 'Item', category: 'Tool', entries: ["These special tools include the items needed to pursue a craft or trade. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft.", "Each type of artisan's tools requires a separate proficiency (e.g. Alchemist's Supplies, Smith's Tools, Tinker's Tools, Brewer's Supplies, Woodcarver's Tools)."] },
		{ name: "Thieves' Tools", type: 'Item', category: 'Tool', entries: ["This set of tools includes a small file, a set of lock picks, a small mirror mounted on a metal handle, a set of narrow-bladed scissors, and a pair of pliers.", "Proficiency with these tools lets you add your proficiency bonus to any ability checks you make to disarm traps or open locks."] },
		{ name: 'Concentration', type: 'Rule', category: 'Spellcasting', entries: ["Some spells require you to maintain concentration in order to keep their magic active.", "If you take damage while concentrating, you must make a Constitution saving throw (DC 10 or half the damage taken, whichever is higher). Taking another concentration spell ends the current one."] },
		{ name: 'Opportunity Attack', type: 'Rule', category: 'Combat Reaction', entries: ["You can make an opportunity attack when a hostile creature that you can see moves out of your reach.", "Uses your reaction to make one melee attack against the provoking creature immediately before it leaves your reach."] },
		{ name: 'Attunement', type: 'Rule', category: 'Magic Items', entries: ["Some magic items require a creature to form a bond with them before their magical properties can be used.", "Attuning requires a creature to spend a short rest focused on only that item. A creature can be attuned to no more than 3 magic items at once."] },
		{ name: 'Carrying Capacity', type: 'Rule', category: 'Encumbrance', entries: ["Your carrying capacity is your Strength score multiplied by 15. This is the weight in pounds that you can carry.", "Push, Drag, or Lift: You can push, drag, or lift a weight in pounds up to twice your carrying capacity (Strength x 30)."] },
		{ name: 'Temporary Hit Points', type: 'Rule', category: 'Health', entries: ["Temporary hit points serve as a buffer against damage, protecting you from injury.", "If you take damage, that damage is subtracted from your temporary hit points first. Leftover damage carries over to normal hit points.", "Temporary hit points do not stack; if you receive new temporary hit points, you decide whether to keep the existing amount or take the new amount."] },
		{ name: 'Heroic Inspiration', type: 'Rule', category: 'Core Rule', entries: ["If you have Heroic Inspiration, you can expend it to reroll any one die roll and use the new result. You either have Heroic Inspiration or you do not; you cannot stockpile multiple instances."] },
		{ name: 'Inspiration', type: 'Rule', category: 'Core Rule', entries: ["If you have Inspiration, you can expend it to reroll any one die roll and use the new result. You either have Inspiration or you do not; you cannot stockpile multiple instances."] },
		{ name: 'Spell Slot', type: 'Rule', category: 'Spellcasting', entries: ["Spell slots represent the magical stamina available to cast spells. Casting a spell expends a slot of that spell's level or higher. Expended slots are regained after finishing a Long Rest (or Short Rest for Warlocks)."] },
		{ name: 'Spell Slots', type: 'Rule', category: 'Spellcasting', entries: ["Spell slots represent the magical stamina available to cast spells. Casting a spell expends a slot of that spell's level or higher. Expended slots are regained after finishing a Long Rest (or Short Rest for Warlocks)."] },
		{ name: 'Cantrip', type: 'Rule', category: 'Spellcasting', entries: ["A cantrip is a spell that can be cast at will, without using a spell slot and without being prepared in advance. It represents foundational magical knowledge."] },
		{ name: 'Cantrips', type: 'Rule', category: 'Spellcasting', entries: ["A cantrip is a spell that can be cast at will, without using a spell slot and without being prepared in advance. It represents foundational magical knowledge."] },
		{ name: 'Ritual Casting', type: 'Rule', category: 'Spellcasting', entries: ["Certain spells have the ritual tag. A ritual version takes 10 minutes longer to cast than normal, but does not expend a spell slot."] },
		{ name: 'Advantage', type: 'Rule', category: 'Core Rule', entries: ["When you have advantage on a d20 roll (attack roll, ability check, or saving throw), roll two d20s and use the higher result."] },
		{ name: 'Disadvantage', type: 'Rule', category: 'Core Rule', entries: ["When you have disadvantage on a d20 roll (attack roll, ability check, or saving throw), roll two d20s and use the lower result."] },
		{ name: 'Saving Throw', type: 'Rule', category: 'Core Rule', entries: ["A saving throw represents an attempt to resist or endure a harmful effect (such as a spell or dragon's breath). Roll a d20, add the ability modifier, and add your proficiency bonus if proficient in that save."] },
		{ name: 'Saving Throws', type: 'Rule', category: 'Core Rule', entries: ["A saving throw represents an attempt to resist or endure a harmful effect (such as a spell or dragon's breath). Roll a d20, add the ability modifier, and add your proficiency bonus if proficient in that save."] },
		{ name: 'Proficiency Bonus', type: 'Rule', category: 'Core Rule', entries: ["Your proficiency bonus is based on total character level (+2 at level 1-4, +3 at 5-8, +4 at 9-12, +5 at 13-16, +6 at 17-20). It adds to attacks with proficient weapons, proficient skills, saving throws, and your spell save DC."] },
		{ name: 'Armor Class', type: 'Rule', category: 'Combat', entries: ["Armor Class represents how difficult it is for an attacker to land a harmful blow on you. An attack roll must meet or beat your AC to hit."] },
		{ name: 'Armor Class (AC)', type: 'Rule', category: 'Combat', entries: ["Armor Class represents how difficult it is for an attacker to land a harmful blow on you. An attack roll must meet or beat your AC to hit."] },
		{ name: 'Initiative', type: 'Rule', category: 'Combat', entries: ["Initiative determines the order of turns during combat. Roll a d20 and add your Dexterity modifier when combat begins."] },
		{ name: 'Hit Dice', type: 'Rule', category: 'Health', entries: ["You have a number of Hit Dice equal to your total character level. During a Short Rest, you can spend Hit Dice to regain lost Hit Points. You regain half your total Hit Dice at the end of a Long Rest."] },
		{ name: 'Short Rest', type: 'Rule', category: 'Rest', entries: ["A Short Rest is a period of downtime, at least 1 hour long, during which a character does nothing more strenuous than eating, drinking, reading, and tending to wounds.", "A character can spend one or more Hit Dice at the end of a Short Rest, up to the character's maximum number of Hit Dice, to regain Hit Points."] },
		{ name: 'Long Rest', type: 'Rule', category: 'Rest', entries: ["A Long Rest is a period of extended downtime, at least 8 hours long, during which a character sleeps or performs light activity (reading, talking, eating, or standing watch for no more than 2 hours).", "At the end of a Long Rest, a character regains all lost Hit Points, all spent spell slots, and up to half of their total number of Hit Dice."] }
	]

	const DAMAGE_TYPES = [
		{ name: 'Acid', entries: ["The corrosive spray of a black dragon's breath and the dissolving enzymes secreted by a black pudding deal acid damage."] },
		{ name: 'Bludgeoning', entries: ["Blunt force attacks—hammers, falling, constriction, and the like—deal bludgeoning damage."] },
		{ name: 'Cold', entries: ["The infernal chill radiating from an ice devil's spear and the frigid blast of a white dragon's breath deal cold damage."] },
		{ name: 'Fire', entries: ["Red dragons breathe fire, and many spells conjure flames to deal fire damage."] },
		{ name: 'Force', entries: ["Force is pure magical energy focused into a damaging form. Most effects that deal force damage, including magic missile and spiritual weapon, are spells."] },
		{ name: 'Lightning', entries: ["A lightning bolt spell and a blue dragon's breath deal lightning damage."] },
		{ name: 'Necrotic', entries: ["Necrotic damage, dealt by certain undead and spells such as chill touch, withers matter and even the soul."] },
		{ name: 'Piercing', entries: ["Puncturing and impaling attacks, including spears and monsters' bites, deal piercing damage."] },
		{ name: 'Poison', entries: ["Venomous stings and the toxic gas of a green dragon's breath deal poison damage."] },
		{ name: 'Psychic', entries: ["Mental abilities such as a psionic blast or vicious mockery deal psychic damage."] },
		{ name: 'Radiant', entries: ["Radiant damage, dealt by a cleric's flame strike spell or an angel's smiting weapon, sears the flesh like fire and overloads the spirit with power."] },
		{ name: 'Slashing', entries: ["Swords, axes, and monsters' claws deal slashing damage."] },
		{ name: 'Thunder', entries: ["A concussive burst of sound, such as the effect of the Thunderwave spell, deals thunder damage."] }
	]

	for (const ed of ['2014', '2024']) {
		const src = ed === '2024' ? 'XPHB' : 'PHB'
		for (const cr of CORE_RULES_DATA) {
			rulesToInsert.push({
				name: cr.name,
				edition: ed,
				source: src,
				page: null,
				type: cr.type,
				category: cr.category,
				entries: cr.entries
			})
		}
		for (const dt of DAMAGE_TYPES) {
			rulesToInsert.push({
				name: dt.name,
				edition: ed,
				source: src,
				page: null,
				type: 'Damage Type',
				category: 'Damage',
				entries: dt.entries
			})
			rulesToInsert.push({
				name: `${dt.name} Damage`,
				edition: ed,
				source: src,
				page: null,
				type: 'Damage Type',
				category: 'Damage',
				entries: dt.entries
			})
		}
	}

	// Deduplicate by name, source, type, edition
	const seen = new Set()
	const deduped = rulesToInsert.filter(r => {
		const key = `${r.name}|${r.source}|${r.type}|${r.edition}`.toLowerCase()
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	await batchInsert('compendium_rules', cs, deduped)
	console.log(`Inserted ${deduped.length} rules.`)
}

// -------------------------------------------------------------
// 8. OPTIONAL FEATURES (Invocations, Metamagic, Maneuvers, Infusions, etc.)
// -------------------------------------------------------------
async function seedOptionalFeatures() {
	console.log('--- Seeding Optional Features ---')
	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'feature_type:json', 'prerequisite:json', 'entries:json'
	], { table: 'compendium_optional_features' })

	const featsToInsert = []

	const processOpt = async (edition) => {
		const dir = edition === '2014' ? DIR_2014 : DIR_2024
		const data = await readJson(join(dir, 'optionalfeatures.json'))
		for (const of of data?.optionalfeature || []) {
			const is2024 = of.source === 'XPHB' || of.edition === 'one' || edition === '2024'
			featsToInsert.push({
				name: of.name,
				edition: is2024 ? '2024' : '2014',
				source: of.source || 'PHB',
				page: of.page ? String(of.page) : null,
				feature_type: of.featureType || [],
				prerequisite: of.prerequisite ? formatPrerequisite(of.prerequisite) : null,
				entries: of.entries || []
			})
		}
	}

	await processOpt('2014')
	await processOpt('2024')

	// Deduplicate by name, source, edition
	const seen = new Set()
	const deduped = featsToInsert.filter(f => {
		const key = `${f.name}|${f.source}|${f.edition}`.toLowerCase()
		if (seen.has(key)) return false
		seen.add(key)
		return true
	})

	await batchInsert('compendium_optional_features', cs, deduped)
	console.log(`Inserted ${deduped.length} optional features.`)
}

// -------------------------------------------------------------
// 9. MONSTERS / BESTIARY
// -------------------------------------------------------------
async function seedMonsters() {
	console.log('--- Seeding Monsters / Bestiary ---')
	const cs = new pgp.helpers.ColumnSet([
		'name', 'edition', 'source', 'page', 'cr',
		'size:json', 'type:json', 'alignment:json', 'ac:json', 'hp:json', 'speed:json',
		'str', 'dex', 'con', 'int', 'wis', 'cha',
		'save:json', 'skill:json', 'passive', 'languages:json', 'senses:json',
		'trait:json', 'action:json', 'bonus:json', 'reaction:json', 'legendary:json',
		'spellcasting:json', 'environment:json', 'raw_data:json'
	], { table: 'compendium_monsters' })

	const processBestiaryDir = async (dir, edition) => {
		const bestiaryDir = join(dir, 'bestiary')
		let files = []
		try {
			const all = await readdir(bestiaryDir)
			files = all.filter(f => f.startsWith('bestiary-') && f.endsWith('.json'))
		} catch (e) {
			console.warn(`Could not read bestiary dir ${bestiaryDir}:`, e.message)
			return
		}

		let totalInserted = 0
		for (const file of files) {
			const data = await readJson(join(bestiaryDir, file))
			if (!data?.monster || data.monster.length === 0) continue

			const seenInFile = new Set()
			const rows = []
			for (const m of data.monster) {
				if (!m.name || !m.source) continue

				const key = `${m.name}|${m.source}`.toLowerCase()
				if (seenInFile.has(key)) continue
				seenInFile.add(key)

				let crStr = '0'
				if (typeof m.cr === 'string') crStr = m.cr
				else if (typeof m.cr === 'number') crStr = String(m.cr)
				else if (m.cr && typeof m.cr === 'object' && m.cr.cr) crStr = String(m.cr.cr)

				const is2024 = m.source === 'XMM' || m.source === 'XPHB' || m.source === 'XDMG' || edition === '2024'

				rows.push({
					name: m.name,
					edition: is2024 ? '2024' : '2014',
					source: m.source,
					page: m.page ? String(m.page) : null,
					cr: crStr,
					size: m.size || ['M'],
					type: m.type || 'humanoid',
					alignment: m.alignment || ['U'],
					ac: m.ac || [],
					hp: m.hp || {},
					speed: m.speed || {},
					str: typeof m.str === 'number' ? m.str : 10,
					dex: typeof m.dex === 'number' ? m.dex : 10,
					con: typeof m.con === 'number' ? m.con : 10,
					int: typeof m.int === 'number' ? m.int : 10,
					wis: typeof m.wis === 'number' ? m.wis : 10,
					cha: typeof m.cha === 'number' ? m.cha : 10,
					save: m.save || null,
					skill: m.skill || null,
					passive: typeof m.passive === 'number' ? m.passive : 10,
					languages: m.languages || [],
					senses: m.senses || [],
					trait: m.trait || [],
					action: m.action || [],
					bonus: m.bonus || [],
					reaction: m.reaction || [],
					legendary: m.legendary || [],
					spellcasting: m.spellcasting || [],
					environment: m.environment || [],
					raw_data: m
				})
			}

			if (rows.length > 0) {
				await batchInsert('compendium_monsters', cs, rows)
				totalInserted += rows.length
			}
		}
		console.log(`Seeded monsters from ${dir} (${totalInserted} monsters processed).`)
	}

	await processBestiaryDir(DIR_2014, '2014')
	await processBestiaryDir(DIR_2024, '2024')
}

// -------------------------------------------------------------
// MAIN RUNNER
// -------------------------------------------------------------
async function run() {
	const target = process.argv[2]
	console.log(`=== Starting Compendium ETL Seeder (Target: ${target || 'ALL'}) ===`)
	try {
		console.log('Ensuring compendium tables exist...')
		await db.compendium.create()

		if (target === 'backgrounds') {
			await seedBackgrounds()
		} else if (target === 'races') {
			await seedRaces()
		} else if (target === 'classes') {
			await seedClasses()
		} else if (target === 'feats') {
			await seedFeats()
		} else if (target === 'spells') {
			await seedSpells()
		} else if (target === 'items') {
			await seedItems()
		} else if (target === 'rules') {
			await seedRules()
		} else if (target === 'optionalfeatures') {
			await seedOptionalFeatures()
		} else if (target === 'monsters') {
			await seedMonsters()
		} else {
			await seedRaces()
			await seedClasses()
			await seedBackgrounds()
			await seedFeats()
			await seedSpells()
			await seedItems()
			await seedRules()
			await seedOptionalFeatures()
			await seedMonsters()
		}
		console.log('=== Compendium Seeding Complete! ===')
		process.exit(0)
	} catch (err) {
		console.error('Seeding failed:', err)
		process.exit(1)
	}
}

run()
