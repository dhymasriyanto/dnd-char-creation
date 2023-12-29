'use strict'

import express from 'express'
const router = express.Router()
import {subClass} from '../app/api/sub-class-controller.mjs'
import multer from 'multer'
const upload = multer() // for parsing multipart/form-data

router.route('/:className/:classSource')
	.get(subClass.all)
router.route('/:className/:classSource/:name/:source/:shortName/:page').get(subClass.find)

export {router as subClass}
