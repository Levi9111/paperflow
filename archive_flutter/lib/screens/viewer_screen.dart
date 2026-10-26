import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import '../models/document_item.dart';
import '../services/file_service.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

class ViewerScreen extends StatefulWidget {
  final Uint8List? initialPdfBytes;
  final String? initialFileName;

  const ViewerScreen({
    super.key,
    this.initialPdfBytes,
    this.initialFileName,
  });

  @override
  State<ViewerScreen> createState() => _ViewerScreenState();
}

class _ViewerScreenState extends State<ViewerScreen> {
  DocumentItem? _selectedDoc;

  @override
  void initState() {
    super.initState();
    if (widget.initialPdfBytes != null) {
      _selectedDoc = DocumentItem(
        name: widget.initialFileName ?? 'Document.pdf',
        path: '',
        sizeInBytes: widget.initialPdfBytes!.lengthInBytes,
        bytes: widget.initialPdfBytes!,
      );
    }
  }

  Future<void> _pickFile() async {
    final docs = await FileService.pickPdfFiles(allowMultiple: false);
    if (docs.isNotEmpty) {
      setState(() {
        _selectedDoc = docs.first;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_selectedDoc != null ? _selectedDoc!.name : 'PDF Document Viewer'),
        actions: [
          if (_selectedDoc != null)
            IconButton(
              icon: const Icon(Icons.file_open_outlined),
              tooltip: 'Open Another PDF',
              onPressed: _pickFile,
            ),
        ],
      ),
      body: _selectedDoc == null
          ? Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 600),
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: DropZone(
                    onTap: _pickFile,
                    title: 'Select a PDF to view and print',
                    subtitle: 'High-performance interactive document viewer with zoom and print.',
                    icon: Icons.visibility_rounded,
                    accentColor: AppTheme.accentIndigo,
                  ),
                ),
              ),
            )
          : PdfPreview(
              build: (format) => _selectedDoc!.bytes,
              canChangeOrientation: false,
              canChangePageFormat: false,
              canDebug: false,
              dynamicLayout: false,
              pdfFileName: _selectedDoc!.name,
              previewPageMargin: const EdgeInsets.all(16),
            ),
    );
  }
}
