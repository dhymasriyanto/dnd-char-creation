'use strict'

import express from 'express'
const router = express.Router()
import {race} from '../app/api/race-controller.mjs'
import multer from 'multer'
const upload = multer() // for parsing multipart/form-data

// define the home page route
// insert one data
router.route('/')
	.get(race.all)

router.route('/:name/:source/:page').get(race.find)

export {router as race}
