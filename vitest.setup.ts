import dotenv from 'dotenv';
import path from 'path';

// Load env vars before any test modules are imported.
// `override: true` is needed because dotenv v17 won't overwrite existing (empty) vars.
dotenv.config({ path: path.resolve(__dirname, '.env.local'), override: true });
dotenv.config({ path: path.resolve(__dirname, '.env'), override: true });
