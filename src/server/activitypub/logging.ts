import { AsyncLocalStorage } from 'node:async_hooks';
import { configureSync, getConsoleSink } from '@logtape/logtape';

configureSync({
  contextLocalStorage: new AsyncLocalStorage(),
  sinks: { console: getConsoleSink() },
  loggers: [
    { category: ['fedify'], lowestLevel: 'error', sinks: ['console'] },
    {
      category: ['logtape', 'meta'],
      lowestLevel: 'warning',
      sinks: ['console'],
    },
  ],
});
