// localStorage-backed domain database
// Keys: ds_domains (JSON array), ds_sets (JSON array), ds_s_<key> (settings)

class DomainDB {
  _load() {
    try { return JSON.parse(localStorage.getItem('ds_domains') || '[]') } catch { return [] }
  }
  _save(domains) {
    localStorage.setItem('ds_domains', JSON.stringify(domains))
  }
  _loadSets() {
    try { return JSON.parse(localStorage.getItem('ds_sets') || '[]') } catch { return [] }
  }
  _saveSets(sets) {
    localStorage.setItem('ds_sets', JSON.stringify(sets))
  }

  findMany() {
    const domains = this._load()
    return [...domains].sort((a, b) => new Date(b.checkedAt) - new Date(a.checkedAt))
  }

  findUnique(domain) {
    return this._load().find(d => d.domain === domain) || null
  }

  upsert(domain, createData, updateData) {
    const domains = this._load()
    const idx = domains.findIndex(d => d.domain === domain)
    if (idx >= 0) {
      domains[idx] = { ...domains[idx], ...updateData, checkedAt: new Date().toISOString() }
      this._save(domains)
      return domains[idx]
    } else {
      const record = {
        id: crypto.randomUUID(),
        domain,
        available: false,
        favorite: false,
        superFavorite: false,
        description: null,
        fitScore: null,
        zones: null,
        association: null,
        checkedAt: new Date().toISOString(),
        ...createData,
      }
      domains.unshift(record)
      this._save(domains)
      return record
    }
  }

  update(id, data) {
    const domains = this._load()
    const idx = domains.findIndex(d => d.id === id)
    if (idx < 0) return null
    domains[idx] = { ...domains[idx], ...data }
    this._save(domains)
    return domains[idx]
  }

  delete(id) {
    const domains = this._load().filter(d => d.id !== id)
    this._save(domains)
  }

  deleteMany() {
    this._save([])
  }

  toggleFavorite(id) {
    const domains = this._load()
    const idx = domains.findIndex(d => d.id === id)
    if (idx < 0) return null
    const wasFav = domains[idx].favorite
    domains[idx] = {
      ...domains[idx],
      favorite: !wasFav,
      // unfavoriting also clears superFavorite
      superFavorite: wasFav ? false : domains[idx].superFavorite,
    }
    this._save(domains)
    return domains[idx]
  }

  toggleSuper(id) {
    const domains = this._load()
    const idx = domains.findIndex(d => d.id === id)
    if (idx < 0) return null
    const wasSuper = domains[idx].superFavorite
    domains[idx] = {
      ...domains[idx],
      superFavorite: !wasSuper,
      favorite: true, // super always implies favorite
    }
    this._save(domains)
    return domains[idx]
  }

  clearFavorites() {
    const domains = this._load().map(d => ({ ...d, favorite: false, superFavorite: false }))
    this._save(domains)
  }

  createSet(name, fitContext) {
    const favorites = this._load().filter(d => d.favorite)
    if (!favorites.length) return null
    const sets = this._loadSets()
    const set = {
      id: crypto.randomUUID(),
      name,
      fitContext: fitContext || null,
      domains: JSON.stringify(favorites),
      count: favorites.length,
      createdAt: new Date().toISOString(),
    }
    sets.unshift(set)
    this._saveSets(sets)
    return set
  }

  listSets() {
    return this._loadSets().map(s => ({
      ...s,
      count: s.count || (JSON.parse(s.domains || '[]').length),
    }))
  }

  deleteSet(id) {
    this._saveSets(this._loadSets().filter(s => s.id !== id))
  }

  restoreSet(id) {
    const sets = this._loadSets()
    const set = sets.find(s => s.id === id)
    if (!set) return null
    const savedDomains = JSON.parse(set.domains || '[]')

    // Clear current favorites
    const domains = this._load().map(d => ({ ...d, favorite: false, superFavorite: false }))

    // Upsert each saved domain back as favorite
    for (const saved of savedDomains) {
      const idx = domains.findIndex(d => d.domain === saved.domain)
      if (idx >= 0) {
        domains[idx] = { ...domains[idx], favorite: true, superFavorite: saved.superFavorite || false }
      } else {
        domains.unshift({
          ...saved,
          id: crypto.randomUUID(),
          checkedAt: new Date().toISOString(),
        })
      }
    }
    this._save(domains)
    return { fitContext: set.fitContext, restored: savedDomains.length }
  }

  exportJSON() {
    const data = {
      domains: this._load(),
      sets: this._loadSets(),
      exportedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'domainsearcher-backup-' + new Date().toISOString().slice(0, 10) + '.json'
    a.click()
    URL.revokeObjectURL(url)
  }
}

export const db = new DomainDB()

export function saveSetting(key, value) {
  localStorage.setItem('ds_s_' + key, JSON.stringify(value))
}

export function loadSetting(key) {
  try {
    const raw = localStorage.getItem('ds_s_' + key)
    return raw == null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}
