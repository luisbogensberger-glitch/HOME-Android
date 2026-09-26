# HOME iOS Store client

This target is the App Store counterpart of the Android Store build. It uses the same authenticated HOME Store API and isolated user data model, keeps sessions in iOS Keychain, bridges the existing HOME web UI to native task sync and EventKit calendar access, and exposes privacy/account-deletion controls natively.

The Store validation workflow stages reviewed web assets into `Resources/Web` and deliberately excludes the private remote executable-JavaScript loader.
