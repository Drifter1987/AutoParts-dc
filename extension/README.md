# AutoParts VIN Safety — browser extension

A source-only Manifest V3 extension. It is intentionally **not** part of the Vite web build and is
not published to a browser store.

## Load locally

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Choose **Load unpacked** and select this `extension/` folder.
4. Open a supported listing page with a VIN and look for the AutoParts panel in the bottom-right.

Supported host matches are Marketplace, CarGurus, Autotrader, Cars.com, Bring a Trailer, and
Copart. The content script scans visible page text and common VIN attributes, prefers a VIN whose
check digit validates, and then fetches:

- `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{VIN}` for identity/specs.
- `https://api.nhtsa.gov/recalls/recallsByVehicle?...` for model-year campaigns.

It opens the full report at
`https://len-golani.github.io/AutoParts-fb/vin?vin={VIN}&report=1`.

## Privacy and limits

The extension reads the current listing page to find a VIN. It sends only the VIN to NHTSA; it does
not read cookies, send analytics, or store browsing history. Listings can be heavily dynamic and
sites can change their DOM; VIN extraction is best-effort and is never a substitute for confirming
the VIN on the vehicle or listing. Model-year campaign counts are not a VIN-specific open-recall
determination.

## Before store release

- Choose and add production icons; review host permissions and listing-site terms.
- Add a packaged build and test each supported site against its current DOM.
- Update `APP_BASE` if the report moves to a custom domain.
- Add store privacy disclosures and a support/contact path.
