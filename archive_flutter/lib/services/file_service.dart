import 'dart:io';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import '../models/document_item.dart';

class FileService {
  /// Clean up temporary working directory on app launch to ensure zero data leakage
  static Future<void> purgeTempDirectory() async {
    try {
      final cacheDir = await getTemporaryDirectory();
      final tempDir = Directory('${cacheDir.path}/.paperflow_temp');
      if (await tempDir.exists()) {
        await tempDir.delete(recursive: true);
      }
      await tempDir.create(recursive: true);
    } catch (e) {
      debugPrint('Error purging temp directory: $e');
    }
  }

  /// Create a safe isolated temp file for intermediate processing
  static Future<File> createTempFile(String extension) async {
    final cacheDir = await getTemporaryDirectory();
    final tempDir = Directory('${cacheDir.path}/.paperflow_temp');
    if (!await tempDir.exists()) {
      await tempDir.create(recursive: true);
    }
    final timestamp = DateTime.now().millisecondsSinceEpoch;
    return File('${tempDir.path}/temp_$timestamp.$extension');
  }

  static Future<List<DocumentItem>> pickPdfFiles({bool allowMultiple = true}) async {
    try {
      final files = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
      );

      if (files.isEmpty) return [];

      final List<DocumentItem> documents = [];
      for (final file in files) {
        final bytes = await file.xFile.readAsBytes();
        final size = await file.xFile.length();

        documents.add(DocumentItem(
          name: file.name,
          path: file.path ?? '',
          sizeInBytes: size,
          bytes: bytes,
        ));
      }
      return documents;
    } catch (e) {
      debugPrint('Error picking PDF files: $e');
      return [];
    }
  }

  static Future<List<File>> pickImages() async {
    try {
      final files = await FilePicker.pickFiles(
        type: FileType.image,
      );

      if (files.isEmpty) return [];

      return files
          .where((f) => f.path != null)
          .map((f) => File(f.path!))
          .toList();
    } catch (e) {
      debugPrint('Error picking images: $e');
      return [];
    }
  }

  static Future<String?> savePdfFile({
    required Uint8List bytes,
    required String defaultFileName,
  }) async {
    try {
      if (Platform.isLinux) {
        // Desktop save dialog using FilePicker.saveFile
        final uri = await FilePicker.saveFile(
          dialogTitle: 'Save Processed PDF',
          fileName: defaultFileName,
          bytes: bytes,
          mimeType: 'application/pdf',
        );

        if (uri != null) {
          return uri.toFilePath();
        }
        return null;
      } else {
        // Android / mobile: Save to App Documents or External directory
        Directory? dir = await getExternalStorageDirectory();
        dir ??= await getApplicationDocumentsDirectory();

        final timestamp = DateTime.now().millisecondsSinceEpoch;
        final cleanName = defaultFileName.replaceAll('.pdf', '');
        final filePath = '${dir.path}/${cleanName}_$timestamp.pdf';

        final file = File(filePath);
        await file.writeAsBytes(bytes);
        return filePath;
      }
    } catch (e) {
      debugPrint('Error saving PDF: $e');
      return null;
    }
  }
}
