import Capacitor
import UIKit

/// Écran principal : branche la galerie et cache la barre d'état (plein écran).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GalleryPlugin())
    }

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
}
