/**
 * Domain availability: RDAP (rdap.org) + DNS-over-HTTPS double-check
 *
 * Logic:
 *   RDAP 200 → taken (always reliable)
 *   RDAP 404 → not conclusive — confirm via DoH A-record lookup:
 *     DoH NXDOMAIN (Status=3) → available
 *     DoH has A/CNAME/NS in Answer OR NS/SOA in Authority → taken
 *     DoH inconclusive → null (unknown)
 *   RDAP error/timeout → DoH only
 *
 * Why double-check: .io, .ai, .co and others have unreliable RDAP registries
 * that return 404 for registered domains (e.g. locator.io, dm.io).
 * Every live domain has DNS delegation, so DoH catches these false negatives.
 */

async function checkViaDoh(domain, signal) {
  try {
    // Query A record — gives NXDOMAIN for unregistered, resolves for live domains
    const url = 'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(domain) + '&type=A'
    const res = await fetch(url, {
      headers: { Accept: 'application/dns-json' },
      signal: signal ?? AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const data = await res.json()
    // NXDOMAIN = definitively not in DNS = available
    if (data.Status === 3) return true
    if (data.Status === 0) {
      const answer = data.Answer || []
      const authority = data.Authority || []
      // Any A, AAAA, CNAME in Answer → domain resolves → taken
      if (answer.some(r => r.type === 1 || r.type === 28 || r.type === 5)) return false
      // NS in Answer → delegated → taken
      if (answer.some(r => r.type === 2)) return false
      // NS or SOA in Authority → domain exists in DNS tree → taken
      if (authority.some(r => r.type === 2 || r.type === 6)) return false
      // Empty answer + empty authority = truly not delegated = available
      if (answer.length === 0 && authority.length === 0) return true
    }
    return null
  } catch {
    return null
  }
}

export async function checkDomainAvailable(domain, signal) {
  try {
    const rdapSignal = signal ?? AbortSignal.timeout(10000)
    const res = await fetch('https://rdap.org/domain/' + domain, {
      method: 'GET',
      redirect: 'follow',
      signal: rdapSignal,
    })
    // RDAP 200 = definitively registered → taken
    if (res.status === 200) return false
    // RDAP 404 = registry says not found, but many registries are unreliable
    // Always confirm with DoH to catch false negatives
    if (res.status === 404) return await checkViaDoh(domain, signal)
    // Other status (400/422/503/redirect loops) → fall back to DoH
    return await checkViaDoh(domain, signal)
  } catch {
    // RDAP timed out or blocked → try DoH alone
    return await checkViaDoh(domain, signal)
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
