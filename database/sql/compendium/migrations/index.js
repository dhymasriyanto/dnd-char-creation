'use strict'

// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config()

async function loadESModule() {
	const { db } = await import('../../../index.mjs')

	async function create() {
		console.log('Creating compendium tables...')
		await db.compendium.create()
		console.log('Compendium tables created successfully.')
	}

	async function drop() {
		console.log('Dropping compendium tables...')
		await db.compendium.drop()
		console.log('Compendium tables dropped successfully.')
	}

	module.exports = {
		create,
		drop
	}

	// eslint-disable-next-line @typescript-eslint/no-var-requires
	require('make-runnable/custom')({
		printOutputFrame: false
	})
}

loadESModule()
