import type { AppConfig } from '../config/index.js';
import type { Database } from '../db/connection.js';
import type { Logger } from './log.js';

/** Everything a module needs from the running application. */
export interface AppContext {
  config: AppConfig;
  configWarnings: string[];
  logger: Logger;
  /** Logger that always prints, used for the start up lines the documentation relies on. */
  lifecycle: Logger;
  database: Database;
}
