require 'json'

package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'apple-musickit'
  s.version        = package['version']
  s.summary        = 'Apple Music native module for HK Life'
  s.description    = 'Provides access to Apple Music library via MPMediaLibrary and MPMusicPlayerController'
  s.license        = 'MIT'
  s.author         = 'HK'
  s.homepage       = 'https://github.com/Goodthanks1811/hklifeapp'
  s.platform       = :ios, '15.1'
  s.swift_version  = '5.4'
  s.source         = { :path => '.' }
  s.source_files   = 'ios/**/*.swift'

  s.dependency 'ExpoModulesCore'

  s.frameworks = 'MediaPlayer', 'StoreKit'
end
