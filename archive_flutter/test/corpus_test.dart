import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:paperflow/models/document_item.dart';

Future<Uint8List> createSyntheticPdf({required int pageCount, String title = 'Test Doc'}) async {
  final pdf = pw.Document();
  for (int i = 1; i <= pageCount; i++) {
    pdf.addPage(
      pw.Page(
        pageFormat: PdfPageFormat.a4,
        build: (pw.Context context) {
          return pw.Center(
            child: pw.Column(
              mainAxisAlignment: pw.MainAxisAlignment.center,
              children: [
                pw.Text(title, style: pw.TextStyle(fontSize: 22, fontWeight: pw.FontWeight.bold)),
                pw.SizedBox(height: 12),
                pw.Text('Page $i of $pageCount'),
              ],
            ),
          );
        },
      ),
    );
  }
  return pdf.save();
}

void main() {
  group('PaperFlow Core Quality Suite', () {
    test('Non-destructive principle: original byte streams are strictly immutable', () async {
      final originalBytes = await createSyntheticPdf(pageCount: 3, title: 'Confidential Doc');
      final originalSnapshot = Uint8List.fromList(originalBytes);

      final doc = DocumentItem(
        name: 'test_doc.pdf',
        path: '/tmp/test_doc.pdf',
        sizeInBytes: originalBytes.lengthInBytes,
        bytes: originalBytes,
        pageCount: 3,
      );

      // Verify formatting and properties
      expect(doc.name, equals('test_doc.pdf'));
      expect(doc.pageCount, equals(3));
      expect(doc.formattedSize, isNotEmpty);

      // Verify immutability
      expect(doc.bytes, equals(originalSnapshot));
    });

    test('Valid PDF generation produces standard %PDF- header magic bytes', () async {
      final bytes = await createSyntheticPdf(pageCount: 1, title: 'Header Test');
      expect(bytes.length, greaterThan(100));
      // %PDF header: 0x25, 0x50, 0x44, 0x46
      expect(bytes.sublist(0, 4), equals([0x25, 0x50, 0x44, 0x46]));
    });

    test('PageItem tracking maintains rotation state and 1-based indexing', () {
      final page = PageItem(originalIndex: 0, rotation: 0);
      expect(page.pageNumber, equals(1));

      page.rotation = (page.rotation + 90) % 360;
      expect(page.rotation, equals(90));

      page.rotation = (page.rotation + 90) % 360;
      expect(page.rotation, equals(180));
    });

    test('DocumentItem formattedSize formats B, KB, MB accurately', () {
      final bDoc = DocumentItem(name: 'a.pdf', path: '', sizeInBytes: 512, bytes: Uint8List(0));
      expect(bDoc.formattedSize, equals('512 B'));

      final kbDoc = DocumentItem(name: 'b.pdf', path: '', sizeInBytes: 1024 * 45, bytes: Uint8List(0));
      expect(kbDoc.formattedSize, equals('45.0 KB'));

      final mbDoc = DocumentItem(name: 'c.pdf', path: '', sizeInBytes: 1024 * 1024 * 3, bytes: Uint8List(0));
      expect(mbDoc.formattedSize, equals('3.00 MB'));
    });
  });
}
