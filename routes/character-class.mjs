'use strict'

import express from 'express'
const router = express.Router()
import {characterClass} from '../app/api/class-controller.mjs'

router.route('/')
	.get(characterClass.all)

router.route('/:value').get(characterClass.find)

export {router as characterClass}
