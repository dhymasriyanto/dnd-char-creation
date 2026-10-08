'use strict'

import express from 'express'
const router = express.Router()
import { compendium } from '../app/api/compendium-controller.mjs'

router.get('/backgrounds', compendium.backgrounds)
router.get('/feats', compendium.feats)
router.get('/spells', compendium.spells)
router.get('/items', compendium.items)
router.get('/monsters', compendium.monsters)
router.get('/rules', compendium.rules)
router.get('/optionalfeatures', compendium.optionalfeatures)
router.get('/races', compendium.races)
router.get('/classes', compendium.classes)
router.get('/class-table', compendium.classTable)
router.get('/subclass-detail', compendium.subclassDetail)
router.get('/adventures', compendium.adventures)
router.post('/homebrew', compendium.saveHomebrew)
router.delete('/homebrew/:category/:id', compendium.deleteHomebrew)
router.get('/lookup', compendium.lookup)

export { router as compendiumRoute }
