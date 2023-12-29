'use strict'

// This is how to import ESModule to CommonJS module
async function loadESModule() {
	const { db } = await import('../../../index.mjs')

	function create() {
		db.character.create()
		console.log('Creating table...')
	}

	function drop() {
		db.character.drop()
		console.log('Dropping table...')
	}

	function seeder() {
		db.character.seeder()
		console.log('Seeding table with data...')
	}

	function empty() {
		db.character.empty()
		console.log('Deleting table data...')
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
