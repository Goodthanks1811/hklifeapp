const { withDangerousMod } = require('@expo/config-plugins');
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
    cc.playCommand.isEnabled = true
    cc.pauseCommand.isEnabled = true
    cc.nextTrackCommand.isEnabled = true
    cc.previousTrackCommand.isEnabled = true
    cc.playCommand.addTarget  { _ in player.play();              return .success }
    cc.pauseCommand.addTarget { _ in player.pause();             return .success }
    cc.nextTrackCommand.addTarget     { _ in player.skipToNextItem();     return .success }
    cc.previousTrackCommand.addTarget { _ in player.skipToPreviousItem(); return .success }
  }

  private func updateNowPlaying(for item: MPMediaItem) {
    var info: [String: Any] = [
      MPMediaItemPropertyTitle:            item.title       ?? "",
      MPMediaItemPropertyArtist:           item.artist      ?? "",
      MPMediaItemPropertyAlbumTitle:       item.albumTitle  ?? "",
      MPMediaItemPropertyPlaybackDuration: item.playbackDuration,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: 0.0,
      MPNowPlayingInfoPropertyPlaybackRate: 1.0,
    ]
    if let artwork = item.artwork {
      info[MPMediaItemPropertyArtwork] = artwork
    } else if let image = UIImage(named: "AppIcon") {
      info[MPMediaItemPropertyArtwork] = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
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
      DispatchQueue.main.async {
        let player = MPMusicPlayerController.applicationQueuePlayer
        player.setQueue(with: col)
        player.shuffleMode = .off
        player.play()
        if let first = col.items.first { self.updateNowPlaying(for: first) }
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
      DispatchQueue.main.async {
        let player = MPMusicPlayerController.applicationQueuePlayer
        player.setQueue(with: col)
        player.shuffleMode = .off
        let idx = max(0, min(songIndex, col.items.count - 1))
        player.nowPlayingItem = col.items[idx]
        player.play()
        self.updateNowPlaying(for: col.items[idx])
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
  }
}
`;

const withAppleMusicKit = (config) => {
  return withDangerousMod(config, [
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
};

module.exports = withAppleMusicKit;
