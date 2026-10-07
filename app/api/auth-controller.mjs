'use strict'

import { db } from '../../database/index.mjs'
import { response } from '../../helper/response.mjs'
import { hashPassword, verifyPassword, signJwt } from '../../helper/auth.mjs'

export const authController = {
	register: async (req, res, next) => {
		try {
			const { username, email, password } = req.body || {}
			if (!username || !email || !password) {
				return response.badRequest('error', 'Username, email, and password are required', null, res)
			}

			const cleanEmail = String(email).trim().toLowerCase()
			const cleanUsername = String(username).trim()

			if (cleanUsername.length < 3) {
				return response.badRequest('error', 'Username must be at least 3 characters', null, res)
			}
			if (password.length < 6) {
				return response.badRequest('error', 'Password must be at least 6 characters', null, res)
			}

			const existingEmail = await db.user.findByEmail(cleanEmail)
			if (existingEmail) {
				return response.badRequest('error', 'Email is already registered', null, res)
			}

			const existingUser = await db.user.findByUsername(cleanUsername)
			if (existingUser) {
				return response.badRequest('error', 'Username is already taken', null, res)
			}

			const { hash, salt } = hashPassword(password)
			const user = await db.user.create({
				username: cleanUsername,
				email: cleanEmail,
				password_hash: hash,
				salt: salt,
				auth_provider: 'local'
			})

			const token = signJwt({ id: user.id, username: user.username, email: user.email })
			return response.ok('success', 'Registration successful', {
				token,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					auth_provider: user.auth_provider
				}
			}, res)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	login: async (req, res, next) => {
		try {
			const identifier = req.body.identifier || req.body.email || req.body.username
			const password = req.body.password

			if (!identifier || !password) {
				return response.badRequest('error', 'Identifier and password are required', null, res)
			}

			const user = await db.user.findByIdentifier(String(identifier).trim())
			if (!user) {
				return response.notAuthenticated('error', 'Invalid email/username or password', null, res)
			}

			if (user.auth_provider !== 'local' && !user.password_hash) {
				return response.badRequest(
					'error',
					`Account registered with SSO (${user.auth_provider}). Please use SSO login.`,
					null,
					res
				)
			}

			const isValid = verifyPassword(password, user.password_hash, user.salt)
			if (!isValid) {
				return response.notAuthenticated('error', 'Invalid email/username or password', null, res)
			}

			const token = signJwt({ id: user.id, username: user.username, email: user.email })
			return response.ok('success', 'Login successful', {
				token,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					auth_provider: user.auth_provider
				}
			}, res)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	me: async (req, res, next) => {
		try {
			const user = await db.user.findById(req.user.id)
			if (!user) {
				return response.notFound('error', 'User not found', null, res)
			}

			return response.ok('success', 'User profile retrieved', {
				id: user.id,
				username: user.username,
				email: user.email,
				auth_provider: user.auth_provider,
				created_at: user.created_at
			}, res)
		} catch (error) {
			return next(response.badRequest(error))
		}
	},

	sso: async (req, res, next) => {
		try {
			let { provider, provider_id, email, username, credential } = req.body || {}

			// Google Identity Services ID Token verification
			if (credential) {
				const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
				if (!verifyRes.ok) {
					return response.notAuthenticated('error', 'Invalid Google credential token', null, res)
				}
				const googleData = await verifyRes.json()
				provider = 'google'
				provider_id = googleData.sub
				email = googleData.email
				username = googleData.name || googleData.email.split('@')[0]
			}

			// GitHub OAuth code exchange
			if (provider === 'github' && req.body.code) {
				const clientId = process.env.GITHUB_CLIENT_ID
				const clientSecret = process.env.GITHUB_CLIENT_SECRET
				if (!clientId || !clientSecret) {
					return response.badRequest('error', 'GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set in server env', null, res)
				}
				const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
					method: 'POST',
					headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
					body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: req.body.code })
				})
				const tokenData = await tokenRes.json()
				if (!tokenData.access_token) {
					return response.notAuthenticated('error', tokenData.error_description || 'GitHub OAuth failed', null, res)
				}
				const ghUserRes = await fetch('https://api.github.com/user', {
					headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'dnd-app' }
				})
				const ghUser = await ghUserRes.json()
				provider_id = String(ghUser.id)
				username = ghUser.login || ghUser.name

				let ghEmail = ghUser.email
				if (!ghEmail) {
					const emailsRes = await fetch('https://api.github.com/user/emails', {
						headers: { Authorization: `Bearer ${tokenData.access_token}`, 'User-Agent': 'dnd-app' }
					})
					if (emailsRes.ok) {
						const emails = await emailsRes.json()
						const primary = Array.isArray(emails) ? (emails.find((e) => e.primary && e.verified) || emails[0]) : null
						ghEmail = primary?.email
					}
				}
				email = ghEmail || `${ghUser.login}@users.noreply.github.com`
			}

			if (!provider || !provider_id || !email) {
				return response.badRequest('error', 'provider, provider_id, and email are required for SSO', null, res)
			}

			const cleanEmail = String(email).trim().toLowerCase()
			const cleanUsername = String(username || cleanEmail.split('@')[0]).trim()

			// Check existing user by provider_id or by email
			let user = await db.user.findByProvider(provider, String(provider_id))
			if (!user) {
				user = await db.user.findByEmail(cleanEmail)
			}

			if (!user) {
				// Create new SSO user
				let finalUsername = cleanUsername
				let collision = await db.user.findByUsername(finalUsername)
				if (collision) {
					finalUsername = `${cleanUsername}_${Math.floor(1000 + Math.random() * 9000)}`
				}

				user = await db.user.create({
					username: finalUsername,
					email: cleanEmail,
					auth_provider: provider,
					provider_id: String(provider_id)
				})
			}

			const token = signJwt({ id: user.id, username: user.username, email: user.email })
			return response.ok('success', 'SSO login successful', {
				token,
				user: {
					id: user.id,
					username: user.username,
					email: user.email,
					auth_provider: user.auth_provider
				}
			}, res)
		} catch (error) {
			return next(response.badRequest(error))
		}
	}
}
