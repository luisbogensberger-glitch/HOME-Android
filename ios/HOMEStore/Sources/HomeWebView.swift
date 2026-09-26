import SwiftUI
import WebKit
import EventKit
import UIKit

struct HomeWebView: UIViewRepresentable {
    @ObservedObject var session: SessionStore

    func makeCoordinator() -> Coordinator { Coordinator(session: session) }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default()
        config.userContentController.add(context.coordinator, name: "homeNative")
        config.userContentController.addUserScript(WKUserScript(source: Self.nativeShim, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let web = WKWebView(frame: .zero, configuration: config)
        web.isOpaque = false
        web.backgroundColor = UIColor(red: 0.067, green: 0.071, blue: 0.078, alpha: 1)
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.navigationDelegate = context.coordinator
        context.coordinator.webView = web
        if let url = Bundle.main.url(forResource: "index", withExtension: "html", subdirectory: "Web") {
            web.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        } else {
            web.loadHTMLString("<body style='background:#111214;color:white;font-family:system-ui;padding:30px'><h1>HOME</h1><p>Store web resources are missing from this build.</p></body>", baseURL: nil)
        }
        return web
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    private static let nativeShim = #"""
    (()=>{
      const post=(type,data={})=>window.webkit.messageHandlers.homeNative.postMessage({type,...data});
      window.__iosCalendarGranted=false;
      window.__iosCalendarEvents=[];
      window.Native={
        loadState:k=>{try{return localStorage.getItem('native:'+k)||''}catch(_){return''}},
        saveState:(k,v)=>{try{localStorage.setItem('native:'+k,String(v??''))}catch(_){}},
        hasNotionConnection:()=>true,
        configureNotion:()=>post('account'),
        disconnectNotion:()=>post('signOut'),
        requestNotionSync:()=>post('sync'),
        createNotionTask:title=>post('createTask',{title:String(title||'')}),
        setNotionTaskDone:(id,done)=>post('taskDone',{id:String(id||''),done:!!done}),
        requestCalendarPermission:()=>post('calendarPermission'),
        hasCalendarPermission:()=>window.__iosCalendarGranted===true,
        getCalendarEvents:(start,end)=>JSON.stringify((window.__iosCalendarEvents||[]).filter(e=>Number(e.end)>Number(start)&&Number(e.start)<Number(end))),
        openCalendarEvent:id=>post('openCalendarEvent',{id:String(id||'')}),
        openUrl:url=>post('openUrl',{url:String(url||'')})
      };
    })();
    """#

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let session: SessionStore
        weak var webView: WKWebView?
        private let events = EKEventStore()
        private var eventDates: [String: Date] = [:]

        init(session: SessionStore) { self.session = session }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "homeNative", let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
            switch type {
            case "sync": Task { await sync() }
            case "createTask":
                let title = (body["title"] as? String ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                if !title.isEmpty { Task { await createTask(title) } }
            case "taskDone":
                let id = body["id"] as? String ?? ""; let done = body["done"] as? Bool ?? false
                if !id.isEmpty { Task { await setTaskDone(id: id, done: done) } }
            case "calendarPermission": requestCalendar()
            case "openCalendarEvent": if let id = body["id"] as? String { openCalendar(id) }
            case "openUrl": if let raw = body["url"] as? String, let url = URL(string: raw), url.scheme == "https" || url.scheme == "mailto" { UIApplication.shared.open(url) }
            case "signOut": Task { @MainActor in session.signOut() }
            case "account": break
            default: break
            }
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                     decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            if navigationAction.navigationType == .linkActivated, let url = navigationAction.request.url,
               url.scheme == "https" || url.scheme == "mailto" {
                UIApplication.shared.open(url); decisionHandler(.cancel); return
            }
            decisionHandler(.allow)
        }

        @MainActor private func sync() async {
            do {
                let object = try await session.api(path: "/v1/snapshot", body: nil)
                emit("onNotionSnapshot", object)
            } catch { emit("onNotionSyncError", ["message": error.localizedDescription]) }
        }

        @MainActor private func createTask(_ title: String) async {
            do {
                let object = try await session.api(path: "/api/tasks", method: "POST", body: ["title": title])
                emit("onNotionTaskCreated", object)
            } catch { emit("onNotionSyncError", ["message": error.localizedDescription]) }
        }

        @MainActor private func setTaskDone(id: String, done: Bool) async {
            do {
                _ = try await session.api(path: "/api/tasks/\(id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id)", method: "PATCH", body: ["done": done])
                emit("onNotionTaskChanged", ["id": id, "done": done])
            } catch { emit("onNotionSyncError", ["message": error.localizedDescription]) }
        }

        private func requestCalendar() {
            if #available(iOS 17.0, *) {
                events.requestFullAccessToEvents { [weak self] granted, _ in DispatchQueue.main.async { self?.calendarResult(granted) } }
            }
        }

        private func calendarResult(_ granted: Bool) {
            guard granted else {
                evaluate("window.__iosCalendarGranted=false;window.onCalendarPermissionResult&&window.onCalendarPermissionResult(false)")
                return
            }
            let start = Calendar.current.date(byAdding: .month, value: -3, to: Date()) ?? Date()
            let end = Calendar.current.date(byAdding: .year, value: 2, to: Date()) ?? Date().addingTimeInterval(63072000)
            let predicate = events.predicateForEvents(withStart: start, end: end, calendars: nil)
            let found = events.events(matching: predicate)
            eventDates = Dictionary(uniqueKeysWithValues: found.map { ($0.eventIdentifier ?? UUID().uuidString, $0.startDate) })
            let payload: [[String: Any]] = found.map { event in
                ["id": event.eventIdentifier ?? "", "title": event.title ?? "Untitled", "start": event.startDate.timeIntervalSince1970 * 1000,
                 "end": event.endDate.timeIntervalSince1970 * 1000, "allDay": event.isAllDay, "location": event.location ?? ""]
            }
            let json = jsonString(payload)
            evaluate("window.__iosCalendarGranted=true;window.__iosCalendarEvents=\(json);window.onCalendarPermissionResult&&window.onCalendarPermissionResult(true);window.updateHome&&window.updateHome()")
        }

        private func openCalendar(_ id: String) {
            guard let date = eventDates[id], let url = URL(string: "calshow:\(date.timeIntervalSinceReferenceDate)") else { return }
            UIApplication.shared.open(url)
        }

        @MainActor private func emit(_ name: String, _ value: Any) {
            evaluate("window.\(name)&&window.\(name)(\(jsonString(value)))")
        }

        private func evaluate(_ script: String) { webView?.evaluateJavaScript(script) }

        private func jsonString(_ value: Any) -> String {
            guard JSONSerialization.isValidJSONObject(value), let data = try? JSONSerialization.data(withJSONObject: value),
                  let string = String(data: data, encoding: .utf8) else { return "{}" }
            return string
        }
    }
}
