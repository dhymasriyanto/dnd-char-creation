'use strict'

import axios from 'axios'

export let getData = {
	all: async (type) => {
		let race = await axios.get(`${process.env.API_URL}/${type}`, {
			headers: {
				'User-Agent': 'Request-Promise',
				'Content-Type': 'application/json'
			}
		})
			.then((response) => {
				return response.data
			})
			.catch((error) => {
				console.log(error)
			})
		return race
	}
}
