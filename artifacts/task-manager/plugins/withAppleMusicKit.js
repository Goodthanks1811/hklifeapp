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

  // Always display the HK Life app icon as Lock Screen / Dynamic Island artwork.
  private func hkArtwork() -> MPMediaItemArtwork? {
    guard let image = UIImage(named: "AppIcon") else { return nil }
    let size = CGSize(width: 1024, height: 1024)
    return MPMediaItemArtwork(boundsSize: size) { _ in image }
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
      fs.writeFileSync(path.join(platformProjectRoot, SWIFT_FILENAME), SWIFT_CONTENT, 'utf8');
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
  // Directly injecting UIBackgroundModes as XML is the only approach guaranteed
  // to survive Expo's built-in infoPlist processing overwriting our changes.
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const { platformProjectRoot } = config.modRequest;
      const infoPlistPath = path.join(platformProjectRoot, 'HKLifeApp', 'Info.plist');
      if (!fs.existsSync(infoPlistPath)) {
        console.warn('[withAppleMusicKit] Info.plist not found — skipping direct patch');
        return config;
      }
      let plist = fs.readFileSync(infoPlistPath, 'utf8');
      if (plist.includes('<key>UIBackgroundModes</key>')) {
        if (!plist.includes('<string>audio</string>')) {
          // Key exists but audio string missing — inject it into the array
          plist = plist.replace(
            /(<key>UIBackgroundModes<\/key>\s*<array>)/,
            '$1\n\t\t<string>audio</string>'
          );
          fs.writeFileSync(infoPlistPath, plist, 'utf8');
          console.log('[withAppleMusicKit] Injected audio into existing UIBackgroundModes array');
        } else {
          console.log('[withAppleMusicKit] UIBackgroundModes:audio already present ✓');
        }
      } else {
        // Key missing entirely — inject the full block before </dict></plist>
        plist = plist.replace(
          /\t<\/dict>\n<\/plist>/,
          '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>audio</string>\n\t</array>\n\t</dict>\n</plist>'
        );
        fs.writeFileSync(infoPlistPath, plist, 'utf8');
        console.log('[withAppleMusicKit] Injected UIBackgroundModes:audio into Info.plist ✓');
      }
      return config;
    },
  ]);
};

module.exports = withAppleMusicKit;
