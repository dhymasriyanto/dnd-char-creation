'use strict'

import {response} from '../../helper/response.mjs'
import {getData} from '../service/getData.mjs'

export let subClass = {
	all: async (req, res, next) => {
		let className = req.params.className
		let classSource = req.params.classSource

		let charClass = await getData.all('class/index.json')

		if (Object.prototype.propertyIsEnumerable.call(charClass, className)) {
			let datas = await getData.all('class/' + charClass[className])

			let subClassData = {}

			subClassData.class = datas.class
			subClassData.classFeature = datas.classFeature
			subClassData.subClass = datas.subclass.filter((data) => {
				if (data.classSource.toLowerCase() === classSource.toLowerCase()) {
					return data
				}
			})


			if (subClassData.length != 0) {
				return response.ok(
					'success',
					'Retrieved all data',
					subClassData,
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
		} else {
			return response.notFound(
				'error',
				'Not Found',
				'',
				res
			)
		}

	},

	find: async (req, res, next) => {
		let className = req.params.className
		let classSource = req.params.classSource
		let name = req.params.name
		let source = req.params.source
		let shortName = req.params.shortName
		let page = req.params.page

		let charClass = await getData.all('class/index.json')

		if (Object.prototype.propertyIsEnumerable.call(charClass, className)) {
			let datas = await getData.all('class/' + charClass[className])

			let subClassData = {}

			subClassData.class = datas.class
			subClassData.classFeature = datas.classFeature
			subClassData.subClass = datas.subclass.filter((data) => {
				if (data.classSource.toLowerCase() === classSource.toLowerCase() && data.name.toLowerCase() === name.toLowerCase() && data.source.toLowerCase() === source.toLowerCase() && data.shortName.toLowerCase() === shortName.toLowerCase() && data.page.toString() === page) {
					return data
				}
			})

			subClassData.subClassFeature = datas.subclassFeature.filter((data) => {
				if (data.classSource.toLowerCase() === classSource.toLowerCase() && data.subclassSource.toLowerCase() === source.toLowerCase() && data.subclassShortName.toLowerCase() === shortName.toLowerCase() && data.page.toString() === page) {
					return data
				}
			})


			if (subClassData.length != 0) {
				return response.ok(
					'success',
					'Retrieved all data',
					subClassData,
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
