import { createMcpHandler, McpServer } from '@modelcontextprotocol/server'
import { fromSupabaseUrl, withOAuthProtectedResource, withSupabase } from '@supabase/server'
import { z } from 'zod'

interface Env {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY?: string
  SUPABASE_SECRET_KEY?: string
  SUPABASE_JWKS?: string
  OPENAI_APPS_CHALLENGE?: string
  PUBLISHER_NAME?: string
  SUPPORT_EMAIL?: string
}

const taskShape = {
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  status: z.enum(['open', 'done', 'archived']),
  due_at: z.string().nullable(),
  area: z.string(),
  priority: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
}

const cardShape = {
  id: z.string(),
  title: z.string(),
  topic: z.string(),
  content: z.record(z.string(), z.unknown()),
  status: z.enum(['active', 'completed', 'archived']),
  created_at: z.string(),
  updated_at: z.string(),
}

function result(message: string, structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent,
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[char]!)
}

function page(title: string, body: string) {
  return new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>body{font:16px/1.6 system-ui,sans-serif;max-width:760px;margin:48px auto;padding:0 20px;color:#171717}h1{font-size:36px}h2{margin-top:32px}a{color:inherit}code{background:#f3f3f3;padding:2px 5px;border-radius:5px}.muted{color:#666}</style></head><body>${body}</body></html>`, {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300', 'x-content-type-options': 'nosniff' },
  })
}

function staticRoute(request: Request, env: Env): Response | null {
  const url = new URL(request.url)
  if (url.pathname === '/.well-known/openai-apps-challenge') {
    const token = (env.OPENAI_APPS_CHALLENGE || '').trim()
    if (!token) return new Response('Not configured', { status: 404 })
    return new Response(token, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })
  }

  const publisher = escapeHtml((env.PUBLISHER_NAME || 'HOME').trim())
  const support = (env.SUPPORT_EMAIL || '').trim()
  const supportHtml = support.includes('@') ? `<a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a>` : 'Support contact will be configured before public release.'

  if (url.pathname === '/' || url.pathname === '/website') {
    return page('HOME – Personal OS', `<h1>HOME – Personal OS</h1><p>HOME is a personal execution layer for tasks, daily planning, and deliberate learning inside ChatGPT and Codex.</p><p><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/support">Support</a></p><p class="muted">Publisher: ${publisher}</p>`)
  }
  if (url.pathname === '/support') {
    return page('HOME Support', `<h1>Support</h1><p>For HOME support, contact ${supportHtml}.</p>`)
  }
  if (url.pathname === '/privacy') {
    return page('HOME Privacy Policy', `<h1>HOME Privacy Policy</h1><p><strong>Last updated: 25 September 2026.</strong></p><p>HOME stores account identifiers, tasks, task notes and status, optional due times and priorities, learning cards, reflections, feedback, and settings that users choose to store.</p><p>The public HOME plugin does not require precise location, contacts, SMS, WhatsApp content, Android Accessibility data, or notification scraping.</p><h2>Purpose</h2><p>HOME uses this information only to provide requested task, planning, and learning workflows. ChatGPT/Codex may send the information required for a selected HOME tool call to HOME's MCP server.</p><h2>Processors</h2><p>HOME uses Supabase for authentication and data infrastructure. ChatGPT/Codex is provided by OpenAI under the user's applicable OpenAI terms and privacy controls.</p><h2>Retention and rights</h2><p>HOME data is retained only as needed to provide the service or meet applicable legal obligations. Users may disconnect HOME at any time and may request access, correction, export, or deletion through ${supportHtml}.</p><h2>Security</h2><p>HOME uses authenticated access, encrypted transport, and per-user Row Level Security policies designed to prevent one user from accessing another user's data.</p><p class="muted">Publisher: ${publisher}</p>`)
  }
  if (url.pathname === '/terms') {
    return page('HOME Terms of Service', `<h1>HOME Terms of Service</h1><p><strong>Last updated: 25 September 2026.</strong></p><p>HOME provides tools for storing and managing personal tasks and learning information through supported clients including ChatGPT and Codex.</p><h2>User responsibility</h2><p>Users are responsible for the information they choose to store and for reviewing important actions and AI-generated output. HOME is not a substitute for professional medical, legal, financial, emergency, or other regulated advice.</p><h2>Account security</h2><p>Users must protect their authentication credentials and may not attempt to access another person's data, bypass security controls, or interfere with the service.</p><h2>Availability</h2><p>HOME may be updated, changed, suspended, or discontinued for maintenance, security, legal, or product reasons.</p><h2>Privacy</h2><p>Personal data is handled as described in the <a href="/privacy">HOME Privacy Policy</a>.</p><h2>Contact</h2><p>${supportHtml}</p><p class="muted">Publisher: ${publisher}</p>`)
  }
  return null
}

function createHomeServer(supabase: any) {
  const server = new McpServer(
    { name: 'home-personal-os', version: '0.1.0' },
    {
      instructions:
        'HOME stores the signed-in user’s task and learning data. Read current HOME data before planning. Never complete or delete work unless the user clearly asks. Prefer small, explicit writes and avoid inventing dates.',
    },
  )

  server.registerTool(
    'get_home_snapshot',
    {
      title: 'Get HOME snapshot',
      description: 'Read the signed-in user’s open tasks, recent completed tasks, and active HOME learning cards before planning or summarizing.',
      inputSchema: {
        task_limit: z.number().int().min(1).max(100).default(50),
        learning_limit: z.number().int().min(1).max(50).default(10),
      },
      outputSchema: {
        open_tasks: z.array(z.object(taskShape)),
        completed_tasks: z.array(z.object(taskShape)),
        learning_cards: z.array(z.object(cardShape)),
      },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ task_limit, learning_limit }) => {
      const [openTasks, doneTasks, cards] = await Promise.all([
        supabase.from('home_tasks').select('id,title,notes,status,due_at,area,priority,created_at,updated_at').eq('status', 'open').order('due_at', { ascending: true, nullsFirst: false }).order('updated_at', { ascending: false }).limit(task_limit),
        supabase.from('home_tasks').select('id,title,notes,status,due_at,area,priority,created_at,updated_at').eq('status', 'done').order('updated_at', { ascending: false }).limit(Math.min(task_limit, 20)),
        supabase.from('home_learning_cards').select('id,title,topic,content,status,created_at,updated_at').eq('status', 'active').order('updated_at', { ascending: false }).limit(learning_limit),
      ])
      for (const query of [openTasks, doneTasks, cards]) if (query.error) throw new Error(query.error.message)
      const structuredContent = { open_tasks: openTasks.data ?? [], completed_tasks: doneTasks.data ?? [], learning_cards: cards.data ?? [] }
      return result(`HOME has ${structuredContent.open_tasks.length} open tasks and ${structuredContent.learning_cards.length} active learning cards.`, structuredContent)
    },
  )

  server.registerTool(
    'create_task',
    {
      title: 'Create HOME task',
      description: 'Create one actionable task in HOME. Do not invent a due time when the user did not supply one.',
      inputSchema: {
        title: z.string().trim().min(1).max(200),
        notes: z.string().max(4000).default(''),
        due_at: z.string().datetime({ offset: true }).nullable().default(null),
        area: z.string().trim().min(1).max(80).default('Personal'),
        priority: z.number().int().min(0).max(3).default(1),
      },
      outputSchema: { task: z.object(taskShape) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ title, notes, due_at, area, priority }) => {
      const { data, error } = await supabase.from('home_tasks').insert({ title, notes, due_at, area, priority }).select('id,title,notes,status,due_at,area,priority,created_at,updated_at').single()
      if (error) throw new Error(error.message)
      return result(`Created HOME task “${data.title}”.`, { task: data })
    },
  )

  server.registerTool(
    'update_task',
    {
      title: 'Update HOME task',
      description: 'Change fields on one existing HOME task. Use only for changes the user requested or clearly approved.',
      inputSchema: {
        id: z.string().uuid(),
        title: z.string().trim().min(1).max(200).optional(),
        notes: z.string().max(4000).optional(),
        due_at: z.string().datetime({ offset: true }).nullable().optional(),
        area: z.string().trim().min(1).max(80).optional(),
        priority: z.number().int().min(0).max(3).optional(),
        status: z.enum(['open', 'done', 'archived']).optional(),
      },
      outputSchema: { task: z.object(taskShape) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ id, ...changes }) => {
      const patch: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(changes)) if (value !== undefined) patch[key] = value
      if (!Object.keys(patch).length) throw new Error('No task changes were provided.')
      const { data, error } = await supabase.from('home_tasks').update(patch).eq('id', id).select('id,title,notes,status,due_at,area,priority,created_at,updated_at').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('Task not found.')
      return result(`Updated HOME task “${data.title}”.`, { task: data })
    },
  )

  server.registerTool(
    'complete_task',
    {
      title: 'Complete HOME task',
      description: 'Mark one existing HOME task as done. Use only when the user explicitly says the task is finished or asks to mark it complete.',
      inputSchema: { id: z.string().uuid() },
      outputSchema: { task: z.object(taskShape) },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ id }) => {
      const { data, error } = await supabase.from('home_tasks').update({ status: 'done' }).eq('id', id).select('id,title,notes,status,due_at,area,priority,created_at,updated_at').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('Task not found.')
      return result(`Marked HOME task “${data.title}” as done.`, { task: data })
    },
  )

  server.registerTool(
    'delete_task',
    {
      title: 'Delete HOME task',
      description: 'Permanently delete one HOME task. Use only when the user explicitly asks to remove it rather than complete or archive it.',
      inputSchema: { id: z.string().uuid() },
      outputSchema: { deleted_id: z.string(), title: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
    },
    async ({ id }) => {
      const { data, error } = await supabase.from('home_tasks').delete().eq('id', id).select('id,title').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Error('Task not found.')
      return result(`Deleted HOME task “${data.title}”.`, { deleted_id: data.id, title: data.title })
    },
  )

  server.registerTool(
    'list_learning_cards',
    {
      title: 'List HOME learning cards',
      description: 'List the signed-in user’s active HOME learning cards for Tube Learning, recall, or review.',
      inputSchema: { limit: z.number().int().min(1).max(50).default(20) },
      outputSchema: { cards: z.array(z.object(cardShape)) },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
    },
    async ({ limit }) => {
      const { data, error } = await supabase.from('home_learning_cards').select('id,title,topic,content,status,created_at,updated_at').eq('status', 'active').order('updated_at', { ascending: false }).limit(limit)
      if (error) throw new Error(error.message)
      const cards = data ?? []
      return result(`Found ${cards.length} active HOME learning cards.`, { cards })
    },
  )

  server.registerTool(
    'save_learning_attempt',
    {
      title: 'Save HOME learning attempt',
      description: 'Save the user’s own reflection plus concise feedback after a meaningful recall or application attempt.',
      inputSchema: {
        card_id: z.string().uuid().nullable().default(null),
        reflection: z.string().trim().min(1).max(4000),
        feedback: z.record(z.string(), z.unknown()).default({}),
        overall_score: z.number().int().min(0).max(100).nullable().default(null),
      },
      outputSchema: {
        attempt: z.object({
          id: z.string(), card_id: z.string().nullable(), reflection: z.string(), feedback: z.record(z.string(), z.unknown()), overall_score: z.number().int().nullable(), created_at: z.string(),
        }),
      },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
    },
    async ({ card_id, reflection, feedback, overall_score }) => {
      const { data, error } = await supabase.from('home_learning_attempts').insert({ card_id, reflection, feedback, overall_score }).select('id,card_id,reflection,feedback,overall_score,created_at').single()
      if (error) throw new Error(error.message)
      return result('Saved this HOME learning attempt.', { attempt: data })
    },
  )

  return server
}

export default {
  async fetch(request: Request, env: Env, executionCtx: ExecutionContext): Promise<Response> {
    const staticResponse = staticRoute(request, env)
    if (staticResponse) return staticResponse

    const url = new URL(request.url)
    if (url.pathname !== '/mcp' && !url.pathname.endsWith('/oauth-protected-resource')) {
      return new Response('Not Found', { status: 404 })
    }

    const appHandler = withOAuthProtectedResource(
      {
        resourceServer: (req: Request) => `${new URL(req.url).origin}/mcp`,
        authorizationServer: fromSupabaseUrl(env.SUPABASE_URL),
      },
      withSupabase({ auth: 'user' }, async (req, ctx) => {
        const handler = createMcpHandler(() => createHomeServer(ctx.supabase))
        return handler.fetch(req)
      }),
    )

    return (appHandler as any)(request, env, executionCtx)
  },
}
