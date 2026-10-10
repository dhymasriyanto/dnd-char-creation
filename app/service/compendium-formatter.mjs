'use strict'

export const safeJson = (val, fallback = []) => {
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

export const normalizeCompendiumName = (s) => (s || '').toLowerCase()
	.replace(/['’]/g, '')
	.replace(/s\b/g, '')
	.replace(/[\s-_]+/g, ' ')
	.trim()

export function formatPrerequisite(prereq) {
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

export function formatBackground(b) {
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

export function formatFeat(f) {
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

export function formatOptionalFeature(of) {
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

export function formatRule(r) {
	const entries = safeJson(r.entries, [])
	const isVeh = r.type === 'Vehicle' || (r.category && ['ship', 'air', 'vehicle', 'spelljammer', 'elemental_airship', 'infwar'].includes(r.category.toLowerCase()))
	const vehStats = isVeh ? extractVehicleStats(entries) : {}
	return {
		id: r.id,
		name: r.name,
		edition: r.edition,
		source: r.source,
		page: r.page,
		type: r.type,
		category: r.category,
		entries,
		...vehStats
	}
}

export function formatRace(r, subraces = []) {
	return {
		id: r.id,
		name: r.name,
		edition: r.edition,
		source: r.source,
		page: r.page,
		size: safeJson(r.size, ['M']),
		speed: r.speed,
		flySpeed: r.fly_speed,
		swimSpeed: r.swim_speed,
		climbSpeed: r.climb_speed,
		darkvision: r.darkvision,
		creatureTypes: safeJson(r.creature_types, ['Humanoid']),
		abilityBonuses: safeJson(r.ability_bonuses, []),
		traits: safeJson(r.traits, []),
		entries: safeJson(r.entries, []),
		subraces: (subraces || []).map(sr => ({
			id: sr.id,
			name: sr.name,
			source: sr.source,
			edition: sr.edition,
			abilityBonuses: safeJson(sr.ability_bonuses, []),
			traits: safeJson(sr.traits, []),
			entries: safeJson(sr.entries, [])
		}))
	}
}

export function formatClass(cl, subclasses = []) {
	return {
		id: cl.id,
		name: cl.name,
		edition: cl.edition,
		source: cl.source,
		page: cl.page,
		hitDice: cl.hit_dice,
		primaryAbility: safeJson(cl.primary_ability, []),
		savingThrows: safeJson(cl.saving_throws, []),
		subclassLevel: cl.subclass_level,
		subclassTitle: cl.subclass_title,
		armorProficiencies: safeJson(cl.armor_proficiencies, []),
		weaponProficiencies: safeJson(cl.weapon_proficiencies, []),
		toolProficiencies: safeJson(cl.tool_proficiencies, []),
		skillChoices: safeJson(cl.skill_choices, {}),
		startingEquipment: safeJson(cl.starting_equipment, []),
		spellcastingAbility: cl.spellcasting_ability,
		entries: safeJson(cl.entries, []),
		classTableGroups: safeJson(cl.class_table_groups, []),
		classFeatures: safeJson(cl.class_features, []),
		subclasses: (subclasses || []).map(sc => ({
			id: sc.id,
			name: sc.name,
			shortName: sc.short_name,
			source: sc.source,
			edition: sc.edition,
			page: sc.page,
			spellcastingAbility: sc.spellcasting_ability,
			entries: safeJson(sc.entries, [])
		}))
	}
}

export function clean5eTag(s) {
	if (typeof s !== 'string') return String(s || '')
	return s.replace(/\{@filter ([^|}]+)[^}]*\}/g, '$1')
	        .replace(/\{@[a-z]+ ([^|}]+)[^}]*\}/g, '$1')
	        .trim()
}

export function formatTableCellValue(val) {
	if (val == null || val === '') return '-'
	if (typeof val === 'number') return val === 0 ? '-' : String(val)
	if (typeof val === 'string') return val === '0' ? '-' : val
	if (typeof val === 'object') {
		if (val.type === 'dice' && Array.isArray(val.toRoll) && val.toRoll[0]) {
			return `${val.toRoll[0].number}d${val.toRoll[0].faces}`
		}
		if (val.type === 'bonus') {
			return (val.value >= 0 ? '+' : '') + val.value
		}
		if (val.type === 'bonusSpeed') {
			return val.value > 0 ? `+${val.value} ft.` : '-'
		}
		if (val.value !== undefined) return String(val.value)
	}
	return '-'
}

export function getOrdinal(n) {
	const s = ['th', 'st', 'nd', 'rd']
	const v = n % 100
	return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function buildClassProgression(cl, dbFeatures = []) {
	const tableGroups = safeJson(cl.class_table_groups, [])

	const customHeaders = []
	tableGroups.forEach(group => {
		const labels = group.colLabels || []
		labels.forEach(lbl => {
			customHeaders.push(clean5eTag(lbl))
		})
	})

	const featuresByLevel = {}
	for (let lvl = 1; lvl <= 20; lvl++) {
		featuresByLevel[lvl] = []
	}

	const embeddedNames = new Set()
	const scanEmbedded = (entry) => {
		if (!entry) return
		if (typeof entry === 'string') {
			const m = entry.match(/<b>([^.<]+)[.<]/g)
			if (m) {
				m.forEach(sub => {
					const clean = sub.replace(/<\/?b>/g, '').replace(/[.<]/g, '').trim().toLowerCase()
					if (clean.length > 2) embeddedNames.add(clean)
				})
			}
		} else if (typeof entry === 'object') {
			if (entry.name && typeof entry.name === 'string') {
				embeddedNames.add(entry.name.trim().toLowerCase())
			}
			if (Array.isArray(entry.entries)) entry.entries.forEach(scanEmbedded)
			if (Array.isArray(entry.items)) entry.items.forEach(scanEmbedded)
		}
	}
	dbFeatures.forEach(f => {
		const ents = safeJson(f.entries, [])
		if (Array.isArray(ents)) ents.forEach(scanEmbedded)
	})

	dbFeatures.forEach(f => {
		const lvl = Math.min(20, Math.max(1, Number(f.level) || 1))
		const fNameLower = (f.name || '').trim().toLowerCase()
		const isChild = embeddedNames.has(fNameLower) && !dbFeatures.some(p => p.name.toLowerCase() === fNameLower && p.id !== f.id)
		featuresByLevel[lvl].push({
			id: f.id,
			name: f.name,
			level: lvl,
			source: f.source,
			edition: f.edition,
			entries: safeJson(f.entries, []),
			isChild: isChild
		})
	})

	const rows = []
	for (let lvl = 1; lvl <= 20; lvl++) {
		const pb = Math.floor((lvl - 1) / 4) + 2
		const rowIdx = lvl - 1

		const customValues = []
		tableGroups.forEach(group => {
			const rowData = (group.rows || group.rowsSpellProgression || [])[rowIdx] || []
			rowData.forEach(c => {
				customValues.push(formatTableCellValue(c))
			})
		})

		const lvlFeats = featuresByLevel[lvl] || []
		const topFeats = lvlFeats.filter(f => !f.isChild)
		const displayFeats = topFeats.length > 0 ? topFeats : lvlFeats

		rows.push({
			level: lvl,
			levelLabel: getOrdinal(lvl),
			proficiencyBonus: `+${pb}`,
			features: displayFeats,
			allFeatures: lvlFeats,
			customValues: customValues
		})
	}

	return {
		id: cl.id,
		name: cl.name,
		className: cl.name,
		edition: cl.edition,
		source: cl.source,
		hitDice: cl.hit_dice,
		primaryAbility: safeJson(cl.primary_ability, []),
		subclassTitle: cl.subclass_title || 'Subclass',
		subclassLevel: cl.subclass_level || 3,
		headers: customHeaders,
		rows,
		allFeatures: dbFeatures.map(f => ({
			id: f.id,
			name: f.name,
			level: Math.min(20, Math.max(1, Number(f.level) || 1)),
			source: f.source,
			edition: f.edition,
			entries: safeJson(f.entries, [])
		}))
	}
}

export function formatMonster(m) {
	const raw = safeJson(m.raw_data, {}) || {}
	const traits = safeJson(m.trait, [])
	const actions = safeJson(m.action, [])
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
		trait: traits,
		action: actions,
		bonus: safeJson(m.bonus, []),
		reaction: safeJson(m.reaction, []),
		legendary: safeJson(m.legendary, []),
		spellcasting: safeJson(m.spellcasting, []),
		environment: safeJson(m.environment, []),
		entries: [
			...(traits.map(t => ({ type: 'entries', name: t.name, entries: Array.isArray(t.entries) ? t.entries : (t.entries ? [t.entries] : []) }))),
			...(actions.map(a => ({ type: 'entries', name: a.name, entries: Array.isArray(a.entries) ? a.entries : (a.entries ? [a.entries] : []) })))
		],
		resist: raw.resist || null,
		immune: raw.immune || null,
		conditionImmune: raw.conditionImmune || null,
		vulnerable: raw.vulnerable || null,
		raw_data: raw
	}
}

export function formatSpell(s) {
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

export const DAMAGE_TYPE_MAP = {
	B: 'Bludgeoning',
	P: 'Piercing',
	S: 'Slashing',
	A: 'Acid',
	C: 'Cold',
	F: 'Fire',
	O: 'Force',
	L: 'Lightning',
	N: 'Necrotic',
	I: 'Poison',
	Y: 'Psychic',
	R: 'Radiant',
	T: 'Thunder'
}

export const PROPERTY_DEFINITIONS = {
	'2H': {
		name: 'Two-Handed',
		desc: {
			'2024': 'A Two-Handed weapon requires two hands when you attack with it.',
			'2014': 'This weapon requires two hands to use. This property is relevant only when you attack with the weapon, not when you simply hold it.'
		}
	},
	'A': {
		name: 'Ammunition',
		desc: {
			'2024': 'You can use a weapon that has the Ammunition property to make a ranged attack only if you have ammunition to fire from it. Each attack expends one piece of ammunition. Drawing the ammunition is part of the attack. After a fight, you can spend 1 minute to recover half the ammunition used.',
			'2014': 'You can use a weapon that has the ammunition property to make a ranged attack only if you have ammunition to fire from the weapon. Each time you attack, you expend one piece of ammunition. You can recover half your expended ammunition after combat.'
		}
	},
	'AF': {
		name: 'Ammunition (Firearms)',
		desc: {
			'2024': 'Firearm Bullets are destroyed upon use in a modern firearm. Futuristic firearms use Energy Cells that become depleted but can possibly be recharged.',
			'2014': 'The ammunition of a firearm is destroyed upon use.'
		}
	},
	'BF': {
		name: 'Burst Fire',
		desc: {
			'2024': 'As an action, you can expend 10 pieces of ammunition to spray shots in a 10-foot Cube within normal range. Each creature in that area must succeed on a DC 15 Dexterity saving throw or take the weapon\'s normal damage.',
			'2014': 'A weapon with burst fire can spray a 10-foot-cube area within normal range. Each creature in the area must succeed on a DC 15 Dexterity saving throw or take the weapon\'s normal damage (uses 10 pieces of ammunition).'
		}
	},
	'F': {
		name: 'Finesse',
		desc: {
			'2024': 'When making an attack with a Finesse weapon, use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls.',
			'2014': 'When making an attack with a finesse weapon, you use your choice of your Strength or Dexterity modifier for the attack and damage rolls. You must use the same modifier for both rolls.'
		}
	},
	'H': {
		name: 'Heavy',
		desc: {
			'2024': 'You have Disadvantage on attack rolls with a Heavy weapon if it\'s a Melee weapon and your Strength score isn\'t at least 13 or if it\'s a Ranged weapon and your Dexterity score isn\'t at least 13.',
			'2014': 'Small creatures have disadvantage on attack rolls with heavy weapons. A heavy weapon\'s size and bulk make it too large for a Small creature to use effectively.'
		}
	},
	'L': {
		name: 'Light',
		desc: {
			'2024': 'When you take the Attack action on your turn and attack with a Light weapon, you can make one extra attack as a Bonus Action later on the same turn. That extra attack must be made with a different Light weapon, and you don\'t add your ability modifier to the extra attack\'s damage unless that modifier is negative.',
			'2014': 'A light weapon is small and easy to handle, making it ideal for use when fighting with two weapons.'
		}
	},
	'LD': {
		name: 'Loading',
		desc: {
			'2024': 'You can fire only one piece of ammunition from a Loading weapon when you use an action, a Bonus Action, or a Reaction to fire it, regardless of the number of attacks you can normally make.',
			'2014': 'Because of the time required to load this weapon, you can fire only one piece of ammunition from it when you use an action, bonus action, or reaction to fire it, regardless of the number of attacks you can normally make.'
		}
	},
	'R': {
		name: 'Reach',
		desc: {
			'2024': 'A Reach weapon adds 5 feet to your reach when you attack with it, as well as when determining your reach for Opportunity Attacks with it.',
			'2014': 'This weapon adds 5 feet to your reach when you attack with it. This property also determines your reach for opportunity attacks with a reach weapon.'
		}
	},
	'RLD': {
		name: 'Reload',
		desc: {
			'2024': 'You can make a limited number of shots with a Reload weapon. You must then reload the weapon as an action or a Bonus Action.',
			'2014': 'A limited number of shots can be made with a weapon that has the reload property. A character must then reload it using an action or a bonus action.'
		}
	},
	'S': {
		name: 'Special',
		desc: {
			'2024': 'A weapon with the Special property has unusual rules governing its use, explained in the weapon\'s description.',
			'2014': 'A weapon with the special property has unusual rules governing its use, explained in the weapon\'s description.'
		}
	},
	'T': {
		name: 'Thrown',
		desc: {
			'2024': 'If a weapon has the Thrown property, you can throw the weapon to make a ranged attack, and you can draw that weapon as part of the attack. If the weapon is a Melee weapon, use the same ability modifier for the attack and damage rolls that you use for a melee attack with that weapon.',
			'2014': 'If a weapon has the thrown property, you can throw the weapon to make a ranged attack. If the weapon is a melee weapon, use the same ability modifier for that attack roll and damage roll that you would use for a melee attack with the weapon.'
		}
	},
	'V': {
		name: 'Versatile',
		desc: {
			'2024': 'A Versatile weapon can be used with one or two hands. A damage value in parentheses appears with the property. The weapon deals that damage when used with two hands to make a melee attack.',
			'2014': 'This weapon can be used with one or two hands. A damage value in parentheses appears with the property—the damage when the weapon is used with two hands to make a melee attack.'
		}
	}
}

export const MASTERY_DEFINITIONS = {
	'Cleave': 'If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon\'s damage, but don\'t add your ability modifier to that damage unless that modifier is negative. You can make this extra attack only once per turn.',
	'Graze': 'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon, and the damage can be increased only by increasing the ability modifier.',
	'Nick': 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. You can make this extra attack only once per turn.',
	'Push': 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
	'Sap': 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
	'Slow': 'If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn. If the creature is hit more than once by weapons that have this property, the Speed reduction doesn\'t exceed 10 feet.',
	'Topple': 'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw (DC 8 + attack ability modifier + Proficiency Bonus). On a failed save, the creature has the Prone condition.',
	'Vex': 'If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.'
}

export const WEAPON_RANGE_MAP = {
	dagger: '20/60',
	handaxe: '20/60',
	javelin: '30/120',
	'light hammer': '20/60',
	spear: '20/60',
	dart: '20/60',
	shortbow: '80/320',
	sling: '30/120',
	'light crossbow': '80/320',
	blowgun: '25/100',
	'hand crossbow': '30/120',
	'heavy crossbow': '100/400',
	longbow: '150/600',
	trident: '20/60',
	net: '5/15',
	musket: '40/120',
	pistol: '30/90'
}

export function formatPropertyNames(props, versatileDice = null, weaponName = '') {
	if (!Array.isArray(props)) return []
	const wName = (weaponName || '').toLowerCase()
	const defaultRange = WEAPON_RANGE_MAP[wName] || null

	return props.map(p => {
		if (typeof p !== 'string') return ''
		const code = p.split('|')[0].trim()
		const def = PROPERTY_DEFINITIONS[code]
		const name = def ? def.name : code
		if ((code === 'V' || name.toLowerCase() === 'versatile') && versatileDice) {
			return `${name} (${versatileDice})`
		}
		if ((code === 'T' || code === 'A') && defaultRange) {
			return `${name} (Range ${defaultRange} ft.)`
		}
		return name
	}).filter(Boolean)
}

export function synthesizeItemEntries(it, rawProps = []) {
	const edition = it.edition || '2024'
	const entries = []
	const wName = (it.name || '').toLowerCase()
	const defaultRange = WEAPON_RANGE_MAP[wName] || null

	const isWeapon = it.item_type === 'weapon' || !!it.damage_dice || !!it.dmg1
	if (isWeapon) {
		const props = Array.isArray(rawProps) ? rawProps : []
		for (const p of props) {
			const code = typeof p === 'string' ? p.split('|')[0].trim() : ''
			const def = PROPERTY_DEFINITIONS[code]
			if (def) {
				let title = def.name
				if ((code === 'V' || title.toLowerCase() === 'versatile') && (it.versatile_dice || it.dmg2)) {
					title += ` (${it.versatile_dice || it.dmg2})`
				} else if ((code === 'T' || code === 'A') && defaultRange) {
					title += ` (Range ${defaultRange} ft.)`
				}
				const desc = def.desc[edition] || def.desc['2024'] || def.desc['2014']
				entries.push(`<b>${title}.</b> ${desc}`)
			}
		}

		const rawMastery = typeof it.mastery === 'string'
			? it.mastery
			: (Array.isArray(it.mastery) && it.mastery.length > 0 ? it.mastery[0] : null)
		if (rawMastery) {
			const mName = String(rawMastery).split('|')[0].trim()
			const mDesc = MASTERY_DEFINITIONS[mName]
			if (mDesc) {
				entries.push(`<b>Mastery: ${mName}.</b> ${mDesc}`)
			}
		}
		return entries
	}

	const isArmor = it.item_type === 'armor' || Number(it.base_ac) > 0 || Number(it.ac) > 0
	if (isArmor) {
		const ac = Number(it.base_ac || it.ac)
		const str = Number(it.strength_requirement || it.strength)
		const stealthDis = !!(it.stealth_disadvantage || it.stealth)
		const isShield = wName.includes('shield')

		if (isShield) {
			entries.push('<b>Shield.</b> A shield increases your Armor Class by 2 while wielded. You can benefit from only one shield at a time.')
		} else {
			let armorDesc = `Armor Class: ${ac}.`
			if (it.ac_dex_bonus === 'yes' || it.dexMod) {
				armorDesc += ' Adds Dexterity modifier.'
			}
			entries.push(`<b>Armor Class.</b> ${armorDesc}`)
		}

		if (str > 0) {
			entries.push(`<b>Strength Requirement.</b> Requires Strength ${str}. If the wearer has a lower Strength score, their speed is reduced by 10 feet.`)
		}

		if (stealthDis) {
			entries.push('<b>Stealth.</b> The wearer has Disadvantage on Dexterity (Stealth) checks.')
		}
		return entries
	}

	return entries
}

export function extractVehicleStats(entries) {
	let crew = null, capPassenger = null, capCargo = null, speed = null
	let vehAc = null, vehHp = null, vehDmgThresh = null, carryingCapacity = null

	if (!Array.isArray(entries)) return { crew, capPassenger, capCargo, speed, vehAc, vehHp, vehDmgThresh, carryingCapacity }

	for (const e of entries) {
		if (e && e.type === 'table' && Array.isArray(e.rows)) {
			for (const row of e.rows) {
				if (!Array.isArray(row) || row.length < 2) continue
				const [prop, val] = row
				const pLower = String(prop || '').toLowerCase()
				const vStr = String(val || '').trim()
				if (pLower.includes('crew') && !crew) crew = vStr
				if (pLower.includes('passenger') && !capPassenger) capPassenger = vStr
				if (pLower.includes('cargo') && !capCargo) capCargo = vStr
				if (pLower.includes('speed') || pLower.includes('pace')) {
					speed = speed ? `${speed}; ${vStr}` : vStr
				}
				if (pLower.includes('armor class') && !vehAc) {
					vehAc = vStr.replace(/^ac\s*/i, '').trim()
				}
				if (pLower.includes('hit points') && !vehHp) {
					vehHp = vStr
					const mDt = vStr.match(/damage threshold\s*(\d+)/i)
					if (mDt && !vehDmgThresh) vehDmgThresh = mDt[1]
				}
				if (pLower.includes('hull')) {
					const mAc = vStr.match(/AC\s*(\d+)/i)
					if (mAc && !vehAc) vehAc = mAc[1]
					const mHp = vStr.match(/HP\s*(\d+)/i)
					if (mHp && !vehHp) vehHp = mHp[1]
					const mDt = vStr.match(/Damage Threshold\s*(\d+)/i)
					if (mDt && !vehDmgThresh) vehDmgThresh = mDt[1]
				}
				if (pLower.includes('carrying capacity') && !carryingCapacity) {
					carryingCapacity = vStr
				}
			}
		}
	}
	return { crew, capPassenger, capCargo, speed, vehAc, vehHp, vehDmgThresh, carryingCapacity }
}

export function formatItem(it) {
	const rawProps = safeJson(it.properties, [])
	const versatileDice = it.versatile_dice || null
	const mappedProps = formatPropertyNames(rawProps, versatileDice, it.name)
	const rawEntries = safeJson(it.entries, [])
	const entries = rawEntries.length > 0 ? rawEntries : synthesizeItemEntries(it, rawProps)
	const masteryStr = typeof it.mastery === 'string'
		? (it.mastery.split('|')[0].trim() || null)
		: (Array.isArray(it.mastery) && it.mastery.length > 0 ? String(it.mastery[0]).split('|')[0].trim() : null)
	const dmgTypeFull = it.damage_type ? (DAMAGE_TYPE_MAP[it.damage_type.toUpperCase()] || it.damage_type) : null
	const vehStats = extractVehicleStats(entries)
	const costFormatted = it.cost_cp
		? (Number(it.cost_cp) >= 100 ? `${Number(it.cost_cp) / 100} gp` : `${it.cost_cp} cp`)
		: null

	return {
		id: it.id,
		name: it.name,
		edition: it.edition,
		source: it.source,
		page: it.page,
		type: it.item_type,
		itemType: it.item_type,
		rarity: it.rarity,
		value: Number(it.cost_cp),
		costCp: Number(it.cost_cp),
		cost: costFormatted,
		weight: Number(it.weight),
		dmg1: it.damage_dice,
		damageDice: it.damage_dice,
		dmgType: dmgTypeFull,
		dmg2: versatileDice,
		versatileDice: versatileDice,
		mastery: masteryStr,
		ac: Number(it.base_ac) || null,
		baseAc: Number(it.base_ac) || null,
		dexMod: it.ac_dex_bonus === 'yes',
		stealth: it.stealth_disadvantage,
		strength: Number(it.strength_requirement) || 0,
		property: mappedProps,
		properties: mappedProps,
		crew: it.crew || vehStats.crew,
		capPassenger: it.capPassenger || vehStats.capPassenger,
		capCargo: it.capCargo || vehStats.capCargo,
		speed: it.speed || it.vehSpeed || vehStats.speed,
		vehAc: it.vehAc || vehStats.vehAc,
		vehHp: it.vehHp || vehStats.vehHp,
		vehDmgThresh: it.vehDmgThresh || vehStats.vehDmgThresh,
		carryingCapacity: it.carryingCapacity || vehStats.carryingCapacity,
		entries
	}
}

export function formatLookupItem(dbItem) {
	const rawProps = safeJson(dbItem.properties, [])
	const versatileDice = dbItem.versatile_dice || null
	const mappedProps = formatPropertyNames(rawProps, versatileDice, dbItem.name)
	const rawEntries = safeJson(dbItem.entries, [])
	const entries = rawEntries.length > 0 ? rawEntries : synthesizeItemEntries(dbItem, rawProps)
	const masteryStr = typeof dbItem.mastery === 'string'
		? (dbItem.mastery.split('|')[0].trim() || null)
		: (Array.isArray(dbItem.mastery) && dbItem.mastery.length > 0 ? String(dbItem.mastery[0]).split('|')[0].trim() : null)
	const dmgTypeFull = dbItem.damage_type ? (DAMAGE_TYPE_MAP[dbItem.damage_type.toUpperCase()] || dbItem.damage_type) : null
	const vehStats = extractVehicleStats(entries)

	let dmgString = null
	if (dbItem.damage_dice) {
		dmgString = `${dbItem.damage_dice}${dmgTypeFull ? ' ' + dmgTypeFull : ''}`
		if (versatileDice) {
			dmgString += ` (Versatile ${versatileDice})`
		}
	}

	const baseAcNum = Number(dbItem.base_ac) || 0
	const strNum = Number(dbItem.strength_requirement) || 0

	return {
		name: dbItem.name,
		type: 'item',
		edition: dbItem.edition,
		source: dbItem.source,
		itemType: dbItem.item_type || 'Item',
		damage: dmgString,
		dmg1: dbItem.damage_dice,
		damageDice: dbItem.damage_dice,
		dmg2: versatileDice,
		versatileDice: versatileDice,
		dmgType: dmgTypeFull,
		ac: baseAcNum > 0 ? String(baseAcNum) : null,
		baseAc: baseAcNum > 0 ? baseAcNum : null,
		properties: mappedProps.length > 0 ? mappedProps.join(', ') : null,
		property: mappedProps,
		mastery: masteryStr,
		weight: dbItem.weight ? `${dbItem.weight} lb` : null,
		cost: dbItem.cost_cp ? (Number(dbItem.cost_cp) >= 100 ? `${Number(dbItem.cost_cp) / 100} gp` : `${dbItem.cost_cp} cp`) : null,
		stealth: dbItem.stealth_disadvantage,
		strength: strNum > 0 ? strNum : null,
		crew: dbItem.crew || vehStats.crew,
		capPassenger: dbItem.capPassenger || vehStats.capPassenger,
		capCargo: dbItem.capCargo || vehStats.capCargo,
		speed: dbItem.speed || dbItem.vehSpeed || vehStats.speed,
		vehAc: dbItem.vehAc || vehStats.vehAc,
		vehHp: dbItem.vehHp || vehStats.vehHp,
		vehDmgThresh: dbItem.vehDmgThresh || vehStats.vehDmgThresh,
		carryingCapacity: dbItem.carryingCapacity || vehStats.carryingCapacity,
		entries
	}
}

export const cleanText = (text) => {
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

export const flattenEntries = (entries) => {
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
