'use strict'

export class UserRepository {
	constructor(db, pgp) {
		this.db = db
		this.pgp = pgp
	}

	async create({ username, email, password_hash = null, salt = null, auth_provider = 'local', provider_id = null }) {
		return this.db.one(
			`INSERT INTO users (username, email, password_hash, salt, auth_provider, provider_id)
			 VALUES ($1, $2, $3, $4, $5, $6)
			 RETURNING id, username, email, auth_provider, created_at`,
			[username, email.toLowerCase(), password_hash, salt, auth_provider, provider_id]
		)
	}

	async findById(id) {
		return this.db.oneOrNone(
			`SELECT id, username, email, auth_provider, provider_id, created_at
			 FROM users WHERE id = $1`,
			[id]
		)
	}

	async findByEmail(email) {
		return this.db.oneOrNone(
			'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
			[email]
		)
	}

	async findByUsername(username) {
		return this.db.oneOrNone(
			'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
			[username]
		)
	}

	async findByIdentifier(identifier) {
		return this.db.oneOrNone(
			'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)',
			[identifier]
		)
	}

	async findByProvider(provider, providerId) {
		return this.db.oneOrNone(
			'SELECT * FROM users WHERE auth_provider = $1 AND provider_id = $2',
			[provider, providerId]
		)
	}
}
