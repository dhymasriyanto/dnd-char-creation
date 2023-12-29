'use strict'

// avoiding error on vscode using when import properties from '../../package.json' assert {type: 'json'}, using this instead: (you know, red is bad)
const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {response} from '../../helper/response.mjs'
import fs from 'fs'

export let subClass = {
	all: (req, res, next) => {
		let className = req.params.className
		let classSource = req.params.classSource

		let charClass = JSON.parse(fs.readFileSync('./data/class/index.json', 'utf8', (err) => {
			if (err) throw err
		}))

		if (Object.prototype.propertyIsEnumerable.call(charClass, className)) {
			let datas = fs.readFileSync('./data/class/' + charClass[className], 'utf8', (err) => {
				if (err) throw err
			})

			datas = JSON.parse(datas)
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
	find: (req, res, next) => {
		let className = req.params.className
		let classSource = req.params.classSource
		let name = req.params.name
		let source = req.params.source
		let shortName = req.params.shortName
		let page = req.params.page

		let charClass = JSON.parse(fs.readFileSync('./data/class/index.json', 'utf8', (err) => {
			if (err) throw err
		}))

		if (Object.prototype.propertyIsEnumerable.call(charClass, className)) {
			let datas = fs.readFileSync('./data/class/' + charClass[className], 'utf8', (err) => {
				if (err) throw err
			})

			datas = JSON.parse(datas)

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
