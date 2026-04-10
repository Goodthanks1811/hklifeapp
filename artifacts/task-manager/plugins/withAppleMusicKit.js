const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Adds AppleMusicKitModule.swift directly to the main app target (HKLifeApp)
 * so it compiles in the same Swift module as ExpoModulesProvider.swift.
 * No cross-target imports needed. No xcode package API calls — pure string
 * manipulation on project.pbxproj so there are no API compatibility issues.
 *
 * patch-expo-modules-provider.js (called from expo-configure-project.sh via
 * ensure-local-modules.js) then injects AppleMusicKitModule.self into the
 * ExpoModulesProvider.swift generated at Xcode build time.
 */

const SWIFT_FILENAME = 'AppleMusicKitModule.swift';

// Deterministic 24-char hex UUIDs — stable across builds.
const FILE_UUID  = 'AA11BB22CC33DD44EE55FF01';
const BUILD_UUID = 'AA11BB22CC33DD44EE55FF02';

const SWIFT_CONTENT = `import ExpoModulesCore
import MediaPlayer
import AVFoundation
import UIKit

public class AppleMusicKitModule: Module {

  private static var remoteCommandsRegistered = false
  // Notification tokens — retained so observers stay alive for the module's lifetime
  private var nowPlayingObserver: NSObjectProtocol?
  private var stateObserver: NSObjectProtocol?

  deinit {
    if let o = nowPlayingObserver { NotificationCenter.default.removeObserver(o) }
    if let o = stateObserver      { NotificationCenter.default.removeObserver(o) }
  }

  private func activateAudioSession() {
    do {
      try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [])
      try AVAudioSession.sharedInstance().setActive(true)
    } catch {}
  }

  private func registerRemoteCommands() {
    guard !AppleMusicKitModule.remoteCommandsRegistered else { return }
    AppleMusicKitModule.remoteCommandsRegistered = true
    let cc = MPRemoteCommandCenter.shared()
    let player = MPMusicPlayerController.applicationQueuePlayer
    cc.playCommand.isEnabled  = true
    cc.pauseCommand.isEnabled = true
    cc.nextTrackCommand.isEnabled     = true
    cc.previousTrackCommand.isEnabled = true
    cc.changePlaybackPositionCommand.isEnabled = true
    cc.playCommand.addTarget  { _ in player.play();  return .success }
    cc.pauseCommand.addTarget { _ in player.pause(); return .success }
    cc.nextTrackCommand.addTarget     { _ in player.skipToNextItem();     return .success }
    cc.previousTrackCommand.addTarget { _ in player.skipToPreviousItem(); return .success }
    cc.changePlaybackPositionCommand.addTarget { event in
      if let e = event as? MPChangePlaybackPositionCommandEvent {
        player.currentPlaybackTime = e.positionTime
      }
      return .success
    }
  }

  // ── Now Playing observers ────────────────────────────────────────────────────
  // applicationQueuePlayer auto-populates MPNowPlayingInfoCenter with the Apple
  // Music catalog artwork immediately after play() is called, overwriting whatever
  // we set. We observe track changes and playback state changes, then re-assert
  // our own info 300 ms later (after the system's automatic update has landed).
  private func registerNowPlayingObservers() {
    guard nowPlayingObserver == nil else { return }
    let player = MPMusicPlayerController.applicationQueuePlayer
    player.beginGeneratingPlaybackNotifications()

    nowPlayingObserver = NotificationCenter.default.addObserver(
      forName: .MPMusicPlayerControllerNowPlayingItemDidChange,
      object: player,
      queue: .main
    ) { [weak self] _ in
      // 300 ms delay: fires after applicationQueuePlayer's automatic MPNowPlayingInfoCenter update
      DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
        guard let item = player.nowPlayingItem else { return }
        self?.assertNowPlaying(item: item, player: player)
      }
    }

    stateObserver = NotificationCenter.default.addObserver(
      forName: .MPMusicPlayerControllerPlaybackStateDidChange,
      object: player,
      queue: .main
    ) { [weak self] _ in
      guard let item = player.nowPlayingItem else { return }
      self?.assertNowPlaying(item: item, player: player)
    }
  }

  // HK logo PNG embedded as base64 — injected at build time by withAppleMusicKit.js.
  // Renders on a black background scaled 1.4× (crops transparent border so the
  // logo fills the Lock Screen / Dynamic Island artwork frame properly).
  private let hkArtworkBase64 = "HK_ARTWORK_BASE64_PLACEHOLDER"

  private func hkArtwork() -> MPMediaItemArtwork? {
    guard let data = Data(base64Encoded: hkArtworkBase64, options: .ignoreUnknownCharacters),
          let logoImage = UIImage(data: data) else {
      // Fallback to app icon if base64 decode fails
      guard let fallback = UIImage(named: "AppIcon") else { return nil }
      let size = CGSize(width: 1024, height: 1024)
      return MPMediaItemArtwork(boundsSize: size) { _ in fallback }
    }
    let size = CGSize(width: 1024, height: 1024)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1.0
    let rendered = UIGraphicsImageRenderer(size: size, format: format).image { ctx in
      UIColor.black.setFill()
      ctx.fill(CGRect(origin: .zero, size: size))
      // 1.4× scale crops the transparent border, enlarging the visible logo
      let s: CGFloat = 1.4
      let dw = size.width * s
      let dh = size.height * s
      logoImage.draw(in: CGRect(x: (size.width - dw) / 2,
                                y: (size.height - dh) / 2,
                                width: dw, height: dh))
    }
    return MPMediaItemArtwork(boundsSize: size) { _ in rendered }
  }

  // Sets MPNowPlayingInfoCenter with HK icon + accurate elapsed time + playback rate.
  // Called both immediately on play and from the observers to re-assert our info.
  private func assertNowPlaying(item: MPMediaItem, player: MPMusicPlayerController) {
    let isPlaying = player.playbackState == .playing
    var info: [String: Any] = [
      MPMediaItemPropertyTitle:                    item.title       ?? "",
      MPMediaItemPropertyArtist:                   item.artist      ?? "",
      MPMediaItemPropertyAlbumTitle:               item.albumTitle  ?? "",
      MPMediaItemPropertyPlaybackDuration:         item.playbackDuration,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: max(0, player.currentPlaybackTime),
      MPNowPlayingInfoPropertyPlaybackRate:        isPlaying ? 1.0 : 0.0,
    ]
    if let art = hkArtwork() {
      info[MPMediaItemPropertyArtwork] = art
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func findCollection(persistentID: UInt64) -> MPMediaItemCollection? {
    guard let collections = MPMediaQuery.playlists().collections else { return nil }
    return collections.first { $0.persistentID == persistentID }
  }

  public func definition() -> ModuleDefinition {
    Name("AppleMusicKit")

    AsyncFunction("requestAuthorization") { (promise: Promise) in
      MPMediaLibrary.requestAuthorization { status in
        switch status {
        case .authorized:    promise.resolve("authorized")
        case .denied:        promise.resolve("denied")
        case .restricted:    promise.resolve("restricted")
        case .notDetermined: promise.resolve("notDetermined")
        @unknown default:    promise.resolve("notDetermined")
        }
      }
    }

    AsyncFunction("getPlaylists") { (promise: Promise) in
      let collections = MPMediaQuery.playlists().collections ?? []
      var result: [[String: Any]] = []
      for col in collections {
        guard let pl = col as? MPMediaPlaylist,
              let name = pl.name, !name.isEmpty else { continue }
        result.append([
          "id": String(col.persistentID), "name": name, "count": col.items.count,
        ])
      }
      promise.resolve(result)
    }

    AsyncFunction("getSongsInPlaylist") { (persistentIDStr: String, promise: Promise) in
      guard let pid = UInt64(persistentIDStr) else {
        promise.reject("INVALID_ID", "Invalid playlist ID"); return
      }
      guard let col = self.findCollection(persistentID: pid) else {
        promise.reject("NOT_FOUND", "Playlist not found"); return
      }
      let songs: [[String: Any]] = col.items.map { item in [
        "id":         String(item.persistentID),
        "title":      item.title      ?? "Unknown",
        "artist":     item.artist     ?? "",
        "albumTitle": item.albumTitle ?? "",
        "duration":   item.playbackDuration,
      ]}
      promise.resolve(songs)
    }

    AsyncFunction("playPlaylist") { (persistentIDStr: String, promise: Promise) in
      guard let pid = UInt64(persistentIDStr), pid != 0 else {
        promise.reject("INVALID_ID", "Invalid playlist ID"); return
      }
      guard let col = self.findCollection(persistentID: pid) else {
        promise.reject("NOT_FOUND", "Playlist not found"); return
      }
      self.activateAudioSession()
      self.registerRemoteCommands()
      self.registerNowPlayingObservers()
      DispatchQueue.main.async {
        let player = MPMusicPlayerController.applicationQueuePlayer
        player.setQueue(with: col)
        player.shuffleMode = .off
        player.repeatMode  = .all
        player.play()
        // Assert immediately; observer will re-assert 300 ms later after system update
        if let first = col.items.first { self.assertNowPlaying(item: first, player: player) }
        promise.resolve(nil)
      }
    }

    AsyncFunction("playSongInPlaylist") { (playlistIDStr: String, songIndex: Int, promise: Promise) in
      guard let pid = UInt64(playlistIDStr) else {
        promise.reject("INVALID_ID", "Invalid playlist ID"); return
      }
      guard let col = self.findCollection(persistentID: pid) else {
        promise.reject("NOT_FOUND", "Playlist not found"); return
      }
      self.activateAudioSession()
      self.registerRemoteCommands()
      self.registerNowPlayingObservers()
      DispatchQueue.main.async {
        let player = MPMusicPlayerController.applicationQueuePlayer
        player.setQueue(with: col)
        player.shuffleMode = .off
        player.repeatMode  = .all
        let idx = max(0, min(songIndex, col.items.count - 1))
        player.nowPlayingItem = col.items[idx]
        player.play()
        self.assertNowPlaying(item: col.items[idx], player: player)
        promise.resolve(nil)
      }
    }

    AsyncFunction("pause") { (promise: Promise) in
      DispatchQueue.main.async {
        MPMusicPlayerController.applicationQueuePlayer.pause()
        promise.resolve(nil)
      }
    }

    AsyncFunction("resumePlay") { (promise: Promise) in
      DispatchQueue.main.async {
        MPMusicPlayerController.applicationQueuePlayer.play()
        promise.resolve(nil)
      }
    }

    AsyncFunction("skipToNext") { (promise: Promise) in
      DispatchQueue.main.async {
        MPMusicPlayerController.applicationQueuePlayer.skipToNextItem()
        promise.resolve(nil)
      }
    }

    AsyncFunction("skipToPrevious") { (promise: Promise) in
      DispatchQueue.main.async {
        MPMusicPlayerController.applicationQueuePlayer.skipToPreviousItem()
        promise.resolve(nil)
      }
    }

    AsyncFunction("getCurrentTime") { (promise: Promise) in
      DispatchQueue.main.async {
        let t = MPMusicPlayerController.applicationQueuePlayer.currentPlaybackTime
        promise.resolve(max(0, t))
      }
    }

    AsyncFunction("getDuration") { (promise: Promise) in
      DispatchQueue.main.async {
        let d = MPMusicPlayerController.applicationQueuePlayer.nowPlayingItem?.playbackDuration ?? 0
        promise.resolve(d)
      }
    }

    AsyncFunction("seekTo") { (time: Double, promise: Promise) in
      DispatchQueue.main.async {
        MPMusicPlayerController.applicationQueuePlayer.currentPlaybackTime = time
        promise.resolve(nil)
      }
    }

    AsyncFunction("setVolume") { (volume: Double, promise: Promise) in
      DispatchQueue.main.async {
        // MPMusicPlayerController.volume is unavailable in iOS — use MPVolumeView slider instead
        let vv = MPVolumeView(frame: CGRect(x: -2000, y: -2000, width: 1, height: 1))
        if let scene = UIApplication.shared.connectedScenes
            .compactMap({ $0 as? UIWindowScene }).first,
           let window = scene.windows.first {
          window.addSubview(vv)
          if let slider = vv.subviews.first(where: { $0 is UISlider }) as? UISlider {
            slider.setValue(Float(volume), animated: false)
            slider.sendActions(for: .valueChanged)
          }
          vv.removeFromSuperview()
        }
        promise.resolve(nil)
      }
    }
  }
}
`;

const withAppleMusicKit = (config) => {
  // ── Guarantee UIBackgroundModes: ['audio'] is in Info.plist ──────────────
  // Belt-and-suspenders: withInfoPlist fires during the info-plist phase;
  // the second withDangerousMod below fires LAST (after everything) and
  // directly patches the XML file on disk — nothing can overwrite it after.
  config = withInfoPlist(config, (cfg) => {
    const plist = cfg.modResults;
    if (!Array.isArray(plist.UIBackgroundModes)) plist.UIBackgroundModes = [];
    if (!plist.UIBackgroundModes.includes('audio')) plist.UIBackgroundModes.push('audio');
    return cfg;
  });

  // ── 0. Patch react-native-spotify-remote to use xcframework ───────────────
  // SpotifyiOS.framework ships only i386/armv7/x86_64 — no arm64 → linker
  // fails on every device build. The package also ships SpotifyiOS.xcframework
  // (ios-arm64_armv7 slice) which has full arm64 support. Patch the podspec
  // here (before pod install) to point at the xcframework instead.
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot } = config.modRequest;
      const podspecPath = path.join(
        projectRoot,
        'node_modules',
        'react-native-spotify-remote',
        'RNSpotifyRemote.podspec',
      );
      if (fs.existsSync(podspecPath)) {
        let podspec = fs.readFileSync(podspecPath, 'utf8');
        const before = podspec;
        // Switch vendored framework from .framework (no arm64) to .xcframework (has arm64)
        podspec = podspec.replace(
          /s\.vendored_frameworks\s*=\s*["']ios\/external\/SpotifySDK\/SpotifyiOS\.framework["']/,
          's.vendored_frameworks = "ios/external/SpotifySDK/SpotifyiOS.xcframework"',
        );
        // Switch preserve_path to xcframework
        podspec = podspec.replace(
          /s\.preserve_path\s*=\s*["']ios\/external\/SpotifySDK\/SpotifyiOS\.framework["']/,
          's.preserve_path = "ios/external/SpotifySDK/SpotifyiOS.xcframework"',
        );
        // Fix source_files: point headers inside the arm64 slice of the xcframework
        podspec = podspec.replace(
          /["']ios\/external\/SpotifySDK\/SpotifyiOS\.framework\/\*\*\/Headers\/\*\.\{h,m\}["']/,
          '"ios/external/SpotifySDK/SpotifyiOS.xcframework/ios-arm64_armv7/SpotifyiOS.framework/Headers/*.{h,m}"',
        );
        if (podspec !== before) {
          fs.writeFileSync(podspecPath, podspec, 'utf8');
          console.log('[withAppleMusicKit] Patched RNSpotifyRemote.podspec → xcframework ✓');
        } else {
          console.log('[withAppleMusicKit] RNSpotifyRemote.podspec already patched or pattern not found');
        }
      } else {
        console.warn('[withAppleMusicKit] RNSpotifyRemote.podspec not found — skipping Spotify xcframework patch');
      }
      return config;
    },
  ]);

  // ── 1. Swift file + pbxproj patching ──────────────────────────────────────
  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;

      // ── 1. Write AppleMusicKitModule.swift to ios/ root ──────────────────
      // The PBXFileReference uses sourceTree="<group>" with path=filename only,
      // which resolves relative to the Xcode project root (ios/).
      // Writing to ios/HKLifeApp/ would need a group entry to resolve correctly;
      // ios/ root matches the bare path entry we inject into the pbxproj.

      // Inject HK artwork as base64 so the lock screen / Dynamic Island can
      // display it without any Xcode asset catalog changes.
      const { projectRoot } = config.modRequest;
      const pngPath = path.join(projectRoot, 'assets', 'images', 'hk-artwork-transparent.png');
      let swiftContent = SWIFT_CONTENT;
      if (fs.existsSync(pngPath)) {
        const pngBase64 = fs.readFileSync(pngPath).toString('base64');
        swiftContent = swiftContent.replace('HK_ARTWORK_BASE64_PLACEHOLDER', pngBase64);
        console.log(`[withAppleMusicKit] Injected HK artwork base64 (${pngBase64.length} chars) into Swift`);
      } else {
        console.warn('[withAppleMusicKit] hk-artwork-transparent.png not found — artwork will fall back to AppIcon');
      }

      fs.writeFileSync(path.join(platformProjectRoot, SWIFT_FILENAME), swiftContent, 'utf8');
      console.log(`[withAppleMusicKit] Wrote ${SWIFT_FILENAME} → ios/`);

      // ── 2. Register it in project.pbxproj via string manipulation ─────────
      const entries = fs.readdirSync(platformProjectRoot);
      const xcodeprojDir = entries.find((e) => e.endsWith('.xcodeproj'));
      if (!xcodeprojDir) {
        console.error('[withAppleMusicKit] No .xcodeproj found — skipping pbxproj patch');
        return config;
      }

      const pbxprojPath = path.join(platformProjectRoot, xcodeprojDir, 'project.pbxproj');
      let pbx = fs.readFileSync(pbxprojPath, 'utf8');

      if (pbx.includes(SWIFT_FILENAME)) {
        console.log(`[withAppleMusicKit] ${SWIFT_FILENAME} already in project.pbxproj`);
        return config;
      }

      // a) PBXFileReference
      pbx = pbx.replace(
        '/* End PBXFileReference section */',
        `\t\t${FILE_UUID} /* ${SWIFT_FILENAME} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${SWIFT_FILENAME}; sourceTree = "<group>"; };\n/* End PBXFileReference section */`
      );

      // b) PBXBuildFile
      pbx = pbx.replace(
        '/* End PBXBuildFile section */',
        `\t\t${BUILD_UUID} /* ${SWIFT_FILENAME} in Sources */ = {isa = PBXBuildFile; fileRef = ${FILE_UUID} /* ${SWIFT_FILENAME} */; };\n/* End PBXBuildFile section */`
      );

      // c) PBXSourcesBuildPhase — insert into the files = ( ... ) list.
      //    The Sources phase contains "isa = PBXSourcesBuildPhase" followed by
      //    a "files = (" list. Inject our build-file entry right after "files = (".
      pbx = pbx.replace(
        /(isa = PBXSourcesBuildPhase;[\s\S]*?files = \()/,
        `$1\n\t\t\t\t${BUILD_UUID} /* ${SWIFT_FILENAME} in Sources */,`
      );

      fs.writeFileSync(pbxprojPath, pbx, 'utf8');
      console.log(`[withAppleMusicKit] Patched project.pbxproj with ${SWIFT_FILENAME}`);

      return config;
    },
  ]);

  // ── 2. Direct Info.plist XML patch — runs LAST, after all Expo mods ───────
  // Dangerous mods execute after info-plist mods, so the file already exists.
  // Directly patching the XML on disk is the only approach guaranteed to survive
  // Expo's built-in infoPlist processing overwriting our changes.
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;

      // Find Info.plist — search every immediate subdirectory of ios/ rather
      // than hardcoding the app-name folder (which can vary between builds).
      let infoPlistPath = null;
      try {
        const entries = fs.readdirSync(platformProjectRoot);
        for (const entry of entries) {
          const candidate = path.join(platformProjectRoot, entry, 'Info.plist');
          if (fs.existsSync(candidate)) {
            infoPlistPath = candidate;
            console.log(`[withAppleMusicKit] Found Info.plist at: ${candidate}`);
            break;
          }
        }
      } catch (e) {
        console.warn('[withAppleMusicKit] Error scanning for Info.plist:', e.message);
      }

      if (!infoPlistPath) {
        console.warn('[withAppleMusicKit] Info.plist not found — UIBackgroundModes patch skipped');
        return config;
      }

      let plist = fs.readFileSync(infoPlistPath, 'utf8');

      if (plist.includes('<key>UIBackgroundModes</key>')) {
        if (!plist.includes('<string>audio</string>')) {
          // Key exists but audio string is missing — inject into the array
          plist = plist.replace(
            /(<key>UIBackgroundModes<\/key>\s*<array>)/,
            '$1\n\t\t<string>audio</string>'
          );
          fs.writeFileSync(infoPlistPath, plist, 'utf8');
          console.log('[withAppleMusicKit] Injected <string>audio</string> into UIBackgroundModes ✓');
        } else {
          console.log('[withAppleMusicKit] UIBackgroundModes:audio already present ✓');
        }
      } else {
        // Key missing entirely — append full block before </dict></plist>.
        // Try multiple closing-tag patterns to handle different plist whitespace styles.
        const replacements = [
          [/\t<\/dict>\n<\/plist>\s*$/, '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>audio</string>\n\t</array>\n\t</dict>\n</plist>\n'],
          [/<\/dict>\n<\/plist>\s*$/, '<key>UIBackgroundModes</key>\n<array>\n<string>audio</string>\n</array>\n</dict>\n</plist>\n'],
          [/<\/dict><\/plist>\s*$/, '<key>UIBackgroundModes</key><array><string>audio</string></array></dict></plist>'],
        ];
        let patched = false;
        for (const [pattern, replacement] of replacements) {
          if (pattern.test(plist)) {
            plist = plist.replace(pattern, replacement);
            patched = true;
            break;
          }
        }
        if (patched) {
          fs.writeFileSync(infoPlistPath, plist, 'utf8');
          console.log('[withAppleMusicKit] Injected UIBackgroundModes:audio into Info.plist ✓');
        } else {
          console.error('[withAppleMusicKit] FAILED to inject UIBackgroundModes — no closing-tag pattern matched');
          // Last resort: append raw XML at end of file
          plist += '\n<!-- UIBackgroundModes injected by withAppleMusicKit -->\n';
          fs.appendFileSync(infoPlistPath.replace('Info.plist', 'UIBackgroundModes.debug'), plist);
          console.log('[withAppleMusicKit] Dumped plist to debug file for inspection');
        }
      }
      return config;
    },
  ]);
};

module.exports = withAppleMusicKit;
