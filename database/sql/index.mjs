'use strict'

// Import QueryFile using ESModule, but keep export it in defaults.
// Original way is : const {QueryFile} = require('pg-promise'); but it can't be import { QueryFile } from "pg-promise";
import pkg from 'pg-promise'
const {QueryFile} = pkg

// __dirname doesn't exist in ESModule, so make it compatible with import.meta.url, but it didn't same as __dirname, so need some modification at it, then it become:
import {dirname} from 'path'
import {fileURLToPath} from 'url'
const __dirname = fileURLToPath(dirname(import.meta.url))

// renaming import 
// Use this instead of const {join: joinPath} =  await import('path');
import {join as joinPath} from 'path'

///////////////////////////////////////////////////////////////////////////////////////////////
// Criteria for deciding whether to place a particular query into an external SQL file or to
// keep it in-line (hard-coded):
//
// - Size / complexity of the query, because having it in a separate file will let you develop
//   the query and see the immediate updates without having to restart your application.
//
// - The necessity to document your query, and possibly keeping its multiple versions commented
//   out in the query file.
//
// In fact, the only reason one might want to keep a query in-line within the code is to be able
// to easily see the relation between the query logic and its formatting parameters. However, this
// is very easy to overcome by using only Named Parameters for your query formatting.
////////////////////////////////////////////////////////////////////////////////////////////////

export const character = {
	create: sql('character/migrations/create.sql'),
	drop: sql('character/migrations/drop.sql'),
	seeder: sql('character/seeds/seeder.sql'),
	empty: sql('character/seeds/empty.sql'),
	all: sql('character/all.sql'),
	findAbilityScore: sql('character/findAbilityScore.sql'),
	findClass: sql('character/findClass.sql'),
	findClassFeature: sql('character/findClassFeature.sql'),
	findEncumbrance: sql('character/findEncumbrance.sql'),
	findEquipment: sql('character/findEquipment.sql'),
	findFeat: sql('character/findFeat.sql'),
	findFeature: sql('character/findFeature.sql'),
	findLanguage: sql('character/findLanguage.sql'),
	findProficiency: sql('character/findProficiency.sql'),
	findRace: sql('character/findRace.sql'),
	findSavingThrow: sql('character/findSavingThrow.sql'),
	findSense: sql('character/findSense.sql'),
	findSkillExpertise: sql('character/findSkillExpertise.sql'),
	findSkillProficiency: sql('character/findSkillProficiency.sql'),
	findSubClass: sql('character/findSubClass.sql'),
	findSubRace: sql('character/findSubRace.sql'),
	findSubClassFeature: sql('character/findSubClassFeature.sql'),
	findSubRaceFeature: sql('character/findSubRaceFeature.sql'),
	findTrait: sql('character/findTrait.sql'),
	findTreasure: sql('character/findTreasure.sql'),
	findId: sql('character/findId.sql'),
	find: sql('character/find.sql'),
	add: sql('character/add.sql'),
	update: sql('character/update.sql'),
	delete: sql('character/delete.sql')
}

///////////////////////////////////////////////
// Helper for linking to external query files;
function sql(file) {

	const fullPath = joinPath(__dirname, file) // generating full path;
	const options = {

		// minifying the SQL is always advised;
		// see also option 'compress' in the API;
		minify: true

		// See also property 'params' for two-step template formatting
	}

	const qf = new QueryFile(fullPath, options)

	if (qf.error) {

		// Something is wrong with our query file :(
		// Testing all files through queries can be cumbersome,
		// so we also report it here, while loading the module:
		console.error(qf.error)
	}

	return qf

	// See QueryFile API:
	// http://vitaly-t.github.io/pg-promise/QueryFile.html
}

///////////////////////////////////////////////////////////////////
// Possible alternative - enumerating all SQL files automatically:
// http://vitaly-t.github.io/pg-promise/utils.html#.enumSql
