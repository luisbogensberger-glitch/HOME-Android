import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6'

const HOME_API = 'https://luis-home-sync.luisbogensberger.workers.dev'
const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com'
const GITHUB_AUDIENCE = 'home-learning-ingest'
const GITHUB_REPOSITORY = 'luisbogensberger-glitch/HOME-Android'
const GITHUB_JWKS = createRemoteJWKSet(new URL('https://token.actions.githubusercontent.com/.well-known/jwks'))
const JSON_HEADERS = {'content-type':'application/json; charset=utf-8','cache-control':'no-store'}
const out = (status:number, body:unknown) => new Response(JSON.stringify(body), {status, headers:JSON_HEADERS})
const txt = (v:unknown,max:number) => String(v ?? '').trim().slice(0,max)

async function validGithubOidc(auth:string){
  if(!auth.startsWith('Bearer ')) return false
  const token=auth.slice(7).trim()
  if(token.split('.').length !== 3) return false
  try{
    const {payload}=await jwtVerify(token,GITHUB_JWKS,{issuer:GITHUB_ISSUER,audience:GITHUB_AUDIENCE})
    const event=String(payload.event_name ?? '')
    return payload.repository === GITHUB_REPOSITORY
      && payload.ref === 'refs/heads/main'
      && ['push','schedule','workflow_dispatch'].includes(event)
  }catch(_){return false}
}

async function validHomeToken(auth:string){
  if(!auth.startsWith('Bearer ') || auth.length < 24 || auth.length > 800) return false
  try{
    const r = await fetch(HOME_API + '/api/tasks', {headers:{authorization:auth,accept:'application/json'}, signal:AbortSignal.timeout(9000)})
    return r.status === 200
  }catch(_){return false}
}

const allowedBehaviour = (kind:string) => {
  if(['behavior_summary','screen_dwell','screen_open','ui_usage_summary','insights_open','insights_node_open','todo_open','todo_complete','todo_add','tube_card_open','tube_complete','gym_open','gym_start','gym_complete','gym_plan_select','behavior_ui_decision','adaptive_profile_updated','habit_intervention','todo_pressure_show','todo_pressure_dismiss','notification_plan','private_text_field','private_home_context'].includes(kind)) return true
  return /^(behaviour_|behavior_|ui_press|screen_|session_|field_activity|learning_|semantic_|runtime_|remote_|vbrain_|live_|notification_|device_command_|private_|tube_)/.test(kind)
}

Deno.serve(async (req:Request) => {
  if(req.method !== 'POST') return out(405,{error:'Method not allowed'})
  const auth = req.headers.get('authorization') || ''
  const authorized = await validGithubOidc(auth) || await validHomeToken(auth)
  if(!authorized) return out(401,{error:'Unauthorized'})

  let body:any
  try{body=await req.json()}catch(_){return out(400,{error:'Invalid JSON'})}
  const attempts = Array.isArray(body?.attempts) ? body.attempts.slice(0,200) : []
  const activity = Array.isArray(body?.activity) ? body.activity.slice(0,500) : []

  const learningRows:any[]=[]
  for(const a of attempts){
    const reflection=txt(a?.reflection ?? a?.sentence,4000)
    const id=txt(a?.id,220)
    if(!id || !reflection) continue
    const at = Number(a?.at || 0)
    learningRows.push({
      id,
      source:txt(a?.source || 'home-sync',80) || 'home-sync',
      card_id:txt(a?.cardId ?? a?.card_id,180) || null,
      title:txt(a?.title,260) || null,
      topic:txt(a?.topic,160) || null,
      prompt:txt(a?.prompt ?? a?.question,1600) || null,
      reflection,
      selected:Number.isInteger(a?.selected)?a.selected:null,
      correct:Number.isInteger(a?.correct)?a.correct:null,
      quiz_correct:typeof a?.quizCorrect === 'boolean' ? a.quizCorrect : (Number.isInteger(a?.selected)&&Number.isInteger(a?.correct)?a.selected===a.correct:null),
      learning_method:txt(a?.method ?? a?.learningMethod,100) || null,
      content_depth:txt(a?.contentDepth,100) || null,
      review_status:txt(a?.reviewStatus,80) || (a?.semanticReview?'reviewed':'pending'),
      semantic_review:a?.semanticReview ?? a?.review ?? null,
      source_created_at: at > 0 ? new Date(at).toISOString() : (txt(a?.createdAt,80) || null),
      payload:{reviewedAt:a?.semanticReviewedAt ?? a?.reviewedAt ?? null, semanticModel:txt(a?.semanticModel,100) || null, quizCorrect:typeof a?.quizCorrect==='boolean'?a.quizCorrect:null}
    })
  }

  const behaviourRows:any[]=[]
  for(const a of activity){
    const id=txt(a?.id,220)
    const kind=txt(a?.kind ?? a?.type,120)
    if(!id || !kind || !allowedBehaviour(kind)) continue
    const at=Number(a?.at || 0)
    const created=at>0 ? new Date(at).toISOString() : (txt(a?.createdAt,80) || null)
    const payload:any={
      screen:txt(a?.screen,100) || null,
      data:(()=>{const d=(a?.data && typeof a.data==='object' && !Array.isArray(a.data)) ? {...a.data} : {}; if(kind==='private_text_field'||kind==='private_home_context'){for(const k of ['text','field','fieldType','reason','cardId','title','taskId']) if(a?.[k] != null) d[k]=a[k];} return d;})(),
      source:txt(a?.source,80) || 'home-sync'
    }
    behaviourRows.push({id,kind,payload,source_created_at:created,synced_at:new Date().toISOString()})
  }

  if(!learningRows.length && !behaviourRows.length) return out(200,{ok:true,upserted:0,activityUpserted:0})

  const url=Deno.env.get('SUPABASE_URL')!
  const key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}})
  if(learningRows.length){
    const {error}=await supabase.from('home_learning_stream').upsert(learningRows,{onConflict:'id'})
    if(error) return out(500,{error:error.message})
  }
  if(behaviourRows.length){
    const {error}=await supabase.from('home_behavior_stream').upsert(behaviourRows,{onConflict:'id'})
    if(error) return out(500,{error:error.message})
  }
  return out(200,{ok:true,upserted:learningRows.length,activityUpserted:behaviourRows.length})
})

