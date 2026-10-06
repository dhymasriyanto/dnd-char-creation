'use strict'

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFile } from 'fs/promises'

const __dirname = fileURLToPath(dirname(import.meta.url))
const ROOT = join(__dirname, '../../')

export let getData = {
	all: async (type, edition = '2024') => {
		const targetDir = edition === '2014' ? '2014_data' : '2024_data'
		const filePath = join(ROOT, targetDir, type)

		try {
			const raw = await readFile(filePath, 'utf8')
			return JSON.parse(raw)
		} catch (err) {
			const fallbackDir = edition === '2014' ? '2024_data' : '2014_data'
			try {
				const fallbackPath = join(ROOT, fallbackDir, type)
				const raw = await readFile(fallbackPath, 'utf8')
				return JSON.parse(raw)
			} catch (e) {
				console.error(`Error loading data for ${type}:`, err.message)
				return null
			}
		}
	}
}
