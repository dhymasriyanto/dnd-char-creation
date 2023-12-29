'use strict'

import express from 'express'
const router = express.Router()
import {character} from '../app/api/character-controller.mjs'
import multer from 'multer'
const upload = multer() // for parsing multipart/form-data

// define the home page route
// insert one data
router.route('/')
	.get(character.all)
	.post(upload.array(), character.add)

// find data by id
// update one data
// delete one data
router.route('/:id').get(character.findId)
	.put(upload.array(), character.update)
	.delete(character.delete)

// find specific data
router.route('/find/:value').get(character.find)

// define the about route
router.route('/about').get(character.about)

export {router as character}
