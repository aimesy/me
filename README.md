# amyc.us

Static project, data, fiction, and contact index for amyc.us.

The Data page embeds the live SFSC and KCSC workspaces inline inside independently collapsible, state-persisted sections. The windows follow the same full-width pattern as the Stats page. Keep the embedded displays primary; full-screen links are secondary escape hatches, not a replacement for the data interfaces.

The Stats page likewise provides independently collapsible live SFSC and KCSC statistics workspaces. SFSC opens to attorney and judgment rankings; KCSC opens to its archive dashboard, aggregates, attorney rankings, and judgment rankings.

## Maintainer check

Run `node scripts/check-data-index-static.mjs`, `node scripts/check-projects-static.mjs`, and `node scripts/check-shared-theme.mjs` before deployment.

The pages load the shared `aimesy/themes` assets live from `https://aimesy.github.io/themes/src/`, so a theme merge reaches every page without a change here. `scripts/check-shared-theme.mjs` requires each page to reference each hosted asset exactly once and to allow that origin in its CSP, and it checks the hosted palette's page-text and header contrast. The hourly project-data workflow refreshes `assets/project-data.json`, fails closed if generation inputs move, rebases before pushing, then explicitly dispatches the sole deployer, `pages.yml`. The deployer repeats the integration and shared-theme checks before upload. Do not vendor the shared assets here or return to commit-pinned jsDelivr URLs.

The SFSC card delegates docket queries to `https://sfsc.amyc.us/#/cases?q=...` and tentative-ruling queries to `https://sfsc.amyc.us/#q=...`. Do not fetch `archive/cases-index.ndjson`, `archive/cases/*.json`, or the department Parquet files from this page. The SFSC viewer owns those search contracts. The scheduled builder reads fallback counts from a separate sparse checkout of `aimesy/sfsc-data`.
