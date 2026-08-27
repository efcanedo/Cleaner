import AppKit
import Foundation

guard CommandLine.arguments.count == 2 else { exit(2) }
let output = URL(fileURLWithPath: CommandLine.arguments[1])
let size = NSSize(width: 1024, height: 1024)
let image = NSImage(size: size)
image.lockFocus()

let background = NSBezierPath(roundedRect: NSRect(x: 36, y: 36, width: 952, height: 952), xRadius: 220, yRadius: 220)
NSGradient(starting: NSColor(calibratedRed: 0.97, green: 0.95, blue: 0.91, alpha: 1), ending: NSColor(calibratedRed: 0.87, green: 0.91, blue: 0.87, alpha: 1))!.draw(in: background, angle: -45)

let document = NSBezierPath()
document.move(to: NSPoint(x: 290, y: 170))
document.line(to: NSPoint(x: 610, y: 170))
document.line(to: NSPoint(x: 764, y: 324))
document.line(to: NSPoint(x: 764, y: 854))
document.line(to: NSPoint(x: 290, y: 854))
document.close()
NSColor(calibratedWhite: 0.99, alpha: 1).setFill()
document.fill()
NSColor(calibratedRed: 0.09, green: 0.21, blue: 0.18, alpha: 1).setStroke()
document.lineWidth = 34
document.lineJoinStyle = .round
document.stroke()

let fold = NSBezierPath()
fold.move(to: NSPoint(x: 610, y: 170))
fold.line(to: NSPoint(x: 610, y: 324))
fold.line(to: NSPoint(x: 764, y: 324))
NSColor(calibratedRed: 0.91, green: 0.57, blue: 0.38, alpha: 1).setFill()
fold.fill()
NSColor(calibratedRed: 0.09, green: 0.21, blue: 0.18, alpha: 1).setStroke()
fold.lineWidth = 34
fold.lineJoinStyle = .round
fold.stroke()

NSColor(calibratedRed: 0.60, green: 0.67, blue: 0.64, alpha: 1).setStroke()
for (y, width) in [(550.0, 276.0), (450.0, 196.0), (350.0, 242.0)] {
    let line = NSBezierPath()
    line.move(to: NSPoint(x: 382, y: y))
    line.line(to: NSPoint(x: 382 + width, y: y))
    line.lineWidth = 30
    line.lineCapStyle = .round
    line.stroke()
}

let badge = NSBezierPath(ovalIn: NSRect(x: 534, y: 158, width: 312, height: 312))
NSColor(calibratedRed: 0.11, green: 0.35, blue: 0.30, alpha: 1).setFill()
badge.fill()
let check = NSBezierPath()
check.move(to: NSPoint(x: 611, y: 314))
check.line(to: NSPoint(x: 663, y: 262))
check.line(to: NSPoint(x: 767, y: 382))
NSColor.white.setStroke()
check.lineWidth = 38
check.lineCapStyle = .round
check.lineJoinStyle = .round
check.stroke()

image.unlockFocus()
guard let tiff = image.tiffRepresentation,
      let bitmap = NSBitmapImageRep(data: tiff),
      let png = bitmap.representation(using: .png, properties: [:])
else { exit(1) }
try png.write(to: output, options: .atomic)
