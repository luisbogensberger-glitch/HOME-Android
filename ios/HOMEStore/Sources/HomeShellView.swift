import SwiftUI

struct HomeShellView: View {
    @ObservedObject var session: SessionStore
    @State private var showDelete = false
    @State private var deleteError: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack(alignment: .topTrailing) {
            HomeWebView(session: session).ignoresSafeArea()
            Menu {
                if !session.email.isEmpty { Text(session.email) }
                Button("Privacy policy") { openURL(session.privacyURL()) }
                Button("Account deletion help") { openURL(session.deletionURL()) }
                Button("Sign out") { session.signOut() }
                Button("Delete account", role: .destructive) { showDelete = true }
            } label: {
                Image(systemName: "person.crop.circle")
                    .font(.system(size: 20, weight: .semibold))
                    .frame(width: 42, height: 42)
                    .background(.black.opacity(0.55), in: Circle())
                    .foregroundStyle(.white)
            }
            .padding(.top, 8).padding(.trailing, 12)
        }
        .alert("Delete Veqrya account?", isPresented: $showDelete) {
            Button("Cancel", role: .cancel) {}
            Button("Delete permanently", role: .destructive) {
                Task {
                    do { try await session.deleteAccount() }
                    catch { deleteError = error.localizedDescription }
                }
            }
        } message: {
            Text("This permanently deletes your Veqrya account, tasks, learning progress and associated Veqrya data.")
        }
        .alert("Could not delete account", isPresented: Binding(get: { deleteError != nil }, set: { if !$0 { deleteError = nil } })) {
            Button("OK", role: .cancel) { deleteError = nil }
        } message: { Text(deleteError ?? "Try again.") }
    }
}
