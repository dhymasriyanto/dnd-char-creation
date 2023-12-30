'use strict'

import express from 'express'
const router = express.Router()
import {character} from '../app/api/character-controller.mjs'
import multer from 'multer'
const upload = multer() // for parsing multipart/form-data

router.route('/')
	.get(character.all)
	.post(upload.array(), character.add)

router.route('/:id').get(character.findId)
	.put(upload.array(), character.update)
	.delete(character.delete)

router.route('/find/:value').get(character.find)

router.route('/about').get(character.about)

export {router as character}
