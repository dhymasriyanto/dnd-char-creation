'use strict'

// avoiding error on vscode using when import properties from '../../package.json' assert {type: 'json'}, using this instead: (you know, red is bad)
const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {response} from '../../helper/response.mjs'
import fs from 'fs'

export let characterClass = {
	all: (req, res, next) => {
		let datas = fs.readFileSync('./data/class/index.json', 'utf8', (err, data) => {
			if (err) throw err
		})
		datas = JSON.parse(datas)
		return response.ok(
			'success',
			'Retrieved all data',
			datas,
			res
		)
	},
	find: (req, res, next) => {
		let value = req.params.value

		let charClass = JSON.parse(fs.readFileSync('./data/class/index.json', 'utf8', (err, data) => {
			if (err) throw err
		}))

		if (Object.prototype.propertyIsEnumerable.call(charClass, value)) {
			let datas = fs.readFileSync('./data/class/' + charClass[value], 'utf8', (err, data) => {
				if (err) throw err
			})

			datas = JSON.parse(datas)

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
