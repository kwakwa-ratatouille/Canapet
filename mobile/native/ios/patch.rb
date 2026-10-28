# Ajoute les fichiers maison au projet Xcode et branche l'écran principal.
require 'xcodeproj'

proj = Xcodeproj::Project.open('ios/App/App.xcodeproj')
target = proj.targets.find { |t| t.name == 'App' }
group = proj.main_group['App']
%w[GalleryPlugin.swift MainViewController.swift].each do |f|
  target.add_file_references([group.new_file(f)])
end
proj.save

sb = 'ios/App/App/Base.lproj/Main.storyboard'
s = File.read(sb)
s = s.sub('customClass="CAPBridgeViewController" customModule="Capacitor"', 'customClass="MainViewController" customModule="App" customModuleProvider="target"')
File.write(sb, s)
puts 'projet ok'
