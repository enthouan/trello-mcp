#!/usr/bin/env bash
set -euo pipefail

# Digests from the official v1.8.1 release assets. Review version and digest
# together; never replace this with an unpinned latest/download URL.
publisher_version=v1.8.1
case "$(uname -s)/$(uname -m)" in
  Linux/x86_64)
    platform=linux_amd64
    checksum=a06c9096dcb9727c13555b6be26c7effa707b01f06a4c561ba7a3635443cf2cc
    ;;
  Darwin/x86_64)
    platform=darwin_amd64
    checksum=88126981225e7714fcc6b7a10cdba4a80ae5901e9740a8c06d0d5195c8bc294c
    ;;
  Darwin/arm64)
    platform=darwin_arm64
    checksum=e45e520892460732a4bdf37255576415d4a53ec171f8b913faf15bb1aef7cb77
    ;;
  *) echo "Unsupported publisher platform" >&2; exit 1 ;;
esac

destination=${1:?Pass an absolute destination for the publisher binary}
case "$destination" in /*) ;; *) echo "Destination must be absolute" >&2; exit 1 ;; esac
publisher_tmp=$(mktemp -d)
trap 'rm -rf "$publisher_tmp"' EXIT
curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' --tlsv1.2 \
  --retry 3 --connect-timeout 15 --max-time 120 \
  "https://github.com/modelcontextprotocol/registry/releases/download/${publisher_version}/mcp-publisher_${platform}.tar.gz" \
  --output "$publisher_tmp/publisher.tar.gz"
printf '%s  %s\n' "$checksum" "$publisher_tmp/publisher.tar.gz" | shasum -a 256 --check -
tar -xzf "$publisher_tmp/publisher.tar.gz" -C "$publisher_tmp" mcp-publisher
install -m 755 "$publisher_tmp/mcp-publisher" "$destination"
