'use strict'

import express from 'express'
const router = express.Router()
import {character} from '../app/api/character-controller.mjs'
import {requireAuth, optionalAuth} from '../helper/auth.mjs'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const upload = multer() // for parsing multipart/form-data

const imageDir = path.join(process.cwd(), 'uploads', 'characters')
if (!fs.existsSync(imageDir)) {
	fs.mkdirSync(imageDir, { recursive: true })
}

const imageStorage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, imageDir)
	},
	filename: function (req, file, cb) {
		const ext = path.extname(file.originalname).toLowerCase() || '.webp'
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
		cb(null, `char-${uniqueSuffix}${ext}`)
	}
})

const imageUpload = multer({
	storage: imageStorage,
	limits: { fileSize: 5 * 1024 * 1024 }
})

router.post('/upload-image', optionalAuth, imageUpload.single('image'), character.uploadImage)

router.use(requireAuth)

router.route('/')
	.get(character.all)
	.post(upload.array(), character.add)

router.route('/:id').get(character.findId)
	.put(upload.array(), character.update)
	.delete(character.delete)

router.route('/find/:value').get(character.find)

// router.route('/about').get(character.about)

export {router as character}
