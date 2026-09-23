
## 🚀 Quick start

1. Clone this repository or download the ZIP file
2. Make sure that you have **Node.js** and NPM, PNPM or Yarn installed
3. Install the project dependencies from the `package.json` file:

```sh
pnpm install
# or
npm install
# or
yarn
```

_PNPM is the package manager of choice for illustration, but you can use what you want._

1. Launch the Next.js local development server on `localhost:3000` by running the following command:

```sh
pnpm run dev
```

You can also build the project and get the distribution files inside the `.next/` folder by running:

```sh
pnpm run build
```

### HTTPS Authentication

Set `NEXTAUTH_URL` to the public Studio HTTPS origin and `NEXTAUTH_PROTOCOL` to
`https`. Set `NEXT_PUBLIC_BASE_URL` to the public HTTPS platform API origin, not
the Studio origin. The platform's stored `apiEndpoint` must use that API origin too.

`NEXT_PUBLIC_*` values and request interceptors are compiled into the browser
bundle. Rebuild and redeploy Studio after changing them, then reload existing
browser tabs. Valid user sessions issued by `adminClient` must not be forcibly
signed out based only on their client ID; platform API roles enforce access.

### Schema versions

Create Schema displays **Version*** for both Indy and W3C organizations.
Indy versions are required, editable numeric versions (for example, `0.1`).
W3C schemas (key, web, and polygon DIDs) display the backend-assigned
`draft/2020-12` value read-only; it is not a user-defined credential revision.
Switching organizations resets the form and reloads the schema type.
Run the focused regression tests with
`node --test src/features/schemas/components/__tests__/SchemaVersion.test.cjs`.

### Bulk verification

Choose Verify Credential → Bulk, select the schema and attributes, then upload
a CSV with a `connectionId` column. The preview matches IDs to the organization's
connections; unmatched IDs are reported and skipped. Proof requests use the
existing single/multiple-connection APIs. Wallet completion requires real active
connections and has not been covered by these unit tests.
Run helper tests with
`node --test src/features/verification/components/__tests__/BulkVerificationHelpers.test.cjs`.

## Contributing

Pull requests are welcome! Please read our [contributions guide](https://github.com/credebl/platform/blob/main/CONTRIBUTING.md) and submit your PRs. We enforce [developer certificate of origin](https://developercertificate.org/) (DCO) commit signing — [guidance](https://github.com/apps/dco) on this is available. We also welcome issues submitted about problems you encounter in using CREDEBL.

## License

[Apache License Version 2.0](https://github.com/credebl/platform/blob/main/LICENSE)
