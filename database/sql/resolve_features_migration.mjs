import { db } from '../index.mjs'

async function run() {
  console.log('--- Resolving refClassFeature and refSubclassFeature in Compendium ---')

  // 1. Resolve Class Features
  const cfRows = await db.any('SELECT id, name, edition, source, level, entries FROM compendium_class_features')
  console.log(`Loaded ${cfRows.length} class features`)

  const cfMap = new Map()
  for (const r of cfRows) {
    const k = (r.name || '').trim().toLowerCase() + '|' + (r.edition || '')
    cfMap.set(k, r)
  }

  function resolveClassEntries(entries, edition, depth = 0) {
    if (depth > 6 || !entries) return entries
    let parsed = entries
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { return entries }
    }

    const resolveItem = (item) => {
      if (typeof item === 'object' && item !== null) {
        if (item.type === 'refClassFeature') {
          const parts = (item.classFeature || '').split('|')
          const fName = parts[0].trim()
          const target = cfMap.get(fName.toLowerCase() + '|' + edition) ||
                         cfMap.get(fName.toLowerCase() + '|2024') ||
                         cfMap.get(fName.toLowerCase() + '|2014')
          if (target) {
            const subEntries = typeof target.entries === 'string' ? JSON.parse(target.entries) : target.entries
            return {
              type: 'entries',
              name: target.name,
              entries: resolveClassEntries(subEntries, edition, depth + 1)
            }
          }
        }
        if (item.entries) {
          return { ...item, entries: resolveClassEntries(item.entries, edition, depth) }
        }
        if (item.items) {
          return { ...item, items: resolveClassEntries(item.items, edition, depth) }
        }
      }
      return item
    }

    if (Array.isArray(parsed)) {
      return parsed.map(resolveItem)
    }
    return resolveItem(parsed)
  }

  let cfUpdated = 0
  for (const r of cfRows) {
    const rawStr = typeof r.entries === 'string' ? r.entries : JSON.stringify(r.entries)
    if (rawStr.includes('refClassFeature')) {
      const resolved = resolveClassEntries(r.entries, r.edition)
      await db.none('UPDATE compendium_class_features SET entries = $1:json WHERE id = $2', [
        JSON.stringify(resolved),
        r.id
      ])
      cfUpdated++
    }
  }
  console.log(`Updated ${cfUpdated} class features with resolved sub-features`)

  // 2. Resolve Subclass Features
  const scfRows = await db.any('SELECT id, name, edition, source, level, entries FROM compendium_sub_class_features')
  console.log(`Loaded ${scfRows.length} subclass features`)

  const scfMap = new Map()
  for (const r of scfRows) {
    const k = (r.name || '').trim().toLowerCase() + '|' + (r.edition || '')
    scfMap.set(k, r)
  }

  function resolveSubClassEntries(entries, edition, depth = 0) {
    if (depth > 6 || !entries) return entries
    let parsed = entries
    if (typeof parsed === 'string') {
      try { parsed = JSON.parse(parsed) } catch { return entries }
    }

    const resolveItem = (item) => {
      if (typeof item === 'object' && item !== null) {
        if (item.type === 'refSubclassFeature') {
          const parts = (item.subclassFeature || '').split('|')
          const fName = parts[0].trim()
          const target = scfMap.get(fName.toLowerCase() + '|' + edition) ||
                         scfMap.get(fName.toLowerCase() + '|2024') ||
                         scfMap.get(fName.toLowerCase() + '|2014')
          if (target) {
            const subEntries = typeof target.entries === 'string' ? JSON.parse(target.entries) : target.entries
            return {
              type: 'entries',
              name: target.name,
              entries: resolveSubClassEntries(subEntries, edition, depth + 1)
            }
          }
        }
        if (item.entries) {
          return { ...item, entries: resolveSubClassEntries(item.entries, edition, depth) }
        }
        if (item.items) {
          return { ...item, items: resolveSubClassEntries(item.items, edition, depth) }
        }
      }
      return item
    }

    if (Array.isArray(parsed)) {
      return parsed.map(resolveItem)
    }
    return resolveItem(parsed)
  }

  let scfUpdated = 0
  for (const r of scfRows) {
    const rawStr = typeof r.entries === 'string' ? r.entries : JSON.stringify(r.entries)
    if (rawStr.includes('refSubclassFeature')) {
      const resolved = resolveSubClassEntries(r.entries, r.edition)
      await db.none('UPDATE compendium_sub_class_features SET entries = $1:json WHERE id = $2', [
        JSON.stringify(resolved),
        r.id
      ])
      scfUpdated++
    }
  }
  console.log(`Updated ${scfUpdated} subclass features with resolved sub-features`)

  console.log('Migration completed successfully!')
  process.exit(0)
}

run().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
