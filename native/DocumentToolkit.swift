import AppKit
import CoreGraphics
import CoreText
import Foundation
import PDFKit
import Vision

enum ToolkitError: Error, LocalizedError {
    case usage(String)
    case open(String)
    case write(String)
    case render(Int)

    var errorDescription: String? {
        switch self {
        case .usage(let value), .open(let value), .write(let value): return value
        case .render(let page): return "Could not render source page \(page)."
        }
    }
}

struct OCRLine {
    let text: String
    let box: CGRect
}

func jsonPrint(_ value: [String: Any]) throws {
    let data = try JSONSerialization.data(withJSONObject: value, options: [.sortedKeys])
    guard let text = String(data: data, encoding: .utf8) else { throw ToolkitError.write("Could not encode the toolkit report.") }
    print(text)
}

func loadPDF(_ url: URL) throws -> PDFDocument {
    if let document = PDFDocument(url: url) { return document }
    guard let image = NSImage(contentsOf: url), let page = PDFPage(image: image) else {
        throw ToolkitError.open("Could not open \(url.lastPathComponent).")
    }
    let document = PDFDocument()
    document.insert(page, at: 0)
    return document
}

func render(_ page: PDFPage, scale requestedScale: CGFloat = 3.0) throws -> CGImage {
    let box = page.bounds(for: .mediaBox)
    let longest = max(box.width, box.height)
    let scale = min(requestedScale, 4000.0 / max(longest, 1.0))
    let width = max(1, Int(ceil(box.width * scale)))
    let height = max(1, Int(ceil(box.height * scale)))
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB),
          let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
    else { throw ToolkitError.render(0) }
    context.setFillColor(NSColor.white.cgColor)
    context.fill(CGRect(x: 0, y: 0, width: width, height: height))
    context.saveGState()
    context.scaleBy(x: scale, y: scale)
    context.translateBy(x: -box.minX, y: -box.minY)
    page.draw(with: .mediaBox, to: context)
    context.restoreGState()
    guard let image = context.makeImage() else { throw ToolkitError.render(0) }
    return image
}

func recognize(_ image: CGImage) throws -> [OCRLine] {
    var observations: [VNRecognizedTextObservation] = []
    let request = VNRecognizeTextRequest { request, error in
        guard error == nil else { return }
        observations = request.results as? [VNRecognizedTextObservation] ?? []
    }
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false
    request.minimumTextHeight = 0.004
    try VNImageRequestHandler(cgImage: image, options: [:]).perform([request])
    return observations.compactMap { observation in
        guard let candidate = observation.topCandidates(1).first, !candidate.string.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return nil }
        return OCRLine(text: candidate.string, box: observation.boundingBox)
    }
}

func drawInvisibleText(_ lines: [OCRLine], pageBox: CGRect, in context: CGContext) {
    context.saveGState()
    context.setTextDrawingMode(.invisible)
    context.textMatrix = .identity
    for line in lines {
        let x = pageBox.minX + line.box.minX * pageBox.width
        let y = pageBox.minY + line.box.minY * pageBox.height
        let height = max(5.0, line.box.height * pageBox.height * 0.82)
        let font = CTFontCreateWithName("Helvetica" as CFString, height, nil)
        let attributes: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: NSColor.black]
        let attributed = NSAttributedString(string: line.text, attributes: attributes)
        let textLine = CTLineCreateWithAttributedString(attributed)
        context.textPosition = CGPoint(x: x, y: y)
        CTLineDraw(textLine, context)
    }
    context.restoreGState()
}

func commandRender(input: URL, outputDirectory: URL) throws {
    let document = try loadPDF(input)
    try FileManager.default.createDirectory(at: outputDirectory, withIntermediateDirectories: true)
    var failures: [Int] = []
    for index in 0..<document.pageCount {
        autoreleasepool {
            do {
                guard let page = document.page(at: index) else { throw ToolkitError.render(index + 1) }
                let cgImage = try render(page, scale: 2.5)
                let representation = NSBitmapImageRep(cgImage: cgImage)
                guard let data = representation.representation(using: .png, properties: [:]) else { throw ToolkitError.render(index + 1) }
                let target = outputDirectory.appendingPathComponent("source-page-\(index + 1).png")
                try data.write(to: target, options: .atomic)
            } catch {
                failures.append(index + 1)
            }
        }
    }
    try jsonPrint(["rendered": document.pageCount - failures.count, "pages": document.pageCount, "failedPages": failures])
}

func commandImagePDF(output: URL, images: [URL]) throws {
    guard !images.isEmpty else { throw ToolkitError.usage("imagepdf requires at least one source image.") }
    let document = PDFDocument()
    for (index, source) in images.enumerated() {
        guard let image = NSImage(contentsOf: source), let page = PDFPage(image: image) else {
            throw ToolkitError.open("Could not convert \(source.lastPathComponent) to PDF.")
        }
        document.insert(page, at: index)
    }
    guard document.write(to: output) else { throw ToolkitError.write("Could not write \(output.lastPathComponent).") }
    try jsonPrint(["pages": document.pageCount, "output": output.lastPathComponent])
}

func commandOCR(input: URL, output: URL) throws {
    let document = try loadPDF(input)
    var mediaBox = CGRect(x: 0, y: 0, width: 612, height: 792)
    guard let consumer = CGDataConsumer(url: output as CFURL),
          let context = CGContext(consumer: consumer, mediaBox: &mediaBox, nil)
    else { throw ToolkitError.write("Could not create \(output.lastPathComponent).") }

    var recognizedLines = 0
    var failedPages: [Int] = []
    var errors: [String] = []
    for index in 0..<document.pageCount {
        autoreleasepool {
            guard let page = document.page(at: index) else { failedPages.append(index + 1); return }
            let box = page.bounds(for: .mediaBox)
            let pageInfo = [kCGPDFContextMediaBox as String: [box.minX, box.minY, box.width, box.height]] as CFDictionary
            context.beginPDFPage(pageInfo)
            context.saveGState()
            page.draw(with: .mediaBox, to: context)
            context.restoreGState()
            do {
                let image = try render(page, scale: 3.2)
                let lines = try recognize(image)
                recognizedLines += lines.count
                drawInvisibleText(lines, pageBox: box, in: context)
            } catch {
                failedPages.append(index + 1)
                errors.append("Page \(index + 1): \(error.localizedDescription)")
            }
            context.endPDFPage()
        }
    }
    context.closePDF()
    guard FileManager.default.fileExists(atPath: output.path) else { throw ToolkitError.write("The improved PDF was not created.") }
    try jsonPrint(["pages": document.pageCount, "recognizedLines": recognizedLines, "failedPages": failedPages, "errors": errors])
}

do {
    let arguments = Array(CommandLine.arguments.dropFirst())
    guard let command = arguments.first else {
        throw ToolkitError.usage("Usage: DocumentToolkit render INPUT OUTPUT_DIR | ocr INPUT OUTPUT | imagepdf OUTPUT IMAGE...")
    }
    switch command {
    case "render" where arguments.count == 3:
        try commandRender(input: URL(fileURLWithPath: arguments[1]), outputDirectory: URL(fileURLWithPath: arguments[2]))
    case "ocr" where arguments.count == 3:
        try commandOCR(input: URL(fileURLWithPath: arguments[1]), output: URL(fileURLWithPath: arguments[2]))
    case "imagepdf" where arguments.count >= 3:
        try commandImagePDF(output: URL(fileURLWithPath: arguments[1]), images: arguments.dropFirst(2).map(URL.init(fileURLWithPath:)))
    default:
        throw ToolkitError.usage("Invalid DocumentToolkit command or arguments.")
    }
} catch {
    FileHandle.standardError.write(Data("DocumentToolkit: \(error.localizedDescription)\n".utf8))
    exit(1)
}
