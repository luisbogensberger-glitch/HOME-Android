import SwiftUI

@main
struct HOMEStoreApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isSignedIn {
                    HomeShellView(session: session)
                } else {
                    AccountView(session: session)
                }
            }
            .preferredColorScheme(.dark)
        }
    }
}
