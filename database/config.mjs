/*
	The default config is actually on JSON, but because we use .env, we need to convert it into .mjs
	and then import using dotenv.
*/

'use strict'

//import dotenv from 'dotenv'

//dotenv.config()

export let dbConfig = {
	host: process.env.DB_HOST,
	port: process.env.DB_PORT,
	database: process.env.DB_NAME,
	user: process.env.DB_USERNAME,
}
