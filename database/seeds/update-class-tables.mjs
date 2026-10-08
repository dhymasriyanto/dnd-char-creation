'use strict'

import { readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { db } from '../index.mjs'

async function run() {
	console.log('--- Updating class_table_groups and class_features in compendium_classes ---')
	const DIR_2024 = join(process.cwd(), '2024_data')
	const DIR_2014 = join(process.cwd(), '2014_data')

	let updatedCount = 0

	for (const yr of ['2024', '2014']) {
		const baseDir = yr === '2024' ? DIR_2024 : DIR_2014
		const classDir = join(baseDir, 'class')
		const files = (await readdir(classDir)).filter(f => f.startsWith('class-') && f.endsWith('.json'))

		for (const file of files) {
			const content = JSON.parse(await readFile(join(classDir, file), 'utf8'))
			for (const cl of (content.class || [])) {
				const is2024 = cl.edition === 'one' || cl.source === 'XPHB' || (cl.source === 'EFA' && yr === '2024')
				const edition = is2024 ? '2024' : '2014'
				const source = cl.source || (is2024 ? 'XPHB' : 'PHB')
				const tableGroups = cl.classTableGroups || []
				const classFeatures = cl.classFeatures || []

				const res = await db.result(
					`UPDATE compendium_classes
					 SET class_table_groups = $1, class_features = $2
					 WHERE LOWER(name) = LOWER($3) AND edition = $4 AND UPPER(source) = UPPER($5)`,
					[JSON.stringify(tableGroups), JSON.stringify(classFeatures), cl.name, edition, source]
				)

				if (res.rowCount > 0) {
					updatedCount += res.rowCount
				} else {
					// Fallback match by name and edition
					const res2 = await db.result(
						`UPDATE compendium_classes
						 SET class_table_groups = $1, class_features = $2
						 WHERE LOWER(name) = LOWER($3) AND edition = $4 AND class_table_groups IS NULL`,
						[JSON.stringify(tableGroups), JSON.stringify(classFeatures), cl.name, edition]
					)
					if (res2.rowCount > 0) {
						updatedCount += res2.rowCount
					}
				}
			}
		}
	}

	console.log(`Updated ${updatedCount} classes with table groups and features.`)

	// Also check if any classes still lack class_table_groups
	const missing = await db.any(
		`SELECT name, edition, source FROM compendium_classes WHERE class_table_groups IS NULL`
	)
	console.log('Classes still lacking table groups:', missing)

	process.exit(0)
}

run().catch(err => {
	console.error('Failed to update class tables:', err)
	process.exit(1)
})
