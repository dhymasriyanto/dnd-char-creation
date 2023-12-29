'use strict'

import express from 'express'
const router = express.Router()
import {characterClass} from '../app/api/class-controller.mjs'
import multer from 'multer'
const upload = multer() // for parsing multipart/form-data

// define the home page route
// insert one data
router.route('/')
	.get(characterClass.all)

router.route('/:value').get(characterClass.find)

export {router as characterClass}
