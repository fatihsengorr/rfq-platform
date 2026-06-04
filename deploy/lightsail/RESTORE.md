# Database Restore Runbook

How to restore the RFQ PostgreSQL database from an S3 backup produced by
`systemd/pg-backup.sh`. Read this **before** you need it.

Backups live in S3 at `s3://<STORAGE_BUCKET>/db-backups/` as
`rfq_<db>_<timestamp>.dump` (pg_dump custom format). Daily at 02:00 UTC,
14-day retention.

---

## 1. List available backups

On the Lightsail host:

```bash
cd ~/rfq-platform
# Load S3 creds from .env.prod
export AWS_ACCESS_KEY_ID=$(grep -E '^STORAGE_ACCESS_KEY=' deploy/lightsail/.env.prod | cut -d= -f2- | tr -d '"'"'"'"')
export AWS_SECRET_ACCESS_KEY=$(grep -E '^STORAGE_SECRET_KEY=' deploy/lightsail/.env.prod | cut -d= -f2- | tr -d '"'"'"'"')
export AWS_DEFAULT_REGION=$(grep -E '^STORAGE_REGION=' deploy/lightsail/.env.prod | cut -d= -f2- | tr -d '"'"'"'"')
BUCKET=$(grep -E '^STORAGE_BUCKET=' deploy/lightsail/.env.prod | cut -d= -f2- | tr -d '"'"'"'"')

aws s3 ls "s3://$BUCKET/db-backups/"
```

Pick the timestamp you want to restore (usually the latest).

## 2. Download it

```bash
aws s3 cp "s3://$BUCKET/db-backups/rfq_rfq_platform_<TIMESTAMP>.dump" /tmp/restore.dump
```

## 3. Restore

> ⚠️ This **overwrites** the current database. Only do it when you intend to
> roll back. If you're unsure, restore into a scratch DB first (Section 5).

Copy the dump into the postgres container and run `pg_restore` with
`--clean` (drops existing objects first):

```bash
POSTGRES_USER=$(grep -E '^POSTGRES_USER=' deploy/lightsail/.env.prod | cut -d= -f2- | tr -d '"'"'"'"')
POSTGRES_DB=$(grep -E '^POSTGRES_DB=' deploy/lightsail/.env.prod | cut -d= -f2- | tr -d '"'"'"'"')

docker cp /tmp/restore.dump rfq-postgres:/tmp/restore.dump

# Stop the API so nothing writes mid-restore.
docker compose --env-file deploy/lightsail/.env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml stop api

docker exec rfq-postgres pg_restore \
  --clean --if-exists --no-owner \
  -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/restore.dump

# Bring the API back up.
docker compose --env-file deploy/lightsail/.env.prod \
  -f docker-compose.yml -f docker-compose.prod.yml start api
```

`pg_restore` may print warnings about objects that didn't exist to drop —
those are harmless with `--if-exists`.

## 4. Verify

```bash
curl -s https://api.rfq.gorhan.co.uk/health   # expect {"status":"ok",...}
docker exec rfq-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -c 'SELECT count(*) FROM "Rfq";'
```

Then log into the web app and spot-check a few RFQs.

## 5. (Safer) Restore into a scratch DB first

If you want to inspect a backup without touching production:

```bash
docker exec rfq-postgres createdb -U "$POSTGRES_USER" rfq_restore_test
docker exec rfq-postgres pg_restore --no-owner \
  -U "$POSTGRES_USER" -d rfq_restore_test /tmp/restore.dump
docker exec rfq-postgres psql -U "$POSTGRES_USER" -d rfq_restore_test \
  -c 'SELECT count(*) FROM "Rfq";'
# When done:
docker exec rfq-postgres dropdb -U "$POSTGRES_USER" rfq_restore_test
```

---

## Operational notes

- **Test the restore quarterly.** Use Section 5 against the latest backup so
  you know recovery works before a real incident.
- Backups carry password hashes and all business data. The S3 bucket must
  stay private (it is — attachments use presigned URLs, no public read).
- Retention is 14 days. To keep a backup longer (e.g. before a risky
  migration), copy it to another prefix:
  `aws s3 cp s3://$BUCKET/db-backups/<file> s3://$BUCKET/db-backups-keep/<file>`
- Manual on-demand backup: `sudo systemctl start rfq-pg-backup.service`
  then `journalctl -u rfq-pg-backup.service -n 30`.
