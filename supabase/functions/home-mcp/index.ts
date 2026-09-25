import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { createMcpHandler, McpServer } from 'npm:@modelcontextprotocol/server@^2.0.0'
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@^1.6.0'
import { z } from 'npm:zod@^4.3.6'

const statusSchema = z.enum(['open', 'done', 'archived'])
const cardStatusSchema = z.enum(['active', 'completed', 'archived'])

const taskShape = {
  id: z.string(),
  title: z.string(),
  notes: z.string(),
  status: statusSchema,
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
  status: cardStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
}

function textResult(message: string, structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: message }],
    structuredContent,
  }
}

Deno.serve(
  withOAuthProtectedResource(
    withSupabase({ auth: 'user' }, async (req, { supabase }) => {
      const handler = createMcpHandler(() => {
        const server = new McpServer(
          { name: 'home-personal-os', version: '0.1.0' },
          {
            instructions:
              'HOME stores the signed-in user’s tasks and learning progress. Read current HOME data before planning. Never mark work complete or delete data unless the user clearly asks. Prefer small, explicit writes over broad changes.',
          },
        )

        server.registerTool(
          'get_home_snapshot',
          {
            title: 'Get HOME snapshot',
            description:
              'Read the signed-in user’s current HOME state: open tasks, recently completed tasks, active learning cards, and profile settings. Use before planning or summarizing the user’s day.',
            inputSchema: {
              task_limit: z.number().int().min(1).max(100).default(50),
              learning_limit: z.number().int().min(1).max(50).default(10),
            },
            outputSchema: {
              open_tasks: z.array(z.object(taskShape)),
              completed_tasks: z.array(z.object(taskShape)),
              learning_cards: z.array(z.object(cardShape)),
              profile: z
                .object({ display_name: z.string().nullable(), timezone: z.string(), settings: z.record(z.string(), z.unknown()) })
                .nullable(),
            },
            annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          },
          async ({ task_limit, learning_limit }) => {
            const [openTasks, doneTasks, cards, profile] = await Promise.all([
              supabase
                .from('home_tasks')
                .select('id,title,notes,status,due_at,area,priority,created_at,updated_at')
                .eq('status', 'open')
                .order('due_at', { ascending: true, nullsFirst: false })
                .order('updated_at', { ascending: false })
                .limit(task_limit),
              supabase
                .from('home_tasks')
                .select('id,title,notes,status,due_at,area,priority,created_at,updated_at')
                .eq('status', 'done')
                .order('updated_at', { ascending: false })
                .limit(Math.min(task_limit, 20)),
              supabase
                .from('home_learning_cards')
                .select('id,title,topic,content,status,created_at,updated_at')
                .eq('status', 'active')
                .order('updated_at', { ascending: false })
                .limit(learning_limit),
              supabase.from('home_profiles').select('display_name,timezone,settings').maybeSingle(),
            ])

            for (const result of [openTasks, doneTasks, cards, profile]) {
              if (result.error) throw new Error(result.error.message)
            }

            const structuredContent = {
              open_tasks: openTasks.data ?? [],
              completed_tasks: doneTasks.data ?? [],
              learning_cards: cards.data ?? [],
              profile: profile.data ?? null,
            }
            return textResult(
              `HOME snapshot: ${structuredContent.open_tasks.length} open tasks and ${structuredContent.learning_cards.length} active learning cards.`,
              structuredContent,
            )
          },
        )

        server.registerTool(
          'list_tasks',
          {
            title: 'List HOME tasks',
            description:
              'List tasks stored in HOME for the signed-in user. Use when the user asks what is pending, completed, archived, due, or currently on their task list.',
            inputSchema: {
              status: z.enum(['open', 'done', 'archived', 'all']).default('open'),
              limit: z.number().int().min(1).max(100).default(50),
            },
            outputSchema: { tasks: z.array(z.object(taskShape)) },
            annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          },
          async ({ status, limit }) => {
            let query = supabase
              .from('home_tasks')
              .select('id,title,notes,status,due_at,area,priority,created_at,updated_at')
              .order('due_at', { ascending: true, nullsFirst: false })
              .order('updated_at', { ascending: false })
              .limit(limit)
            if (status !== 'all') query = query.eq('status', status)
            const { data, error } = await query
            if (error) throw new Error(error.message)
            const tasks = data ?? []
            return textResult(`Found ${tasks.length} HOME tasks.`, { tasks })
          },
        )

        server.registerTool(
          'create_task',
          {
            title: 'Create HOME task',
            description:
              'Create one task in HOME for the signed-in user. Use only when the user wants an actionable item saved. Keep the title concise and put context in notes.',
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
            const { data, error } = await supabase
              .from('home_tasks')
              .insert({ title, notes, due_at, area, priority })
              .select('id,title,notes,status,due_at,area,priority,created_at,updated_at')
              .single()
            if (error) throw new Error(error.message)
            return textResult(`Created HOME task “${data.title}”.`, { task: data })
          },
        )

        server.registerTool(
          'update_task',
          {
            title: 'Update HOME task',
            description:
              'Change fields on one existing HOME task. Use for edits such as title, notes, due time, area, priority, or status. Do not use this to silently complete a task.',
            inputSchema: {
              id: z.string().uuid(),
              title: z.string().trim().min(1).max(200).optional(),
              notes: z.string().max(4000).optional(),
              due_at: z.string().datetime({ offset: true }).nullable().optional(),
              area: z.string().trim().min(1).max(80).optional(),
              priority: z.number().int().min(0).max(3).optional(),
              status: statusSchema.optional(),
            },
            outputSchema: { task: z.object(taskShape) },
            annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
          },
          async ({ id, ...changes }) => {
            const patch: Record<string, unknown> = {}
            for (const [key, value] of Object.entries(changes)) {
              if (value !== undefined) patch[key] = value
            }
            if (Object.keys(patch).length === 0) throw new Error('No task changes were provided.')
            const { data, error } = await supabase
              .from('home_tasks')
              .update(patch)
              .eq('id', id)
              .select('id,title,notes,status,due_at,area,priority,created_at,updated_at')
              .maybeSingle()
            if (error) throw new Error(error.message)
            if (!data) throw new Error('Task not found.')
            return textResult(`Updated HOME task “${data.title}”.`, { task: data })
          },
        )

        server.registerTool(
          'complete_task',
          {
            title: 'Complete HOME task',
            description:
              'Mark one existing HOME task as done. Use only when the user explicitly says the task is completed or clearly asks to mark it complete.',
            inputSchema: { id: z.string().uuid() },
            outputSchema: { task: z.object(taskShape) },
            annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
          },
          async ({ id }) => {
            const { data, error } = await supabase
              .from('home_tasks')
              .update({ status: 'done' })
              .eq('id', id)
              .select('id,title,notes,status,due_at,area,priority,created_at,updated_at')
              .maybeSingle()
            if (error) throw new Error(error.message)
            if (!data) throw new Error('Task not found.')
            return textResult(`Marked HOME task “${data.title}” as done.`, { task: data })
          },
        )

        server.registerTool(
          'delete_task',
          {
            title: 'Delete HOME task',
            description:
              'Permanently delete one HOME task. Use only when the user explicitly wants the task removed rather than completed or archived.',
            inputSchema: { id: z.string().uuid() },
            outputSchema: { deleted_id: z.string(), title: z.string() },
            annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true },
          },
          async ({ id }) => {
            const { data, error } = await supabase
              .from('home_tasks')
              .delete()
              .eq('id', id)
              .select('id,title')
              .maybeSingle()
            if (error) throw new Error(error.message)
            if (!data) throw new Error('Task not found.')
            return textResult(`Deleted HOME task “${data.title}”.`, { deleted_id: data.id, title: data.title })
          },
        )

        server.registerTool(
          'list_learning_cards',
          {
            title: 'List HOME learning cards',
            description:
              'List the signed-in user’s HOME learning cards. Use for Tube Learning, recall practice, or reviewing active learning topics.',
            inputSchema: {
              status: z.enum(['active', 'completed', 'archived', 'all']).default('active'),
              limit: z.number().int().min(1).max(50).default(20),
            },
            outputSchema: { cards: z.array(z.object(cardShape)) },
            annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
          },
          async ({ status, limit }) => {
            let query = supabase
              .from('home_learning_cards')
              .select('id,title,topic,content,status,created_at,updated_at')
              .order('updated_at', { ascending: false })
              .limit(limit)
            if (status !== 'all') query = query.eq('status', status)
            const { data, error } = await query
            if (error) throw new Error(error.message)
            const cards = data ?? []
            return textResult(`Found ${cards.length} HOME learning cards.`, { cards })
          },
        )

        server.registerTool(
          'save_learning_card',
          {
            title: 'Save HOME learning card',
            description:
              'Save one concise learning card to HOME when the user wants to retain a concept for later Tube Learning or recall practice.',
            inputSchema: {
              title: z.string().trim().min(1).max(220),
              topic: z.string().trim().max(120).default(''),
              content: z.record(z.string(), z.unknown()).default({}),
            },
            outputSchema: { card: z.object(cardShape) },
            annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
          },
          async ({ title, topic, content }) => {
            const { data, error } = await supabase
              .from('home_learning_cards')
              .insert({ title, topic, content })
              .select('id,title,topic,content,status,created_at,updated_at')
              .single()
            if (error) throw new Error(error.message)
            return textResult(`Saved HOME learning card “${data.title}”.`, { card: data })
          },
        )

        server.registerTool(
          'save_learning_attempt',
          {
            title: 'Save HOME learning attempt',
            description:
              'Store the user’s own learning reflection and concise feedback after a meaningful recall or application attempt. ChatGPT should evaluate the answer before calling this tool.',
            inputSchema: {
              card_id: z.string().uuid().nullable().default(null),
              reflection: z.string().trim().min(1).max(4000),
              feedback: z.record(z.string(), z.unknown()).default({}),
              overall_score: z.number().int().min(0).max(100).nullable().default(null),
            },
            outputSchema: {
              attempt: z.object({
                id: z.string(),
                card_id: z.string().nullable(),
                reflection: z.string(),
                feedback: z.record(z.string(), z.unknown()),
                overall_score: z.number().int().nullable(),
                created_at: z.string(),
              }),
            },
            annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: false },
          },
          async ({ card_id, reflection, feedback, overall_score }) => {
            const { data, error } = await supabase
              .from('home_learning_attempts')
              .insert({ card_id, reflection, feedback, overall_score })
              .select('id,card_id,reflection,feedback,overall_score,created_at')
              .single()
            if (error) throw new Error(error.message)
            return textResult('Saved this HOME learning attempt.', { attempt: data })
          },
        )

        return server
      })

      return handler.fetch(req)
    }),
  ),
)
