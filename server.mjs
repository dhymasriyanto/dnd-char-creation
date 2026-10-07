'use strict'

import express from 'express'
import dotenv from 'dotenv/config'
import {router} from './routes/index.mjs'
import cors from 'cors'
import path from 'path'
import fs from 'fs'

const uploadsDir = path.join(process.cwd(), 'uploads', 'characters')
if (!fs.existsSync(uploadsDir)) {
	fs.mkdirSync(uploadsDir, { recursive: true })
}

//dotenv.config()
const app = express()
const port = process.env.PORT

app.use(cors())
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

app.use(express.json({ limit: '50mb' })) // for parsing application/json

app.use(
	express.urlencoded({
		limit: '50mb',
		extended: true
	})
) // for parsing application/x-www-form-urlencoded

app.use('/', router)

app.listen(port, () => console.log(`Server started on port : ${port}`))
