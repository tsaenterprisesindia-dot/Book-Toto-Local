import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer = null;

export async function connectDB() {
  if (process.env.MONGODB_URI) {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('[db] connected:', process.env.MONGODB_URI);
    return null;
  }

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
  console.log('[db] connected to in-memory MongoDB (data resets on restart)');
  console.log('[db] tip: set MONGODB_URI in server/.env to use Atlas / local MongoDB');
  return mongoServer;
}

export async function stopDB() {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}
