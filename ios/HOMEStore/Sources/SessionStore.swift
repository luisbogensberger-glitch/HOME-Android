import Foundation
import Security

@MainActor
final class SessionStore: ObservableObject {
    struct Session: Codable {
        var accessToken: String
        var refreshToken: String
        var email: String
        var expiresAt: Date
    }

    @Published private(set) var session: Session?
    @Published var errorMessage: String?
    @Published var busy = false

    private let service = "com.veqrya.app.session"
    private let account = "veqrya-session"

    init() {
        session = loadKeychain()
    }

    var isSignedIn: Bool { session != nil }
    var email: String { session?.email ?? "" }

    private var apiURL: URL {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "HOME_API_URL") as? String,
              let url = URL(string: raw), url.scheme == "https" else { fatalError("Veqrya API URL missing") }
        return url
    }
    private var supabaseURL: URL {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "HOME_SUPABASE_URL") as? String,
              let url = URL(string: raw), url.scheme == "https" else { fatalError("Veqrya authentication URL missing") }
        return url
    }
    private var anonKey: String {
        guard let value = Bundle.main.object(forInfoDictionaryKey: "HOME_SUPABASE_ANON_KEY") as? String,
              value.count > 20 else { fatalError("Veqrya authentication key missing") }
        return value
    }

    func signIn(email: String, password: String) async {
        await authenticate(path: "/auth/v1/token?grant_type=password", email: email, password: password, create: false)
    }

    func signUp(email: String, password: String) async {
        await authenticate(path: "/auth/v1/signup", email: email, password: password, create: true)
    }

    private func authenticate(path: String, email: String, password: String, create: Bool) async {
        let cleanEmail = email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        guard cleanEmail.contains("@") else { errorMessage = "Enter a valid email address."; return }
        guard password.count >= 8 else { errorMessage = "Password must contain at least 8 characters."; return }
        busy = true; errorMessage = nil
        defer { busy = false }
        do {
            let result = try await supabase(path: path, body: ["email": cleanEmail, "password": password], bearer: nil)
            guard let access = result["access_token"] as? String,
                  let refresh = result["refresh_token"] as? String else {
                if create { throw VeqryaError.message("Account created. Confirm your email, then sign in.") }
                throw VeqryaError.message("Authentication did not return a session.")
            }
            let expires = (result["expires_in"] as? NSNumber)?.doubleValue ?? 3600
            let user = result["user"] as? [String: Any]
            let returnedEmail = (user?["email"] as? String) ?? cleanEmail
            let newSession = Session(accessToken: access, refreshToken: refresh, email: returnedEmail,
                                     expiresAt: Date().addingTimeInterval(max(60, expires)))
            try saveKeychain(newSession)
            session = newSession
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func signOut() {
        deleteKeychain()
        session = nil
    }

    func deleteAccount() async throws {
        _ = try await api(path: "/api/account", method: "DELETE", body: nil)
        signOut()
    }

    func privacyURL() -> URL { apiURL.appending(path: "privacy") }
    func deletionURL() -> URL { apiURL.appending(path: "delete-account") }

    func api(path: String, method: String = "GET", body: [String: Any]?) async throws -> Any {
        let token = try await accessToken()
        var request = URLRequest(url: URL(string: path, relativeTo: apiURL)!)
        request.httpMethod = method
        request.timeoutInterval = 35
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        var (data, response) = try await URLSession.shared.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            _ = try await refresh(force: true)
            let retry = try await accessToken()
            request.setValue("Bearer \(retry)", forHTTPHeaderField: "Authorization")
            (data, response) = try await URLSession.shared.data(for: request)
        }
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw parseError(data, fallback: "Veqrya request failed")
        }
        if data.isEmpty { return [:] }
        return try JSONSerialization.jsonObject(with: data)
    }

    private func accessToken() async throws -> String {
        guard let current = session else { throw VeqryaError.message("Sign in to Veqrya first.") }
        if current.expiresAt > Date().addingTimeInterval(90) { return current.accessToken }
        return try await refresh(force: false)
    }

    private func refresh(force: Bool) async throws -> String {
        guard let current = session else { throw VeqryaError.message("Sign in to Veqrya first.") }
        if !force, current.expiresAt > Date().addingTimeInterval(90) { return current.accessToken }
        let result = try await supabase(path: "/auth/v1/token?grant_type=refresh_token",
                                        body: ["refresh_token": current.refreshToken], bearer: nil)
        guard let access = result["access_token"] as? String,
              let refreshToken = result["refresh_token"] as? String else {
            signOut(); throw VeqryaError.message("Your Veqrya session expired. Sign in again.")
        }
        let expires = (result["expires_in"] as? NSNumber)?.doubleValue ?? 3600
        let refreshed = Session(accessToken: access, refreshToken: refreshToken, email: current.email,
                                expiresAt: Date().addingTimeInterval(max(60, expires)))
        try saveKeychain(refreshed)
        session = refreshed
        return access
    }

    private func supabase(path: String, body: [String: Any], bearer: String?) async throws -> [String: Any] {
        var request = URLRequest(url: URL(string: path, relativeTo: supabaseURL)!)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.setValue(anonKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json; charset=utf-8", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let bearer { request.setValue("Bearer \(bearer)", forHTTPHeaderField: "Authorization") }
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw parseError(data, fallback: "Authentication failed")
        }
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    private func parseError(_ data: Data, fallback: String) -> Error {
        if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
            let message = (object["error"] as? String) ?? (object["message"] as? String) ?? (object["msg"] as? String)
            if let message, !message.isEmpty { return VeqryaError.message(message) }
        }
        return VeqryaError.message(fallback)
    }

    private func saveKeychain(_ value: Session) throws {
        let data = try JSONEncoder().encode(value)
        deleteKeychain()
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
            kSecValueData as String: data
        ]
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else { throw VeqryaError.message("Could not securely save the Veqrya session.") }
    }

    private func loadKeychain() -> Session? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return nil }
        return try? JSONDecoder().decode(Session.self, from: data)
    }

    private func deleteKeychain() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum VeqryaError: LocalizedError {
    case message(String)
    var errorDescription: String? { if case let .message(message) = self { return message }; return "Veqrya error" }
}
