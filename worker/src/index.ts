const ALLOWED_ORIGINS = [
  'https://chainpioneer.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

const ALLOWED_UPSTREAM = 'https://spark2-api.blockanalitica.com'

export default {
  async fetch(request: Request): Promise<Response> {
    const origin = request.headers.get('Origin') || ''
    const corsOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ''

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': corsOrigin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      })
    }

    const url = new URL(request.url)
    const upstream = ALLOWED_UPSTREAM + url.pathname + url.search

    const response = await fetch(upstream, {
      method: request.method,
      headers: { 'User-Agent': 'spark-api-proxy' },
    })

    const newResponse = new Response(response.body, response)
    newResponse.headers.set('Access-Control-Allow-Origin', corsOrigin)
    return newResponse
  },
}
