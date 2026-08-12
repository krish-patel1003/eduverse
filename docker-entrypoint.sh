#!/bin/sh
set -e

# Where the live SQLite DB lives (writable tmpfs on Cloud Run).
DATA_DIR="${DATA_DIR:-/tmp}"
mkdir -p "$DATA_DIR"
DB="$DATA_DIR/eduverse.db"

# If a GCS bucket is configured, restore-on-boot + continuously replicate via
# Litestream. Otherwise just run the server (ephemeral DB).
if [ -n "$LITESTREAM_BUCKET" ]; then
  cat >/tmp/litestream.yml <<EOF
dbs:
  - path: ${DB}
    replicas:
      - type: gcs
        bucket: ${LITESTREAM_BUCKET}
        path: eduverse
EOF
  echo "litestream: restoring ${DB} from gs://${LITESTREAM_BUCKET}/eduverse (if present)"
  litestream restore -if-replica-exists -config /tmp/litestream.yml "$DB" || true
  exec litestream replicate -config /tmp/litestream.yml -exec "node server.js"
else
  echo "LITESTREAM_BUCKET not set — running with an ephemeral database."
  exec node server.js
fi
