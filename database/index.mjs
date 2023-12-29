'use strict'

import promise from 'bluebird' // best promise library (according to pg-promise owner)
import pgPromise from 'pg-promise' // pg-promise core library
import { dbConfig } from './config.mjs' //db connection config
import { Diagnostics } from './diagnostics/index.mjs'
import { Service } from './repository/index.mjs'
//import dotenv from 'dotenv'

//dotenv.config()

// pg-promise initialization options:
const initOptions = {

	// use a custom promise library, instead of the default ES6 promise:
	promiseLib: promise,

	// set the schema
	schema: process.env.DB_SCHEMA,

	// extending the database protocol with pg-promise custom repositories;
	// API: http://vitaly-t.github.io/pg-promise/global.html#event:extend
	// eslint-disable-next-line no-unused-vars
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	extend(obj, dc){

		// Database Context (dc) is mainly useful when extending multiple databases with different access API-s.

		// Do not use 'require()' here, because this event occurs for every task and transaction being executed,
		// which should be as fast as possible.
		obj.character = new Service(obj, pgp)
	}
}

// initializing the library and export it
export const pgp = pgPromise(initOptions)

// creating the database instance and export it
export let db = pgp(dbConfig)

// initializing optional diagnostics
Diagnostics.init(initOptions)
