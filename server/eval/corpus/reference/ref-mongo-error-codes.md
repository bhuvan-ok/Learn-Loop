# MongoDB Server Error Codes

MongoDB errors carry a numeric code and a code name. Applications should branch on these rather than on message text.

## Command and namespace errors

- `13 Unauthorized`: The authenticated user lacks the privileges needed for the command.
- `18 AuthenticationFailed`: The supplied credentials were rejected during authentication.
- `26 NamespaceNotFound`: The requested database or collection does not exist.
- `48 NamespaceExists`: An attempt was made to create a collection that already exists.
- `59 CommandNotFound`: The server does not recognise the command that was sent.
- `9 FailedToParse`: The command or query document could not be parsed.
- `11 UserNotFound`: The referenced user does not exist.
- `2 BadValue`: A value in the command was not valid for the field it was given for.
- `121 DocumentValidationFailure`: A write violated the collection's validation rules.

## Index and operation errors

- `85 IndexOptionsConflict`: An index with the same key pattern but different options already exists.
- `86 IndexKeySpecsConflict`: An index with the same name but a different key specification already exists.
- `50 MaxTimeMSExpired`: An operation ran longer than its maxTimeMS limit and was stopped.
- `262 ExceededTimeLimit`: The operation exceeded the time limit set for it.
- `96 OperationFailed`: A generic failure of the requested operation.
- `91 ShutdownInProgress`: The server is shutting down and cannot accept the operation.
- `89 NetworkTimeout`: A network operation to another server timed out.
- `6 HostUnreachable`: The target host could not be reached over the network.
- `7 HostNotFound`: The host name could not be resolved.

## Transaction and concurrency errors

- `112 WriteConflict`: Two operations tried to modify the same document at once and one must be retried.
- `251 NoSuchTransaction`: The referenced transaction was aborted or has expired.
- `225 TransactionTooOld`: The transaction number is older than the latest transaction for that session.
- `244 TransactionTooLarge`: The transaction exceeded the maximum size that a single transaction can hold.
- `246 SnapshotUnavailable`: The snapshot a read requested is no longer available.
- `50 InterruptedAtShutdown`: The operation was cancelled because the server began shutting down.
