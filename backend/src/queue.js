/**
 * queue.js — shared Redis connection + BullMQ queue instance.
 * Imported by both the producer (campanha.service) and the worker (disparo.worker).
 */
const { Queue, QueueEvents } = require('bullmq')
const IORedis = require('ioredis')

const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

// Shared Redis connection (maxRetriesPerRequest=null required by BullMQ)
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

connection.on('error', (err) => {
  console.error('[redis] Connection error:', err.message)
})

const QUEUE_NAME = 'disparos'

// Producer queue — used to add jobs
const disparosQueue = new Queue(QUEUE_NAME, { connection })

// QueueEvents — used to listen for job completions (optional, for status polling)
const disparosQueueEvents = new QueueEvents(QUEUE_NAME, { connection })

module.exports = { disparosQueue, disparosQueueEvents, connection, QUEUE_NAME }
