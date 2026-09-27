"""Patch the reconstructed Android WorkerSync for V-Brain 18 data-sync hardening.

The base Android project is reconstructed from the historical payload at build time, then the
current overlay is copied on top. Keeping this transformation explicit makes the migration
repeatable while preserving the stable signer/update path.
"""
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "src/luis-home-app/app/src/main/java/com/luis/home/WorkerSync.java")
s = path.read_text()

old = '''            connection.setRequestProperty("Authorization", "Bearer " + token);\n            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");'''
new = '''            boolean supabaseFunction = url.startsWith("https://skgmgxthymnzubbobqxu.supabase.co/functions/v1/");\n            if (supabaseFunction) connection.setRequestProperty("X-HOME-Authorization", "Bearer " + token);\n            else connection.setRequestProperty("Authorization", "Bearer " + token);\n            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");'''
if old not in s:
    raise SystemExit("WorkerSync auth anchor not found")
s = s.replace(old, new, 1)

old = '''    int pendingOutboxCount() { return readOutbox().length(); }\n\n    JSONObject syncStatus() {\n        JSONObject out=new JSONObject();\n        try {\n            android.content.SharedPreferences p=context.getSharedPreferences("vbrain_sync",Context.MODE_PRIVATE);\n            out.put("configured",isConfigured()).put("pending",pendingOutboxCount())\n               .put("lastSyncedAt",p.getLong("lastSyncedAt",0)).put("lastError",p.getString("lastError",""));\n        } catch(Exception ignored) { }\n        return out;\n    }\n\n    void flushOutbox() {\n        if (!isConfigured() || !flushing.compareAndSet(false, true)) return;\n        long deadline=System.currentTimeMillis()+40000;\n        try {\n            JSONArray rows = readOutbox();'''
new = '''    int pendingOutboxCount() { return readOutbox().length(); }\n\n    private int pendingUserOutboxCount() {\n        JSONArray rows=readOutbox(); int n=0;\n        for(int i=0;i<rows.length();i++){\n            JSONObject row=rows.optJSONObject(i); if(row==null)continue;\n            String type=row.optString("type");\n            if("task".equals(type)||"attempt".equals(type)||"private_activity".equals(type)||"command_ack".equals(type))n++;\n        }\n        return n;\n    }\n\n    private int pendingTelemetryCount() {\n        JSONArray rows=readOutbox(); int n=0;\n        for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null&&"activity".equals(row.optString("type")))n++;}\n        return n;\n    }\n\n    /** Preserve user content, but compact disposable high-volume telemetry and put user writes first. */\n    private JSONArray compactAndPrioritizeOutbox() {\n        try {\n            synchronized(outboxLock){\n                JSONArray rows=readOutbox(), critical=new JSONArray(), telemetry=new JSONArray();\n                for(int i=0;i<rows.length();i++){\n                    JSONObject row=rows.optJSONObject(i); if(row==null)continue;\n                    if("activity".equals(row.optString("type"))) telemetry.put(row); else critical.put(row);\n                }\n                JSONArray result=new JSONArray();\n                for(int i=0;i<critical.length();i++){JSONObject row=critical.optJSONObject(i);if(row!=null)result.put(row);}\n                int start=Math.max(0,telemetry.length()-120);\n                for(int i=start;i<telemetry.length();i++){JSONObject row=telemetry.optJSONObject(i);if(row!=null)result.put(row);}\n                if(result.length()!=rows.length() || critical.length()>0) writeOutbox(result);\n                return result;\n            }\n        } catch(Exception ignored) { return readOutbox(); }\n    }\n\n    JSONObject syncStatus() {\n        JSONObject out=new JSONObject();\n        try {\n            android.content.SharedPreferences p=context.getSharedPreferences("vbrain_sync",Context.MODE_PRIVATE);\n            int user=pendingUserOutboxCount(), telemetry=pendingTelemetryCount();\n            out.put("configured",isConfigured()).put("pending",user).put("pendingUser",user)\n               .put("pendingTelemetry",telemetry).put("pendingTotal",user+telemetry)\n               .put("lastSyncedAt",p.getLong("lastSyncedAt",0)).put("lastError",p.getString("lastError",""));\n        } catch(Exception ignored) { }\n        return out;\n    }\n\n    void flushOutbox() {\n        if (!isConfigured() || !flushing.compareAndSet(false, true)) return;\n        long deadline=System.currentTimeMillis()+40000;\n        try {\n            JSONArray rows = compactAndPrioritizeOutbox();'''
if old not in s:
    raise SystemExit("WorkerSync outbox anchor not found")
s = s.replace(old, new, 1)

path.write_text(s)
print(f"Patched {path}: Supabase HOME auth + user-first compact sync queue")
