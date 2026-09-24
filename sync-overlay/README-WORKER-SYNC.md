# HOME Worker Sync

Backend: `https://luis-home-sync.luisbogensberger.workers.dev`

The Android app should store the HOME token only in Android Keystore-backed encrypted storage and send it as a Bearer token to the Cloudflare Worker. The Worker persists tasks, learning cards, quiz attempts and activity in D1.

This branch introduces `WorkerSync.java` and will replace the old Notion-specific sync bridge in `MainActivity.java`.
