# V-Brain mit Google verbinden

Die Android-Erweiterung ist eingebaut und mit simulierten Google-Antworten geprüft. Eine echte Verbindung ist erst nach der Google-Freigabe auf dem Handy bestätigt. Die bestehende ChatGPT-Kalenderverbindung erteilt der Android-App keine Berechtigung.

## Einmalig in Google Cloud

1. Öffne die [Google Cloud Console](https://console.cloud.google.com/) mit deinem Google-Konto und wähle ein eigenes Projekt für V-Brain.
2. Aktiviere im selben Projekt die [Google Tasks API](https://console.cloud.google.com/apis/library/tasks.googleapis.com) und die [Google Calendar API](https://console.cloud.google.com/apis/library/calendar-json.googleapis.com).
3. Richte unter **Google Auth Platform → Branding** den Namen „V-Brain“ und deine eigenen Kontaktangaben ein. Für einen ersten Test mit einem persönlichen Google-Konto: **Audience → External → Testing**, danach dein Konto als Testnutzer eintragen. Testing-Autorisierungen laufen nach sieben Tagen ab. Für täglichen persönlichen Betrieb nach dem Verbindungstest unter **Audience → Publish app / In production** wechseln und V-Brain erneut verbinden. Google sieht für reine persönliche Nutzung eine Ausnahme von der Verifizierung vor; dabei kann ein Hinweis auf die unverifizierte App erscheinen.
4. Unter **Data Access** diese Berechtigungen eintragen:
   - `https://www.googleapis.com/auth/tasks`
   - `https://www.googleapis.com/auth/calendar.readonly`
5. Unter [Clients](https://console.cloud.google.com/auth/clients) einen Client vom Typ **Android** erstellen:

| Feld | Wert |
| --- | --- |
| Name | V-Brain Android |
| Package name | `com.luis.home` |
| SHA-1 certificate fingerprint | `1F:5A:1A:9C:B8:6C:FD:1F:04:DE:97:82:00:82:5F:23:5B:0E:EE:0A` |

Der Fingerabdruck stammt aus der geprüften APK mit dem bisherigen V-Brain-Signierschlüssel. Die App ruft Google direkt über Play Services auf; für diesen Weg muss kein Client-Secret in V-Brain eingefügt werden.

## Auf dem Handy

1. Die neue **V-Brain-STABLE.apk** über die vorhandene App installieren. Die vorherige App muss dafür nicht deinstalliert werden.
2. V-Brain öffnen → **To-Dos → Connect Google**. Konto auswählen und Tasks-Zugriff sowie Kalender-Lesezugriff freigeben.
3. Auf **Google Tasks · synced** warten. Die Auswahl neben dem Sync-Button bestimmt die Google-Liste für neue Aufgaben. Vorhandene Listen werden eingelesen; aktuelle noch lokale Aufgaben werden nach dem ersten erfolgreichen Einlesen übertragen. Zurückgehaltene ältere Importe werden nicht gesammelt übertragen.

## Die echte Verbindung prüfen

- Eine Aufgabe in V-Brain anlegen und in Google Tasks prüfen.
- Dieselbe Aufgabe in Google Tasks umbenennen oder abschließen; in V-Brain **Sync Google** antippen.
- Eine Notiz und ein Datum in V-Brain ändern; die Änderungen in Google Tasks prüfen.
- Einen Termin in Google Calendar ändern oder löschen; V-Brain synchronisieren und den Kalender öffnen.

Bei geöffneter App erfolgt der automatische Abgleich ungefähr alle 45 Sekunden sowie beim Wiederöffnen. Android führt Hintergrundabgleiche ungefähr alle 15 Minuten aus und kann sie wegen Energiesparregeln verschieben. Das ist kein sofortiger Push-Dienst.

Offline bleiben Aufgaben, Notizen und zuletzt geladene Termine verfügbar. Aufgabenänderungen warten dauerhaft auf den nächsten erfolgreichen Abgleich. Gelöschte Google-Aufgaben werden nicht automatisch wieder angelegt; gespeicherte Notizen findest du unter **Removed on Google · recover saved notes**. **Restore as new** legt auf deinen Wunsch eine neue Aufgabe an.

## Quellen zur Einrichtung

- [Google: Android-Autorisierung und Client-Registrierung](https://developer.android.com/identity/authorization)
- [Google: Android-OAuth-Client mit Package und SHA-1 erstellen](https://developers.google.com/workspace/guides/create-credentials#android)
- [Google: OAuth-Veröffentlichungsstatus](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview)
- [Google: Ausnahmen für persönliche Nutzung](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
