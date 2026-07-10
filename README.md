# amyc.us

Static project and fiction index for amyc.us.

## Maintainer check

Run `node scripts/check-projects-static.mjs` before deployment.

The SFSC card delegates docket queries to the canonical `https://sfsc.amyc.us/#/cases?q=...` route. Do not fetch `archive/cases-index.ndjson` or `archive/cases/*.json` from SFSC Pages. The slim Pages build intentionally omits those compatibility artifacts; the SFSC viewer owns the sharded case-directory search contract. The scheduled builder reads fallback counts from a separate sparse checkout of `aimesy/sfsc-data`.
