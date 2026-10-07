'use strict'

import {compendium as sql} from '../sql/index.mjs'

class CompendiumRepository {
	constructor(db, pgp) {
		this.db = db
		this.pgp = pgp
	}

	async create() {
		return this.db.none(sql.create)
	}

	async drop() {
		return this.db.none(sql.drop)
	}

	// --- Races / Species ---
	async getRaces({ edition = '2024', source = null, search = null, limit = null, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_races WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	async getRaceById(id) {
		return this.db.oneOrNone('SELECT * FROM compendium_races WHERE id = $1', [id])
	}

	async getRaceByName(name, edition = '2024') {
		return this.db.oneOrNone(
			'SELECT * FROM compendium_races WHERE LOWER(name) = LOWER($1) AND edition = $2',
			[name, edition]
		)
	}

	async getSubRaces({ raceId = null, edition = '2024', search = null } = {}) {
		let query = 'SELECT * FROM compendium_sub_races WHERE 1=1'
		const params = []

		if (raceId) {
			params.push(raceId)
			query += ` AND race_id = $${params.length}`
		}
		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		return this.db.any(query, params)
	}

	async getSubRacesByParent({ raceName, raceSource = null, edition = '2024' } = {}) {
		let query = `
			SELECT sr.*, r.name as parent_race_name, r.source as parent_race_source
			FROM compendium_sub_races sr
			JOIN compendium_races r ON sr.race_id = r.id
			WHERE LOWER(r.name) = LOWER($1) AND sr.edition = $2
		`
		const params = [raceName, edition]
		if (raceSource) {
			params.push(raceSource.toLowerCase())
			query += ` AND LOWER(r.source) = $${params.length}`
		}
		query += ' ORDER BY sr.name ASC'
		return this.db.any(query, params)
	}

	// --- Classes & Subclasses ---
	async getClasses({ edition = '2024', source = null, search = null, limit = null, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_classes WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	async getClassById(id) {
		return this.db.oneOrNone('SELECT * FROM compendium_classes WHERE id = $1', [id])
	}

	async getClassByName(name, edition = '2024') {
		return this.db.oneOrNone(
			'SELECT * FROM compendium_classes WHERE LOWER(name) = LOWER($1) AND edition = $2',
			[name, edition]
		)
	}

	async getSubClasses({ classId = null, edition = '2024', search = null } = {}) {
		let query = 'SELECT * FROM compendium_sub_classes WHERE 1=1'
		const params = []

		if (classId) {
			params.push(classId)
			query += ` AND class_id = $${params.length}`
		}
		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		return this.db.any(query, params)
	}

	async getClassFeatures({ classId, edition = '2024', level = null } = {}) {
		let query = 'SELECT * FROM compendium_class_features WHERE class_id = $1 AND edition = $2'
		const params = [classId, edition]
		if (level) {
			params.push(level)
			query += ` AND level <= $${params.length}`
		}
		query += ' ORDER BY level ASC, name ASC'
		return this.db.any(query, params)
	}

	async getSubClassFeatures({ subClassId, edition = '2024', level = null } = {}) {
		let query = 'SELECT * FROM compendium_sub_class_features WHERE sub_class_id = $1 AND edition = $2'
		const params = [subClassId, edition]
		if (level) {
			params.push(level)
			query += ` AND level <= $${params.length}`
		}
		query += ' ORDER BY level ASC, name ASC'
		return this.db.any(query, params)
	}

	async getFullClass(className, edition = '2024') {
		const cl = await this.getClassByName(className, edition)
		if (!cl) return null
		const classFeature = await this.getClassFeatures({ classId: cl.id, edition })
		const subclass = await this.getSubClasses({ classId: cl.id, edition })
		return { class: [cl], classFeature, subclass }
	}

	async getFullSubClass({ className, classSource = null, name = null, source = null, shortName = null, edition = '2024' } = {}) {
		const cl = await this.getClassByName(className, edition)
		if (!cl) return null
		const classFeature = await this.getClassFeatures({ classId: cl.id, edition })

		let query = 'SELECT * FROM compendium_sub_classes WHERE class_id = $1 AND edition = $2'
		const params = [cl.id, edition]
		if (name) {
			params.push(name.toLowerCase())
			query += ` AND LOWER(name) = $${params.length}`
		}
		if (source) {
			params.push(source.toLowerCase())
			query += ` AND LOWER(source) = $${params.length}`
		}
		if (shortName) {
			params.push(shortName.toLowerCase())
			query += ` AND LOWER(short_name) = $${params.length}`
		}
		query += ' ORDER BY name ASC'
		const subClasses = await this.db.any(query, params)

		let subClassFeature = []
		if (subClasses.length > 0) {
			const scId = subClasses[0].id
			subClassFeature = await this.getSubClassFeatures({ subClassId: scId, edition })
		}

		return {
			class: [cl],
			classFeature,
			subClass: subClasses,
			subClassFeature
		}
	}

	// --- Backgrounds ---
	async getBackgrounds({ edition = '2024', search = null, source = null, limit = null, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_backgrounds WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	// --- Feats ---
	async getFeats({ edition = '2024', category = null, search = null, source = null, limit = null, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_feats WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (category) {
			params.push(category)
			query += ` AND category = $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	// --- Spells ---
	async getSpells({ edition = '2024', level = null, maxLevel = null, school = null, className = null, search = null, source = null, limit = null, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_spells WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (level != null) {
			params.push(level)
			query += ` AND level = $${params.length}`
		}
		if (maxLevel != null) {
			params.push(maxLevel)
			query += ` AND level <= $${params.length}`
		}
		if (school) {
			params.push(school)
			query += ` AND LOWER(school) = LOWER($${params.length})`
		}
		if (className) {
			params.push(`%${className.toLowerCase()}%`)
			query += ` AND LOWER(classes::text) LIKE $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY level ASC, name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	// --- Items ---
	async getItems({ edition = '2024', itemType = null, mastery = null, search = null, source = null, limit = 100, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_items WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (itemType) {
			params.push(itemType)
			query += ` AND item_type = $${params.length}`
		}
		if (mastery) {
			params.push(mastery.toLowerCase())
			query += ` AND LOWER(mastery) = $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	// --- Monsters ---
	async getMonsters({ edition = '2024', cr = null, type = null, search = null, source = null, limit = 100, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_monsters WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (cr != null && cr !== '' && cr !== 'all') {
			params.push(String(cr))
			query += ` AND cr = $${params.length}`
		}
		if (type != null && type !== '' && type !== 'all') {
			params.push(`%${type.toLowerCase()}%`)
			query += ` AND LOWER(type::text) LIKE $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	async getMonsterByName(name, edition = '2024', source = null) {
		const defaultSource = edition === '2024' ? 'XMM' : 'MM'
		const srcUpper = (source || '').toUpperCase().trim()
		return this.db.oneOrNone(
			`SELECT * FROM compendium_monsters WHERE LOWER(name) = LOWER($1)
			 ORDER BY
				(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
				(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
				(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC
			 LIMIT 1`,
			[name, srcUpper, edition, defaultSource]
		)
	}

	// --- Rules ---
	async getRules({ edition = '2024', type = null, category = null, search = null, source = null, limit = 200, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_rules WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (type && type !== 'all') {
			params.push(type)
			query += ` AND LOWER(type) = LOWER($${params.length})`
		}
		if (category && category !== 'all') {
			params.push(category)
			query += ` AND LOWER(category) = LOWER($${params.length})`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	async getRuleByName(name, type = null, edition = '2024', source = null) {
		const raw = String(name || '').trim().toLowerCase()
		const singular = raw.replace(/s$/, '')
		const plural = raw + 's'
		const norm = raw.replace(/['"“”]/g, '').replace(/[\s_-]+/g, '').replace(/s(?=tool)/g, '').replace(/s$/, '')
		const srcUpper = (source || '').toUpperCase().trim()
		const sources2014 = ['PHB', 'DMG', 'MM', 'XGE', 'TCE', 'VGM', 'MTF', 'MPMM', 'SCAG', 'EGW', 'FTD', 'ERLW']
		const sources2024 = ['XPHB', 'XDMG']
		let effectiveEdition = edition
		if (sources2014.includes(srcUpper)) effectiveEdition = '2014'
		else if (sources2024.includes(srcUpper)) effectiveEdition = '2024'
		const defaultSource = effectiveEdition === '2024' ? 'XPHB' : 'PHB'

		let query = `
			SELECT * FROM compendium_rules
			WHERE (
				LOWER(name) = $1
				OR LOWER(name) = $2
				OR LOWER(name) = $3
				OR REPLACE(REPLACE(REPLACE(REPLACE(RTRIM(LOWER(name), 's'), '''', ''), ' ', ''), '_', ''), 'stool', 'tool') = $4
			)
		`
		const params = [raw, singular, plural, norm]
		if (type) {
			params.push(type.toLowerCase())
			query += ` AND LOWER(type) = $${params.length}`
		}
		params.push(srcUpper, effectiveEdition, defaultSource)
		query += ` ORDER BY
			(CASE WHEN $${params.length - 2} != '' AND UPPER(source) = $${params.length - 2} THEN 0 ELSE 1 END) ASC,
			(CASE WHEN edition = $${params.length - 1} THEN 0 ELSE 1 END) ASC,
			(CASE WHEN UPPER(source) = $${params.length} THEN 0 ELSE 1 END) ASC
			LIMIT 1`
		return this.db.oneOrNone(query, params)
	}

	// --- Optional Features ---
	async getOptionalFeatures({ edition = '2024', featureType = null, search = null, source = null, limit = 200, offset = 0 } = {}) {
		let query = 'SELECT * FROM compendium_optional_features WHERE 1=1'
		const params = []

		if (edition) {
			params.push(edition)
			query += ` AND edition = $${params.length}`
		}
		if (featureType && featureType !== 'all') {
			params.push(`%${featureType.toLowerCase()}%`)
			query += ` AND LOWER(feature_type::text) LIKE $${params.length}`
		}
		if (source) {
			params.push(source.toUpperCase())
			query += ` AND UPPER(source) = $${params.length}`
		}
		if (search) {
			params.push(`%${search.toLowerCase()}%`)
			query += ` AND LOWER(name) LIKE $${params.length}`
		}
		query += ' ORDER BY name ASC'
		if (limit) {
			params.push(Number(limit))
			query += ` LIMIT $${params.length}`
		}
		if (offset) {
			params.push(Number(offset))
			query += ` OFFSET $${params.length}`
		}
		return this.db.any(query, params)
	}

	async getOptionalFeatureByName(name, edition = '2024', source = null) {
		const srcUpper = (source || '').toUpperCase().trim()
		const sources2014 = ['PHB', 'DMG', 'MM', 'XGE', 'TCE', 'VGM', 'MTF', 'MPMM', 'SCAG', 'EGW', 'FTD', 'ERLW']
		const sources2024 = ['XPHB', 'XDMG']
		let effectiveEdition = edition
		if (sources2014.includes(srcUpper)) effectiveEdition = '2014'
		else if (sources2024.includes(srcUpper)) effectiveEdition = '2024'
		const defaultSource = effectiveEdition === '2024' ? 'XPHB' : 'PHB'

		return this.db.oneOrNone(
			`SELECT * FROM compendium_optional_features WHERE LOWER(name) = LOWER($1)
			 ORDER BY
				(CASE WHEN $2 != '' AND UPPER(source) = $2 THEN 0 ELSE 1 END) ASC,
				(CASE WHEN edition = $3 THEN 0 ELSE 1 END) ASC,
				(CASE WHEN UPPER(source) = $4 THEN 0 ELSE 1 END) ASC
			 LIMIT 1`,
			[name, srcUpper, effectiveEdition, defaultSource]
		)
	}
}

export {CompendiumRepository as compendium}
