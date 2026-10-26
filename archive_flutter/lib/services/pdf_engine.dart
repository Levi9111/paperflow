import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:printing/printing.dart';
import 'package:image/image.dart' as img;
import '../models/document_item.dart';

class PdfEngine {
  /// Count pages in a PDF document by rasterizing metadata or reading streams
  static Future<int> getPageCount(Uint8List pdfBytes) async {
    try {
      int count = 0;
      await for (final _ in Printing.raster(pdfBytes, pages: null, dpi: 36)) {
        count++;
      }
      return count > 0 ? count : 1;
    } catch (e) {
      debugPrint('Error getting page count: $e');
      return 1;
    }
  }

  /// Merge multiple PDF documents into a single PDF
  static Future<Uint8List> mergePdfs(List<DocumentItem> documents, {void Function(double)? onProgress}) async {
    final pdf = pw.Document();
    int totalDocs = documents.length;
    int currentDoc = 0;

    for (final doc in documents) {
      currentDoc++;
      if (onProgress != null) {
        onProgress(currentDoc / totalDocs);
      }

      await for (final page in Printing.raster(doc.bytes, dpi: 200)) {
        final imageBytes = await page.toPng();
        final image = pw.MemoryImage(imageBytes);

        pdf.addPage(
          pw.Page(
            pageFormat: PdfPageFormat(page.width.toDouble(), page.height.toDouble()),
            margin: pw.EdgeInsets.zero,
            build: (pw.Context context) {
              return pw.FullPage(
                ignoreMargins: true,
                child: pw.Image(image, fit: pw.BoxFit.fill),
              );
            },
          ),
        );
      }
    }

    return pdf.save();
  }

  /// Split a PDF by given page indices (0-based)
  static Future<Uint8List> extractPages(
    Uint8List sourcePdf,
    List<int> pageIndices, {
    void Function(double)? onProgress,
  }) async {
    final pdf = pw.Document();
    int processed = 0;

    for (final index in pageIndices) {
      await for (final page in Printing.raster(sourcePdf, pages: [index], dpi: 200)) {
        final imageBytes = await page.toPng();
        final image = pw.MemoryImage(imageBytes);

        pdf.addPage(
          pw.Page(
            pageFormat: PdfPageFormat(page.width.toDouble(), page.height.toDouble()),
            margin: pw.EdgeInsets.zero,
            build: (pw.Context context) {
              return pw.FullPage(
                ignoreMargins: true,
                child: pw.Image(image, fit: pw.BoxFit.fill),
              );
            },
          ),
        );
      }
      processed++;
      if (onProgress != null) {
        onProgress(processed / pageIndices.length);
      }
    }

    return pdf.save();
  }

  /// Organize: Reorder, rotate, and filter pages
  static Future<Uint8List> organizePages(
    Uint8List sourcePdf,
    List<PageItem> pages, {
    void Function(double)? onProgress,
  }) async {
    final pdf = pw.Document();
    int processed = 0;

    for (final pageItem in pages) {
      await for (final page in Printing.raster(sourcePdf, pages: [pageItem.originalIndex], dpi: 200)) {
        final rawPng = await page.toPng();
        
        // Apply rotation if needed
        Uint8List finalBytes = rawPng;
        if (pageItem.rotation % 360 != 0) {
          final decoded = img.decodeImage(rawPng);
          if (decoded != null) {
            final rotated = img.copyRotate(decoded, angle: pageItem.rotation);
            finalBytes = Uint8List.fromList(img.encodePng(rotated));
          }
        }

        final image = pw.MemoryImage(finalBytes);
        final isRotated90or270 = (pageItem.rotation ~/ 90) % 2 != 0;
        final width = isRotated90or270 ? page.height.toDouble() : page.width.toDouble();
        final height = isRotated90or270 ? page.width.toDouble() : page.height.toDouble();

        pdf.addPage(
          pw.Page(
            pageFormat: PdfPageFormat(width, height),
            margin: pw.EdgeInsets.zero,
            build: (pw.Context context) {
              return pw.FullPage(
                ignoreMargins: true,
                child: pw.Image(image, fit: pw.BoxFit.fill),
              );
            },
          ),
        );
      }
      processed++;
      if (onProgress != null) {
        onProgress(processed / pages.length);
      }
    }

    return pdf.save();
  }

  /// Compress PDF by controlling raster DPI and JPEG stream quality
  static Future<Uint8List> compressPdf(
    Uint8List sourcePdf, {
    int dpi = 150,
    int jpegQuality = 70,
    void Function(double)? onProgress,
  }) async {
    final pdf = pw.Document();

    await for (final page in Printing.raster(sourcePdf, dpi: dpi.toDouble())) {
      final pngBytes = await page.toPng();
      final decoded = img.decodeImage(pngBytes);
      
      Uint8List compressedImgBytes = pngBytes;
      if (decoded != null) {
        // Compress using JPEG encoding with specified quality
        compressedImgBytes = Uint8List.fromList(img.encodeJpg(decoded, quality: jpegQuality));
      }

      final image = pw.MemoryImage(compressedImgBytes);
      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat(page.width.toDouble(), page.height.toDouble()),
          margin: pw.EdgeInsets.zero,
          build: (pw.Context context) {
            return pw.FullPage(
              ignoreMargins: true,
              child: pw.Image(image, fit: pw.BoxFit.fill),
            );
          },
        ),
      );
    }

    return pdf.save();
  }

  /// Convert Images to PDF with orientation and fit mode
  static Future<Uint8List> imagesToPdf(
    List<File> imageFiles, {
    PdfPageFormat format = PdfPageFormat.a4,
    double margin = 20.0,
    bool autoRotate = true,
  }) async {
    final pdf = pw.Document();

    for (final file in imageFiles) {
      final bytes = await file.readAsBytes();
      final decoded = img.decodeImage(bytes);
      if (decoded == null) continue;

      final isLandscape = decoded.width > decoded.height;
      final pageFormat = (autoRotate && isLandscape) ? format.landscape : format.portrait;
      final pdfImage = pw.MemoryImage(bytes);

      pdf.addPage(
        pw.Page(
          pageFormat: pageFormat,
          margin: pw.EdgeInsets.all(margin),
          build: (pw.Context context) {
            return pw.Center(
              child: pw.Image(pdfImage, fit: pw.BoxFit.contain),
            );
          },
        ),
      );
    }

    return pdf.save();
  }

  /// Convert PDF pages to high-resolution Images
  static Future<List<Uint8List>> pdfToImages(
    Uint8List sourcePdf, {
    int dpi = 200,
  }) async {
    final List<Uint8List> imageList = [];
    await for (final page in Printing.raster(sourcePdf, dpi: dpi.toDouble())) {
      final pngBytes = await page.toPng();
      imageList.add(pngBytes);
    }
    return imageList;
  }

  /// Add customizable text or stamp watermark to a PDF
  static Future<Uint8List> addWatermark(
    Uint8List sourcePdf, {
    required String text,
    double opacity = 0.35,
    double fontSize = 48.0,
    PdfColor color = PdfColors.red,
    double angle = -0.5, // Radians (~ -30 deg)
  }) async {
    final pdf = pw.Document();

    await for (final page in Printing.raster(sourcePdf, dpi: 200)) {
      final imageBytes = await page.toPng();
      final bgImage = pw.MemoryImage(imageBytes);

      pdf.addPage(
        pw.Page(
          pageFormat: PdfPageFormat(page.width.toDouble(), page.height.toDouble()),
          margin: pw.EdgeInsets.zero,
          build: (pw.Context context) {
            return pw.Stack(
              children: [
                pw.FullPage(
                  ignoreMargins: true,
                  child: pw.Image(bgImage, fit: pw.BoxFit.fill),
                ),
                pw.Center(
                  child: pw.Transform.rotate(
                    angle: angle,
                    child: pw.Opacity(
                      opacity: opacity,
                      child: pw.Text(
                        text,
                        style: pw.TextStyle(
                          color: color,
                          fontSize: fontSize,
                          fontWeight: pw.FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      );
    }

    return pdf.save();
  }
}
