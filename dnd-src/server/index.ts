// Local-only entry. On Vercel the function in api/dnd/[...path].ts is used instead.
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { app } from './app'
app.use('/dnd/*', serveStatic({ root: './' }))
app.get('/dnd/*', serveStatic({ path: './dnd/index.html' }))
serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 8787) })
console.log('dnd server on', process.env.PORT ?? 8787)
