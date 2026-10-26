import 'package:flutter/material.dart';
import '../models/document_item.dart';
import '../services/file_service.dart';
import '../services/pdf_engine.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

enum CompressionLevel { extreme, recommended, highQuality }

class CompressScreen extends StatefulWidget {
  const CompressScreen({super.key});

  @override
  State<CompressScreen> createState() => _CompressScreenState();
}

class _CompressScreenState extends State<CompressScreen> {
  DocumentItem? _selectedDoc;
  CompressionLevel _selectedLevel = CompressionLevel.recommended;
  bool _isCompressing = false;
  int? _compressedSize;
  String? _savedPath;

  Future<void> _pickFile() async {
    final docs = await FileService.pickPdfFiles(allowMultiple: false);
    if (docs.isNotEmpty) {
      setState(() {
        _selectedDoc = docs.first;
        _compressedSize = null;
        _savedPath = null;
      });
    }
  }

  Future<void> _processCompression() async {
    if (_selectedDoc == null) return;

    setState(() {
      _isCompressing = true;
      _compressedSize = null;
      _savedPath = null;
    });

    int dpi;
    int quality;
    switch (_selectedLevel) {
      case CompressionLevel.extreme:
        dpi = 96;
        quality = 55;
        break;
      case CompressionLevel.recommended:
        dpi = 144;
        quality = 72;
        break;
      case CompressionLevel.highQuality:
        dpi = 200;
        quality = 88;
        break;
    }

    try {
      final compressedBytes = await PdfEngine.compressPdf(
        _selectedDoc!.bytes,
        dpi: dpi,
        jpegQuality: quality,
      );

      final path = await FileService.savePdfFile(
        bytes: compressedBytes,
        defaultFileName: 'PaperFlow_Compressed_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      setState(() {
        _compressedSize = compressedBytes.lengthInBytes;
        _savedPath = path;
        _isCompressing = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(path != null ? 'Compressed successfully & saved to: $path' : 'Compressed successfully!'),
            backgroundColor: AppTheme.accentGreen,
          ),
        );
      }
    } catch (e) {
      setState(() => _isCompressing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error compressing PDF: $e'),
            backgroundColor: AppTheme.primaryCrimson,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Compress PDF File'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            if (_selectedDoc == null)
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 600),
                    child: DropZone(
                      onTap: _pickFile,
                      title: 'Select PDF to compress and reduce file size',
                      subtitle: 'Choose between Extreme, Recommended, or High-Quality preservation.',
                      icon: Icons.compress_rounded,
                      accentColor: AppTheme.accentGreen,
                    ),
                  ),
                ),
              )
            else
              Expanded(
                child: SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Document card
                      Card(
                        child: Padding(
                          padding: const EdgeInsets.all(16.0),
                          child: Row(
                            children: [
                              Container(
                                width: 48,
                                height: 48,
                                decoration: BoxDecoration(
                                  color: AppTheme.accentGreen.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.picture_as_pdf, color: AppTheme.accentGreen),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _selectedDoc!.name,
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                    const SizedBox(height: 4),
                                    Text('Original Size: ${_selectedDoc!.formattedSize}'),
                                  ],
                                ),
                              ),
                              OutlinedButton.icon(
                                onPressed: _pickFile,
                                icon: const Icon(Icons.swap_horiz, size: 18),
                                label: const Text('Change'),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Text(
                        'Compression Level',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 12),
                      _buildCompressionOption(
                        level: CompressionLevel.extreme,
                        title: 'Extreme Compression',
                        description: 'Lowest file size, standard image quality (Best for email attachments)',
                        reductionTag: '~70% Reduction',
                      ),
                      const SizedBox(height: 10),
                      _buildCompressionOption(
                        level: CompressionLevel.recommended,
                        title: 'Recommended Compression (Default)',
                        description: 'Balanced size reduction with high visual fidelity',
                        reductionTag: '~50% Reduction',
                      ),
                      const SizedBox(height: 10),
                      _buildCompressionOption(
                        level: CompressionLevel.highQuality,
                        title: 'High Quality Preservation',
                        description: 'Crisp images & vector text with minimal compression',
                        reductionTag: '~25% Reduction',
                      ),
                      if (_compressedSize != null) ...[
                        const SizedBox(height: 24),
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppTheme.accentGreen.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppTheme.accentGreen.withValues(alpha: 0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.verified, color: AppTheme.accentGreen, size: 28),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      'Compressed Size: ${(_compressedSize! / (1024 * 1024)).toStringAsFixed(2)} MB',
                                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                    ),
                                    if (_savedPath != null)
                                      Text('Saved to: $_savedPath', style: const TextStyle(fontSize: 12)),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton.icon(
                          onPressed: _isCompressing ? null : _processCompression,
                          icon: _isCompressing
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.compress),
                          label: Text(
                            _isCompressing ? 'Compressing PDF...' : 'Compress PDF File',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.accentGreen,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildCompressionOption({
    required CompressionLevel level,
    required String title,
    required String description,
    required String reductionTag,
  }) {
    final isSelected = _selectedLevel == level;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return InkWell(
      onTap: () => setState(() => _selectedLevel = level),
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.darkSurface : AppTheme.lightSurface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? AppTheme.accentGreen : (isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected ? AppTheme.accentGreen : Colors.grey,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: AppTheme.accentGreen.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          reductionTag,
                          style: const TextStyle(
                            color: AppTheme.accentGreen,
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary,
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
