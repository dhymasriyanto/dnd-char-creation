'use strict'

// avoiding error on vscode using when import properties from '../../package.json' assert {type: 'json'}, using this instead: (you know, red is bad)
const {default: properties} = await import('../../package.json', {assert: {type: 'json'}})
import {response} from '../../helper/response.mjs'
import fs from 'fs'

export let subRace = {
	all: (req, res, next) => {
		let datas = fs.readFileSync('./data/races.json', 'utf8', (err, data) => {
			if (err) throw err
		})

		datas = JSON.parse(datas)

		return response.ok(
			'success',
			'Retrieved all data',
			datas.subrace,
			res
		)
	},

	find: (req, res, next) => {
		let raceName = req.params.raceName
		let raceSource = req.params.raceSource
		let name = req.params.name
		let source = req.params.source
		let page = req.params.page

		let datas = fs.readFileSync('./data/races.json', 'utf8', (err, data) => {
			if (err) throw err
		})

		datas = JSON.parse(datas)

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

	get: (req, res, next) => {
		let raceName = req.params.raceName
		let raceSource = req.params.raceSource
		let page = req.params.page

		let datas = fs.readFileSync('./data/races.json', 'utf8', (err, data) => {
			if (err) throw err
		})

		datas = JSON.parse(datas)

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
