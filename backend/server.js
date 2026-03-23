require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { migrate } = require('./src/db/migrate')

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
app.use(express.json())

// Routes
app.use('/api/auth', require('./src/routes/auth.routes'))
app.use('/api/wabas', require('./src/routes/waba.routes'))
app.use('/api/templates', require('./src/routes/template.routes'))
app.use('/api/campanhas', require('./src/routes/campanha.routes'))
app.use('/api/aquecimento', require('./src/routes/aquecimento.routes'))

// Run migrations then start server
migrate()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('[db] Migration failed:', err)
    process.exit(1)
  })
