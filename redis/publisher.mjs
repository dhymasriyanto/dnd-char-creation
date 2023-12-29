'use strict'

import { client } from './setUp.mjs'

const publisher = client.duplicate()

export default async (channel, message) => {
	await publisher.connect()

	await publisher.publish(channel, message)
}
