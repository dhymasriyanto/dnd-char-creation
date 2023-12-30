'use strict'

import express from 'express'
const router = express.Router()
import {race} from '../app/api/race-controller.mjs'

router.route('/')
	.get(race.all)

router.route('/:name/:source/:page').get(race.find)

export {router as race}
