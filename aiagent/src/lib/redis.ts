import Redis from 'ioredis'
import dotenv from 'dotenv'

dotenv.config()

const useRedis = process.env.USE_REDIS === 'true'

export const redis = useRedis
  ? new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null
    })
  : null
