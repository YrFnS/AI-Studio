#!/usr/bin/env bash
set -euo pipefail

repo="${1:-$(pwd)}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

parts_dir="$repo/scripts/product-correctness-bundle"
cat "$parts_dir"/part-*.b64 | tr -d '\r\n' > "$tmp/bundle.b64"

actual_chars="$(wc -c < "$tmp/bundle.b64" | tr -d ' ')"
if [[ "$actual_chars" != "27088" ]]; then
  echo "Unexpected product-correctness bundle length: $actual_chars" >&2
  exit 1
fi

base64 --decode "$tmp/bundle.b64" > "$tmp/bundle.zip"
echo "cc1a7fbafc8a9f21223f20b3458bef46a3174831d457a3881cbb4f9d3997e342  $tmp/bundle.zip" | sha256sum --check

mkdir -p "$tmp/unpacked"
unzip -q "$tmp/bundle.zip" -d "$tmp/unpacked"
node "$tmp/unpacked/ai-studio-product-correctness/scripts/apply-product-correctness.mjs" "$repo"

python3 - "$repo/src/lib/local-backup.ts" <<'PY'
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
old = """  return {
    id,
    generationId,
    mimeType,
    size: bytes.byteLength,
    createdAt,
    blob: new Blob([bytes], { type: mimeType }),
  };
"""
new = """  const blobBytes = new Uint8Array(bytes.byteLength);
  blobBytes.set(bytes);

  return {
    id,
    generationId,
    mimeType,
    size: bytes.byteLength,
    createdAt,
    blob: new Blob([blobBytes.buffer], { type: mimeType }),
  };
"""
if new not in source:
    if old not in source:
        raise SystemExit('Could not locate backup media Blob construction')
    source = source.replace(old, new)
path.write_text(source)
PY
