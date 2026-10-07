'use strict'

const SKILL_ABILITY_MAP = {
	athletics: 'strength',
	acrobatics: 'dexterity',
	sleight_of_hand: 'dexterity',
	stealth: 'dexterity',
	arcana: 'intelligence',
	history: 'intelligence',
	investigation: 'intelligence',
	nature: 'intelligence',
	religion: 'intelligence',
	animal_handling: 'wisdom',
	insight: 'wisdom',
	medicine: 'wisdom',
	perception: 'wisdom',
	survival: 'wisdom',
	deception: 'charisma',
	intimidation: 'charisma',
	performance: 'charisma',
	persuasion: 'charisma'
}

const WEAPON_MASTERY_DESCRIPTIONS = {
	cleave: 'If you hit a creature, you can make a melee attack against a second creature within 5 ft of it (using weapon damage die only).',
	graze: 'If your attack roll misses, you still deal damage to the target equal to your ability modifier used for the attack.',
	nick: 'You can make the extra attack from the Light weapon property as part of the Attack action, not a Bonus Action.',
	push: 'If you hit a creature, you can push it up to 10 feet straight away from you (Large or smaller).',
	sap: 'If you hit a creature, its next attack roll before the start of your next turn has Disadvantage.',
	slow: 'If you hit a creature and deal damage, you reduce its Speed by 10 feet until the start of your next turn.',
	topple: 'If you hit a creature, you can force it to make a Constitution save (DC 8 + PB + ability mod) or fall Prone.',
	vex: 'If you hit a creature and deal damage, you gain Advantage on your next attack roll against that creature before the end of your next turn.'
}

function hasJackOfAllTrades(character) {
	if (!character) return false
	const cfs = character.class_feature || []
	if (Array.isArray(cfs) && cfs.some(f => (f.name || '').toLowerCase().includes('jack of all trades'))) {
		return true
	}
	const classes = Array.isArray(character.classes)
		? character.classes
		: (Array.isArray(character.class) ? character.class : [])

	for (const cl of classes) {
		const name = (cl.name || cl.class_name || '').toLowerCase()
		const lvl = Number(cl.level || character.level || 1)
		if (name === 'bard' && lvl >= 2) return true
	}

	if (typeof character.class === 'string' && character.class.toLowerCase() === 'bard') {
		const lvl = Number(character.level || 1)
		if (lvl >= 2) return true
	}

	return false
}

function hasRemarkableAthlete(character) {
	if (!character) return false
	const scfs = character.sub_class_feature || []
	if (Array.isArray(scfs) && scfs.some(f => (f.name || '').toLowerCase().includes('remarkable athlete'))) {
		return true
	}
	const subClasses = Array.isArray(character.sub_class)
		? character.sub_class
		: (Array.isArray(character.sub_classes) ? character.sub_classes : [])
	for (const sc of subClasses) {
		const name = (sc.name || sc.subclass_name || '').toLowerCase()
		const lvl = Number(sc.level || character.level || 1)
		if (name === 'champion' && lvl >= 7) return true
	}
	return false
}

export function computeVttSheet(character) {
	const level = Number(character.level || 1)
	const pb = Math.floor((level - 1) / 4) + 2

	// Ability Scores & Modifiers
	const abs = character.ability_score || {}
	const abilities = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']
	const abilityStats = {}

	for (const a of abilities) {
		const score = Number(abs[a] != null ? abs[a] : 10)
		const mod = Math.floor((score - 10) / 2)
		abilityStats[a] = {
			score,
			modifier: mod,
			modifier_string: mod >= 0 ? `+${mod}` : `${mod}`
		}
	}

	// Saving Throws
	const st = character.saving_throw || {}
	const savingThrows = {}
	for (const a of abilities) {
		const isProf = Boolean(st[a])
		const total = abilityStats[a].modifier + (isProf ? pb : 0)
		savingThrows[a] = {
			proficient: isProf,
			total,
			modifier_string: total >= 0 ? `+${total}` : `${total}`,
			roll_formula: total >= 0 ? `1d20+${total}` : `1d20${total}`
		}
	}

	// Skills
	const sp = character.skill_proficiency || {}
	const se = character.skill_expertise || {}
	const skills = {}

	const hasJoat = hasJackOfAllTrades(character)
	const hasRa = hasRemarkableAthlete(character)
	const joatBonus = Math.floor(pb / 2)
	const raBonus = Math.ceil(pb / 2)

	for (const [skill, ability] of Object.entries(SKILL_ABILITY_MAP)) {
		const isProf = Boolean(sp[skill])
		const isExp = Boolean(se[skill])
		let isJoat = false
		let isRa = false
		let bonus = 0

		if (isExp) {
			bonus = 2 * pb
		} else if (isProf) {
			bonus = pb
		} else if (hasJoat) {
			bonus = joatBonus
			isJoat = true
		} else if (hasRa && (ability === 'strength' || ability === 'dexterity' || ability === 'constitution')) {
			bonus = raBonus
			isRa = true
		}

		const total = abilityStats[ability].modifier + bonus
		const passive = 10 + total

		skills[skill] = {
			ability,
			proficient: isProf,
			expertise: isExp,
			jack_of_all_trades: isJoat,
			remarkable_athlete: isRa,
			bonus,
			total,
			passive,
			modifier_string: total >= 0 ? `+${total}` : `${total}`,
			roll_formula: total >= 0 ? `1d20+${total}` : `1d20${total}`
		}
	}

	// Combat
	const dexMod = abilityStats.dexterity.modifier
	const strMod = abilityStats.strength.modifier

	const initiativeBonus = hasJoat ? joatBonus : (hasRa ? raBonus : 0)
	const initiative = dexMod + initiativeBonus
	const initiativeRoll = initiative >= 0 ? `1d20+${initiative}` : `1d20${initiative}`

	// AC Calculation
	let baseArmorAc = null
	let hasShield = false
	const equipments = character.equipment || character.equipments || []

	for (const eq of equipments) {
		const isEquipped = eq.status === 'equipped'
		if (!isEquipped) continue
		const nameLower = (eq.name || '').toLowerCase()

		if (nameLower.includes('shield')) {
			hasShield = true
		} else if (eq.is_armor || eq.item_type === 'armor') {
			const itemAc = eq.base_ac != null ? Number(eq.base_ac) : (eq.ac ? Number(eq.ac) : null)
			if (itemAc !== null && itemAc > 0) {
				if (eq.ac_dex_bonus === false || itemAc >= 16) {
					baseArmorAc = itemAc
				} else if (itemAc >= 12 && itemAc <= 15) {
					baseArmorAc = itemAc + Math.min(2, Math.max(0, dexMod))
				} else {
					baseArmorAc = itemAc + dexMod
				}
			} else if (nameLower.includes('padded') || nameLower.includes('leather') || nameLower.includes('studded')) {
				const base = nameLower.includes('studded') ? 12 : 11
				baseArmorAc = base + dexMod
			} else if (nameLower.includes('hide') || nameLower.includes('chain shirt') || nameLower.includes('scale mail') || nameLower.includes('breastplate') || nameLower.includes('half plate')) {
				let base = 14
				if (nameLower.includes('hide')) base = 12
				else if (nameLower.includes('chain shirt')) base = 13
				else if (nameLower.includes('scale mail') || nameLower.includes('breastplate')) base = 14
				else if (nameLower.includes('half plate')) base = 15
				baseArmorAc = base + Math.min(2, Math.max(0, dexMod))
			} else if (nameLower.includes('ring mail') || nameLower.includes('chain mail') || nameLower.includes('splint') || nameLower.includes('plate')) {
				let base = 16
				if (nameLower.includes('ring mail')) base = 14
				else if (nameLower.includes('chain mail')) base = 16
				else if (nameLower.includes('splint')) base = 17
				else if (nameLower.includes('plate')) base = 18
				baseArmorAc = base
			}
		}
	}

	let ac = 10 + dexMod
	if (baseArmorAc !== null) {
		ac = baseArmorAc
	} else if (character.ac) {
		ac = Number(character.ac)
	}
	if (hasShield) {
		ac += 2
	}

	// Senses
	const senses = {
		passive_perception: skills.perception.passive,
		passive_investigation: skills.investigation.passive,
		passive_insight: skills.insight.passive,
		custom: character.sense || []
	}

	// Weapon Attacks
	const attacks = []
	const COMMON_WEAPONS = [
		'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light hammer', 'mace', 'quarterstaff', 'sickle', 'spear',
		'light crossbow', 'dart', 'shortbow', 'sling', 'battleaxe', 'flail', 'glaive', 'greataxe', 'greatsword',
		'halberd', 'lance', 'longsword', 'maul', 'morningstar', 'pike', 'rapier', 'scimitar', 'shortsword', 'trident',
		'war pick', 'warhammer', 'whip', 'blowgun', 'heavy crossbow', 'hand crossbow', 'longbow', 'net'
	]

	for (const eq of equipments) {
		const isEquipped = eq.status === 'equipped'
		if (!isEquipped) continue
		const nameLower = (eq.name || '').toLowerCase()

		const isNotWeapon = eq.is_armor || eq.equip_type === 'armor' || eq.equip_type === 'shield' || eq.equip_type === 'container' || eq.equip_type === 'wearable' || eq.item_type === 'armor' || eq.item_type === 'gear' || eq.item_type === 'tool' || nameLower.includes('shield') || nameLower.includes('armor') || ['chest', 'backpack', 'pouch', 'sack'].includes(nameLower)
		if (isNotWeapon) continue

		const isExplicitWeapon = eq.equip_type === 'weapon' || eq.item_type === 'weapon' || Boolean(eq.damage_dice || eq.dmg1)
		const isKnownWeapon = COMMON_WEAPONS.some(w => nameLower.includes(w))
		if (!isExplicitWeapon && !isKnownWeapon) continue

		const dmgDice = eq.damage_dice || eq.dmg1 || '1d6'
		const isFinesseOrRanged = eq.properties?.includes('finesse') || eq.item_type === 'weapon_ranged'
		const atkMod = isFinesseOrRanged ? Math.max(dexMod, strMod) : strMod
		const atkBonus = pb + atkMod
		const dmgTotal = atkMod

		const rawMastery = Array.isArray(eq.mastery) ? eq.mastery[0] : eq.mastery
		const masteryName = typeof rawMastery === 'object' && rawMastery?.uid
			? rawMastery.uid.split('|')[0]
			: (typeof rawMastery === 'string' ? rawMastery.split('|')[0] : null)
		const masteryKey = masteryName ? masteryName.trim().toLowerCase() : null
		const masteryInfo = masteryKey && WEAPON_MASTERY_DESCRIPTIONS[masteryKey]
			? {
				name: masteryName,
				effect: WEAPON_MASTERY_DESCRIPTIONS[masteryKey],
				dc: masteryKey === 'topple' ? (8 + pb + atkMod) : null
			}
			: null

		attacks.push({
			name: eq.name,
			attack_bonus: atkBonus,
			attack_roll: atkBonus >= 0 ? `1d20+${atkBonus}` : `1d20${atkBonus}`,
			damage_dice: dmgDice,
			damage_bonus: dmgTotal,
			damage_type: eq.damage_type || eq.dmgType || 'slashing',
			damage_roll: dmgTotal >= 0 ? `${dmgDice}+${dmgTotal}` : `${dmgDice}${dmgTotal}`,
			mastery: masteryInfo
		})
	}

	// Spellcasting
	let spellcasting = null
	const primaryClass = Array.isArray(character.class) ? character.class[0] : character.class
	if (primaryClass) {
		let spellAbility = null
		const rawAbility = primaryClass.spellcasting_ability || primaryClass.spellAbility
		if (rawAbility) {
			const map = { int: 'intelligence', wis: 'wisdom', cha: 'charisma', str: 'strength', dex: 'dexterity', con: 'constitution' }
			spellAbility = map[String(rawAbility).toLowerCase()] || String(rawAbility).toLowerCase()
		} else {
			const cName = (primaryClass.name || '').toLowerCase()
			if (['wizard', 'artificer'].includes(cName)) spellAbility = 'intelligence'
			else if (['cleric', 'druid', 'ranger'].includes(cName)) spellAbility = 'wisdom'
			else if (['bard', 'paladin', 'sorcerer', 'warlock'].includes(cName)) spellAbility = 'charisma'
		}

		if (spellAbility) {
			const sMod = abilityStats[spellAbility].modifier
			const saveDc = 8 + pb + sMod
			const spellAtk = pb + sMod

			spellcasting = {
				ability: spellAbility,
				ability_modifier: sMod,
				spell_save_dc: saveDc,
				spell_attack_bonus: spellAtk,
				spell_attack_roll: spellAtk >= 0 ? `1d20+${spellAtk}` : `1d20${spellAtk}`
			}
		}
	}

	// Defenses & Saving throw advantages dynamic extraction
	let storedDefenses = character.defenses
	if (typeof storedDefenses === 'string') {
		try { storedDefenses = JSON.parse(storedDefenses) } catch { storedDefenses = null }
	}
	const defenses = storedDefenses || { resistances: [], immunities: [], vulnerabilities: [] }
	if (!defenses.resistances) defenses.resistances = []
	if (!defenses.immunities) defenses.immunities = []
	if (!defenses.vulnerabilities) defenses.vulnerabilities = []

	function cleanEntryText(val) {
		if (!val) return ''
		if (typeof val === 'string') return val.replace(/\{@\w+\s+([^|}]+)(?:\|[^}]+)?\}/g, '$1')
		if (Array.isArray(val)) return val.map(cleanEntryText).join(' ')
		if (typeof val === 'object') {
			const n = val.name ? `${val.name}: ` : ''
			const sub = cleanEntryText(val.entries || val.entry || '')
			return `${n}${sub}`
		}
		return ''
	}

	const allSources = []
	if (Array.isArray(character.compendium_race_entries)) allSources.push(...character.compendium_race_entries)
	if (Array.isArray(character.compendium_sub_race_entries)) allSources.push(...character.compendium_sub_race_entries)
	if (Array.isArray(character.trait)) allSources.push(...character.trait)
	if (Array.isArray(character.class_feature)) allSources.push(...character.class_feature)
	if (Array.isArray(character.sub_class_feature)) allSources.push(...character.sub_class_feature)
	if (Array.isArray(character.feature)) allSources.push(...character.feature)
	if (Array.isArray(character.feat)) allSources.push(...character.feat)

	const DAMAGE_TYPES = ['Acid', 'Bludgeoning', 'Cold', 'Fire', 'Force', 'Lightning', 'Necrotic', 'Piercing', 'Poison', 'Psychic', 'Radiant', 'Slashing', 'Thunder']

	// Dynamic Resistances from compendium entries
	if (defenses.resistances.length === 0) {
		for (const src of allSources) {
			const text = cleanEntryText(src)
			for (const dt of DAMAGE_TYPES) {
				const re1 = new RegExp(`(?:resistance|resistant)[^.]*?\\b${dt}\\b`, 'i')
				const re2 = new RegExp(`\\b${dt}\\b[^.]*?(?:damage)?[^.]*?(?:resistance|resistant)`, 'i')
				if ((re1.test(text) || re2.test(text)) && !defenses.resistances.includes(dt)) {
					defenses.resistances.push(dt)
				}
			}
		}
	}

	// Dynamic Immunities from compendium entries
	if (defenses.immunities.length === 0) {
		for (const src of allSources) {
			const text = cleanEntryText(src)
			for (const dt of DAMAGE_TYPES) {
				const re = new RegExp(`(?:immune|immunity)[^.]*?\\b${dt}\\b`, 'i')
				if (re.test(text) && !defenses.immunities.includes(dt)) {
					defenses.immunities.push(dt)
				}
			}
		}
	}

	// Dynamic Saving Throw Advantages from compendium entries
	const saveAdvantageNotes = []
	const seenAdvLabels = new Set()

	for (const src of allSources) {
		const text = cleanEntryText(src)
		if (/advantage[^.]*?(?:saving throw|save)/i.test(text) || /advantage on[^.]*?save/i.test(text)) {
			const name = src.name || ''
			const sentences = text.split(/(?<=[.!?])\s+/)
			const advSentence = sentences.find(s => /advantage[^.]*?(?:saving throw|save)/i.test(s) || /advantage on[^.]*?save/i.test(s))
			if (advSentence) {
				let label = advSentence.trim()
				if (name && !label.toLowerCase().includes(name.toLowerCase())) {
					label = `${label} (${name})`
				}
				if (!seenAdvLabels.has(label.toLowerCase())) {
					seenAdvLabels.add(label.toLowerCase())
					saveAdvantageNotes.push({ type: 'advantage', label })
				}
			}
		}
	}

	if (character.saving_throw_notes) {
		saveAdvantageNotes.push({ type: 'custom', label: character.saving_throw_notes })
	}

	let storedConditions = character.conditions
	if (typeof storedConditions === 'string') {
		try { storedConditions = JSON.parse(storedConditions) } catch { storedConditions = [] }
	}
	const conditions = Array.isArray(storedConditions) ? storedConditions : []

	return {
		edition: character.edition || '2014',
		level,
		proficiency_bonus: pb,
		abilities: abilityStats,
		saving_throws: savingThrows,
		saving_throw_notes: saveAdvantageNotes,
		defenses,
		conditions,
		inspiration: Boolean(character.inspiration),
		campaign_name: character.campaign_name || null,
		campaign_id: character.campaign_id || null,
		skills,
		combat: {
			armor_class: ac,
			initiative,
			initiative_roll: initiativeRoll,
			jack_of_all_trades: hasJoat,
			speed: Number(character.speed || 30),
			speeds: character.speeds || {},
			ac_custom: character.ac_custom || {},
			hp: {
				current: Number(character.hp || 10),
				max: Number(character.max_hp || 10),
				temp: Number(character.temp_hp || 0),
				hit_dice: character.hit_dice || '1d8',
				max_hp_modifier: Number(character.max_hp_modifier || 0),
				override_max_hp: character.override_max_hp != null ? Number(character.override_max_hp) : null
			}
		},
		senses,
		attacks,
		spellcasting
	}
}
