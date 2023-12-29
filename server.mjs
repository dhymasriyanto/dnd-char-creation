'use strict'

import express from 'express'
import dotenv from 'dotenv/config'
import {router} from './routes/index.mjs'
import cors from 'cors'

const app = express()
//dotenv.config()
const port = process.env.PORT

app.use(cors())

app.use(express.json()) // for parsing application/json

app.use(
	express.urlencoded({
		extended: true
	})
) // for parsing application/x-www-form-urlencoded

app.use('/', router)

app.listen(port, () => console.log(`Server started on port : ${port}`))
