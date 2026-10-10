# Brief: The cache stampede

## The idea
Why a single expiring cache key can take a database down, and the three standard fixes. Reference episode for the studio: it uses every scene type and most choreographies.

## Audience and promise
Backend engineers and interview candidates who know what a cache is. After 3–4 minutes they can explain cache-aside, why hot keys cause stampedes (thundering herds), and how request coalescing, serve-stale and TTL jitter prevent them.

## Key facts (verified)
- Cache-aside: the application checks the cache, reads the database on a miss, then writes the value back with a TTL. (Standard pattern; see AWS caching best practices.)
- When a popular key expires, concurrent misses all query the database for the same data: a thundering herd / cache stampede.
- Facebook's memcache system uses leases so that only the first client that misses asks the database; the others wait briefly and retry the cache. — Nishtala et al., "Scaling Memcache at Facebook", NSDI 2013; MIT 6.824 FAQ.
- Go's `golang.org/x/sync/singleflight` "provides a duplicate function call suppression mechanism"; `Group.Do` ensures only one execution is in flight per key and duplicate callers receive the same result. — pkg.go.dev.
- HTTP standardises serve-stale as `stale-while-revalidate` (RFC 5861).
- Randomising TTLs (jitter) spreads expirations so keys don't expire in lockstep. Probabilistic early expiration is the formal version (Vattani et al., VLDB 2015).
- Numbers in the hook (50,000 reads/s, 5,000 queries/s capacity, 95% hit rate) are illustrative, and the narration frames them as "your" system, not a real incident.

## Sources
- [Scaling Memcache at Facebook (NSDI 2013)](https://www.usenix.org/conference/nsdi13/technical-sessions/presentation/nishtala)
- [MIT 6.824 FAQ on the memcache paper](https://pdos.csail.mit.edu/6.824/papers/memcache-faq.txt)
- [singleflight package](https://pkg.go.dev/golang.org/x/sync/singleflight)
- [RFC 5861: HTTP Cache-Control Extensions for Stale Content](https://www.rfc-editor.org/rfc/rfc5861)
- [Optimal Probabilistic Cache Stampede Prevention (VLDB 2015)](https://www.vldb.org/pvldb/vol8/p886-vattani.pdf)
