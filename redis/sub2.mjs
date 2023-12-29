'use strict'

// A sample stream consumer using the blocking variant of XREAD.
// This consumes entries from a stream created by stream-producer.js

//import { createClient, commandOptions } from 'redis'
import { client, commandOptions } from './setUp.mjs'

async function streamConsumerGroup() {
	const subscriber = client.duplicate()

	if (process.argv.length !== 3) {
		console.log('usage: node sub.mjs <consumerName>')
		process.exit(1)
	}

	const consumerName = process.argv[2]

	await subscriber.connect()

	// Create the consumer group (and stream) if needed...

	try {
		await subscriber.xGroupCreate('item.restock', 'c', '0', {
			MKSTREAM: true,
		})
		console.log('Created consumer group.')
	} catch (e) {
		console.log('Consumer group already exists, skipped creation.')
	}

	console.log(`Starting consumer ${consumerName}.`)

	//let currentId = '0-0' // Start at lowest possible stream ID
	//let currentId = '$' // Start at lowest possible stream ID

	// eslint-disable-next-line no-constant-condition
	while (true) {
		try {
			let response = await subscriber.xReadGroup(
				commandOptions({
					isolated: true,
				}),
				'c',
				consumerName,
				[
					{
						key: 'item.restock',
						id: '>',
					},
				],
				{
					COUNT: 1,
					BLOCK: 0,
				}
			)

			if (response) {
				// Response is an array of streams, each containing an array of
				// entries:
				// [
				//   {
				//     "name": "mystream",
				//     "messages": [
				//       {
				//         "id": "1642088708425-0",
				//         "message": {
				//           "num": "999"
				//         }
				//       }
				//     ]
				//   }
				// ]
				console.log(JSON.stringify(response))

				const entryId = response[0].messages[0].id

				await subscriber.xAck('item.restock', 'c', entryId)

				console.log(`Acknowledged processing of entry ${entryId}.`)

				// Get the ID of the first (only) entry returned.
			} else {
				// Response is null, we have read everything that is
				// in the stream right now...
				console.log('No new stream entries.')
			}
		} catch (err) {
			console.error(err)
		}
	}
}

streamConsumerGroup()
