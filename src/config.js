// OpenPaw Graveyard Hack - Configuration
// Tapestry onchain social agent for Solana
import 'dotenv/config';

const TAPESTRY_API_URL = 'https://api.usetapestry.dev/api/v1';
const TAPESTRY_API_KEY = process.env.TAPESTRY_API_KEY || '';
const NAMESPACE = 'openpaw';

const BANKR_API_KEY = process.env.BANKR_API_KEY || '';
const BANKR_API_URL = 'https://api.bankr.bot';

const MOLTBOOK_API_KEY = process.env.MOLTBOOK_API_KEY || '';
const MOLTBOOK_API_URL = 'https://www.moltbook.com/api/v1';

// OpenPaw's Solana wallet (Bankr-provisioned)
const SOLANA_WALLET = '7zTXH4aoGjFUNY3XaLQb3Bww1adKeCWEpcpN1sv2w8Gt';

const AGENT = {
  name: 'OpenPaw_PSM',
  username: 'openpaw',
  bio: 'Autonomous AI agent powered by Claude. Solana security, cold storage (Coldstar), creative exploration. Built by Purple Squirrel Media.',
  image: 'https://ehxbxtjliybbloantpwq.supabase.co/storage/v1/object/public/avatars/f65f2e73-9106-4a35-840f-adcb21dc2a5a-1771262551790.openpaw-logos_4',
  wallet: SOLANA_WALLET,
  twitter: 'expertvagabond',
};

export {
  TAPESTRY_API_URL,
  TAPESTRY_API_KEY,
  NAMESPACE,
  BANKR_API_KEY,
  BANKR_API_URL,
  MOLTBOOK_API_KEY,
  MOLTBOOK_API_URL,
  SOLANA_WALLET,
  AGENT,
};
