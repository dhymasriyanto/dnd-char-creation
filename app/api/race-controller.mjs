'use strict'

// avoiding error on vscode using when import properties from '../../package.json' assert {type: 'json'}, using this instead: (you know, red is bad)
const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {response} from '../../helper/response.mjs'
import fs from 'fs'

export let race = {
	all: (req, res, next) => {
		let datas = fs.readFileSync('./data/races.json', 'utf8', (err, data) => {
			if (err) throw err
		})

		datas = JSON.parse(datas)

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

		let datas = fs.readFileSync('./data/races.json', 'utf8', (err, data) => {
			if (err) throw err
		})

		datas = JSON.parse(datas)

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
