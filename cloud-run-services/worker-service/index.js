import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');

const worker = new Worker('tasks', async job => {
    if (job.name === 'processExcel') {
        console.log(`Processing excel data for ${job.data.email}`);
        // Simulate long-running task
        await new Promise(resolve => setTimeout(resolve, 2000));
    } else if (job.name === 'documentEmbedding') {
        console.log(`Processing embeddings for document: ${job.data.documentId}`);
    }
}, { connection });

worker.on('completed', job => {
    console.log(`${job.id} has completed!`);
});

worker.on('failed', (job, err) => {
    console.log(`${job.id} has failed with ${err.message}`);
});

console.log("Worker service is listening for background jobs...");
