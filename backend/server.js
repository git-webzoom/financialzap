require('dotenv').config()
const express = require('express')
const cors = require('cors')
const cron = require('node-cron')
const { migrate } = require('./src/db/migrate')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
// trust proxy headers (EasyPanel/nginx reverse proxy)
app.set('trust proxy', 1)
app.use(express.json({ limit: '10mb' }))

// Routes
app.use('/api/auth',       require('./src/routes/auth.routes'))
app.use('/api/wabas',      require('./src/routes/waba.routes'))
app.use('/api/templates',  require('./src/routes/template.routes'))
app.use('/api/campanhas',  require('./src/routes/campanha.routes'))
app.use('/api/aquecimento',require('./src/routes/aquecimento.routes'))
app.use('/api/webhook',    require('./src/routes/webhook.routes'))
app.use('/api/kanban',     require('./src/routes/kanban.routes'))
app.use('/api/inventory',  require('./src/routes/inventory.routes'))

// Run migrations then start server
migrate()
  .then(() => {
    // Start BullMQ dispatch worker
    require('./src/workers/disparo.worker').startWorker()

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
      console.log(`[webhook] Endpoint: POST /api/webhook`)
      console.log(`[webhook] Verify token configured: ${!!process.env.META_WEBHOOK_VERIFY_TOKEN}`)
    })

    // Every minute: fire scheduled campaigns whose time has come
    cron.schedule('* * * * *', async () => {
      try {
        const { dispatchScheduledCampaigns } = require('./src/services/campanha.service')
        await dispatchScheduledCampaigns()
      } catch (err) {
        console.error('[cron:scheduled] Error:', err.message)
      }
    })

    // Daily template sync — runs at 03:00 server time every day
    cron.schedule('0 3 * * *', async () => {
      console.log('[cron:templates] Starting daily template sync...')
      try {
        const { syncAllWabas } = require('./src/services/template.service')
        await syncAllWabas()
      } catch (err) {
        console.error('[cron:templates] Daily sync error:', err.message)
      }
    })
  })
  .catch((err) => {
    console.error('[db] Migration failed:', err.message)
    console.error(err.stack)
    process.exit(1)
  })
