'use strict'

import {db} from '../../database/index.mjs'

export function safeEntries(val) {
	if (!val) return []
	if (Array.isArray(val)) return val
	if (typeof val === 'string') {
		try {
			let parsed = JSON.parse(val)
			while (typeof parsed === 'string') {
				try {
					parsed = JSON.parse(parsed)
				} catch {
					break
				}
			}
			return Array.isArray(parsed) ? parsed : [parsed]
		} catch {
			return [val]
		}
	}
	return [val]
}

export async function enrichWithCompendiumEntries(datas) {
	if (!datas) return
	const edition = datas.edition || '2024'

	try {
		// Class features
		if (Array.isArray(datas.class_feature) && datas.class_feature.length > 0) {
			const names = datas.class_feature.map(f => f.name.toLowerCase())
			const charClassMap = new Map((datas.class || []).map(c => [c.id, (c.name || '').toLowerCase()]))
			const defaultClassName = (datas.class?.[0]?.name || '').toLowerCase()

			const charClassNames = (datas.class || []).map(c => (c.name || '').toLowerCase()).filter(Boolean)

			// ponytail: match features by class to prevent cross-class pollution (e.g. Spellcasting, Extra Attack)
			const compRows = await db.any(
				`SELECT ccf.name, LOWER(cc.name) as class_name, ccf.entries 
				 FROM compendium_class_features ccf
				 JOIN compendium_classes cc ON cc.id = ccf.class_id
				 WHERE LOWER(ccf.name) = ANY($1) 
				   AND ($3::text[] IS NULL OR cardinality($3::text[]) = 0 OR LOWER(cc.name) = ANY($3))
				 ORDER BY CASE WHEN ccf.edition = $2 THEN 0 ELSE 1 END`,
				[names, edition, charClassNames]
			)
			const cMap = new Map()
			for (const r of compRows) {
				const featKey = r.name.toLowerCase()
				const fullKey = `${r.class_name}::${featKey}`
				if (!cMap.has(fullKey)) {
					cMap.set(fullKey, safeEntries(r.entries))
				}
				if (!cMap.has(featKey)) {
					cMap.set(featKey, safeEntries(r.entries))
				}
			}
			for (const cf of datas.class_feature) {
				if (!cf.entries || cf.entries.length === 0) {
					const featKey = cf.name.toLowerCase()
					const cfClassName = charClassMap.get(cf.class_id) || defaultClassName
					cf.entries = (cfClassName && cMap.get(`${cfClassName}::${featKey}`)) || cMap.get(featKey) || []
				}
			}
		}

		// Subclass features
		if (Array.isArray(datas.sub_class_feature) && datas.sub_class_feature.length > 0) {
			const names = datas.sub_class_feature.map(f => f.name.toLowerCase())
			const charScMap = new Map((datas.sub_class || []).map(sc => [sc.id, sc]))
			const charClassMap = new Map((datas.class || []).map(c => [c.id, (c.name || '').toLowerCase()]))
			const defaultClassName = (datas.class?.[0]?.name || '').toLowerCase()

			const charClassNames = (datas.class || []).map(c => (c.name || '').toLowerCase()).filter(Boolean)

			// ponytail: join sub_classes & classes to prevent cross-class contamination (e.g. Bard vs Cleric Bonus Proficiencies)
			const compRows = await db.any(
				`SELECT scf.name, LOWER(csc.name) as sc_name, LOWER(COALESCE(csc.short_name, '')) as sc_short_name, 
				        LOWER(COALESCE(csc.source, '')) as sc_source, LOWER(cc.name) as class_name, scf.entries 
				 FROM compendium_sub_class_features scf
				 JOIN compendium_sub_classes csc ON csc.id = scf.sub_class_id
				 JOIN compendium_classes cc ON cc.id = csc.class_id
				 WHERE LOWER(scf.name) = ANY($1)
				   AND ($3::text[] IS NULL OR cardinality($3::text[]) = 0 OR LOWER(cc.name) = ANY($3))
				 ORDER BY CASE WHEN scf.edition = $2 THEN 0 ELSE 1 END`,
				[names, edition, charClassNames]
			)
			const scMap = new Map()
			for (const r of compRows) {
				const featKey = r.name.toLowerCase()
				if (r.sc_source && !scMap.has(`${r.sc_name}|${r.sc_source}::${featKey}`)) {
					scMap.set(`${r.sc_name}|${r.sc_source}::${featKey}`, safeEntries(r.entries))
				}
				if (!scMap.has(`${r.sc_name}::${featKey}`)) {
					scMap.set(`${r.sc_name}::${featKey}`, safeEntries(r.entries))
				}
				if (r.sc_short_name && !scMap.has(`${r.sc_short_name}::${featKey}`)) {
					scMap.set(`${r.sc_short_name}::${featKey}`, safeEntries(r.entries))
				}
				if (!scMap.has(`${r.class_name}::${featKey}`)) {
					scMap.set(`${r.class_name}::${featKey}`, safeEntries(r.entries))
				}
			}
			for (const scf of datas.sub_class_feature) {
				if (!scf.entries || scf.entries.length === 0) {
					const featKey = scf.name.toLowerCase()
					const scObj = charScMap.get(scf.sub_class_id) || datas.sub_class?.[0]
					const scName = (scObj?.name || '').toLowerCase()
					const scSource = (scf.source || scObj?.source || '').toLowerCase()
					const scShort = (scObj?.short_name || scObj?.shortName || '').toLowerCase()
					const className = charClassMap.get(scObj?.class_id) || defaultClassName
					scf.entries = (scName && scSource && scMap.get(`${scName}|${scSource}::${featKey}`))
						|| (scName && scMap.get(`${scName}::${featKey}`))
						|| (scShort && scMap.get(`${scShort}::${featKey}`))
						|| (className && scMap.get(`${className}::${featKey}`))
						|| []
				}
			}
		}

		// Feats
		if (Array.isArray(datas.feat) && datas.feat.length > 0) {
			const rawNames = datas.feat.map(f => (f.name || '').trim().toLowerCase())
			const baseNames = datas.feat.map(f => (f.name || '').split(/[-;(]/)[0].trim().toLowerCase()).filter(Boolean)
			const allLookup = [...new Set([...rawNames, ...baseNames])]
			const compRows = await db.any(
				`SELECT name, entries FROM compendium_feats 
				 WHERE LOWER(name) = ANY($1)
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
				[allLookup, edition]
			)
			const fMap = new Map()
			for (const r of compRows) {
				const k = r.name.toLowerCase()
				if (!fMap.has(k)) {
					fMap.set(k, safeEntries(r.entries))
				}
			}
			for (const ft of datas.feat) {
				if (!ft.entries || ft.entries.length === 0) {
					const exact = (ft.name || '').toLowerCase()
					const base = (ft.name || '').split(/[-;(]/)[0].trim().toLowerCase()
					ft.entries = fMap.get(exact) || fMap.get(base) || []
				}
			}
		}

		// Background features
		if (Array.isArray(datas.feature) && datas.feature.length > 0 && datas.background) {
			const compBg = await db.oneOrNone(
				`SELECT entries FROM compendium_backgrounds 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.background, edition]
			)
			if (compBg) {
				const bgEntries = safeEntries(compBg.entries)
				const bgEntriesMap = new Map()
				for (const item of bgEntries) {
					if (item && item.name) {
						bgEntriesMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
						bgEntriesMap.set(item.name.toLowerCase().replace(/^feature:\s*/i, ''), safeEntries(item.entries || [item]))
					}
				}
				for (const bf of datas.feature) {
					if (!bf.entries || bf.entries.length === 0) {
						bf.entries = bgEntriesMap.get(bf.name.toLowerCase()) || bgEntries
					}
				}
			}
		}

		// Racial traits
		if (datas.race?.name) {
			const compRace = await db.oneOrNone(
				`SELECT entries, traits, speed, fly_speed, swim_speed, climb_speed FROM compendium_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.race.name, edition]
			)
			if (compRace) {
				if (compRace.fly_speed) datas.race.fly_speed = Number(compRace.fly_speed)
				if (compRace.swim_speed) datas.race.swim_speed = Number(compRace.swim_speed)
				if (compRace.climb_speed) datas.race.climb_speed = Number(compRace.climb_speed)
				if (compRace.speed && !datas.speed) datas.race.speed = Number(compRace.speed)
				datas.compendium_race_entries = safeEntries(compRace.entries)
				const raceEntries = datas.compendium_race_entries
				const raceEntriesMap = new Map()
				for (const item of raceEntries) {
					if (item && item.name) {
						raceEntriesMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
					}
				}
				if (!Array.isArray(datas.trait)) datas.trait = []
				if (datas.trait.length > 0) {
					for (const rt of datas.trait) {
						if (!rt.entries || rt.entries.length === 0) {
							rt.entries = raceEntriesMap.get(rt.name.toLowerCase()) || []
						}
					}
				} else {
					const fluff = ['age', 'size', 'alignment', 'speed', 'languages', 'language']
					for (const item of raceEntries) {
						if (item && item.name && !fluff.includes(item.name.toLowerCase())) {
							datas.trait.push({
								name: item.name,
								entries: safeEntries(item.entries || [item])
							})
						}
					}
				}
			}
		}

		// Subrace traits
		if (datas.sub_race?.name) {
			const compSubRace = await db.oneOrNone(
				`SELECT entries FROM compendium_sub_races 
				 WHERE LOWER(name) = LOWER($1) 
				 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END LIMIT 1`,
				[datas.sub_race.name, edition]
			)
			if (compSubRace) {
				datas.compendium_sub_race_entries = safeEntries(compSubRace.entries)
				const srEntries = datas.compendium_sub_race_entries
				const srMap = new Map()
				for (const item of srEntries) {
					if (item && item.name) {
						srMap.set(item.name.toLowerCase(), safeEntries(item.entries || [item]))
					}
				}
				if (!Array.isArray(datas.trait)) datas.trait = []
				for (const rt of datas.trait) {
					if (!rt.entries || rt.entries.length === 0) {
						const found = srMap.get(rt.name.toLowerCase())
						if (found) rt.entries = found
					}
				}
				for (const item of srEntries) {
					if (item && item.name && !datas.trait.some(t => (t.name || '').toLowerCase() === item.name.toLowerCase())) {
						datas.trait.push({
							name: item.name,
							entries: safeEntries(item.entries || [item])
						})
					}
				}
			}
		}

		// Classes (enrich spellcasting_ability, hit_dice, saving_throws from compendium)
		const classList = Array.isArray(datas.class) ? datas.class : (datas.class ? [datas.class] : [])
		if (classList.length > 0) {
			const classNames = classList.map(c => (c.name || '').toLowerCase()).filter(Boolean)
			if (classNames.length > 0) {
				const compClasses = await db.any(
					`SELECT name, spellcasting_ability, hit_dice, saving_throws FROM compendium_classes 
					 WHERE LOWER(name) = ANY($1) 
					 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
					[classNames, edition]
				)
				const ccMap = new Map()
				for (const cc of compClasses) {
					if (!ccMap.has(cc.name.toLowerCase())) {
						ccMap.set(cc.name.toLowerCase(), cc)
					}
				}
				for (const c of classList) {
					const found = ccMap.get((c.name || '').toLowerCase())
					if (found) {
						if (!c.spellcasting_ability) c.spellcasting_ability = found.spellcasting_ability
						if (!c.hit_dice) c.hit_dice = found.hit_dice
						if (!c.saving_throws) c.saving_throws = found.saving_throws
					}
				}
			}
		}

		// Equipment (enrich base_ac, item_type, ac_dex_bonus from compendium)
		const eqList = Array.isArray(datas.equipment) ? datas.equipment : []
		if (eqList.length > 0) {
			const eqNames = eqList.map(e => (e.name || '').toLowerCase()).filter(Boolean)
			if (eqNames.length > 0) {
				const compItems = await db.any(
					`SELECT name, item_type, base_ac, ac_dex_bonus, equip_type, container_capacity FROM compendium_items 
					 WHERE LOWER(name) = ANY($1) 
					 ORDER BY CASE WHEN edition = $2 THEN 0 ELSE 1 END`,
					[eqNames, edition]
				)
				const itMap = new Map()
				for (const it of compItems) {
					if (!itMap.has(it.name.toLowerCase())) {
						itMap.set(it.name.toLowerCase(), it)
					}
				}
				for (const eq of eqList) {
					const found = itMap.get((eq.name || '').toLowerCase())
					if (found) {
						if (eq.base_ac == null && found.base_ac != null) eq.base_ac = Number(found.base_ac)
						if (!eq.item_type && found.item_type) eq.item_type = found.item_type
						if (eq.ac_dex_bonus == null && found.ac_dex_bonus != null) eq.ac_dex_bonus = found.ac_dex_bonus
						if (!eq.equip_type && found.equip_type) eq.equip_type = found.equip_type
						if (eq.container_capacity == null && found.container_capacity != null) eq.container_capacity = Number(found.container_capacity)
					}
				}
			}
		}
	} catch (e) {
		console.warn('Could not enrich features with compendium entries:', e.message)
	}
}
