import SwiftUI

struct HomeShellView: View {
    @ObservedObject var session: SessionStore
    @State private var showDelete = false
    @State private var showAIConnections = false
    @State private var deleteError: String?
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack(alignment: .topTrailing) {
            HomeWebView(session: session).ignoresSafeArea()
            Menu {
                if !session.email.isEmpty { Text(session.email) }
                Button("AI connections") { showAIConnections = true }
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
        .sheet(isPresented: $showAIConnections) {
            AIConnectionsView()
                .preferredColorScheme(.dark)
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

private struct AIConnectionsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.openURL) private var openURL

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        Image(systemName: "sparkles")
                            .font(.title2)
                            .frame(width: 36, height: 36)
                        VStack(alignment: .leading, spacing: 3) {
                            Text("ChatGPT").font(.headline)
                            Text("Veqrya connector ready")
                                .font(.caption)
                                .foregroundStyle(.green)
                        }
                        Spacer()
                        Button("Open") {
                            if let url = URL(string: "https://chatgpt.com/") { openURL(url) }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                } footer: {
                    Text("Use the same Veqrya account when connecting the Veqrya connector in ChatGPT. Tasks and learning data then come from the same account-isolated Supabase data plane.")
                }

                Section("Next providers") {
                    Label("Claude · planned", systemImage: "circle.dashed")
                    Label("Gemini · planned", systemImage: "circle.dashed")
                }

                Section {
                    Text("Veqrya does not ask you to paste an AI API key into the app and does not bill model usage on your behalf.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("AI connections")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}
