import SwiftUI

@main
struct HOMEStoreApp: App {
    @StateObject private var session = SessionStore()

    var body: some Scene {
        WindowGroup {
            Group {
                if session.isSignedIn {
                    HomeWebView(session: session)
                        .ignoresSafeArea()
                } else {
                    AccountView(session: session)
                }
            }
            .preferredColorScheme(.dark)
        }
    }
}
