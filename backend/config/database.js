// MongoDB database connection
import mongoose from 'mongoose';

export const connectDB = async () => {
  const maxRetries = 5;
  let retryCount = 0;

  // Try Atlas first, then fallback to local
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chat-app';
  const isLocal = mongoURI.includes('localhost');

  while (retryCount < maxRetries) {
    try {
      console.log(`Attempting MongoDB connection (attempt ${retryCount + 1}/${maxRetries})...`);

      const conn = await mongoose.connect(mongoURI, {
        dbName: 'chat-app',
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        heartbeatFrequencyMS: 10000,
        maxPoolSize: 10,
        minPoolSize: 5,
        waitQueueTimeoutMS: 10000
      });

      console.log(`✓ MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      retryCount++;

      // If Atlas fails and we haven't tried local yet, try local as fallback
      if (!isLocal && retryCount === 3) {
        console.warn('⚠ Atlas connection failed, trying local MongoDB as fallback...');
        try {
          const localURI = 'mongodb://localhost:27017/chat-app';
          const conn = await mongoose.connect(localURI, {
            dbName: 'chat-app',
            serverSelectionTimeoutMS: 5000
          });
          console.log(`✓ Connected to local MongoDB: ${conn.connection.host}`);
          return conn;
        } catch (localError) {
          console.warn('⚠ Local MongoDB also failed:', localError.message);
          console.log('Continuing with Atlas retries...');
        }
      }

      if (retryCount >= maxRetries) {
        console.error('✗ MongoDB connection failed after maximum retries');
        console.error('\n=== CONNECTION HELP ===');
        console.error('\n1. USING MONGODB ATLAS (Cloud):');
        console.error('   - Go to: https://cloud.mongodb.com/');
        console.error('   - Navigate: Security → IP Access List');
        console.error('   - Add your current IP: 0.0.0.0/0 (allows all IPs - easiest for dev)');
        console.error('   - Or click "Add Current IP Address"');
        console.error('');
        console.error('2. USING LOCAL MONGODB:');
        console.error('   - Install MongoDB: https://www.mongodb.com/try/download/community');
        console.error('   - Start MongoDB service:');
        console.error('     Windows: net start MongoDB');
        console.error('     Mac/Linux: sudo systemctl start mongod');
        console.error('');
        console.error('3. CHECK YOUR .env FILE:');
        console.error('   - Ensure MONGODB_URI is correct');
        console.error('   - Format: mongodb+srv://<user>:<pass>@cluster.mongodb.net/<dbname>?retryWrites=true&w=majority');
        console.error('');
        console.error('Current URI being used:', mongoURI.replace(/\/\/.*:.*@/, '//***:***@'));
        return null;
      }

      console.warn(`⚠ Connection attempt ${retryCount} failed: ${error.message}`);
      console.log(`Retrying in ${Math.min(retryCount * 2, 10)} seconds...`);

      await new Promise(resolve => setTimeout(resolve, Math.min(retryCount * 2000, 10000)));
    }
  }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  try {
    await mongoose.connection.close();
    console.log('MongoDB connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    return null;
  }
});

// Handle unhandled rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled Promise Rejection:', error);
});

