/**
 * Domain availability checking via RDAP (rdap.org)
 * rdap.org is CORS-enabled — browser can call directly, no proxy needed.
 * GET not HEAD (some servers return 405 on HEAD)
 * Returns: true = available, false = taken, null = unknown (error / unexpected status)
 */

export async function checkDomainAvailable(domain, signal) {
  try {
    const res = await fetch('https://rdap.org/domain/' + domain, {
      method: 'GET',
      redirect: 'follow',
      signal: signal ?? AbortSignal.timeout(10000),
    })
    if (res.status === 404) return true    // not registered = available
    if (res.status === 200) return false   // registered = taken
    return null                            // 400/422/503/etc — can't tell
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
