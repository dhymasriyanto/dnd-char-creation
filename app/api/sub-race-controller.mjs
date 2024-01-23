'use strict'

import {response} from '../../helper/response.mjs'
import {getData} from '../service/getData.mjs'

export let subRace = {
	all: async (req, res, next) => {
		let datas = await getData.all('races.json')

		return response.ok(
			'success',
			'Retrieved all data',
			datas.subrace,
			res
		)
	},

	find: async (req, res, next) => {
		let raceName = req.params.raceName
		let raceSource = req.params.raceSource
		let name = req.params.name
		let source = req.params.source
		let page = req.params.page

		let datas = await getData.all('races.json')

		let subRaceData = {}

		subRaceData = datas.subrace.filter((data) => {
			if (data.raceName.toLowerCase() === raceName.toLowerCase() && data.raceSource.toLowerCase() === raceSource.toLowerCase() && (data.name ? data.name.toLowerCase() === name.toLowerCase() : true) && data.source.toLowerCase() === source.toLowerCase() && data.page.toString() === page) {
				return data
			}
		})

		if (subRaceData.length != 0) {
			return response.ok(
				'success',
				'Retrieved all data',
				subRaceData,
				res
			)
		} else {
			return response.ok(
				'error',
				'Not Found',
				[],
				res
			)
		}
	},

	get: async (req, res, next) => {
		let raceName = req.params.raceName
		let raceSource = req.params.raceSource

		let datas = await getData.all('races.json')

		let subRaceData = {}

		subRaceData = datas.subrace.filter((data) => {
			if (data.raceName.toLowerCase() === raceName.toLowerCase() && data.raceSource.toLowerCase() === raceSource.toLowerCase()) {
				return data
			}
		})

		if (subRaceData.length != 0) {
			return response.ok(
				'success',
				'Retrieved all data',
				subRaceData,
				res
			)
		} else {
			return response.ok(
				'error',
				'Not Found',
				[],
				res
			)
		}
	}
}
