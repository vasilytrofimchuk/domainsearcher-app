/**
 * Domain availability checking via RDAP (rdap.org)
 * rdap.org is CORS-enabled — browser can call directly, no proxy needed.
 * GET not HEAD (some servers return 405 on HEAD)
 * 404 = available, 200 = taken
 */

export async function checkDomainAvailable(domain, signal) {
  try {
    const res = await fetch('https://rdap.org/domain/' + domain, {
      method: 'GET',
      redirect: 'follow',
      signal: signal ?? AbortSignal.timeout(10000),
    })
    return res.status === 404
  } catch {
    return false // conservative: unknown = unavailable
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
