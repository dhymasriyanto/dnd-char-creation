'use strict'

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readdir, readFile } from 'fs/promises'
import { db } from '../index.mjs'

const __dirname = fileURLToPath(dirname(import.meta.url))
const ROOT = join(__dirname, '../../')
const DIR_2014 = join(ROOT, '2014_data')
const DIR_2024 = join(ROOT, '2024_data')

async function readJson(path) {
	try {
		const raw = await readFile(path, 'utf8')
		return JSON.parse(raw)
	} catch (err) {
		console.warn(`[WARN] Skipping ${path}: ${err.message}`)
		return null
	}
}

// -------------------------------------------------------------
// 1. VEHICLE FORMATTERS
// -------------------------------------------------------------
function formatVehicleStatBlock(v, fluffEntries = []) {
	const entries = []
	if (Array.isArray(fluffEntries) && fluffEntries.length > 0) {
		entries.push(...fluffEntries)
	}

	const statsTable = {
		type: 'table',
		caption: `${v.name} Statistics`,
		colLabels: ['Property', 'Details'],
		rows: []
	}

	if (v.dimensions) {
		statsTable.rows.push(['Dimensions', Array.isArray(v.dimensions) ? v.dimensions.join(' by ') : String(v.dimensions)])
	}
	if (v.terrain) {
		statsTable.rows.push(['Terrain', Array.isArray(v.terrain) ? v.terrain.join(', ') : String(v.terrain)])
	}
	if (v.capCrew != null) {
		statsTable.rows.push(['Crew Capacity', `${v.capCrew} crew members`])
	}
	if (v.capPassenger != null) {
		statsTable.rows.push(['Passenger Capacity', `${v.capPassenger} passengers`])
	}
	if (v.capCargo != null) {
		statsTable.rows.push(['Cargo Capacity', `${v.capCargo} tons`])
	}
	if (v.cost != null) {
		statsTable.rows.push(['Cost', v.cost >= 100 ? `${v.cost / 100} gp` : `${v.cost} cp`])
	}
	if (v.pace) {
		const paceStr = typeof v.pace === 'object' ? Object.entries(v.pace).map(([k, val]) => `${k}: ${val} mph`).join(', ') : `${v.pace} mph`
		statsTable.rows.push(['Travel Pace', paceStr])
	}
	if (v.speed) {
		const formatSpeed = (s) => {
			if (!s) return ''
			if (typeof s === 'number' || typeof s === 'string') return `${s} ft.`
			if (typeof s === 'object') {
				return Object.entries(s).map(([k, val]) => {
					if (typeof val === 'object' && val !== null) {
						return `${k}: ${val.number || 30} ft.${val.condition ? ` ${val.condition}` : ''}`
					}
					return `${k}: ${val} ft.`
				}).join(', ')
			}
			return String(s)
		}
		const speedStr = formatSpeed(v.speed)
		statsTable.rows.push(['Tactical Speed', speedStr])
	}
	if (v.hull) {
		const hullDesc = `AC ${v.hull.ac || '—'}, HP ${v.hull.hp || '—'}${v.hull.dt ? `, Damage Threshold ${v.hull.dt}` : ''}`
		statsTable.rows.push(['Hull', hullDesc])
	}

	if (statsTable.rows.length > 0) {
		entries.push(statsTable)
	}

	if (Array.isArray(v.weapon) && v.weapon.length > 0) {
		const weaponSection = {
			type: 'entries',
			name: 'Weapons & Armaments',
			entries: []
		}
		for (const w of v.weapon) {
			const wSub = {
				type: 'entries',
				name: `${w.name}${w.count ? ` (${w.count})` : ''}`,
				entries: []
			}
			const wStats = []
			if (w.ac != null) wStats.push(`AC ${w.ac}`)
			if (w.hp != null) wStats.push(`HP ${w.hp}`)
			if (w.crew != null) wStats.push(`Crew ${w.crew}`)
			if (wStats.length) wSub.entries.push(`**Stats:** ${wStats.join(', ')}`)
			if (w.entries) wSub.entries.push(...(Array.isArray(w.entries) ? w.entries : [w.entries]))
			if (w.action) {
				for (const act of w.action) {
					if (act.entries) {
						wSub.entries.push(`**${act.name || 'Action'}:** ${Array.isArray(act.entries) ? act.entries.join(' ') : act.entries}`)
					}
				}
			}
			weaponSection.entries.push(wSub)
		}
		entries.push(weaponSection)
	}

	if (Array.isArray(v.control) && v.control.length > 0) {
		const controlSec = {
			type: 'entries',
			name: 'Controls',
			entries: v.control.map(c => `**${c.name}:** AC ${c.ac || '—'}, HP ${c.hp || '—'}. ${(c.entries || []).join(' ')}`)
		}
		entries.push(controlSec)
	}

	if (Array.isArray(v.movement) && v.movement.length > 0) {
		const moveSec = {
			type: 'entries',
			name: 'Movement',
			entries: v.movement.map(m => `**${m.name}:** AC ${m.ac || '—'}, HP ${m.hp || '—'}. ${(m.speed?.[0]?.entries || m.entries || []).join(' ')}`)
		}
		entries.push(moveSec)
	}

	return entries
}

function formatStandaloneVehicleEntries(it) {
	const entries = []
	const isAir = it.type && (it.type.includes('AIR') || it.name.toLowerCase().includes('airship'))
	const isWater = it.type && (it.type.includes('SHP') || it.name.toLowerCase().includes('ship') || it.name.toLowerCase().includes('boat'))
	const isDrawn = it.type && it.type.includes('VEH')

	let intro = `A standard conveyance described in the rules.`
	if (isAir) {
		intro = `${it.name} is a majestic airborne vessel buoyed by magical buoyancy or gas chambers and propelled by sails or elemental engines through the skies.`
	} else if (isWater) {
		intro = `${it.name} is a waterborne vessel designed for seafaring voyages, coastal patrols, or river transit.`
	} else if (isDrawn) {
		intro = `${it.name} is a land conveyance drawn by draft animals such as horses, oxen, or mules.`
	}
	entries.push(intro)

	const statsTable = {
		type: 'table',
		caption: `${it.name} Statistics`,
		colLabels: ['Property', 'Details'],
		rows: []
	}

	if (it.vehAc) statsTable.rows.push(['Armor Class', `AC ${it.vehAc}`])
	if (it.vehHp) statsTable.rows.push(['Hit Points', `${it.vehHp}${it.vehDmgThresh ? ` (Damage Threshold ${it.vehDmgThresh})` : ''}`])
	if (it.vehSpeed) statsTable.rows.push(['Speed', `${it.vehSpeed} mph (${it.vehSpeed * 24} miles per day)`])
	if (it.crew) statsTable.rows.push(['Crew Required', `${it.crew} crew members`])
	if (it.capPassenger) statsTable.rows.push(['Passenger Capacity', `${it.capPassenger} passengers`])
	if (it.capCargo) statsTable.rows.push(['Cargo Capacity', `${it.capCargo} ton${it.capCargo > 1 ? 's' : ''}`])
	if (it.weight) statsTable.rows.push(['Vehicle Weight', `${it.weight} lb.`])
	if (it.value) statsTable.rows.push(['Cost', it.value >= 100 ? `${it.value / 100} gp` : `${it.value} cp`])

	if (statsTable.rows.length > 0) entries.push(statsTable)

	if (isDrawn) {
		entries.push({
			type: 'entries',
			name: 'Drawn Vehicles Rules',
			entries: [
				"An animal pulling a carriage, cart, chariot, sled, or wagon can move weight up to five times its base carrying capacity, including the weight of the vehicle. If multiple animals pull the same vehicle, add their carrying capacities together."
			]
		})
	}

	return entries
}

function formatMountEntries(it) {
	const entries = []
	entries.push(`${it.name} is a creature commonly acquired as a mount or beast of burden in the worlds of D&D.`)

	const statsTable = {
		type: 'table',
		caption: `${it.name} Attributes`,
		colLabels: ['Property', 'Details'],
		rows: []
	}

	if (it.speed) statsTable.rows.push(['Speed', `${it.speed} ft.`])
	if (it.carryingCapacity) statsTable.rows.push(['Carrying Capacity', `${it.carryingCapacity} lb.`])
	if (it.carryingCapacity) statsTable.rows.push(['Pulling Capacity', `Can pull up to ${it.carryingCapacity * 5} lb. when hitched to a vehicle`])
	if (it.value) statsTable.rows.push(['Cost', it.value >= 100 ? `${it.value / 100} gp` : `${it.value} cp`])

	if (statsTable.rows.length > 0) entries.push(statsTable)

	entries.push({
		type: 'entries',
		name: 'Mounted Combat Rules',
		entries: [
			"A willing creature that is at least one size larger than you and that has an appropriate anatomy can serve as a mount.",
			"While you're mounted, you have two options: you can control the mount, or you can allow it to act independently. A controlled mount moves on your turn as you direct, and it has only three action options: Dash, Disengage, and Dodge. An independent mount retains its place in the initiative order and acts as it wishes."
		]
	})

	return entries
}

// -------------------------------------------------------------
// 2. STANDARD GEAR, WEAPON, ARMOR, TOOL & COMMODITY FORMATTERS
// -------------------------------------------------------------
const PROPERTY_DEFINITIONS = {
	'2H': { name: 'Two-Handed', desc: 'A Two-Handed weapon requires two hands when you attack with it.' },
	'A': { name: 'Ammunition', desc: 'You can use a weapon that has the Ammunition property to make a ranged attack only if you have ammunition to fire from it.' },
	'F': { name: 'Finesse', desc: 'When making an attack with a finesse weapon, you use your choice of your Strength or Dexterity modifier for the attack and damage rolls.' },
	'H': { name: 'Heavy', desc: 'Creatures that are Small or Tiny have Disadvantage on attack rolls with heavy weapons.' },
	'L': { name: 'Light', desc: 'When you take the Attack action and attack with a light weapon, you can make an extra attack with a different light weapon.' },
	'LD': { name: 'Loading', desc: 'Because of the time required to load this weapon, you can fire only one piece of ammunition from it when you use an action, bonus action, or reaction to fire it.' },
	'R': { name: 'Reach', desc: 'This weapon adds 5 feet to your reach when you attack with it, as well as when determining your reach for opportunity attacks with it.' },
	'T': { name: 'Thrown', desc: 'If a weapon has the thrown property, you can throw the weapon to make a ranged attack.' },
	'V': { name: 'Versatile', desc: 'This weapon can be used with one or two hands. A damage value in parentheses appears with the property—the damage when used with two hands.' }
}

const MASTERY_DEFINITIONS = {
	'Cleave': 'If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first.',
	'Graze': 'If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll.',
	'Nick': 'When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action.',
	'Push': 'If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.',
	'Sap': 'If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.',
	'Slow': 'If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn.',
	'Topple': 'If you hit a creature with this weapon, you can force the creature to make a Constitution saving throw. On a failed save, the creature has the Prone condition.',
	'Vex': 'If you hit a creature with this weapon and deal damage to the creature, you have Advantage on your next attack roll against that creature before the end of your next turn.'
}

const DAMAGE_MAP = {
	'B': 'Bludgeoning', 'P': 'Piercing', 'S': 'Slashing',
	'F': 'Fire', 'C': 'Cold', 'L': 'Lightning', 'A': 'Acid',
	'I': 'Poison', 'N': 'Necrotic', 'R': 'Radiant', 'O': 'Force', 'Y': 'Psychic', 'T': 'Thunder'
}

function synthesizeWeaponEntries(it) {
	const entries = []
	const dmgType = DAMAGE_MAP[it.damage_type?.toUpperCase()] || it.damage_type || 'damage'
	const catStr = it.weaponCategory ? `${it.weaponCategory.charAt(0).toUpperCase() + it.weaponCategory.slice(1)} Weapon` : 'Weapon'
	entries.push(`**${catStr}.** Deals ${it.damage_dice || '1d4'} ${dmgType} damage.`)

	if (it.versatile_dice) {
		entries.push(`**Versatile (${it.versatile_dice}).** This weapon can be used with one or two hands. When wielded with two hands to make a melee attack, it deals ${it.versatile_dice} damage.`)
	}

	let props = it.properties
	if (typeof props === 'string') {
		try { props = JSON.parse(props) } catch (_) { props = [] }
	}
	if (!Array.isArray(props)) props = []

	if (props.length > 0) {
		for (const p of props) {
			const code = String(p).split('|')[0].trim()
			const def = PROPERTY_DEFINITIONS[code]
			if (def) {
				entries.push(`**${def.name}.** ${def.desc}`)
			}
		}
	}

	if (it.mastery) {
		const mName = String(it.mastery).split('|')[0].trim()
		const mDesc = MASTERY_DEFINITIONS[mName]
		if (mDesc) {
			entries.push(`**Mastery: ${mName}.** ${mDesc}`)
		}
	}

	return entries
}

function synthesizeArmorEntries(it) {
	const entries = []
	const isShield = it.name.toLowerCase().includes('shield')
	if (isShield) {
		entries.push('**Shield.** A shield increases your Armor Class by 2 while wielded. You can benefit from only one shield at a time.')
	} else {
		let armorDesc = `Armor Class: ${it.base_ac || 10}.`
		if (it.ac_dex_bonus === 'yes') {
			armorDesc += ' Adds Dexterity modifier.'
		}
		entries.push(`**Armor Class.** ${armorDesc}`)
	}

	if (Number(it.strength_requirement) > 0) {
		entries.push(`**Strength Requirement.** Requires Strength ${it.strength_requirement}. If the wearer has a lower Strength score, their speed is reduced by 10 feet.`)
	}

	if (it.stealth_disadvantage) {
		entries.push('**Stealth.** The wearer has Disadvantage on Dexterity (Stealth) checks.')
	}

	return entries
}

const GEAR_DESCRIPTIONS = {
	'abacus': "A standard calculating tool featuring beads sliding along parallel wires, used by merchants, accountants, and scholars to compute large sums.",
	'bedroll': "A compact, insulated sleeping roll with blanket and ties, suitable for resting outdoors during travel and exploration.",
	'blanket': "A thick, warm woven blanket providing warmth and comfort when sleeping or traveling in cold weather.",
	'bell': "A small metal bell that emits a clear ringing tone audible up to 60 feet away when shaken or rung by a tripwire.",
	'bit and bridle': "Leather straps and a metal bit placed in the mount's mouth to allow the rider to steer and control the animal.",
	'crystal': "An arcane focus: a specially attuned crystal designed to channel arcane magical energy for spellcasting.",
	'orb': "An arcane focus: a spherical crystal, glass, or polished stone orb that serves as a conduit for arcane spells.",
	'rod': "An arcane focus: a scepter or rod crafted of metal, bone, or carved wood that channels arcane spells.",
	'staff': "An arcane focus: a specially constructed wooden staff designed to focus magical spells.",
	'wand': "An arcane focus: a slender wand fashioned from wood, bone, or metal used to direct spell energy.",
	'yew wand': "A druidic focus: a wand carved from sacred yew wood, resonating with the primal forces of nature.",
	'wooden staff': "A druidic focus: a sturdy staff fashioned from natural hardwood, seasoned to channel nature magic.",
	'sprig of mistletoe': "A druidic focus: a freshly harvested sprig of wild mistletoe, sacred to druidic traditions.",
	'totem': "A druidic focus: a sacred effigy, carved bone, animal fetish, or feather bundle sacred to wild nature spirits.",
	'amulet': "A holy symbol: an amulet bearing the sacred emblem of a deity, pantheon, or religious philosophy.",
	'emblem': "A holy symbol: an insignia or holy device blazoned on a shield or tabard, used as a divine focus.",
	'reliquary': "A holy symbol: a small, ornate container holding a sacred relic of a saint or divine being.",
	'component pouch': "A watertight leather belt pouch containing all the common material components and items needed to cast your spells.",
	'ale (gallon)': "A full gallon jug of standard fermented ale.",
	'ale (mug)': "A generous flagon or clay mug filled with refreshing ale.",
	'bread (loaf)': "A freshly baked loaf of hearty wheat or rye bread.",
	'loaf of bread': "A freshly baked loaf of hearty wheat or rye bread.",
	'cheese (wedge)': "A wedge of firm, aged travelers' cheese.",
	'hunk of cheese': "A substantial chunk of hard, aged farm cheese.",
	'chunk of meat': "A hearty portion of fresh or smoked game meat.",
	'common wine (bottle)': "A standard glass bottle of local vintage table wine.",
	'common wine (pitcher)': "An earthenware pitcher containing several generous servings of local tavern wine.",
	'fine wine (bottle)': "A sealed bottle of exquisitely aged vintage wine of renowned craftsmanship.",
	'feed (per day)': "A daily ration of grain and dried forage suitable for horses, mules, and other draft animals.",
	'stabling (per day)': "A day of sheltered accommodation, hay, water, and grooming for a mount at an inn or livery stable.",
	'barding': "Specialized armor designed to protect a mount's head, neck, chest, and body. Any type of armor can be purchased as barding at four times the base cost and twice the weight.",
	'adamantine bar': "A heavy ingot of refined adamantine metal, one of the hardest substances in the multiverse, prized for crafting indestructible weapons and armor.",
	'canvas (1 sq. yd.)': "Tough, unbleached cloth woven from hemp or flax, used for making tents, tarpaulins, sails, and heavy sacks.",
	'cotton cloth (1 sq. yd.)': "Lightweight woven fabric suited for shirts, linings, and lightweight garments.",
	'linen (1 sq. yd.)': "Smooth, breathable cloth woven from flax fibers, popular for shirts, tunics, and summer garments.",
	'silk (1 sq. yd.)': "Luxurious, finely spun shimmering silk fabric imported from distant realms, favored for noble attire.",
	'chalk (1 piece)': "A stick of white or colored chalk used for drawing arcane symbols, marking doors, or sketching maps on stone and wood.",
	'chicken': "A domestic fowl kept for eggs and meat. Worth 2 cp.",
	'cow': "A domestic bovine kept for milk, beef, and leather. Weighs approximately 1,000–1,500 lb. Worth 10 gp.",
	'ox': "A large, castrated bull trained as a draft animal, renowned for immense pulling strength. Worth 15 gp.",
	'pig': "A domestic swine kept for livestock and cured meat. Worth 3 gp.",
	'sheep': "A domestic ovine raised for wool, milk, and mutton. Worth 2 gp.",
	'goat': "A hardy, nimble domestic mammal kept for milk and meat, capable of grazing on sparse mountain vegetation. Worth 1 gp.",
	'cinnamon': "A fragrant, pungent spice harvested from tree bark, prized in baking and luxury trade. Worth 2 gp per pound.",
	'cloves': "Fragrant dried flower buds prized as an exotic spice, preservative, and medicinal remedy. Worth 3 gp per pound.",
	'ginger': "A spicy, warming root used in cooking, tea, and apothecaries. Worth 1 gp per pound.",
	'pepper': "Black peppercorns, the most widely sought-after seasoning and trade spice. Worth 2 gp per pound.",
	'saffron': "The precious golden-red stigmas of crocus flowers, the most valuable spice in the world. Worth 15 gp per pound.",
	'salt': "Essential mineral salt used for seasoning, preserving meats, and alchemy. Worth 5 cp per pound.",
	'flour': "Milled grain flour used for baking daily bread and hardtack. Worth 2 cp per pound.",
	'wheat': "A bushel of harvested wheat grain ready for milling or winter storage. Worth 1 cp per pound.",
	'copper': "A raw 1-pound ingot or plate of refined copper metal. Worth 5 sp.",
	'silver': "A refined 1-pound ingot of pure silver metal. Worth 5 gp.",
	'gold': "A refined 1-pound ingot of solid gold. Worth 50 gp.",
	'platinum': "A refined 1-pound ingot of shimmering platinum. Worth 500 gp.",
	'iron': "A 1-pound bar of forged iron, the backbone of tools, nails, weapons, and construction. Worth 1 sp.",
	'common clothes': "A set of everyday clothing including a tunic, trousers or skirt, belt, and shoes, suited for commoners and laborers.",
	'costume clothes': "Elaborate, flamboyant clothing designed for masquerades, plays, and theatrical performances.",
	'fine clothes': "Exquisite tailored garments crafted from velvet, silk, or embroidered linen, accessorized with fur trim and fine leather.",
	'traveler\'s clothes': "Sturdy boots, wool trousers or skirt, a warm tunic or shirt, a hooded cloak, and leather gloves, built for the rigors of the road.",
	'robes': "Long, flowing robes worn by wizards, scholars, monks, and ceremonial priests.",
	'grappling hook': "A sturdy three- or four-pronged iron hook tied to a rope to secure an anchor point when climbing or boarding vessels.",
	'hammer': "A standard one-handed work hammer used for driving iron pitons, nails, and carpentry.",
	'sledgehammer': "A heavy two-handed maul designed for breaking stone, smashing masonry, and heavy labor.",
	'miner\'s pick': "A heavy pickaxe with a pointed iron head designed for quarrying rock, digging mines, and excavation.",
	'shovel': "A sturdy spade with an iron blade and wooden shaft, used for digging trenches, campsites, and earthworks.",
	'hourglass': "A glass timekeeping device filled with measured sand that marks the passage of 1 hour.",
	'ink (1-ounce bottle)': "A small glass vial of durable black or dark brown writing ink.",
	'ink pen': "A quill or dip pen with a split nib for writing with ink on parchment and paper.",
	'paper (one sheet)': "A sheet of pressed plant-fiber paper suitable for writing and drawing maps.",
	'parchment (one sheet)': "A durable sheet of treated animal skin suitable for spell scrolls and official documents.",
	'perfume (vial)': "A small vial of fragrant scented oils used to mask odors and convey wealth.",
	'piton': "A steel spike with an eyelet at one end, driven into rock or masonry to secure a climbing rope.",
	'iron spike': "A heavy forged iron spike useful for wedging doors open or shut and securing blockades.",
	'iron spikes (10)': "A bundle of 10 heavy forged iron spikes.",
	'pole (10-foot)': "A 10-foot wooden staff used for probing dungeon floors, testing for tripwires, and gauging water depth.",
	'riding saddle': "A standard leather saddle fitted for a rider on a horse or similar mount.",
	'pack saddle': "A specialized frame saddle designed to strap packs, crates, and heavy cargo onto a draft animal.",
	'saddlebags': "A pair of connected leather pouches draped over a mount's saddle, holding up to 8 cubic feet or 30 pounds of gear.",
	'sealing wax': "A stick of colored wax melted onto letters and documents to receive the impression of a signet ring.",
	'signal whistle': "A small metal whistle that produces a shrill blast audible up to several hundred feet away.",
	'signet ring': "A gold or silver finger ring engraved with a family crest, arcane sigil, or personal seal.",
	'soap': "A bar of scented or tallow soap used for washing and cleanliness.",
	'steel mirror': "A polished sheet of steel that serves as a reflective mirror without the risk of shattering.",
	'whetstone': "A smooth abrasive stone used to sharpen weapon blades and edge tools.",
	'dice set': "A set of ivory, bone, or wooden dice used for gambling and games of chance.",
	'dragonchess set': "A strategic board game played on three stacked boards with pieces representing dragons and heroes.",
	'three-dragon ante set': "A popular card game of skill, nerve, and betting played across taverns in Faerûn.",
	'enchanted three-dragon ante set': "A finely enchanted card game set that animates cards with tiny draconic illusions during play.",
	'playing card set': "A standard deck of illustrated playing cards used for leisure and gambling.",
	'arrow': "A single shafted projectile tipped with an iron arrowhead, fired from a shortbow or longbow.",
	'arrows (20)': "A standard quiver bundle of 20 wooden arrows.",
	'crossbow bolt': "A short, heavy projectile designed to be launched from a crossbow.",
	'crossbow bolts (20)': "A case containing 20 crossbow bolts.",
	'blowgun needle': "A tiny steel dart or needle tipped with feathers, designed for use in a blowgun.",
	'blowgun needles (50)': "A pouch containing 50 blowgun needles.",
	'sling bullet': "A heavy, rounded lead or polished stone projectile designed for high-impact sling shots.",
	'sling bullets (20)': "A pouch containing 20 sling bullets.",
	'energy cell': "A compact technological power cell used to power advanced futuristic firearms and devices.",
	'modern bullet': "A modern metallic cartridge containing primer, gunpowder, and bullet.",
	'modern bullets (10)': "A clip containing 10 modern metallic cartridges.",
	'renaissance bullet': "A lead ball and measured charge of black powder for Renaissance firearms.",
	'renaissance bullets (10)': "A pouch of 10 lead balls and powder charges.",
	'alchemist\'s supplies': "These supplies include two glass beakers, a metal frame to hold a beaker over a flame, a glass stirring rod, a small mortar and pestle, and a pouch of common alchemical reagents. Proficiency allows crafting acid, alchemist's fire, and identifying substances.",
	'brewer\'s supplies': "Includes a large glass jug, a quantity of hops, a siphon, and several feet of tubing. Proficiency allows brewing beer, purifying water, and evaluating beverages.",
	'calligrapher\'s supplies': "Includes parchment, specialty inks, a dozen quills of varying sizes, and weights. Proficiency allows scribing official documents, maps, and illuminated manuscripts.",
	'carpenter\'s tools': "Includes a wooden mallet, a hand saw, a plane, claw, chisels, and a square. Proficiency allows crafting wooden items, furniture, and examining structural integrity.",
	'cartographer\'s tools': "Includes a quill, ink, parchment, a pair of compasses, calipers, and a ruler. Proficiency allows drafting accurate maps and navigating uncharted territory.",
	'cobbler\'s tools': "Includes a hammer, an awl, a knife, a shoe stand, cutters, leather scraps, and thread. Proficiency allows crafting and repairing footwear, as well as concealing small compartments in boot heels.",
	'cook\'s utensils': "Includes a metal pot, knives, forks, a stirring spoon, and a cutting board. Proficiency allows preparing nourishing meals that improve party rest and foraging.",
	'glassblower\'s tools': "Includes a blowpipe, a marver, blocks, tweezers, and shears. Proficiency allows shaping glass vials, bottles, lenses, and intricate glassware.",
	'jeweler\'s tools': "Includes a small saw and hammer, files, pliers, and tweezers. Proficiency allows cutting gems, appraising jewelry, and identifying counterfeit precious stones.",
	'leatherworker\'s tools': "Includes a knife, a mallet, an edger, hole punches, thread, and leather scraps. Proficiency allows tanning hides, crafting leather armor, and tailoring durable leather goods.",
	'mason\'s tools': "Includes a trowel, a hammer, a chisel, brushes, and a plumb line. Proficiency allows carving stone, examining masonry, and finding weak points in stone walls.",
	'painter\'s supplies': "Includes an easel, canvas, paints, brushes, charcoal sticks, and a palette. Proficiency allows creating paintings, portraits, and deciphering visual art.",
	'potter\'s tools': "Includes potter's needles, ribs, scraper, a wire loop, and a wheel. Proficiency allows shaping ceramic vessels, tiles, and clay molds.",
	'smith\'s tools': "Includes hammers, tongs, charcoal, rags, and a steel anvil horn. Proficiency allows repairing metal armor and weapons, forging horseshoes, and evaluating metalwork.",
	'tinker\'s tools': "Includes a variety of hand tools, thread, needles, a whetstone, scraps of cloth and leather, and a small pot of glue. Proficiency allows repairing mundane gear and assembling clockwork gadgets.",
	'weaver\'s tools': "Includes thread, needles, and a small loom. Proficiency allows crafting cloth garments, tapestries, and repairing sails and tents.",
	'woodcarver\'s tools': "Includes a knife, a gouge, and a small saw. Proficiency allows carving wooden figurines, crafting arrows, and fashioning wooden weapons.",
	'bagpipes': "A traditional wind instrument consisting of an enclosed bag holding air and three drone pipes with a chanter. Can be used as a spellcasting focus for bards.",
	'drum': "A percussion instrument with a taut membrane over a resonant hollow shell. Can be used as a spellcasting focus for bards.",
	'dulcimer': "A stringed instrument played by striking strings with small hammers. Can be used as a spellcasting focus for bards.",
	'flute': "A reedless woodwind instrument producing clear, melodious tones. Can be used as a spellcasting focus for bards.",
	'horn': "A brass or natural horn instrument producing a resonant calling blast. Can be used as a spellcasting focus for bards.",
	'lute': "A plucked string instrument with a neck and a deep round back. Can be used as a spellcasting focus for bards.",
	'lyre': "A classic U-shaped string instrument associated with poetic recitation and song. Can be used as a spellcasting focus for bards.",
	'pan flute': "A wind instrument consisting of multiple pipes of gradually increasing length. Can be used as a spellcasting focus for bards.",
	'shawm': "A double-reed woodwind instrument with a loud, penetrating timbre. Can be used as a spellcasting focus for bards.",
	'viol': "A bowed string instrument with six strings played between the legs. Can be used as a spellcasting focus for bards."
}

// -------------------------------------------------------------
// 3. ENRICH ITEMS
// -------------------------------------------------------------
async function enrichItems() {
	console.log('=== ENRICHING COMPENDIUM ITEMS ===')
	const items2024 = (await readJson(join(DIR_2024, 'items.json')))?.item || []
	const items2014 = (await readJson(join(DIR_2014, 'items.json')))?.item || []
	const base2024 = (await readJson(join(DIR_2024, 'items-base.json')))?.baseitem || []
	const base2014 = (await readJson(join(DIR_2014, 'items-base.json')))?.baseitem || []
	const veh2024 = (await readJson(join(DIR_2024, 'vehicles.json')))?.vehicle || []
	const veh2014 = (await readJson(join(DIR_2014, 'vehicles.json')))?.vehicle || []
	const fluffVeh2024 = (await readJson(join(DIR_2024, 'fluff-vehicles.json')))?.vehicleFluff || []
	const fluffVeh2014 = (await readJson(join(DIR_2014, 'fluff-vehicles.json')))?.vehicleFluff || []

	const allRawItems = [...items2024, ...items2014, ...base2024, ...base2014]
	const allVehicles = [...veh2024, ...veh2014]
	const allFluffVehicles = [...fluffVeh2024, ...fluffVeh2014]

	// Map raw items by name & source
	const itemMap = new Map()
	for (const it of allRawItems) {
		if (it.name && it.source) itemMap.set(`${it.name}|${it.source}`.toLowerCase(), it)
		if (it.name && !itemMap.has(it.name.toLowerCase())) itemMap.set(it.name.toLowerCase(), it)
	}

	function resolveItemCopy(it, depth = 0) {
		if (!it._copy || depth > 5) return it
		const parentName = it._copy.name
		const parentSource = it._copy.source
		const parent = itemMap.get(`${parentName}|${parentSource}`.toLowerCase()) || itemMap.get(parentName.toLowerCase())
		if (!parent) return it
		const resolvedParent = resolveItemCopy(parent, depth + 1)
		return {
			...resolvedParent,
			...it,
			entries: (it.entries && it.entries.length) ? it.entries : (resolvedParent.entries || []),
			property: (it.property && it.property.length) ? it.property : (resolvedParent.property || []),
			mastery: it.mastery || resolvedParent.mastery,
			dmg1: it.dmg1 || resolvedParent.dmg1,
			dmg2: it.dmg2 || resolvedParent.dmg2,
			dmgType: it.dmgType || resolvedParent.dmgType,
			ac: it.ac != null ? it.ac : resolvedParent.ac,
			weight: it.weight != null ? it.weight : resolvedParent.weight,
			value: it.value != null ? it.value : resolvedParent.value
		}
	}

	const dbItems = await db.any('SELECT * FROM compendium_items')
	console.log(`Found ${dbItems.length} items in DB to examine.`)

	let updatedCount = 0

	for (const dbIt of dbItems) {
		const rawKey = `${dbIt.name}|${dbIt.source}`.toLowerCase()
		let raw = itemMap.get(rawKey) || itemMap.get(dbIt.name.toLowerCase())
		if (raw && raw._copy) {
			raw = resolveItemCopy(raw)
		}

		let currentEntries = dbIt.entries
		if (typeof currentEntries === 'string') {
			try { currentEntries = JSON.parse(currentEntries) } catch (_) { currentEntries = [] }
		}
		if (!Array.isArray(currentEntries)) currentEntries = []

		let newEntries = [...currentEntries]
		let newItemType = dbIt.item_type

		// A. Check if it's a vehicle or ship
		const isVehType = raw?.type && (raw.type.startsWith('SHP') || raw.type.startsWith('AIR') || raw.type.startsWith('VEH') || raw.type.startsWith('SPC'))
		const hasVehStats = raw && (raw.vehAc || raw.vehHp || raw.seeAlsoVehicle)
		const isVehName = ['sailing ship', 'warship', 'longship', 'airship', 'galley', 'keelboat', 'rowboat', 'wagon', 'carriage', 'cart', 'chariot', 'sled'].includes(dbIt.name.toLowerCase())

		if (isVehType || hasVehStats || isVehName) {
			newItemType = 'vehicle'

			// Find matching vehicle stat block in vehicles.json
			let matchedVeh = null
			if (raw?.seeAlsoVehicle && raw.seeAlsoVehicle.length > 0) {
				const seeName = String(raw.seeAlsoVehicle[0]).split('|')[0].toLowerCase()
				matchedVeh = allVehicles.find(v => v.name.toLowerCase() === seeName)
			}
			if (!matchedVeh) {
				matchedVeh = allVehicles.find(v => v.name.toLowerCase() === dbIt.name.toLowerCase())
			}

			if (matchedVeh) {
				const fluff = allFluffVehicles.find(f => f.name.toLowerCase() === matchedVeh.name.toLowerCase())
				newEntries = formatVehicleStatBlock(matchedVeh, fluff?.entries || matchedVeh.entries || [])
			} else if (raw) {
				newEntries = formatStandaloneVehicleEntries(raw)
			}
		}

		// B. Check if it's a mount
		const isMountType = raw?.type && raw.type.startsWith('MNT')
		const isMountName = ['warhorse', 'riding horse', 'draft horse', 'elephant', 'camel', 'mule', 'donkey', 'mastiff', 'pony'].includes(dbIt.name.toLowerCase())

		if (isMountType || isMountName || raw?.carryingCapacity) {
			newItemType = 'mount'
			if (newEntries.length === 0) {
				newEntries = formatMountEntries(raw || { name: dbIt.name, value: dbIt.cost_cp })
			}
		}

		// C. If still empty, check resolved raw entries
		if (newEntries.length === 0 && raw?.entries && raw.entries.length > 0) {
			newEntries = raw.entries
		}

		// D. If still empty, check standard gear / focus / food descriptions
		if (newEntries.length === 0) {
			const lower = dbIt.name.toLowerCase().trim()
			const matchedDesc = GEAR_DESCRIPTIONS[lower]
			if (matchedDesc) {
				newEntries = [matchedDesc]
			} else if (raw?.type === '$A' || raw?.type?.includes('$')) {
				newEntries = [`A finely crafted art object or precious treasure worth ${Number(dbIt.cost_cp) >= 100 ? `${Number(dbIt.cost_cp) / 100} gp` : `${dbIt.cost_cp} cp`}.`]
			} else if (raw?.type === '$G') {
				newEntries = [`A precious gemstone worth ${Number(dbIt.cost_cp) >= 100 ? `${Number(dbIt.cost_cp) / 100} gp` : `${dbIt.cost_cp} cp`}. Can be used in trading or as a spellcasting component.`]
			}
		}

		// E. If still empty, synthesize weapon entries
		if (newEntries.length === 0 && (dbIt.item_type === 'weapon' || dbIt.damage_dice)) {
			newEntries = synthesizeWeaponEntries(dbIt)
		}

		// F. If still empty, synthesize armor entries
		if (newEntries.length === 0 && (dbIt.item_type === 'armor' || Number(dbIt.base_ac) > 0)) {
			newEntries = synthesizeArmorEntries(dbIt)
		}

		// G. If still empty, synthesize tool entries
		if (newEntries.length === 0 && dbIt.item_type === 'tool') {
			const toolDesc = GEAR_DESCRIPTIONS[dbIt.name.toLowerCase().trim()] || `A set of tools required to practice a craft or trade. Proficiency allows you to add your proficiency bonus to ability checks made using these tools.`
			newEntries = [toolDesc]
		}

		// H. Fallback for any remaining empty items
		if (newEntries.length === 0) {
			newEntries = [`A standard piece of equipment or trade commodity described in the D&D rules.`]
		}

		// Only update if entries or item_type changed
		const entriesChanged = JSON.stringify(newEntries) !== JSON.stringify(currentEntries) && newEntries.length > 0
		const typeChanged = newItemType !== dbIt.item_type

		if (entriesChanged || typeChanged) {
			await db.none(
				'UPDATE compendium_items SET entries = $1, item_type = $2 WHERE id = $3',
				[JSON.stringify(newEntries), newItemType, dbIt.id]
			)
			updatedCount++
		}
	}

	console.log(`Updated ${updatedCount} items in compendium_items.`)

		// Insert any vehicles from vehicles.json that are missing in compendium_items
		let insertedVehicles = 0
		for (const v of allVehicles) {
			for (const ed of ['2014', '2024']) {
				const exists = await db.oneOrNone(
					'SELECT id FROM compendium_items WHERE LOWER(name) = LOWER($1) AND edition = $2 LIMIT 1',
					[v.name, ed]
				)
				if (!exists) {
					const fluff = allFluffVehicles.find(f => f.name.toLowerCase() === v.name.toLowerCase())
					const richEntries = formatVehicleStatBlock(v, fluff?.entries || v.entries || [])
					await db.none(
						`INSERT INTO compendium_items (
							name, edition, source, page, item_type, rarity, cost_cp, weight,
							base_ac, properties, entries
						) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
						[
							v.name,
							ed,
							v.source || (ed === '2024' ? 'XDMG' : 'DMG'),
							v.page ? String(v.page) : null,
							'vehicle',
							'none',
							v.cost ? String(v.cost) : '0',
							'0.00',
							v.hull?.ac ? String(v.hull.ac) : '0',
							JSON.stringify([]),
							JSON.stringify(richEntries)
						]
					)
					insertedVehicles++
				}
			}
		}
		if (insertedVehicles > 0) {
			console.log(`Inserted ${insertedVehicles} missing vehicles into compendium_items.`)
		}
	}

// -------------------------------------------------------------
// 4. ENRICH MONSTERS (_copy resolution)
// -------------------------------------------------------------
async function enrichMonsters() {
	console.log('=== ENRICHING COMPENDIUM MONSTERS ===')
	const bestiary2024Files = (await readdir(join(DIR_2024, 'bestiary'))).filter(f => f.startsWith('bestiary-') && f.endsWith('.json'))
	const bestiary2014Files = (await readdir(join(DIR_2014, 'bestiary'))).filter(f => f.startsWith('bestiary-') && f.endsWith('.json'))

	const monsterMap = new Map()

	for (const f of bestiary2024Files) {
		const data = await readJson(join(DIR_2024, 'bestiary', f))
		for (const m of data?.monster || []) {
			monsterMap.set(`${m.name}|${m.source}`.toLowerCase(), m)
			if (!monsterMap.has(m.name.toLowerCase())) monsterMap.set(m.name.toLowerCase(), m)
		}
	}

	for (const f of bestiary2014Files) {
		const data = await readJson(join(DIR_2014, 'bestiary', f))
		for (const m of data?.monster || []) {
			const k = `${m.name}|${m.source}`.toLowerCase()
			if (!monsterMap.has(k)) monsterMap.set(k, m)
			if (!monsterMap.has(m.name.toLowerCase())) monsterMap.set(m.name.toLowerCase(), m)
		}
	}

	function resolveMonsterCopy(m, depth = 0) {
		if (!m._copy || depth > 5) return m
		const parentName = m._copy.name
		const parentSource = m._copy.source
		const parent = monsterMap.get(`${parentName}|${parentSource}`.toLowerCase()) || monsterMap.get(parentName.toLowerCase())
		if (!parent) return m
		const resolvedParent = resolveMonsterCopy(parent, depth + 1)
		return {
			...resolvedParent,
			...m,
			trait: (m.trait && m.trait.length) ? m.trait : (resolvedParent.trait || []),
			action: (m.action && m.action.length) ? m.action : (resolvedParent.action || []),
			bonus: (m.bonus && m.bonus.length) ? m.bonus : (resolvedParent.bonus || []),
			reaction: (m.reaction && m.reaction.length) ? m.reaction : (resolvedParent.reaction || []),
			legendary: (m.legendary && m.legendary.length) ? m.legendary : (resolvedParent.legendary || []),
			spellcasting: (m.spellcasting && m.spellcasting.length) ? m.spellcasting : (resolvedParent.spellcasting || []),
			ac: (m.ac && m.ac.length) ? m.ac : (resolvedParent.ac || []),
			hp: (m.hp && Object.keys(m.hp).length) ? m.hp : (resolvedParent.hp || {}),
			speed: (m.speed && Object.keys(m.speed).length) ? m.speed : (resolvedParent.speed || {}),
			str: m.str != null ? m.str : resolvedParent.str,
			dex: m.dex != null ? m.dex : resolvedParent.dex,
			con: m.con != null ? m.con : resolvedParent.con,
			int: m.int != null ? m.int : resolvedParent.int,
			wis: m.wis != null ? m.wis : resolvedParent.wis,
			cha: m.cha != null ? m.cha : resolvedParent.cha,
			save: m.save || resolvedParent.save,
			skill: m.skill || resolvedParent.skill,
			passive: m.passive != null ? m.passive : resolvedParent.passive,
			senses: (m.senses && m.senses.length) ? m.senses : (resolvedParent.senses || []),
			languages: (m.languages && m.languages.length) ? m.languages : (resolvedParent.languages || []),
			cr: m.cr != null ? m.cr : resolvedParent.cr
		}
	}

	// Query monsters that have empty traits AND actions, or empty AC / HP
	const emptyMonsters = await db.any(
		"SELECT id, name, source, edition, raw_data FROM compendium_monsters WHERE (trait IS NULL OR trait::text = '[]') AND (action IS NULL OR action::text = '[]')"
	)
	console.log(`Found ${emptyMonsters.length} empty monsters in DB.`)

	let fixedCount = 0
	for (const dbM of emptyMonsters) {
		const rawKey = `${dbM.name}|${dbM.source}`.toLowerCase()
		let raw = monsterMap.get(rawKey) || monsterMap.get(dbM.name.toLowerCase()) || dbM.raw_data
		if (!raw || !raw._copy) continue

		const resolved = resolveMonsterCopy(raw)

		let crStr = '0'
		if (typeof resolved.cr === 'string') crStr = resolved.cr
		else if (typeof resolved.cr === 'number') crStr = String(resolved.cr)
		else if (resolved.cr && typeof resolved.cr === 'object' && resolved.cr.cr) crStr = String(resolved.cr.cr)

		await db.none(`
			UPDATE compendium_monsters SET
				cr = $1,
				ac = $2,
				hp = $3,
				speed = $4,
				str = $5,
				dex = $6,
				con = $7,
				int = $8,
				wis = $9,
				cha = $10,
				save = $11,
				skill = $12,
				passive = $13,
				languages = $14,
				senses = $15,
				trait = $16,
				action = $17,
				bonus = $18,
				reaction = $19,
				legendary = $20,
				spellcasting = $21
			WHERE id = $22
		`, [
			crStr,
			JSON.stringify(resolved.ac || []),
			JSON.stringify(resolved.hp || {}),
			JSON.stringify(resolved.speed || {}),
			resolved.str != null ? resolved.str : 10,
			resolved.dex != null ? resolved.dex : 10,
			resolved.con != null ? resolved.con : 10,
			resolved.int != null ? resolved.int : 10,
			resolved.wis != null ? resolved.wis : 10,
			resolved.cha != null ? resolved.cha : 10,
			JSON.stringify(resolved.save || null),
			JSON.stringify(resolved.skill || null),
			resolved.passive != null ? resolved.passive : 10,
			JSON.stringify(resolved.languages || []),
			JSON.stringify(resolved.senses || []),
			JSON.stringify(resolved.trait || []),
			JSON.stringify(resolved.action || []),
			JSON.stringify(resolved.bonus || []),
			JSON.stringify(resolved.reaction || []),
			JSON.stringify(resolved.legendary || []),
			JSON.stringify(resolved.spellcasting || []),
			dbM.id
		])
		fixedCount++
	}

	console.log(`Resolved and updated ${fixedCount} monsters in compendium_monsters.`)
}

export async function enrichCompendium() {
	await enrichItems()
	await enrichMonsters()
}

async function main() {
	try {
		await enrichCompendium()
		console.log('Compendium enrichment completed successfully!')
		process.exit(0)
	} catch (err) {
		console.error('Fatal error during enrichment:', err)
		process.exit(1)
	}
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
	main()
}
