'use strict'

import { createClient, commandOptions } from 'redis'

const client = createClient()

client.on('connect', () => {
	console.log('Success connect')
})

client.on('ready', () => {
	console.log('Redis ready')
})

client.on('error', (err) => {
	console.log('Error : ', err)
})

export { client, commandOptions }
