import 'dart:io';
import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import '../services/file_service.dart';
import '../services/pdf_engine.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

class ImgToPdfScreen extends StatefulWidget {
  const ImgToPdfScreen({super.key});

  @override
  State<ImgToPdfScreen> createState() => _ImgToPdfScreenState();
}

class _ImgToPdfScreenState extends State<ImgToPdfScreen> {
  final List<File> _images = [];
  bool _isProcessing = false;
  String? _savedPath;
  final double _margin = 15.0;
  bool _autoRotate = true;

  Future<void> _pickImages() async {
    final images = await FileService.pickImages();
    if (images.isNotEmpty) {
      setState(() {
        _images.addAll(images);
        _savedPath = null;
      });
    }
  }

  void _removeImage(int index) {
    setState(() => _images.removeAt(index));
  }

  Future<void> _processConvert() async {
    if (_images.isEmpty) return;

    setState(() {
      _isProcessing = true;
      _savedPath = null;
    });

    try {
      final pdfBytes = await PdfEngine.imagesToPdf(
        _images,
        format: PdfPageFormat.a4,
        margin: _margin,
        autoRotate: _autoRotate,
      );

      final path = await FileService.savePdfFile(
        bytes: pdfBytes,
        defaultFileName: 'PaperFlow_Images_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      setState(() {
        _isProcessing = false;
        _savedPath = path;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(path != null ? 'Created PDF and saved to: $path' : 'PDF created successfully!'),
            backgroundColor: AppTheme.accentGreen,
          ),
        );
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error creating PDF: $e'),
            backgroundColor: AppTheme.primaryCrimson,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Images to PDF'),
        actions: [
          if (_images.isNotEmpty)
            TextButton.icon(
              onPressed: _isProcessing ? null : _pickImages,
              icon: const Icon(Icons.add_photo_alternate, size: 20),
              label: const Text('Add Images'),
            ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            if (_images.isEmpty)
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 600),
                    child: DropZone(
                      onTap: _pickImages,
                      title: 'Select images to convert to PDF',
                      subtitle: 'Supports JPG, PNG, WebP, BMP, and TIFF formats.',
                      icon: Icons.image_rounded,
                      accentColor: AppTheme.accentAmber,
                    ),
                  ),
                ),
              )
            else
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          '${_images.length} Images Selected',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 16),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _images.clear()),
                          child: const Text('Clear All', style: TextStyle(color: AppTheme.primaryCrimson)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    // Image grid
                    Expanded(
                      child: GridView.builder(
                        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 180,
                          childAspectRatio: 0.85,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                        itemCount: _images.length,
                        itemBuilder: (context, index) {
                          final file = _images[index];
                          return Card(
                            clipBehavior: Clip.antiAlias,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                              ),
                            ),
                            child: Stack(
                              children: [
                                Positioned.fill(
                                  child: Image.file(file, fit: BoxFit.cover),
                                ),
                                Positioned(
                                  top: 6,
                                  left: 6,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: Colors.black.withValues(alpha: 0.6),
                                      borderRadius: BorderRadius.circular(4),
                                    ),
                                    child: Text(
                                      '${index + 1}',
                                      style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                    ),
                                  ),
                                ),
                                Positioned(
                                  top: 4,
                                  right: 4,
                                  child: InkWell(
                                    onTap: () => _removeImage(index),
                                    child: Container(
                                      padding: const EdgeInsets.all(4),
                                      decoration: const BoxDecoration(
                                        color: Colors.black54,
                                        shape: BoxShape.circle,
                                      ),
                                      child: const Icon(Icons.close, color: Colors.white, size: 16),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 16),
                    // Settings row
                    Row(
                      children: [
                        Checkbox(
                          value: _autoRotate,
                          activeColor: AppTheme.accentAmber,
                          onChanged: (val) => setState(() => _autoRotate = val ?? true),
                        ),
                        const Text('Auto-orient landscape images to landscape pages'),
                      ],
                    ),
                    if (_savedPath != null) ...[
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: AppTheme.accentGreen.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppTheme.accentGreen.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.check_circle, color: AppTheme.accentGreen),
                            const SizedBox(width: 12),
                            Expanded(child: Text('Saved to: $_savedPath', overflow: TextOverflow.ellipsis)),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: _isProcessing ? null : _processConvert,
                        icon: _isProcessing
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.picture_as_pdf),
                        label: Text(
                          _isProcessing ? 'Converting to PDF...' : 'Convert to PDF (${_images.length} Images)',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.accentAmber,
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}
