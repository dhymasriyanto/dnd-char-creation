'use strict'

import express from 'express'
const router = express.Router()
import {character} from './character.mjs'
import {characterClass} from './character-class.mjs'
import {subClass} from './sub-class.mjs'
import {race} from './race.mjs'
import {subRace} from './sub-race.mjs'

// middleware that is specific to this router
router.use((req, res, next) => {
	console.log('Time: ', Date.now())
	next()
})

router.use('/character', character)
router.use('/class', characterClass)
router.use('/race', race)
router.use('/sub-race', subRace)
router.use('/sub-class', subClass)

export {router}
