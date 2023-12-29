'use strict'

// A sample stream producer using XADD.
import { client } from './setUp.mjs'

let streamName = 'item.restock'
let trimmedStreamName = 'mytrimmedstream'
let id = '*'
let consumerLength = 2

async function streamProducer(jsonData) {
	const publisher = client.duplicate()

	await publisher.connect()

	let jsonStringified = JSON.stringify(jsonData)

	for (let i = 0; i < consumerLength; i++) {
		await publisher.xAdd(
			streamName,
			id, // * = Let Redis generate a timestamp ID for this new entry.
			// Payload to add to the stream:
			{
				//i: i.toString(),
				data: jsonStringified,
				// Other name/value pairs can go here as required...
			}
		)

		// Also add to a stream whose length we will cap at approximately
		// 1000 entries using the MAXLEN trimming strategy:
		// https://redis.io/commands/xadd/

		await publisher.xAdd(
			trimmedStreamName,
			// eslint-disable-next-line no-undef
			//id, // Re-use the ID from the previous stream.
			id,
			// Payload to add to the stream:
			{
				//i: i.toString(),
				data: jsonStringified,
				// Other name/value pairs can go here as required...
			},
			// Specify a trimming strategy...
			{
				TRIM: {
					strategy: 'MAXLEN', // Trim by length.
					strategyModifier: '~', // Approximate trimming.
					threshold: 1000, // Retain around 1000 entries.
				},
			}
		)
	}

	// Take a look at how many entries are in the streams...
	// Should be 10000:
	console.log(`Length of ${streamName}: ${await publisher.xLen(streamName)}.`)
	// Should be approximately 1000:
	console.log(
		`Length of ${trimmedStreamName}: ${await publisher.xLen(
			trimmedStreamName
		)}.`
	)

	await publisher.quit()
}

let jsonData = {
	test: 'data',
}

streamProducer(jsonData)
