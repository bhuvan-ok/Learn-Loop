# Backups and Recovery for MongoDB

Data protection starts with the question of how much loss and how much downtime the business can accept. The recovery point objective is the maximum age of data that may be lost, and the recovery time objective is the maximum time to get back to a working system. These two numbers drive the choice of backup method.

The mongodump tool connects to a running database and writes its contents as BSON files, and mongorestore loads them back. A dump is simple, portable and good for small and medium databases or for moving data between environments. It reads every document, so it adds load to a busy server and the result is only consistent if the oplog option is used to capture changes made during the dump.

A filesystem or cloud volume snapshot copies the underlying storage and is much faster for large databases. A snapshot is only safe if the database files and its journal are captured together at the same instant, which most cloud platforms can do for a single volume. Managed services such as Atlas offer continuous backup with point-in-time recovery, which lets you restore to any second within a retention window.

A backup you have never restored is only a hope. Schedule regular restore tests into a separate environment and check that the data is complete and that the procedure fits within the recovery time objective.

Store backups away from the system they protect, in a different account or region, and encrypt them because they contain the same sensitive data as production. Apply a retention policy, for instance daily copies for a week and monthly copies for a year, so storage costs stay bounded.

Protect backup credentials separately from production credentials so a compromise of one does not expose the other.
