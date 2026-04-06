/**
 * queue.js — shared Redis connection + BullMQ queue instance.
 * Imported by both the producer (campanha.service) and the worker (disparo.worker).
 */
const { Queue, QueueEvents } = require('bullmq')
const IORedis = require('ioredis')

// Support both REDIS_URL (EasyPanel style) and REDIS_HOST/PORT (legacy .env)
function buildRedisConnection() {
  if (process.env.REDIS_URL) {
    console.log('[redis] Using REDIS_URL:', process.env.REDIS_URL.replace(/:\/\/.*@/, '://***@'))
    return new IORedis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
  }

  const host     = process.env.REDIS_HOST     || '127.0.0.1'
  const port     = parseInt(process.env.REDIS_PORT || '6379', 10)
  const password = process.env.REDIS_PASSWORD || undefined

  console.log(`[redis] Connecting to ${host}:${port}`)
  return new IORedis({
    host,
    port,
    password,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

const connection = buildRedisConnection()

connection.on('connect', () => console.log('[redis] Connected'))
connection.on('ready',   () => console.log('[redis] Ready'))
connection.on('error',   (err) => console.error('[redis] Connection error:', err.message))
connection.on('close',   () => console.warn('[redis] Connection closed'))
connection.on('reconnecting', () => console.log('[redis] Reconnecting…'))

const QUEUE_NAME = 'disparos'

// Producer queue — used to add jobs
const disparosQueue = new Queue(QUEUE_NAME, { connection })

// QueueEvents — used to listen for job completions (optional, for status polling)
const disparosQueueEvents = new QueueEvents(QUEUE_NAME, { connection })

module.exports = { disparosQueue, disparosQueueEvents, connection, QUEUE_NAME }
