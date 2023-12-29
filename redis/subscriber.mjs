'use strict'

import { client } from './setUp.mjs'

const subscriber = client.duplicate()

export default async (channel) => {
	await subscriber.connect()

	await subscriber.subscribe(channel, (message) => {
		console.log(message)
	})
}
