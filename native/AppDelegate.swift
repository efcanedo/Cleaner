import AppKit
import Foundation

private final class ResponseBox: @unchecked Sendable { var isReady = false }

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var statusMenuItem: NSMenuItem!
    private var helperProcess: Process?
    private var readinessTimer: Timer?
    private var readinessAttempts = 0
    private let appURL = URL(string: "http://127.0.0.1:41842/")!
    private let healthURL = URL(string: "http://127.0.0.1:41842/api/health")!
    private let logURL = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Logs/Document Cleaner 1.1.log")

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)
        configureMenuBar()
        ensureServiceIsRunning()
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        openInterface()
        return false
    }

    func applicationWillTerminate(_ notification: Notification) {
        readinessTimer?.invalidate()
        stop(helperProcess)
    }

    private func configureMenuBar() {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        statusItem.button?.title = "✓ 1.1"
        statusItem.button?.toolTip = "Document Cleaner 1.1"
        let menu = NSMenu()
        let open = NSMenuItem(title: "Open Document Cleaner", action: #selector(openInterface), keyEquivalent: "o")
        open.target = self
        menu.addItem(open)
        statusMenuItem = NSMenuItem(title: "Starting…", action: nil, keyEquivalent: "")
        statusMenuItem.isEnabled = false
        menu.addItem(statusMenuItem)
        menu.addItem(.separator())
        let quit = NSMenuItem(title: "Quit Document Cleaner", action: #selector(quitApp), keyEquivalent: "q")
        quit.target = self
        menu.addItem(quit)
        statusItem.menu = menu
    }

    private func ensureServiceIsRunning() {
        if serviceIsReady(healthURL) { markReadyAndOpen(); return }
        guard let resources = Bundle.main.resourceURL else { showStartupError(); return }
        let node = resources.appendingPathComponent("runtime/node")
        let appDirectory = resources.appendingPathComponent("app")
        if !FileManager.default.fileExists(atPath: logURL.path) { FileManager.default.createFile(atPath: logURL.path, contents: nil) }
        guard let log = try? FileHandle(forWritingTo: logURL) else { showStartupError(); return }
        _ = try? log.seekToEnd()
        let process = Process()
        process.executableURL = node
        process.arguments = [appDirectory.appendingPathComponent("helper-server.mjs").path]
        process.currentDirectoryURL = appDirectory
        process.standardOutput = log
        process.standardError = log
        do { try process.run(); helperProcess = process } catch { showStartupError(); return }
        readinessAttempts = 0
        readinessTimer = Timer.scheduledTimer(timeInterval: 0.5, target: self, selector: #selector(checkReadiness(_:)), userInfo: nil, repeats: true)
        RunLoop.main.add(readinessTimer!, forMode: .common)
    }

    @objc private func checkReadiness(_ timer: Timer) {
        readinessAttempts += 1
        if serviceIsReady(healthURL) { timer.invalidate(); readinessTimer = nil; markReadyAndOpen() }
        else if readinessAttempts >= 90 { timer.invalidate(); readinessTimer = nil; showStartupError() }
    }

    private func serviceIsReady(_ url: URL) -> Bool {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 0.75
        let session = URLSession(configuration: configuration)
        let box = ResponseBox()
        let semaphore = DispatchSemaphore(value: 0)
        let task = session.dataTask(with: url) { _, response, _ in
            if let response = response as? HTTPURLResponse { box.isReady = (200..<400).contains(response.statusCode) }
            semaphore.signal()
        }
        task.resume()
        _ = semaphore.wait(timeout: .now() + 1.0)
        task.cancel()
        session.invalidateAndCancel()
        return box.isReady
    }

    private func markReadyAndOpen() {
        statusMenuItem.title = "Ready — outputs save to Downloads"
        openInterface()
    }

    @objc private func openInterface() { NSWorkspace.shared.open(appURL) }
    @objc private func quitApp() { NSApp.terminate(nil) }
    private func stop(_ process: Process?) { if let process, process.isRunning { process.terminate(); process.waitUntilExit() } }

    private func showStartupError() {
        statusMenuItem.title = "Could not start"
        let alert = NSAlert()
        alert.alertStyle = .critical
        alert.messageText = "Document Cleaner could not start"
        alert.informativeText = "Quit the app from the menu bar and open it again. If the problem continues, inspect Document Cleaner 1.1.log in Library/Logs."
        alert.runModal()
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.delegate = delegate
application.run()
