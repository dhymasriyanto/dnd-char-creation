'use strict'

import {response} from '../../helper/response.mjs'
import {getData} from '../service/getData.mjs'

export let race = {
	all: async (req, res, next) => {
		let datas = await getData.all('races.json')

		return response.ok(
			'success',
			'Retrieved all data',
			datas.race,
			res
		)
	},
	find: (req, res, next) => {
		let name = req.params.name
		let source = req.params.source
		let page = req.params.page

		let datas = getData.all('races.json')

		let raceData = {}

		raceData = datas.race.filter((data) => {
			if (data.name.toLowerCase() === name.toLowerCase() && data.source.toLowerCase() === source.toLowerCase() && data.page.toString() === page) {
				return data
			}
		})

		if (raceData.length != 0) {
			return response.ok(
				'success',
				'Retrieved all data',
				raceData,
				res
			)
		} else {
			return response.ok(
				'success',
				'Not Found',
				[],
				res
			)
		}
	}
}
