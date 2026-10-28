import AVFoundation
import Capacitor
import Photos
import UIKit

/// Photo Roulette : pioche des photos (ou vidéos) au hasard dans toute la photothèque.
@objc(GalleryPlugin)
public class GalleryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GalleryPlugin"
    public let jsName = "Gallery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "random", returnType: CAPPluginReturnPromise)
    ]

    @objc func random(_ call: CAPPluginCall) {
        let count = call.getInt("count") ?? 3
        let video = call.getBool("video") ?? false
        let done: (Bool) -> Void = { ok in
            guard ok else {
                call.reject("Autorisation refusée")
                return
            }
            DispatchQueue.global(qos: .userInitiated).async {
                call.resolve(["items": self.pick(count: count, video: video)])
            }
        }
        if #available(iOS 14, *) {
            PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
                done(status == .authorized || status == .limited)
            }
        } else {
            PHPhotoLibrary.requestAuthorization { status in
                done(status == .authorized)
            }
        }
    }

    private func pick(count: Int, video: Bool) -> [[String: String]] {
        let res = PHAsset.fetchAssets(with: video ? .video : .image, options: nil)
        let mgr = PHImageManager.default()
        var items: [[String: String]] = []
        for i in Array(0..<res.count).shuffled() {
            if items.count >= count { break }
            let a = res.object(at: i)
            if video {
                if a.duration > 20 { continue }
                let o = PHVideoRequestOptions()
                o.isNetworkAccessAllowed = true
                o.deliveryMode = .mediumQualityFormat
                let sem = DispatchSemaphore(value: 0)
                var data: Data?
                var mime = "video/mp4"
                mgr.requestAVAsset(forVideo: a, options: o) { av, _, _ in
                    if let u = (av as? AVURLAsset)?.url {
                        data = try? Data(contentsOf: u)
                        if u.pathExtension.lowercased() == "mov" { mime = "video/quicktime" }
                    }
                    sem.signal()
                }
                sem.wait()
                if let d = data, d.count <= 8 * 1024 * 1024 {
                    items.append(["data": d.base64EncodedString(), "mime": mime])
                }
            } else {
                let o = PHImageRequestOptions()
                o.isSynchronous = true
                o.isNetworkAccessAllowed = true
                o.deliveryMode = .highQualityFormat
                o.resizeMode = .exact
                var img: UIImage?
                mgr.requestImage(for: a, targetSize: CGSize(width: 960, height: 960), contentMode: .aspectFit, options: o) { im, _ in
                    img = im
                }
                if let j = img?.jpegData(compressionQuality: 0.82) {
                    items.append(["data": j.base64EncodedString(), "mime": "image/jpeg"])
                }
            }
        }
        return items
    }
}
