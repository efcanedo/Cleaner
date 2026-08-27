# Building Document Cleaner

## Requirements

- Apple-silicon Mac (`arm64`) running macOS 12 or newer
- Xcode or Xcode Command Line Tools with Swift 6-compatible `swiftc`
- Apple-silicon Node.js 22.13 or newer and npm
- Standard macOS tools: `codesign`, `ditto`, `iconutil`, `lipo`, `plutil`, `rsync`, `shasum`, and `sips`
- Internet access when npm restores dependencies

End users do not need Node.js, npm, Tesseract, or another OCR package. The `.app` embeds Node and a native Swift toolkit using PDFKit and Vision.

## Build and verify

```bash
./scripts/build-app.sh
```

The build script:

1. validates macOS, arm64, the toolchain, versions, and the embedded Node architecture;
2. restores exact dependencies with `npm ci`;
3. runs lint, unit tests, and the production Vite build;
4. compiles the launcher, document toolkit, and icon generator for arm64;
5. installs production-only Node dependencies into the app bundle;
6. creates the icon, property list, static interface, runtime, and native binaries;
7. applies an ad-hoc signature;
8. creates `outputs/Document Cleaner 1.1.app.zip`;
9. extracts and verifies the distributable's signature, plist, JavaScript syntax, and executable architectures; and
10. prints the SHA-256 checksum.

The script will not replace an existing archive unless explicitly authorized:

```bash
DOCUMENT_CLEANER_OVERWRITE=1 ./scripts/build-app.sh
```

To reuse installed dependencies:

```bash
DOCUMENT_CLEANER_SKIP_INSTALL=1 ./scripts/build-app.sh
```

To select a particular arm64 Node executable or output directory:

```bash
DOCUMENT_CLEANER_NODE_BINARY=/absolute/path/to/node \
DOCUMENT_CLEANER_OUTPUT_DIR=/absolute/output/directory \
./scripts/build-app.sh
```

## Development

Run the helper and Vite server in separate terminals:

```bash
npm run helper
npm run dev
```

The Vite interface is available at `http://localhost:3032`; `/api` requests proxy to the loopback helper at port 41842. Production uses the helper's built-in static server at `http://127.0.0.1:41842`.

## Tests

```bash
npm run lint
npm test
npm run build
```

The complete build script is the final distributable verification. Live OpenAI processing is intentionally not part of automated tests because it requires the user's Keychain credential, incurs API charges, and depends on external service state. Use the in-app **Test saved key** action, followed by representative fixtures for each cleaning path, for a live acceptance run.

## Signing

The current local distribution workflow uses an ad-hoc signature, like Document Harvester. macOS may require the user to approve first launch. Public distribution without that step would require an Apple Developer ID certificate and notarization.
