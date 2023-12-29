'use strict'

import express from 'express'
const router = express.Router()
import {subRace} from '../app/api/sub-race-controller.mjs'
import multer from 'multer'
const upload = multer() // for parsing multipart/form-data

// define the home page route
// insert one data
router.route('/')
	.get(subRace.all)

router.route('/:raceName/:raceSource/:name/:source/:page').get(subRace.find)
router.route('/:raceName/:raceSource/').get(subRace.get)

export {router as subRace}
