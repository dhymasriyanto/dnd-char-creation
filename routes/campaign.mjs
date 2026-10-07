'use strict'

import express from 'express'
const router = express.Router()
import { campaignController } from '../app/api/campaign-controller.mjs'
import { requireAuth } from '../helper/auth.mjs'

router.use(requireAuth)

router.get('/', campaignController.list)
router.post('/', campaignController.create)
router.post('/join', campaignController.join)
router.get('/:id', campaignController.detail)
router.delete('/:id', campaignController.delete)
router.post('/:id/leave', campaignController.leave)
router.post('/:id/link-character', campaignController.linkCharacter)
router.post('/:id/unlink-character', campaignController.unlinkCharacter)
router.get('/:id/messages', campaignController.getMessages)
router.post('/:id/messages', campaignController.sendMessage)
router.post('/:id/rolls', campaignController.sendRoll)

export { router as campaign }
