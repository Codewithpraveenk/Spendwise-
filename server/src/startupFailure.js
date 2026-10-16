// Never log database-driver messages: they can contain credential-bearing URIs.
export function startupFailure(error, stage) {
  const result = { event: 'startup_failed', stage };
  if (stage === 'configuration') return { ...result, code: 'CONFIGURATION_ERROR', message: 'Check required production environment settings, including MONGODB_URI, application origin and email mode.' };
  if (error?.code === 18 || error?.codeName === 'AuthenticationFailed') return { ...result, code: 'DATABASE_AUTHENTICATION_FAILED', message: 'Atlas rejected the database login. Check the database user and encoded password in the private connection string.' };
  if (error?.code === 13) return { ...result, code: 'DATABASE_PERMISSION_DENIED', message: 'The database user lacks permissions required to prepare application indexes.' };
  if (error?.code === 11000) return { ...result, code: 'DATABASE_DUPLICATE_RECORDS', message: 'Existing duplicate records prevent a required unique index. Resolve duplicates without deleting unrelated records.' };
  if ([85, 86].includes(error?.code)) return { ...result, code: 'DATABASE_INDEX_CONFLICT', message: 'An existing index conflicts with a declared application index. Review the index definitions before changing them.' };
  if (error?.name === 'MongoParseError') return { ...result, code: 'DATABASE_URI_INVALID', message: 'The private MongoDB connection string is not valid. Check its format and URL-encoded password.' };
  if (['MongooseServerSelectionError', 'MongoServerSelectionError'].includes(error?.name)) return { ...result, code: 'DATABASE_UNREACHABLE', message: 'Cannot reach Atlas. Check cluster availability, Atlas Network Access for the hosting outbound IP ranges, DNS and TLS connectivity.' };
  return { ...result, code: 'DATABASE_STARTUP_FAILED', message: 'Database startup failed. Check database configuration and availability. Private connection details are omitted.' };
}
