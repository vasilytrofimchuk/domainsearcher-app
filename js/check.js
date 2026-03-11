/**
 * Domain availability checking via RDAP (rdap.org) + DNS-over-HTTPS fallback
 * rdap.org is CORS-enabled — browser can call directly, no proxy needed.
 * Cloudflare DoH (1.1.1.1/dns-query) is also CORS-enabled.
 * Returns: true = available, false = taken, null = unknown (error / unexpected status)
 *
 * Two-stage for short labels (≤2 chars):
 *   1. RDAP: 200 = taken (done). 404 = maybe available (proceed to stage 2).
 *   2. DoH NS lookup: NXDOMAIN = available, has NS = taken, else unknown.
 *   Reason: some registries return RDAP 404 for reserved/premium short domains
 *   (e.g. dm.io is registered but .io RDAP says 404). Every registered domain
 *   must have NS records, so DoH is a reliable secondary signal.
 */

async function checkViaDoh(domain, signal) {
  try {
    const url = 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=NS'
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: signal ?? AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // Status 3 = NXDOMAIN → not in DNS → available
    if (data.Status === 3) return true
    if (data.Status === 0) {
      const answers = data.Answer || []
      // Has NS records in Answer → domain is delegated → taken
      if (answers.some(r => r.type === 2)) return false
      // No Answer at all (SOA in Authority, empty Answer) → domain not delegated → available
      if (answers.length === 0) return true
    }
    return null
  } catch {
    return null
  }
}

export async function checkDomainAvailable(domain, signal) {
  const label = domain.split('.')[0]
  const isShort = label.length <= 2

  try {
    const res = await fetch('https://rdap.org/domain/' + domain, {
      method: 'GET',
      redirect: 'follow',
      signal: signal ?? AbortSignal.timeout(10000),
    })
    if (res.status === 200) return false   // registered = taken (trust this always)
    if (res.status === 404) {
      if (isShort) {
        // RDAP 404 is unreliable for short labels — confirm via DNS
        return await checkViaDoh(domain, signal)
      }
      return true    // not registered = available
    }
    return null      // 400/422/503/etc — can't tell
  } catch {
    return null  // CORS block, timeout, network error — don't assume taken
  }
}

export async function checkMultipleZones(name, zones, signal) {
  const results = {}
  for (const zone of zones) {
    if (signal?.aborted) break
    results[zone] = await checkDomainAvailable(name + '.' + zone, signal)
    // polite delay between checks
    if (zones.indexOf(zone) < zones.length - 1) {
      await new Promise(r => setTimeout(r, 100))
    }
  }
  return results
}
