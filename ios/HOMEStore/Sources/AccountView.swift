import SwiftUI

struct AccountView: View {
    @ObservedObject var session: SessionStore
    @State private var email = ""
    @State private var password = ""
    @State private var createMode = false
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            Color(red: 0.067, green: 0.071, blue: 0.078).ignoresSafeArea()
            VStack(alignment: .leading, spacing: 22) {
                Spacer()
                Text("HOME").font(.system(size: 46, weight: .bold, design: .rounded))
                Text("Your adaptive personal operating system.")
                    .font(.title3.weight(.semibold)).foregroundStyle(.secondary)

                VStack(spacing: 12) {
                    TextField("Email", text: $email)
                        .textInputAutocapitalization(.never).keyboardType(.emailAddress)
                        .textContentType(.emailAddress).padding(14).background(.white.opacity(0.07)).clipShape(RoundedRectangle(cornerRadius: 15))
                    SecureField("Password (8+ characters)", text: $password)
                        .textContentType(createMode ? .newPassword : .password)
                        .padding(14).background(.white.opacity(0.07)).clipShape(RoundedRectangle(cornerRadius: 15))
                }

                if let error = session.errorMessage {
                    Text(error).font(.footnote).foregroundStyle(.red)
                }

                Button {
                    Task {
                        if createMode { await session.signUp(email: email, password: password) }
                        else { await session.signIn(email: email, password: password) }
                    }
                } label: {
                    HStack { Spacer(); if session.busy { ProgressView() } else { Text(createMode ? "Create HOME account" : "Sign in") }; Spacer() }
                        .fontWeight(.bold).padding(14)
                }
                .buttonStyle(.borderedProminent)
                .disabled(session.busy)

                Button(createMode ? "Already have an account? Sign in" : "New to HOME? Create account") {
                    session.errorMessage = nil
                    createMode.toggle()
                }
                .font(.footnote.weight(.semibold))

                HStack(spacing: 18) {
                    Button("Privacy") { openURL(session.privacyURL()) }
                    Button("Delete-account help") { openURL(session.deletionURL()) }
                }
                .font(.caption).foregroundStyle(.secondary)
                Spacer()
            }
            .padding(26)
            .frame(maxWidth: 520)
        }
    }
}
