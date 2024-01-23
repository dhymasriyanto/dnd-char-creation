'use strict'

import {response} from '../../helper/response.mjs'
import {getData} from '../service/getData.mjs'

export let characterClass = {
	all: async (req, res, next) => {
		let datas = await getData.all('class/index.json')

		return response.ok(
			'success',
			'Retrieved all data',
			datas,
			res
		)
	},

	find: async (req, res, next) => {
		let value = req.params.value

		let charClass = await getData.all('class/index.json')

		if (Object.prototype.propertyIsEnumerable.call(charClass, value)) {
			let datas = await getData.all('class/' + charClass[value])

			return response.ok(
				'success',
				'Retrieved all data',
				datas,
				res
			)
		} else {
			return response.notFound(
				'error',
				'Not Found',
				'',
				res
			)
		}

	}
}
