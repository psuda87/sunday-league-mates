// Przygotowany adapter; brak projektu iOS. Dołączyć później przez Xcode.
import Capacitor
import FirebaseCore
import FirebaseMessaging

@objc(SlmFcmBridgePlugin)
public class SlmFcmBridgePlugin: CAPPlugin, CAPBridgedPlugin, MessagingDelegate {
    public let identifier = "SlmFcmBridgePlugin"
    public let jsName = "SlmFcmBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getToken", returnType: CAPPluginReturnPromise)
    ]
    public override func load() {
        // Firebase.configure() pozostaje w AppDelegate i jest warunkowe.
        if FirebaseApp.app() != nil {
            Messaging.messaging().isAutoInitEnabled = false
            Messaging.messaging().delegate = self
        }
    }
    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["configured": FirebaseApp.app() != nil])
    }
    @objc func getToken(_ call: CAPPluginCall) {
        guard FirebaseApp.app() != nil, Messaging.messaging().apnsToken != nil else {
            call.reject("FCM/APNs nie jest skonfigurowane")
            return
        }
        Messaging.messaging().isAutoInitEnabled = true
        Messaging.messaging().token { token, error in
            guard error == nil, let token = token else {
                call.reject("Nie można pobrać tokenu FCM")
                return
            }
            call.resolve(["token": token])
        }
    }
    @objc func disable(_ call: CAPPluginCall) {
        guard FirebaseApp.app() != nil else { call.resolve(); return }
        Messaging.messaging().isAutoInitEnabled = false
        Messaging.messaging().deleteToken { error in
            if error != nil { call.reject("Nie można wyrejestrować FCM") }
            else { call.resolve() }
        }
    }
    public func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else { return }
        notifyListeners("token", data: ["token": token], retainUntilConsumed: true)
    }
}
