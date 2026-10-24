const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const mode = process.argv[2]; // 'local' or 'live'

if (!fs.existsSync(envPath)) {
  console.error('.env file not found at:', envPath);
  process.exit(1);
}

let content = fs.readFileSync(envPath, 'utf8');

const LOCAL_URI = 'mongodb://127.0.0.1:27017/stowave_local_dev';
const LIVE_URI = 'mongodb+srv://alizohaibweb_db_user:XsdGG2d5g4fIrMdB@cluster0.vjokz1b.mongodb.net/?retryWrites=true&w=majority';

if (mode === 'live') {
  // Switch to LIVE Atlas Mongo
  content = content.replace(
    /^(#?\s*)MONGODB_URI=.*$/m,
    `MONGODB_URI=${LIVE_URI}`
  );
  console.log('✅ Switched .env to LIVE Production MongoDB Atlas cluster!');
  console.log('📡 MONGODB_URI is now pointing to Atlas.');
} else if (mode === 'local') {
  // Switch to LOCAL Installed Mongo
  content = content.replace(
    /^(#?\s*)MONGODB_URI=.*$/m,
    `MONGODB_URI=${LOCAL_URI}`
  );
  console.log('🛡️ Switched .env to LOCAL Installed MongoDB (mongodb://127.0.0.1:27017/stowave_local_dev)!');
  console.log('🔒 Live portal data is completely protected during testing.');
} else {
  console.log('Usage: node scripts/switch-env.js [local|live]');
  process.exit(0);
}

fs.writeFileSync(envPath, content, 'utf8');
