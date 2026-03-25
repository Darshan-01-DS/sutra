import mongoose from 'mongoose';
import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf-8');
const match = env.match(/MONGODB_URI="([^"]+)"/);
const uri = match[1];

console.log('Testing connection to direct endpoints...');
mongoose.connect(uri)
  .then(() => {
    console.log('SUCCESS! Directly connected to MongoDB replica set.');
    process.exit(0);
  })
  .catch(err => {
    console.error('FAILED TO CONNECT:', err);
    process.exit(1);
  });
