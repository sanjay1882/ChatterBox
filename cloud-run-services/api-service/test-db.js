import mongoose from 'mongoose';
import ChatSession from './models/ChatSession.js';

async function check() {
    await mongoose.connect('mongodb://localhost:27017/chatterbox', { serverSelectionTimeoutMS: 5000 });
    const sessions = await ChatSession.find().sort({ updatedAt: -1 }).limit(3);
    for (const session of sessions) {
        console.log(`\nSession: ${session._id}`);
        for (const msg of session.messages.slice(-5)) { // Look at last 5 messages
            if (msg.role === 'model') {
                console.log(`  Role: ${msg.role}`);
                console.log(`  browserResult:`, msg.browserResult);
                console.log(`  sources:`, msg.sources?.length);
            }
        }
    }
    process.exit(0);
}

check().catch(console.error);
