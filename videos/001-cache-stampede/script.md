# Script: The cache stampede: how one expiring key takes down a database

Mirrors spec.json. `{words|cue}` marks sync points, `[pause]` marks deliberate pauses.

## hook — cold-open · statement
SAY (brisk, urgent): Nine p.m. [pause 0.2] One cache key expires. [pause 0.4]
SAY (rush, urgent): Thirty seconds later, your database is {down|c-down}. [pause 0.5]
SAY (normal, excited): Nothing was deployed. Nothing was misconfigured. [pause 0.3] So what happened?
SHOW: "One key expires." / "The {database|red} dies."

## stakes — big-number · stat
SAY (brisk): Your cache is absorbing {fifty thousand reads|c-reads} a second. [pause 0.3] The database behind it can take about {five thousand|c-cap}.
SHOW: 50,000 reads/s — absorbed by {the cache|blue}; bars: Database capacity, Peak traffic

## myth — myth · statement
SAY: We treat the cache like a {safety net|c-net}. [pause 0.4] It {isn't|c-not} one.
SAY: It's a {speed layer|c-speed}, and it can fail for everyone at once.
SHOW: "A cache keeps you ~~safe~~." / "It keeps you {fast|green}."

## ch-aside — chapter · chapter  (chapter: What is cache-aside?)
SAY (normal, warm): First: what is cache-aside? [pause 0.2] It's how most systems use a cache today.
SHOW: chapter 1: What is cache-aside? — Check the cache, then the database · route: Cache-aside / The stampede / Three fixes

## build — build · diagram
SAY: A request {arrives|c-users} at your {app server|c-api}.
SAY: Before touching the database, the app asks the {cache|c-cache}: do you already have this?
SAY: The {database|c-db} is only the fallback. [pause 0.3]
SHOW: diagram "cache": show users; show api; show cache; show db

## hit — flow · diagram
SAY: Most of the time, the cache {has it|c-hit}. That's a hit. It comes back in about a millisecond, and the database {never hears about it|c-never}.
SHOW: diagram "cache": flow users→api→cache; badge cache "HIT"; dim db,api-db

## miss — flow · diagram
SAY: When the cache {doesn't have it|c-miss}, that's a miss.
SAY: The app reads the {database|c-db}, [pause 0.2] then {writes the answer back|c-fill} into the cache, with an expiry time called a {TTL|c-ttl}.
SHOW: diagram "cache": flow users→api→cache; badge cache "MISS"; flow api→db; flow api→cache; badge cache "TTL 60s"

## hit-rate — big-number · stat
SAY: If ninety-five percent of reads are hits, [pause 0.2] the database only sees {one request in twenty|c-one}. [pause 0.4] That's the whole trick.
SHOW: 95% — hit rate; bars: Reads per second, Reach the database

## ch-stampede — chapter · chapter  (chapter: Why does it collapse?)
SAY (normal, serious): So why does it collapse? [pause 0.3] This is the part nobody plans for.
SHOW: chapter 2: Why does it collapse? — When one key expires for everyone · route map

## stampede — failure · diagram
SAY: Picture one {hot key|c-hot}: the home feed, read thousands of times a second.
SAY (slow): At nine p.m., its TTL {runs out|c-expire}. [pause 0.4]
SAY (brisk): Every request in the next few milliseconds {misses|c-miss}, and every one of them goes {straight to the database|c-flood}.
SAY (slow): Same row. Same query. A thousand times over. [pause 0.3] The database {falls over|c-dead}.
SHOW: diagram "cache": clear-lines; badge cache "feed:home"; flow users→api→cache; badge cache "EXPIRED"; pulse cache; flow api→db; badge db "×1000"; fail db; badge db "TIMEOUT"

## slow-motion — deep-dive · sequence
SAY: Slow it down. {Request A|c-a} misses, and asks the database.
SAY: While A waits, {everyone else|c-b} misses too.
SAY: And they all {ask the database|c-db} for the very same row. [pause 0.3] Nobody knows someone is already fetching it.
SHOW: sequence: a→cache GET feed:home; cache→a miss; a→db SELECT feed; rest→cache GET feed:home; cache→rest miss; rest→db SELECT feed

## insight — insight · statement
SAY (slow): Nothing in the cache was broken. [pause 0.5] It simply expired, {for everyone, at the same moment|c-all}.
SHOW: "The cache didn't break." / "It expired for {everyone|red}."

## ch-fixes — chapter · chapter  (chapter: How do we stop it?)
SAY (brisk, excited): So how do we stop it? [pause 0.2] Three fixes, and they work best together.
SHOW: chapter 3: How do we stop it? — Coalesce, serve stale, add jitter · route map

## coalesce — solution · code
SAY (brisk): Fix one: {coalesce|c-co} the misses.
SAY: The first request that misses does the {database read|c-load}. Everyone else {waits for that one result|c-wait}. [pause 0.3]
SAY (neutral): In Go, that's the {singleflight|c-sf} package. Facebook's memcache paper describes the same idea, using {leases|c-lease}.
SHOW: heading "Fix 1: {coalesce|green} the misses" over code feed.go: 8 lines, highlights on cues

## coalesced — solution · diagram
SAY: Now the stampede becomes {one query|c-one}. [pause 0.3] The database {recovers|c-rec}, and the cache is {refilled|c-fill}, once.
SHOW: heading "One miss, {one query|green}" · diagram "cache": clear-lines; flow users→api; badge api "1 IN FLIGHT"; flow api→db; recover db; flow api→cache; badge cache "HIT"

## stale-jitter — solution · compare
SAY: Fix two: {serve stale|c-stale}. When a hot key expires, keep answering with the old value for a few seconds, while {one request|c-one} refreshes it.
SAY: Users get data that's a little old, [pause 0.2] {instead of an error|c-err}.
SAY: Fix three: {add jitter|c-jit}. Instead of every key living exactly sixty seconds, give each one sixty, {plus or minus a little|c-pm}.
SAY: Keys stop expiring in lockstep. [pause 0.2] It won't save a single hot key, but it {stops thousands of keys|c-many} expiring together.
SHOW: compare: Fix 2: serve stale vs Fix 3: add jitter

## recap — recap · list
SAY: Cache-aside: check the cache, fall back to the database.
SAY: A hot key can expire for everyone at once.
SAY: So coalesce the misses, serve stale, and add jitter.
SHOW: list "The short version": Check the cache, then the database / Hot keys expire {all at once|red} / Coalesce, serve stale, add jitter

## outro — outro · outro
SAY: So: one hot key, one database query, and no stampede. [pause 0.3]
SAY: If this helped, follow for more system design, explained in a few minutes.
SHOW: "One key. {One query.} No stampede." + @sainp7
