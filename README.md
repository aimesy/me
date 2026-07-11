# amyc.us

Static project and fiction index for amyc.us.

## Maintainer check

Run `node scripts/check-projects-static.mjs` before deployment.

The hourly project-data workflow also advances the immutable `aimesy/themes` commit pin used by both pages. It verifies the pinned palette contrast, fails closed if generation inputs move, rebases before pushing, then explicitly dispatches the sole deployer, `pages.yml`. The deployer repeats the integration and pinned-theme checks before upload. Keep the shared assets on one full commit SHA; do not vendor them here or restore mutable branch URLs.

The SFSC card delegates docket queries to `https://sfsc.amyc.us/#/cases?q=...` and tentative-ruling queries to `https://sfsc.amyc.us/#q=...`. Do not fetch `archive/cases-index.ndjson`, `archive/cases/*.json`, or the department Parquet files from this page. The SFSC viewer owns those search contracts. The scheduled builder reads fallback counts from a separate sparse checkout of `aimesy/sfsc-data`.
