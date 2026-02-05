import { config } from "dotenv";
import { resolve } from "path";

// Load environment variables from .env.local for tests
config({ path: resolve(__dirname, "../.env.local") });

// Fallback values for tests if env vars are still missing
if (!process.env.PLATFORM_TREASURY_ADDRESS) {
  process.env.PLATFORM_TREASURY_ADDRESS = "0x0D9945F0a591094927df47DB12ACB1081cE9F0F6";
}
if (!process.env.POSTERA_SPLITTER_ADDRESS) {
  process.env.POSTERA_SPLITTER_ADDRESS = "0x622C9f74fA66D4d7E0661F1fd541Cc72E367c938";
}
