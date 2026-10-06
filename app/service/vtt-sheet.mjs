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

	for (const [skill, ability] of Object.entries(SKILL_ABILITY_MAP)) {
		const isProf = Boolean(sp[skill])
		const isExp = Boolean(se[skill])
		const bonus = isExp ? 2 * pb : (isProf ? pb : 0)
		const total = abilityStats[ability].modifier + bonus
		const passive = 10 + total

		skills[skill] = {
			ability,
			proficient: isProf,
			expertise: isExp,
			total,
			passive,
			modifier_string: total >= 0 ? `+${total}` : `${total}`,
			roll_formula: total >= 0 ? `1d20+${total}` : `1d20${total}`
		}
	}

	// Combat
	const dexMod = abilityStats.dexterity.modifier
	const strMod = abilityStats.strength.modifier

	const initiative = dexMod
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
			if (nameLower.includes('padded') || nameLower.includes('leather') || nameLower.includes('studded')) {
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
			} else if (eq.ac || eq.base_ac) {
				const base = Number(eq.ac || eq.base_ac)
				baseArmorAc = base > 0 ? (base + (eq.dexMod ? dexMod : 0)) : (10 + dexMod)
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

	for (const eq of equipments) {
		const isWeapon = eq.damage_dice || eq.dmg1 || eq.status === 'equipped'
		if (!isWeapon) continue

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
		const cName = (primaryClass.name || '').toLowerCase()
		let spellAbility = null

		if (['wizard', 'artificer'].includes(cName)) spellAbility = 'intelligence'
		else if (['cleric', 'druid', 'ranger'].includes(cName)) spellAbility = 'wisdom'
		else if (['bard', 'paladin', 'sorcerer', 'warlock'].includes(cName)) spellAbility = 'charisma'

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

	return {
		edition: character.edition || '2014',
		level,
		proficiency_bonus: pb,
		abilities: abilityStats,
		saving_throws: savingThrows,
		skills,
		combat: {
			armor_class: ac,
			initiative,
			initiative_roll: initiativeRoll,
			speed: Number(character.speed || 30),
			hp: {
				current: Number(character.hp || 10),
				max: Number(character.max_hp || 10),
				temp: Number(character.temp_hp || 0),
				hit_dice: character.hit_dice || '1d8'
			}
		},
		senses,
		attacks,
		spellcasting
	}
}
