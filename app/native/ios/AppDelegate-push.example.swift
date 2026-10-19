// Fragmenty do późniejszego połączenia z istniejącym AppDelegate, nie drugi delegate.
// NIEPRZETESTOWANE; wymagają FirebaseCore, FirebaseMessaging i capabilities APNs.
import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging

func configureOptionalFirebase() {
    if FirebaseApp.app() == nil,
       Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
        FirebaseApp.configure()
        Messaging.messaging().isAutoInitEnabled = false
    }
}
// W application(_:didFinishLaunchingWithOptions:) wywołać configureOptionalFirebase().
// Zarejestrować SlmFcmBridgePlugin w używanym CAPBridgeViewController.
// Poniższe metody wstawić DO istniejącej klasy AppDelegate:
/*
func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    if FirebaseApp.app() != nil { Messaging.messaging().apnsToken = deviceToken }
    NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
}
func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
}
*/
