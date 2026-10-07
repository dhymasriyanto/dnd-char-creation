'use strict'

import crypto from 'crypto'
import { response } from './response.mjs'

const JWT_SECRET = process.env.JWT_SECRET || 'dnd-secret-character-key-2024'

export function hashPassword(password, salt = null) {
	const useSalt = salt || crypto.randomBytes(16).toString('hex')
	const hash = crypto.scryptSync(password, useSalt, 64).toString('hex')
	return { hash, salt: useSalt }
}

export function verifyPassword(password, hash, salt) {
	if (!password || !hash || !salt) return false
	try {
		const testHash = crypto.scryptSync(password, salt, 64).toString('hex')
		const bufA = Buffer.from(testHash, 'hex')
		const bufB = Buffer.from(hash, 'hex')
		if (bufA.length !== bufB.length) return false
		return crypto.timingSafeEqual(bufA, bufB)
	} catch {
		return false
	}
}

export function signJwt(payload, expiresIn = 7 * 24 * 3600) {
	const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
	const now = Math.floor(Date.now() / 1000)
	const body = Buffer.from(JSON.stringify({
		...payload,
		iat: now,
		exp: now + expiresIn
	})).toString('base64url')

	const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
	return `${header}.${body}.${sig}`
}

export function verifyJwt(token) {
	if (!token || typeof token !== 'string') return null
	const parts = token.split('.')
	if (parts.length !== 3) return null

	const [header, body, sig] = parts
	const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')

	try {
		const bufSig = Buffer.from(sig)
		const bufExpected = Buffer.from(expectedSig)
		if (bufSig.length !== bufExpected.length || !crypto.timingSafeEqual(bufSig, bufExpected)) {
			return null
		}

		const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
		const now = Math.floor(Date.now() / 1000)
		if (payload.exp && payload.exp < now) {
			return null
		}
		return payload
	} catch {
		return null
	}
}

export function extractBearerToken(req) {
	const authHeader = req.headers.authorization || req.headers.Authorization
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null
	}
	return authHeader.slice(7).trim()
}

export function requireAuth(req, res, next) {
	const token = extractBearerToken(req)
	if (!token) {
		return response.notAuthenticated('error', 'Authentication required', null, res)
	}
	const user = verifyJwt(token)
	if (!user) {
		return response.notAuthenticated('error', 'Invalid or expired token', null, res)
	}
	req.user = user
	next()
}

export function optionalAuth(req, res, next) {
	const token = extractBearerToken(req)
	if (token) {
		const user = verifyJwt(token)
		if (user) {
			req.user = user
		}
	}
	next()
}
