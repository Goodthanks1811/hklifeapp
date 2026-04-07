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

public class AppleMusicKitModule: Module {
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
      let query = MPMediaQuery.playlists()
      let collections = query.collections ?? []
      var result: [[String: Any]] = []
      for collection in collections {
        guard let playlist = collection as? MPMediaPlaylist,
              let name = playlist.name, !name.isEmpty else { continue }
        result.append([
          "id":    String(collection.persistentID),
          "name":  name,
          "count": collection.items.count,
        ])
      }
      promise.resolve(result)
    }

    AsyncFunction("getSongsInPlaylist") { (persistentIDStr: String, promise: Promise) in
      guard let persistentID = UInt64(persistentIDStr) else {
        promise.reject("INVALID_ID", "Invalid playlist ID")
        return
      }
      let query = MPMediaQuery.playlists()
      let collections = query.collections ?? []
      for collection in collections {
        if collection.persistentID == persistentID {
          let songs: [[String: Any]] = collection.items.map { item in
            [
              "id":         String(item.persistentID),
              "title":      item.title ?? "Unknown",
              "artist":     item.artist ?? "",
              "albumTitle": item.albumTitle ?? "",
              "duration":   item.playbackDuration,
            ]
          }
          promise.resolve(songs)
          return
        }
      }
      promise.reject("NOT_FOUND", "Playlist not found")
    }

    AsyncFunction("playPlaylist") { (persistentIDStr: String, promise: Promise) in
      guard let persistentID = UInt64(persistentIDStr), persistentID != 0 else {
        promise.reject("INVALID_ID", "Invalid playlist ID")
        return
      }
      let query = MPMediaQuery.playlists()
      let collections = query.collections ?? []
      var found: MPMediaItemCollection? = nil
      for collection in collections {
        if collection.persistentID == persistentID { found = collection; break }
      }
      guard let collection = found else {
        promise.reject("NOT_FOUND", "Playlist not found")
        return
      }
      DispatchQueue.main.async {
        let player = MPMusicPlayerController.systemMusicPlayer
        player.setQueue(with: collection)
        player.shuffleMode = .off
        player.play()
        promise.resolve(nil)
      }
    }

    AsyncFunction("playSongInPlaylist") { (playlistIDStr: String, songIndex: Int, promise: Promise) in
      guard let playlistID = UInt64(playlistIDStr) else {
        promise.reject("INVALID_ID", "Invalid playlist ID")
        return
      }
      let query = MPMediaQuery.playlists()
      let collections = query.collections ?? []
      for collection in collections {
        if collection.persistentID == playlistID {
          DispatchQueue.main.async {
            let player = MPMusicPlayerController.systemMusicPlayer
            player.setQueue(with: collection)
            player.shuffleMode = .off
            let idx = max(0, min(songIndex, collection.items.count - 1))
            player.nowPlayingItem = collection.items[idx]
            player.play()
            promise.resolve(nil)
          }
          return
        }
      }
      promise.reject("NOT_FOUND", "Playlist not found")
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
