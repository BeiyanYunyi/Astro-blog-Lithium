import { AsyncLocalStorage } from 'node:async_hooks';
import {
  configureSync,
  defaultConsoleFormatter,
  getConsoleSink,
  type LogRecord,
} from '@logtape/logtape';

export function formatFederationLog(record: LogRecord): readonly unknown[] {
  const output = defaultConsoleFormatter(record);
  if (
    record.category.join('.') !== 'fedify.federation.inbox' ||
    !['noSignature', 'invalidSignature', 'keyFetchError'].includes(
      String(record.properties.reason),
    )
  )
    return output;
  // The default formatter drops properties absent from the message template.
  // Keep the verification reason visible without dumping the request or activity.
  return [
    ...output,
    JSON.stringify({
      reason: record.properties.reason,
      keyId: record.properties.keyId ?? null,
      recipient: record.properties.recipient ?? null,
    }),
  ];
}

configureSync({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: { console: getConsoleSink({ formatter: formatFederationLog }) },
  loggers: [
    { category: ['fedify'], lowestLevel: 'error', sinks: ['console'] },
    {
      category: ['logtape', 'meta'],
      lowestLevel: 'warning',
      sinks: ['console'],
    },
  ],
});
