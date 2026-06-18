# Supabase Database Backup & Restore Guide

This document defines the disaster recovery policies, backup strategy, and recovery procedures for the Nova Store database hosted on Supabase (PostgreSQL).

---

## 1. Backup Strategy Overview

Nova Store uses a **dual-layer backup strategy** to achieve a high level of data durability:

1. **Automated Physical Backups (Managed by Supabase)**
   * **Free Tier projects**: Daily automated snapshots (retained for 7 days).
   * **Pro Tier projects**: Point-in-Time Recovery (PITR) enabling rolling 1-second recovery resolution up to 7 days back.
2. **Scheduled Logical Backups (Managed by Nova Store DevOps)**
   * Weekly full-database logical dumps (`pg_dump`) archived to a secure, encrypted object storage container (e.g., AWS S3 or Google Cloud Storage) with a 30-day lifecycle retention policy.
   * On-demand manual backups performed prior to major application releases or database migration campaigns.

---

## 2. Automated Backups via Supabase Dashboard

Automated physical backups require no script configuration and can be managed directly in the Supabase control plane:

* **Location**: Navigation Panel -> **Database** -> **Backups**.
* **Recovery Action**:
  * Select the desired daily snapshot or timestamp (if PITR is enabled).
  * Click **Restore** to roll back the database.
  * *Note: Restores are destructive to intermediate data; ensure any transaction records generated since the snapshot timestamp are exported before initiating physical recovery.*

---

## 3. Manual Logical Backups using `pg_dump`

To perform a manual logical backup, run the standard PostgreSQL client tool `pg_dump` targeting the database transaction pooler URI.

### Prerequisites
Make sure you have the PostgreSQL client utilities installed and on your system path. Ensure your `.env` contains the correct Supabase `DATABASE_URL` (usually matches port `5432` or `6543` for connection pooler).

### Command A: Full Custom-Compressed Backup (Recommended)
This format is highly compressed, flexible, and allows restoring selective tables or schemas using the `pg_restore` command.

```bash
pg_dump "postgres://postgres.yourprojectid:yourpassword@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" \
  -F c \
  -b \
  -v \
  -f "novastore_backup_$(date +%Y%m%d_%H%M%S).dump"
```
* **`-F c`**: Specifies custom format (highly compressed binary).
* **`-b`**: Includes large objects.
* **`-v`**: Verbose logging.
* **`-f`**: Output file name.

### Command B: Plain Text SQL Backup
Use this format if you want a human-readable script containing raw DDL and DML commands that can be run directly using `psql`.

```bash
pg_dump "postgres://postgres.yourprojectid:yourpassword@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" \
  -F p \
  -b \
  -v \
  -f "novastore_backup_$(date +%Y%m%d_%H%M%S).sql"
```

---

## 4. Database Restore Procedures

In the event of database corruption, table drops, or regional failovers, follow these restore steps:

### Restore Scenario A: Restoring Custom Binary Dumps (`.dump`)
Use `pg_restore` to apply custom format backups.

1. **Safety Step**: Terminate existing connections to the database to prevent locks during restore.
2. **Execute Restore Command**:

```bash
pg_restore -d "postgres://postgres.yourprojectid:yourpassword@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  -v \
  "novastore_backup_filename.dump"
```
* **`--clean`**: Drops database objects (tables, functions, indexes) before recreating them.
* **`--if-exists`**: Uses `IF EXISTS` clause when dropping tables to prevent errors.
* **`--no-owner`**: Skips setting object ownership, preventing authorization failures on shared cloud environments.
* **`--no-privileges`**: Skips restoring permissions (grants/revokes) to avoid privilege conflicts.

### Restore Scenario B: Restoring Plain Text SQL Dumps (`.sql`)
Use `psql` to run plain text SQL scripts.

```bash
psql "postgres://postgres.yourprojectid:yourpassword@aws-0-eu-west-1.pooler.supabase.com:6543/postgres" \
  -f "novastore_backup_filename.sql"
```

---

## 5. Security & Retention Policy

1. **Encryption**: All logical backup dumps (`.dump` / `.sql`) must be encrypted before transmission to third-party storage providers.
   * Encrypt using GPG:
     ```bash
     gpg --symmetric --cipher-algo AES256 novastore_backup.dump
     ```
2. **Retention**:
   * **Production Logs & Dumps**: Kept for 30 days, then pruned automatically.
   * **End-of-Month Backups**: Moved to cold archival storage (AWS Glacier) and retained for 1 year.
3. **Disaster Drills**:
   * Re-verifying the restore files must be performed once every quarter on an isolated staging database instance.
