export let response = {
	ok: (status, message, values, reply)=>{
		return reply
			.status(200)
			.json({
				status: status,
				message: message,
				data: values,
				statusCode: 200
			})
	},
	loadCsrf: (status, message, values, reply)=>{
		return reply
			.status(200)
			.json({
				status: status,
				message: message,
				data: values,
				statusCode: 200
			})
	},
	invalid:(status, message, values, reply)=>{
		return reply
			.status(202)
			.json({
				status: status,
				message: message,
				data: values,
				statusCode: 202
			})
	},
	badRequest:(status, message, values, reply)=>{
		return reply
			.status(400)
			.json({
				status: status,
				message: message,
				data: values,
				statusCode: 400
			})
	},
	notFound:(status, message, values, reply)=>{
		return reply
			.status(404)
			.json({
				status: status,
				message: message,
				data: values,
				statusCode: 404
			})
	},
	notAuthenticated:(status, message, values, reply)=>{
		return reply
			.status(401)
			.json({
				status:status,
				message: message,
				data: values,
				statusCode:401
			})
	},
	notAuthorized:(status, message, values, reply)=>{
		return reply
			.status(403)
			.json({
				status: status,
				message: message,
				data: values,
				statusCode:403
			})
	}
}