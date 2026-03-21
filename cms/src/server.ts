import express from 'express'
import payload from 'payload'

const app = express()

const start = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'dev-secret-change-in-prod',
    express: app,
    onInit: () => {
      payload.logger.info(`Payload Admin URL: ${payload.getAdminURL()}`)
    },
  })

  const port = parseInt(process.env.PORT || '4094', 10)

  app.listen(port, () => {
    payload.logger.info(`CMS server listening on port ${port}`)
  })
}

start()
