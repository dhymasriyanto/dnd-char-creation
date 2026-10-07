'use strict'

import express from 'express'
const router = express.Router()
import { authController } from '../app/api/auth-controller.mjs'
import { requireAuth } from '../helper/auth.mjs'
import multer from 'multer'
const upload = multer()

router.post('/register', upload.none(), authController.register)
router.post('/login', upload.none(), authController.login)
router.get('/me', requireAuth, authController.me)
router.post('/sso', upload.none(), authController.sso)

export { router as auth }
