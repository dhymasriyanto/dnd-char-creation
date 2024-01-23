'use strict'

const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {db} from '../../database/index.mjs'
import {response} from '../../helper/response.mjs'

export let character = {
	all: (req, res, next) => {
		db.character.all()
			.then(rows => {
				return response.ok(
					'success',
					'Retrieved all data',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	add: (req, res, next) => {
		db.character.add(req.body)
			.then(rows => {
				return response.ok(
					'success',
					'Data inserted',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	update: (req, res, next) => {
		db.character.update(req.body, req.params.id)
			.then(rows => {
				return response.ok(
					'success',
					'Data updated',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	delete: (req, res, next) => {
		db.character.delete(req.params.id)
			.then(rows => {
				return response.ok(
					'success',
					'Data deleted',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	findId: async (req, res, next) => {
		let datas = await db.character.findId(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.race = await db.character.findRace(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sub_race = await db.character.findSubRace(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.class = await db.character.findClass(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.class_feature = await db.character.findClassFeature(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sub_class = await db.character.findSubClass(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sub_class_feature = await db.character.findSubClassFeature(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.ability_score = await db.character.findAbilityScore(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.saving_throw = await db.character.findSavingThrow(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.skill_proficiency = await db.character.findSkillProficiency(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.skill_expertise = await db.character.findSkillExpertise(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.sense = await db.character.findSense(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.feat = await db.character.findFeat(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.trait = await db.character.findTrait(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.feature = await db.character.findFeature(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.proficiency = await db.character.findProficiency(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.language = await db.character.findLanguage(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.treasure = await db.character.findTreasure(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.equipment = await db.character.findEquipment(req.params.id)
			.then(rows => {
				return rows
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		datas.encumbrance = await db.character.findEncumbrance(req.params.id)
			.then(rows => {
				return rows[0]
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})

		return response.ok(
			'success',
			'Retrieved all data',
			datas,
			res
		)

	},

	find: (req, res, next) => {
		db.character.find(req.params.value)
			.then(rows => {
				return response.ok(
					'success',
					'Retrieved similar data',
					rows,
					res
				)
			})
			.catch((error) => {
				return next(response.badRequest(error))
			})
	},

	about: (req, res) => {
		let aboutInfo = {
			name: properties.name,
			version: properties.version,
		}
		res.json({
			status: 'success',
			data: aboutInfo,
			message: 'Retrieved about info of the character'
		})
	},
}
