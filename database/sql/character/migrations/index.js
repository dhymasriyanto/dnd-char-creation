'use strict'

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()

// This is how to import ESModule to CommonJS module
async function loadESModule() {
	const { db } = await import('../../../index.mjs')

	async function create() {
		console.log('Creating table...')
		await db.character.create()
		console.log('Table created successfully.')
	}

	async function drop() {
		console.log('Dropping table...')
		await db.character.drop()
		console.log('Table dropped successfully.')
	}

	async function seeder() {
		console.log('Seeding table with data...')
		await db.character.seeder()
		console.log('Table seeded successfully.')
	}

	async function empty() {
		console.log('Deleting table data...')
		await db.character.empty()
		console.log('Table emptied successfully.')
	}

	module.exports = {
		create,
		drop,
		seeder,
		empty
	}

	// package for make runnable our function (actually only on commonjs, but fortunately we did it :) )
	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require('make-runnable/custom')({
		printOutputFrame:false
	})
}

loadESModule()
