#!/bin/bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INFO_PLIST="$PROJECT_ROOT/native/Info.plist"
OUTPUT_DIR="${DOCUMENT_CLEANER_OUTPUT_DIR:-$PROJECT_ROOT/outputs}"
NODE_BINARY="${DOCUMENT_CLEANER_NODE_BINARY:-$(command -v node || true)}"
SKIP_INSTALL="${DOCUMENT_CLEANER_SKIP_INSTALL:-0}"
ALLOW_OVERWRITE="${DOCUMENT_CLEANER_OVERWRITE:-0}"
BUILD_ROOT=""

fail() { echo "Build failed: $*" >&2; exit 1; }
cleanup() {
  if [[ -n "$BUILD_ROOT" && "$BUILD_ROOT" == "${TMPDIR:-/tmp}/document-cleaner-build."* ]]; then /bin/rm -rf "$BUILD_ROOT"; fi
}
trap cleanup EXIT INT TERM

[[ "$(uname -s)" == "Darwin" ]] || fail "Document Cleaner must be built on macOS."
[[ "$(uname -m)" == "arm64" ]] || fail "This build targets Apple-silicon Macs."
[[ -f "$INFO_PLIST" ]] || fail "native/Info.plist is missing."
[[ -n "$NODE_BINARY" && -x "$NODE_BINARY" ]] || fail "Node.js was not found."
for command_name in npm swiftc codesign ditto lipo plutil rsync shasum sips iconutil; do command -v "$command_name" >/dev/null || fail "$command_name is required."; done

NODE_MAJOR="$($NODE_BINARY -p 'Number(process.versions.node.split(".")[0])')"
[[ "$NODE_MAJOR" -ge 22 ]] || fail "Node.js 22.13 or newer is required."
lipo -archs "$NODE_BINARY" | tr ' ' '\n' | grep -qx arm64 || fail "The embedded Node.js executable must support arm64."

VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$INFO_PLIST")"
PACKAGE_VERSION="$($NODE_BINARY -p "JSON.parse(require('fs').readFileSync('$PROJECT_ROOT/package.json','utf8')).version")"
[[ "${PACKAGE_VERSION%.*}" == "$VERSION" ]] || fail "package.json $PACKAGE_VERSION does not match app version $VERSION."
ARCHIVE="$OUTPUT_DIR/Document Cleaner $VERSION.app.zip"
[[ ! -e "$ARCHIVE" || "$ALLOW_OVERWRITE" == "1" ]] || fail "$ARCHIVE already exists. Set DOCUMENT_CLEANER_OVERWRITE=1 to replace it."

BUILD_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/document-cleaner-build.XXXXXX")"
APP_BUNDLE="$BUILD_ROOT/Document Cleaner.app"
CONTENTS="$APP_BUNDLE/Contents"
APP_RESOURCES="$CONTENTS/Resources/app"
CLANG_CACHE="$BUILD_ROOT/clang-cache"
SWIFT_CACHE="$BUILD_ROOT/swift-cache"
RUNTIME_STAGE="$BUILD_ROOT/runtime-stage"

cd "$PROJECT_ROOT"
if [[ "$SKIP_INSTALL" != "1" ]]; then npm ci; fi
npm run lint
npm test
npm run build

mkdir -p "$CONTENTS/MacOS" "$APP_RESOURCES" "$CONTENTS/Resources/runtime" "$CONTENTS/Resources/bin" "$RUNTIME_STAGE"
env CLANG_MODULE_CACHE_PATH="$CLANG_CACHE" SWIFT_MODULE_CACHE_PATH="$SWIFT_CACHE" swiftc -target arm64-apple-macosx12.0 native/AppDelegate.swift -o native/DocumentCleanerLauncher -framework AppKit
env CLANG_MODULE_CACHE_PATH="$CLANG_CACHE" SWIFT_MODULE_CACHE_PATH="$SWIFT_CACHE" swiftc -target arm64-apple-macosx12.0 native/DocumentToolkit.swift -o native/DocumentToolkit -framework AppKit -framework PDFKit -framework Vision -framework CoreText
env CLANG_MODULE_CACHE_PATH="$CLANG_CACHE" SWIFT_MODULE_CACHE_PATH="$SWIFT_CACHE" swiftc -target arm64-apple-macosx12.0 native/IconMaker.swift -o "$BUILD_ROOT/IconMaker" -framework AppKit

cp package.json package-lock.json "$RUNTIME_STAGE/"
npm ci --omit=dev --ignore-scripts --prefix "$RUNTIME_STAGE"
cp native/DocumentCleanerLauncher "$CONTENTS/MacOS/DocumentCleanerLauncher"
cp native/DocumentToolkit "$CONTENTS/Resources/bin/DocumentToolkit"
cp native/Info.plist "$CONTENTS/Info.plist"
cp "$NODE_BINARY" "$CONTENTS/Resources/runtime/node"
cp native/helper-server.mjs native/pipeline.mjs native/openai.mjs native/prompts.mjs native/utils.mjs "$APP_RESOURCES/"
cp docs/Document_Cleaner_App_Instructions_Updated_v2.md "$APP_RESOURCES/specification.md"
rsync -a dist/ "$APP_RESOURCES/dist/"
rsync -a "$RUNTIME_STAGE/node_modules/" "$APP_RESOURCES/node_modules/"

ICON_SOURCE="$BUILD_ROOT/icon-1024.png"
ICONSET="$BUILD_ROOT/DocumentCleaner.iconset"
"$BUILD_ROOT/IconMaker" "$ICON_SOURCE"
mkdir -p "$ICONSET"
for spec in "16 icon_16x16.png" "32 icon_16x16@2x.png" "32 icon_32x32.png" "64 icon_32x32@2x.png" "128 icon_128x128.png" "256 icon_128x128@2x.png" "256 icon_256x256.png" "512 icon_256x256@2x.png" "512 icon_512x512.png" "1024 icon_512x512@2x.png"; do
  read -r pixels filename <<<"$spec"
  sips -z "$pixels" "$pixels" "$ICON_SOURCE" --out "$ICONSET/$filename" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$CONTENTS/Resources/DocumentCleaner.icns"

plutil -lint "$CONTENTS/Info.plist" >/dev/null
codesign --force --deep --sign - "$APP_BUNDLE"
codesign --verify --deep --strict --verbose=2 "$APP_BUNDLE"

mkdir -p "$OUTPUT_DIR"
if [[ -e "$ARCHIVE" ]]; then /bin/rm -f "$ARCHIVE"; fi
ditto -c -k --norsrc --keepParent "$APP_BUNDLE" "$ARCHIVE"

VERIFIED="$BUILD_ROOT/verified"
mkdir -p "$VERIFIED"
ditto -x -k "$ARCHIVE" "$VERIFIED"
VERIFIED_APP="$VERIFIED/Document Cleaner.app"
codesign --verify --deep --strict --verbose=2 "$VERIFIED_APP"
plutil -lint "$VERIFIED_APP/Contents/Info.plist" >/dev/null
"$VERIFIED_APP/Contents/Resources/runtime/node" --check "$VERIFIED_APP/Contents/Resources/app/helper-server.mjs"
lipo -archs "$VERIFIED_APP/Contents/MacOS/DocumentCleanerLauncher" | tr ' ' '\n' | grep -qx arm64
lipo -archs "$VERIFIED_APP/Contents/Resources/bin/DocumentToolkit" | tr ' ' '\n' | grep -qx arm64
lipo -archs "$VERIFIED_APP/Contents/Resources/runtime/node" | tr ' ' '\n' | grep -qx arm64

echo
echo "Document Cleaner $VERSION built and verified."
echo "Archive: $ARCHIVE"
shasum -a 256 "$ARCHIVE"
