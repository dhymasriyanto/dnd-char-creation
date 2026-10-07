'use strict'

import {character as sql} from '../sql/index.mjs'
//import dotenv from 'dotenv'

//dotenv.config()

function clean5eToolsMarkup(text) {
	if (typeof text !== 'string') return ''
	let cleaned = text
	let iterations = 0
	while (/\{@([a-zA-Z0-9_]+)(?: ([^{}]+))?\}/.test(cleaned) && iterations < 10) {
		cleaned = cleaned.replace(/\{@([a-zA-Z0-9_]+)(?: ([^{}]+))?\}/g, (match, tag, content) => {
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
	cleaned = cleaned.replace(/\s+/g, ' ').trim()
	cleaned = cleaned.replace(/s\s+Weapons$/i, 's')
	return cleaned
}

const CLASS_HD = {
	barbarian: 12, fighter: 10, paladin: 10, ranger: 10, bard: 8,
	cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8,
	artificer: 8, sorcerer: 6, wizard: 6
}
const CLASS_SAVES = {
	barbarian: ['strength', 'constitution'],
	bard: ['dexterity', 'charisma'],
	cleric: ['wisdom', 'charisma'],
	druid: ['intelligence', 'wisdom'],
	fighter: ['strength', 'constitution'],
	monk: ['strength', 'dexterity'],
	paladin: ['wisdom', 'charisma'],
	ranger: ['strength', 'dexterity'],
	rogue: ['dexterity', 'intelligence'],
	sorcerer: ['constitution', 'charisma'],
	warlock: ['wisdom', 'charisma'],
	wizard: ['intelligence', 'wisdom'],
	artificer: ['constitution', 'intelligence']
}

class ServiceRepository {
	constructor(db, pgp) {
		this.db = db
		this.pgp = pgp
	}

	// Creates the table;
	async create() {
		return this.db.none(sql.create)
	}

	// Drop table
	async drop() {
		return this.db.none(sql.drop)
	}

	// Seed column
	async seeder() {
		return this.db.map(sql.seeder, [], row => row.id)
	}

	// Empty column
	async empty() {
		return this.db.none(sql.empty)
	}

	// List all table data; 
	async all(userId = null) {
		return this.db.any(sql.all, [userId ? +userId : null])
	}

	async findAbilityScore(id) {
		return this.db.any(sql.findAbilityScore, id)
	}

	async findClass(id) {
		return this.db.any(sql.findClass, id)
	}

	async findClassFeature(id) {
		return this.db.any(sql.findClassFeature, id)
	}

	async findEncumbrance(id) {
		return this.db.any(sql.findEncumbrance, id)
	}

	async findEquipment(id) {
		return this.db.any(sql.findEquipment, id)
	}

	async findFeat(id) {
		return this.db.any(sql.findFeat, id)
	}

	async findFeature(id) {
		return this.db.any(sql.findFeature, id)
	}

	async findLanguage(id) {
		return this.db.any(sql.findLanguage, id)
	}

	async findProficiency(id) {
		return this.db.any(sql.findProficiency, id)
	}

	async findRace(id) {
		return this.db.any(sql.findRace, id)
	}

	findSavingThrow(id) {
		return this.db.any(sql.findSavingThrow, id)
	}

	async findSense(id) {
		return this.db.any(sql.findSense, id)
	}

	async findSkillExpertise(id) {
		return this.db.any(sql.findSkillExpertise, id)
	}

	async findSkillProficiency(id) {
		return this.db.any(sql.findSkillProficiency, id)
	}

	async findSubClass(id) {
		return this.db.any(sql.findSubClass, id)
	}

	async findSubRace(id) {
		return this.db.any(sql.findSubRace, id)
	}

	async findSubClassFeature(id) {
		return this.db.any(sql.findSubClassFeature, id)
	}

	async findSubRaceFeature(id) {
		return this.db.any(sql.findSubRaceFeature, id)
	}

	async findTrait(id) {
		return this.db.any(sql.findTrait, id)
	}

	async findTreasure(id) {
		return this.db.any(sql.findTreasure, id)
	}

	async findSpell(id) {
		return this.db.any(sql.findSpell, id)
	}

	// find specific id
	async findId(id) {
		return this.db.any(sql.findId, id)
	}

	// find specific data
	async find(values) {
		return this.db.any(sql.find, `%${values}%`)
	}

	// add new data
	async add(data, userId = null) {
		return this.db.tx('add-character', async t => {
			const abs = data.ability_scores || {
				strength: data.strength || 10,
				dexterity: data.dexterity || 10,
				constitution: data.constitution || 10,
				intelligence: data.intelligence || 10,
				wisdom: data.wisdom || 10,
				charisma: data.charisma || 10
			}
			const conMod = Math.floor(((+abs.constitution || 10) - 10) / 2)
			const dexMod = Math.floor(((+abs.dexterity || 10) - 10) / 2)

			// Multiclass & Single Class support
			const classesList = Array.isArray(data.classes) && data.classes.length > 0
				? data.classes
				: (data.class || data.characterClass ? [{
					name: (data.class || data.characterClass).name || (data.class || data.characterClass).class?.name || data.class_name,
					level: data.level ? +data.level : 1,
					class: data.class || data.characterClass,
					sub_class: data.sub_class || data.characterSubClass,
					spells: data.spells || []
				}] : [])

			let totalLevel = 0
			let defaultHp = 0
			const hdParts = []

			for (let i = 0; i < classesList.length; i++) {
				const item = classesList[i]
				const cLvl = Math.max(1, Number(item.level) || 1)
				totalLevel += cLvl
				const clName = (item.name || item.class?.name || item.class?.class?.name || '').toLowerCase()
				const hd = item.class?.hd?.faces || item.class?.class?.hd?.faces || CLASS_HD[clName] || 8
				hdParts.push(`${cLvl}d${hd}`)

				if (i === 0) {
					defaultHp += hd + conMod
					if (cLvl > 1) {
						defaultHp += (cLvl - 1) * (Math.floor(hd / 2) + 1 + conMod)
					}
				} else {
					defaultHp += cLvl * (Math.floor(hd / 2) + 1 + conMod)
				}
			}
			totalLevel = Math.min(20, Math.max(1, totalLevel || (data.level ? +data.level : 1)))
			if (defaultHp <= 0) defaultHp = 10 + conMod
			const computedHitDice = hdParts.length > 0 ? hdParts.join(' + ') : `${totalLevel}d8`

			const race = data.race || data.characterRace || {}
			const walkSpeed = race.speed?.walk || (typeof race.speed === 'number' ? race.speed : 30)

			const characterId = await t.one(sql.add, {
				user_id: data.user_id ? +data.user_id : (userId ? +userId : null),
				edition: data.edition || '2014',
				name: data.name || data.characterName || 'Unnamed Character',
				level: totalLevel,
				proficiency_bonus: Math.floor((totalLevel - 1) / 4) + 2,
				hp: data.hp ? +data.hp : Math.max(1, defaultHp),
				max_hp: data.max_hp ? +data.max_hp : Math.max(1, defaultHp),
				temp_hp: data.temp_hp ? +data.temp_hp : 0,
				ac: data.ac ? +data.ac : (10 + dexMod),
				initiative: data.initiative != null ? +data.initiative : dexMod,
				speed: data.speed ? +data.speed : walkSpeed,
				hit_dice: data.hit_dice || computedHitDice,
				background: data.background || data.characterBackground || null,
				alignment: data.alignment || null,
				inspiration: data.inspiration || false,
				campaign_id: data.campaign_id != null ? +data.campaign_id : null,
				campaign_name: data.campaign_name || null,
				conditions: JSON.stringify(data.conditions || []),
				defenses: JSON.stringify(data.defenses || { resistances: [], immunities: [], vulnerabilities: [] }),
				saving_throw_notes: data.saving_throw_notes || null,
				image_url: data.image_url || null,
				characteristics: JSON.stringify(data.characteristics || {})
			}, r => +r.id)

			// ability_scores
			await t.none(
				`INSERT INTO ability_scores (character_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					characterId,
					+abs.strength || 10,
					+abs.dexterity || 10,
					+abs.constitution || 10,
					+abs.intelligence || 10,
					+abs.wisdom || 10,
					+abs.charisma || 10
				]
			)

			// saving_throws (auto dari primary class jika tidak dioper)
			const primaryClass = classesList[0] || {}
			const cName = (primaryClass.name || primaryClass.class?.name || primaryClass.class?.class?.name || data.class_name || '').toLowerCase()
			const defaultSaves = CLASS_SAVES[cName] || []
			const st = data.saving_throws || {}
			await t.none(
				`INSERT INTO saving_throws (character_id, strength, dexterity, constitution, intelligence, wisdom, charisma)
				 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
				[
					characterId,
					Boolean(st.strength ?? defaultSaves.includes('strength')),
					Boolean(st.dexterity ?? defaultSaves.includes('dexterity')),
					Boolean(st.constitution ?? defaultSaves.includes('constitution')),
					Boolean(st.intelligence ?? defaultSaves.includes('intelligence')),
					Boolean(st.wisdom ?? defaultSaves.includes('wisdom')),
					Boolean(st.charisma ?? defaultSaves.includes('charisma'))
				]
			)

			// skill_proficiencies
			const sp = data.skill_proficiencies || {}
			await t.none(
				`INSERT INTO skill_proficiencies (
					character_id, athletics, acrobatics, animal_handling, arcana, deception, history, insight,
					intimidation, investigation, medicine, nature, perception, performance, persuasion, religion,
					sleight_of_hand, stealth, survival
				) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
				[
					characterId,
					Boolean(sp.athletics), Boolean(sp.acrobatics), Boolean(sp.animal_handling), Boolean(sp.arcana),
					Boolean(sp.deception), Boolean(sp.history), Boolean(sp.insight), Boolean(sp.intimidation),
					Boolean(sp.investigation), Boolean(sp.medicine), Boolean(sp.nature), Boolean(sp.perception),
					Boolean(sp.performance), Boolean(sp.persuasion), Boolean(sp.religion), Boolean(sp.sleight_of_hand),
					Boolean(sp.stealth), Boolean(sp.survival)
				]
			)

			// skill_expertises
			const se = data.skill_expertises || {}
			await t.none(
				`INSERT INTO skill_expertises (
					character_id, athletics, acrobatics, animal_handling, arcana, deception, history, insight,
					intimidation, investigation, medicine, nature, perception, performance, persuasion, religion,
					sleight_of_hand, stealth, survival
				) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
				[
					characterId,
					Boolean(se.athletics), Boolean(se.acrobatics), Boolean(se.animal_handling), Boolean(se.arcana),
					Boolean(se.deception), Boolean(se.history), Boolean(se.insight), Boolean(se.intimidation),
					Boolean(se.investigation), Boolean(se.medicine), Boolean(se.nature), Boolean(se.perception),
					Boolean(se.performance), Boolean(se.persuasion), Boolean(se.religion), Boolean(se.sleight_of_hand),
					Boolean(se.stealth), Boolean(se.survival)
				]
			)

			// character_languages
			const langs = Array.isArray(data.languages) ? data.languages : (data.language ? (Array.isArray(data.language) ? data.language : [data.language]) : [])
			for (const lang of langs) {
				const langName = typeof lang === 'string' ? lang : (lang.name || '')
				if (langName) {
					await t.none('INSERT INTO character_languages (character_id, name) VALUES ($1, $2)', [characterId, langName])
				}
			}

			// character_proficiencies (armor, weapon, tools)
			const profs = Array.isArray(data.proficiencies) ? data.proficiencies : (data.proficiency ? (Array.isArray(data.proficiency) ? data.proficiency : [data.proficiency]) : [])
			for (const prof of profs) {
				const rawName = typeof prof === 'string' ? prof : (prof.name || '')
				const profName = clean5eToolsMarkup(rawName)
				if (profName) {
					await t.none('INSERT INTO character_proficiencies (character_id, name) VALUES ($1, $2)', [characterId, profName])
				}
			}

			// character_races
			let raceId = null
			if (race && race.name) {
				raceId = await t.one(
					`INSERT INTO character_races (character_id, name, source, page)
					 VALUES ($1, $2, $3, $4) RETURNING id`,
					[characterId, race.name, race.source || null, race.page ? String(race.page) : null],
					r => +r.id
				)

				// character_sub_races
				const subRace = data.sub_race || data.characterSubRace
				if (subRace && subRace.name) {
					await t.none(
						`INSERT INTO character_sub_races (character_id, race_id, name, source, page)
						 VALUES ($1, $2, $3, $4, $5)`,
						[characterId, raceId, subRace.name, subRace.source || null, subRace.page ? String(subRace.page) : null]
					)
				}

				// traits
				const traits = race.traitTags || []
				for (const trName of traits) {
					await t.none(
						'INSERT INTO character_traits (character_id, name) VALUES ($1, $2)',
						[characterId, String(trName)]
					)
				}
			}

			// character_classes & features for each class in classesList
			for (const item of classesList) {
				const className = item.name || item.class?.name || item.class?.class?.name || ''
				if (!className) continue
				const cObj = item.class?.class || item.class || {}
				const cSource = item.source || cObj.source || null
				const cPage = (item.page || cObj.page) ? String(item.page || cObj.page) : null
				const cLvl = Math.max(1, Number(item.level) || 1)

				const classId = await t.one(
					`INSERT INTO character_classes (character_id, name, level, source, page)
					 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
					[characterId, className, cLvl, cSource, cPage],
					r => +r.id
				)

				// class features
				const features = item.class?.classFeature || item.classFeature || []
				for (const f of features) {
					if ((f.level || 1) <= cLvl) {
						await t.none(
							`INSERT INTO character_class_features (character_id, class_id, name, source, page, level)
							 VALUES ($1, $2, $3, $4, $5, $6)`,
							[characterId, classId, f.name, f.source || null, f.page ? String(f.page) : null, f.level || 1]
						)
					}
				}

				// character_sub_classes
				const subClass = item.sub_class || item.characterSubClass
				const sc = subClass?.subClass ? (Array.isArray(subClass.subClass) ? subClass.subClass[0] : subClass.subClass) : subClass
				if (sc && sc.name) {
					const subClassId = await t.one(
						`INSERT INTO character_sub_classes (character_id, class_id, name, source, short_name, page)
						 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
						[characterId, classId, sc.name, sc.source || null, sc.shortName || sc.short_name || null, sc.page ? String(sc.page) : null],
						r => +r.id
					)

					const scFeatures = subClass.subClassFeature || []
					const seenScf = new Set()
					for (const sf of scFeatures) {
						if ((sf.level || 1) <= cLvl) {
							const sfName = (sf.name || '').trim()
							if (!sfName || seenScf.has(sfName.toLowerCase())) continue
							seenScf.add(sfName.toLowerCase())
							await t.none(
								`INSERT INTO character_sub_class_features (character_id, sub_class_id, name, source, page, level)
								 VALUES ($1, $2, $3, $4, $5, $6)`,
								[characterId, subClassId, sfName, sf.source || null, sf.page ? String(sf.page) : null, sf.level || 1]
							)
						}
					}
				}
			}

			// background feat & feats
			const feats = data.feats || (data.feat ? [data.feat] : [])
			for (const ft of feats) {
				const ftName = typeof ft === 'string' ? ft : ft.name
				if (ftName) {
					await t.none(
						'INSERT INTO character_feats (character_id, name) VALUES ($1, $2)',
						[characterId, ftName]
					)
				}
			}

			// background features & traits
			const charFeatures = data.features || (data.feature ? [data.feature] : [])
			for (const f of charFeatures) {
				const fName = typeof f === 'string' ? f : f.name
				if (fName) {
					await t.none(
						'INSERT INTO character_features (character_id, name) VALUES ($1, $2)',
						[characterId, fName]
					)
				}
			}

			// equipment & gear
			let totalWeight = 0
			const eqList = data.equipment || data.equipments || []
			for (const eq of eqList) {
				if (!eq || !eq.name) continue
				const amt = eq.amount ? +eq.amount : 1
				const wtNum = parseFloat(eq.weight) || 0
				totalWeight += (wtNum * amt)
				await t.none(
					`INSERT INTO equipments (character_id, name, weight, amount, status, is_armor, container_name)
					 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
					[
						characterId,
						eq.name,
						eq.weight ? String(eq.weight) : '0',
						amt,
						eq.status || 'inventory',
						Boolean(eq.is_armor),
						eq.container_name || null
					]
				)
			}

			// encumbrances (defaults)
			const strScore = abs.strength ? +abs.strength : 10
			await t.none(
				`INSERT INTO encumbrances (character_id, current, maximum, lift_push_drag)
				 VALUES ($1, $2, $3, $4)`,
				[characterId, Math.round(totalWeight), strScore * 15, strScore * 30]
			)

			// treasures (defaults)
			const tr = data.treasures || data.treasure || {}
			await t.none(
				`INSERT INTO treasures (character_id, pp, gp, ep, sp, cp)
				 VALUES ($1, $2, $3, $4, $5, $6)`,
				[
					characterId,
					tr.pp ? +tr.pp : 0,
					tr.gp ? +tr.gp : 0,
					tr.ep ? +tr.ep : 0,
					tr.sp ? +tr.sp : 0,
					tr.cp ? +tr.cp : 0
				]
			)

			// character_spells
			const spellsList = data.spells || data.characterSpells || []
			for (const sp of spellsList) {
				if (!sp || !sp.name) continue
				await t.none(
					`INSERT INTO character_spells (
						character_id, name, level, school, casting_time, range, duration, components, is_prepared, is_cantrip, source, source_feat, is_feat_spell
					) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
					[
						characterId,
						sp.name,
						sp.level != null ? +sp.level : 0,
						sp.school || null,
						sp.casting_time || (Array.isArray(sp.time) ? `${sp.time[0]?.number || 1} ${sp.time[0]?.unit || 'action'}` : '1 action'),
						typeof sp.range === 'string' ? sp.range : (sp.range?.type || 'Self'),
						typeof sp.duration === 'string' ? sp.duration : (Array.isArray(sp.duration) ? (sp.duration[0]?.type || 'Instantaneous') : 'Instantaneous'),
						typeof sp.components === 'string' ? sp.components : (sp.components ? Object.keys(sp.components).join(', ').toUpperCase() : ''),
						sp.is_prepared !== false,
						Boolean(sp.level === 0 || sp.is_cantrip),
						sp.source || null,
						sp.sourceFeat || sp.source_feat || null,
						Boolean(sp.is_feat_spell || sp.sourceFeat || sp.source_feat)
					]
				)
			}

			return { id: characterId }
		})
	}

	// update a data
	async update(data, id) {
		return this.db.tx('update-character', async t => {
			const characterId = +id
			const abs = data.ability_score || data
			const conMod = Math.floor(((+abs.constitution || 10) - 10) / 2)
			const dexMod = Math.floor(((+abs.dexterity || 10) - 10) / 2)

			// Multiclass & Single Class support
			const classesList = Array.isArray(data.classes) && data.classes.length > 0
				? data.classes
				: (data.class || data.characterClass ? [{
					name: (data.class || data.characterClass).name || (data.class || data.characterClass).class?.name || data.class_name,
					level: data.level ? +data.level : 1,
					class: data.class || data.characterClass,
					sub_class: data.sub_class || data.characterSubClass,
					spells: data.spells || []
				}] : [])

			let totalLevel = null
			let computedHitDice = null
			if (classesList.length > 0) {
				let sumLvl = 0
				let defaultHp = 0
				const hdParts = []
				for (let i = 0; i < classesList.length; i++) {
					const item = classesList[i]
					const cLvl = Math.max(1, Number(item.level) || 1)
					sumLvl += cLvl
					const clName = (item.name || item.class?.name || item.class?.class?.name || '').toLowerCase()
					const hd = item.class?.hd?.faces || item.class?.class?.hd?.faces || CLASS_HD[clName] || 8
					hdParts.push(`${cLvl}d${hd}`)
					if (i === 0) {
						defaultHp += hd + conMod
						if (cLvl > 1) {
							defaultHp += (cLvl - 1) * (Math.floor(hd / 2) + 1 + conMod)
						}
					} else {
						defaultHp += cLvl * (Math.floor(hd / 2) + 1 + conMod)
					}
				}
				totalLevel = Math.min(20, Math.max(1, sumLvl))
				computedHitDice = hdParts.length > 0 ? hdParts.join(' + ') : `${totalLevel}d8`
			} else if (data.level) {
				totalLevel = Math.min(20, Math.max(1, +data.level))
			}

			await t.one(sql.update, {
				id: characterId,
				edition: data.edition || null,
				name: data.name || data.characterName || null,
				level: totalLevel,
				proficiency_bonus: totalLevel ? (Math.floor((totalLevel - 1) / 4) + 2) : (data.proficiency_bonus ? +data.proficiency_bonus : null),
				hp: data.hp != null ? +data.hp : null,
				max_hp: data.max_hp != null ? +data.max_hp : null,
				temp_hp: data.temp_hp != null ? +data.temp_hp : null,
				ac: data.ac != null ? +data.ac : null,
				initiative: data.initiative != null ? +data.initiative : null,
				speed: data.speed != null ? +data.speed : null,
				hit_dice: data.hit_dice || computedHitDice,
				background: data.background || data.characterBackground || null,
				alignment: data.alignment || null,
				inspiration: data.inspiration != null ? data.inspiration : null,
				has_campaign_id: data.campaign_id !== undefined,
				campaign_id: data.campaign_id != null ? +data.campaign_id : null,
				has_campaign_name: data.campaign_name !== undefined,
				campaign_name: data.campaign_name !== undefined ? data.campaign_name : null,
				conditions: data.conditions !== undefined ? JSON.stringify(data.conditions) : null,
				defenses: data.defenses !== undefined ? JSON.stringify(data.defenses) : null,
				saving_throw_notes: data.saving_throw_notes !== undefined ? data.saving_throw_notes : null,
				has_max_hp_modifier: data.max_hp_modifier !== undefined,
				max_hp_modifier: data.max_hp_modifier != null ? +data.max_hp_modifier : 0,
				has_override_max_hp: data.override_max_hp !== undefined,
				override_max_hp: data.override_max_hp != null ? +data.override_max_hp : null,
				has_ac_custom: data.ac_custom !== undefined,
				ac_custom: data.ac_custom != null ? JSON.stringify(data.ac_custom) : null,
				has_speeds: data.speeds !== undefined,
				speeds: data.speeds != null ? JSON.stringify(data.speeds) : null,
				has_image_url: data.image_url !== undefined,
				image_url: data.image_url !== undefined ? data.image_url : null,
				has_characteristics: data.characteristics !== undefined,
				characteristics: data.characteristics !== undefined ? JSON.stringify(data.characteristics) : null
			}, r => +r.id)

			// Ability scores
			if (abs.strength != null || abs.dexterity != null || abs.constitution != null || abs.intelligence != null || abs.wisdom != null || abs.charisma != null) {
				await t.none(
					`UPDATE ability_scores SET
						strength = COALESCE($2, strength),
						dexterity = COALESCE($3, dexterity),
						constitution = COALESCE($4, constitution),
						intelligence = COALESCE($5, intelligence),
						wisdom = COALESCE($6, wisdom),
						charisma = COALESCE($7, charisma)
					 WHERE character_id = $1`,
					[
						characterId,
						abs.strength != null ? +abs.strength : null,
						abs.dexterity != null ? +abs.dexterity : null,
						abs.constitution != null ? +abs.constitution : null,
						abs.intelligence != null ? +abs.intelligence : null,
						abs.wisdom != null ? +abs.wisdom : null,
						abs.charisma != null ? +abs.charisma : null
					]
				)
			}

			// Treasures / currency
			const tr = data.treasures || data.treasure || data.currency
			if (tr) {
				await t.none(
					`UPDATE treasures SET
						pp = COALESCE($2, pp),
						gp = COALESCE($3, gp),
						ep = COALESCE($4, ep),
						sp = COALESCE($5, sp),
						cp = COALESCE($6, cp)
					 WHERE character_id = $1`,
					[
						characterId,
						tr.pp != null ? +tr.pp : null,
						tr.gp != null ? +tr.gp : null,
						tr.ep != null ? +tr.ep : null,
						tr.sp != null ? +tr.sp : null,
						tr.cp != null ? +tr.cp : null
					]
				)
			}

			// Equipment & Gear
			if (data.equipment || data.equipments) {
				const eqList = data.equipment || data.equipments || []
				await t.none('DELETE FROM equipments WHERE character_id = $1', characterId)
				let totalWeight = 0
				for (const eq of eqList) {
					if (!eq || !eq.name) continue
					const amt = eq.amount ? +eq.amount : 1
					const wtNum = parseFloat(eq.weight) || 0
					totalWeight += (wtNum * amt)
					await t.none(
						`INSERT INTO equipments (character_id, name, weight, amount, status, is_armor, container_name)
						 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
						[
							characterId,
							eq.name,
							eq.weight ? String(eq.weight) : '0',
							amt,
							eq.status || 'inventory',
							Boolean(eq.is_armor),
							eq.container_name || null
						]
					)
				}

				const strVal = abs.strength ? +abs.strength : 10
				await t.none(
					`UPDATE encumbrances SET
						current = $2,
						maximum = $3,
						lift_push_drag = $4
					 WHERE character_id = $1`,
					[characterId, Math.round(totalWeight), strVal * 15, strVal * 30]
				)
			}

			// Race & Lineage
			const race = data.race || data.characterRace
			if (race && race.name) {
				await t.none('DELETE FROM character_sub_races WHERE character_id = $1', characterId)
				await t.none('DELETE FROM character_traits WHERE character_id = $1', characterId)
				await t.none('DELETE FROM character_races WHERE character_id = $1', characterId)

				const raceId = await t.one(
					`INSERT INTO character_races (character_id, name, source, page)
					 VALUES ($1, $2, $3, $4) RETURNING id`,
					[characterId, race.name, race.source || null, race.page ? String(race.page) : null],
					r => +r.id
				)

				const subRace = data.sub_race || data.characterSubRace
				if (subRace && subRace.name) {
					await t.none(
						`INSERT INTO character_sub_races (character_id, race_id, name, source, page)
						 VALUES ($1, $2, $3, $4, $5)`,
						[characterId, raceId, subRace.name, subRace.source || null, subRace.page ? String(subRace.page) : null]
					)
				}

				const traits = race.traitTags || []
				for (const trName of traits) {
					await t.none(
						'INSERT INTO character_traits (character_id, name) VALUES ($1, $2)',
						[characterId, String(trName)]
					)
				}
			}

			// Class & Subclass (Multiclass support)
			const primaryClass = classesList[0] || (data.class || data.characterClass || {})
			const cName = (primaryClass.name || primaryClass.class?.name || data.class_name || '').toLowerCase()

			if (classesList.length > 0) {
				await t.none('DELETE FROM character_sub_class_features WHERE character_id = $1', characterId)
				await t.none('DELETE FROM character_sub_classes WHERE character_id = $1', characterId)
				await t.none('DELETE FROM character_class_features WHERE character_id = $1', characterId)
				await t.none('DELETE FROM character_classes WHERE character_id = $1', characterId)

				for (const item of classesList) {
					const cLvl = Math.max(1, Number(item.level) || 1)
					const rawClass = item.class || item
					const className = item.name || rawClass.name || rawClass.class?.name || 'Unknown Class'
					const cSource = rawClass.source || rawClass.class?.source || null
					const cPage = (rawClass.page || rawClass.class?.page) ? String(rawClass.page || rawClass.class.page) : null

					const classId = await t.one(
						`INSERT INTO character_classes (character_id, name, level, source, page)
						 VALUES ($1, $2, $3, $4, $5) RETURNING id`,
						[characterId, className, cLvl, cSource, cPage],
						r => +r.id
					)

					const features = rawClass.classFeature || rawClass.class?.classFeature || []
					const seenCf = new Set()
					for (const f of features) {
						if ((f.level || 1) <= cLvl) {
							const fName = (f.name || '').trim()
							if (!fName || seenCf.has(fName.toLowerCase())) continue
							seenCf.add(fName.toLowerCase())
							await t.none(
								`INSERT INTO character_class_features (character_id, class_id, name, source, page, level)
								 VALUES ($1, $2, $3, $4, $5, $6)`,
								[characterId, classId, fName, f.source || null, f.page ? String(f.page) : null, f.level || 1]
							)
						}
					}

					const subClass = item.sub_class || item.characterSubClass
					const sc = subClass?.subClass ? (Array.isArray(subClass.subClass) ? subClass.subClass[0] : subClass.subClass) : subClass
					if (sc && sc.name) {
						const subClassId = await t.one(
							`INSERT INTO character_sub_classes (character_id, class_id, name, source, short_name, page)
							 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
							[characterId, classId, sc.name, sc.source || null, sc.shortName || sc.short_name || null, sc.page ? String(sc.page) : null],
							r => +r.id
						)

						const scFeatures = subClass.subClassFeature || []
						const seenScf = new Set()
						for (const sf of scFeatures) {
							if ((sf.level || 1) <= cLvl) {
								const sfName = (sf.name || '').trim()
								if (!sfName || seenScf.has(sfName.toLowerCase())) continue
								seenScf.add(sfName.toLowerCase())
								await t.none(
									`INSERT INTO character_sub_class_features (character_id, sub_class_id, name, source, page, level)
									 VALUES ($1, $2, $3, $4, $5, $6)`,
									[characterId, subClassId, sfName, sf.source || null, sf.page ? String(sf.page) : null, sf.level || 1]
								)
							}
						}
					}
				}
			}

			// Feats
			if (data.feats || data.feat) {
				await t.none('DELETE FROM character_feats WHERE character_id = $1', characterId)
				const feats = data.feats || (data.feat ? [data.feat] : [])
				for (const ft of feats) {
					const ftName = typeof ft === 'string' ? ft : ft.name
					if (ftName) {
						await t.none(
							'INSERT INTO character_feats (character_id, name) VALUES ($1, $2)',
							[characterId, ftName]
						)
					}
				}
			}

			// Features
			if (data.features || data.feature) {
				await t.none('DELETE FROM character_features WHERE character_id = $1', characterId)
				const charFeatures = data.features || (data.feature ? [data.feature] : [])
				for (const f of charFeatures) {
					const fName = typeof f === 'string' ? f : f.name
					if (fName) {
						await t.none(
							'INSERT INTO character_features (character_id, name) VALUES ($1, $2)',
							[characterId, fName]
						)
					}
				}
			}

			// Languages
			if (data.languages) {
				await t.none('DELETE FROM character_languages WHERE character_id = $1', characterId)
				for (const lang of data.languages) {
					if (lang) {
						await t.none(
							'INSERT INTO character_languages (character_id, name) VALUES ($1, $2)',
							[characterId, String(lang)]
						)
					}
				}
			}

			// Proficiencies
			if (data.proficiencies) {
				await t.none('DELETE FROM character_proficiencies WHERE character_id = $1', characterId)
				for (const prof of data.proficiencies) {
					const cleaned = clean5eToolsMarkup(typeof prof === 'string' ? prof : (prof?.name || ''))
					if (cleaned) {
						await t.none(
							'INSERT INTO character_proficiencies (character_id, name) VALUES ($1, $2)',
							[characterId, cleaned]
						)
					}
				}
			}

			// Saving Throws
			if (cName || data.saving_throws) {
				const defaultSaves = CLASS_SAVES[(cName || '').toLowerCase()] || []
				const st = data.saving_throws || {}
				await t.none(
					`UPDATE saving_throws SET
						strength = $2, dexterity = $3, constitution = $4,
						intelligence = $5, wisdom = $6, charisma = $7
					 WHERE character_id = $1`,
					[
						characterId,
						Boolean(st.strength ?? defaultSaves.includes('strength')),
						Boolean(st.dexterity ?? defaultSaves.includes('dexterity')),
						Boolean(st.constitution ?? defaultSaves.includes('constitution')),
						Boolean(st.intelligence ?? defaultSaves.includes('intelligence')),
						Boolean(st.wisdom ?? defaultSaves.includes('wisdom')),
						Boolean(st.charisma ?? defaultSaves.includes('charisma'))
					]
				)
			}

			// Skill Proficiencies
			const spData = data.skill_proficiencies || data.skills
			if (spData) {
				await t.none(
					`UPDATE skill_proficiencies SET
						athletics = $2, acrobatics = $3, animal_handling = $4, arcana = $5,
						deception = $6, history = $7, insight = $8, intimidation = $9,
						investigation = $10, medicine = $11, nature = $12, perception = $13,
						performance = $14, persuasion = $15, religion = $16, sleight_of_hand = $17,
						stealth = $18, survival = $19
					 WHERE character_id = $1`,
					[
						characterId,
						Boolean(spData.athletics),
						Boolean(spData.acrobatics),
						Boolean(spData.animal_handling),
						Boolean(spData.arcana),
						Boolean(spData.deception),
						Boolean(spData.history),
						Boolean(spData.insight),
						Boolean(spData.intimidation),
						Boolean(spData.investigation),
						Boolean(spData.medicine),
						Boolean(spData.nature),
						Boolean(spData.perception),
						Boolean(spData.performance),
						Boolean(spData.persuasion),
						Boolean(spData.religion),
						Boolean(spData.sleight_of_hand),
						Boolean(spData.stealth),
						Boolean(spData.survival)
					]
				)
			}

			// Skill Expertises
			const seData = data.skill_expertises || data.expertises
			if (seData) {
				await t.none(
					`UPDATE skill_expertises SET
						athletics = $2, acrobatics = $3, animal_handling = $4, arcana = $5,
						deception = $6, history = $7, insight = $8, intimidation = $9,
						investigation = $10, medicine = $11, nature = $12, perception = $13,
						performance = $14, persuasion = $15, religion = $16, sleight_of_hand = $17,
						stealth = $18, survival = $19
					 WHERE character_id = $1`,
					[
						characterId,
						Boolean(seData.athletics),
						Boolean(seData.acrobatics),
						Boolean(seData.animal_handling),
						Boolean(seData.arcana),
						Boolean(seData.deception),
						Boolean(seData.history),
						Boolean(seData.insight),
						Boolean(seData.intimidation),
						Boolean(seData.investigation),
						Boolean(seData.medicine),
						Boolean(seData.nature),
						Boolean(seData.perception),
						Boolean(seData.performance),
						Boolean(seData.persuasion),
						Boolean(seData.religion),
						Boolean(seData.sleight_of_hand),
						Boolean(seData.stealth),
						Boolean(seData.survival)
					]
				)
			}

			// Spells
			if (data.spells != null) {
				await t.none('DELETE FROM character_spells WHERE character_id = $1', characterId)
				for (const sp of data.spells) {
					if (!sp || !sp.name) continue
					await t.none(
						`INSERT INTO character_spells (
							character_id, name, level, school, casting_time, range, duration, components, is_prepared, is_cantrip, source, source_feat, is_feat_spell
						) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
						[
							characterId,
							sp.name,
							sp.level != null ? +sp.level : 0,
							sp.school || null,
							sp.casting_time || (Array.isArray(sp.time) ? `${sp.time[0]?.number || 1} ${sp.time[0]?.unit || 'action'}` : '1 action'),
							typeof sp.range === 'string' ? sp.range : (sp.range?.type || 'Self'),
							typeof sp.duration === 'string' ? sp.duration : (Array.isArray(sp.duration) ? (sp.duration[0]?.type || 'Instantaneous') : 'Instantaneous'),
							typeof sp.components === 'string' ? sp.components : (sp.components ? Object.keys(sp.components).join(', ').toUpperCase() : ''),
							sp.is_prepared !== false,
							Boolean(sp.level === 0 || sp.is_cantrip),
							sp.source || null,
							sp.sourceFeat || sp.source_feat || null,
							Boolean(sp.is_feat_spell || sp.sourceFeat || sp.source_feat)
						]
					)
				}
			}

			return { id: characterId }
		})
	}

	// delete a data
	async delete(id) {
		return this.db.map(sql.delete, id, row => row.id)
	}
}

export {ServiceRepository as character}
