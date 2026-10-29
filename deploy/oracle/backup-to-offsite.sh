#!/usr/bin/env bash
# Encrypted PostgreSQL-only backup to independently configured offsite storage.
# Requires PostgreSQL 18 pg_dump, age, rclone and a configured rclone remote.
set -euo pipefail
umask 077
: "$DATABASE_URL" "$BACKUP_AGE_RECIPIENT" "$BACKUP_RCLONE_TARGET"

for binary in pg_dump age rclone; do
  command -v "$binary" >/dev/null || { echo "Missing required tool: $binary" >&2; exit 2; }
done
case "$BACKUP_RCLONE_TARGET" in
  *:*) ;;
  *) echo "Backup target must be an offsite rclone remote:directory" >&2; exit 2 ;;
esac

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="abdallah-erp-pg18-$timestamp.dump.age"
archive="$tmp_dir/$name"

# Pipe dump to age so only encrypted bytes touch the filesystem.
pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" |
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$archive"
test -s "$archive" || { echo "Encrypted dump empty" >&2; exit 1; }

rclone copyto "$archive" "$BACKUP_RCLONE_TARGET/$name" --retries 3
echo "Encrypted PostgreSQL dump uploaded offsite: $name"
echo "File uploads also require their own backup policy."
