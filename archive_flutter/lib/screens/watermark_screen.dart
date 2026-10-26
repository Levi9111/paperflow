import 'package:flutter/material.dart';
import 'package:pdf/pdf.dart';
import '../models/document_item.dart';
import '../services/file_service.dart';
import '../services/pdf_engine.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

class WatermarkScreen extends StatefulWidget {
  const WatermarkScreen({super.key});

  @override
  State<WatermarkScreen> createState() => _WatermarkScreenState();
}

class _WatermarkScreenState extends State<WatermarkScreen> {
  DocumentItem? _selectedDoc;
  final TextEditingController _textController = TextEditingController(text: 'CONFIDENTIAL');
  double _opacity = 0.3;
  double _fontSize = 44.0;
  bool _isProcessing = false;
  String? _savedPath;

  final List<String> _presets = ['CONFIDENTIAL', 'DRAFT', 'TOP SECRET', 'SAMPLE', 'APPROVED', 'DO NOT COPY'];

  Future<void> _pickFile() async {
    final docs = await FileService.pickPdfFiles(allowMultiple: false);
    if (docs.isNotEmpty) {
      setState(() {
        _selectedDoc = docs.first;
        _savedPath = null;
      });
    }
  }

  Future<void> _processWatermark() async {
    if (_selectedDoc == null || _textController.text.trim().isEmpty) return;

    setState(() {
      _isProcessing = true;
      _savedPath = null;
    });

    try {
      final watermarkedBytes = await PdfEngine.addWatermark(
        _selectedDoc!.bytes,
        text: _textController.text.trim(),
        opacity: _opacity,
        fontSize: _fontSize,
        color: PdfColors.red700,
      );

      final path = await FileService.savePdfFile(
        bytes: watermarkedBytes,
        defaultFileName: 'PaperFlow_Watermarked_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      setState(() {
        _isProcessing = false;
        _savedPath = path;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(path != null ? 'Watermark added! Saved to: $path' : 'Watermark added successfully!'),
            backgroundColor: AppTheme.accentGreen,
          ),
        );
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error adding watermark: $e'),
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
        title: const Text('Add Watermark'),
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
                      title: 'Select PDF to add custom watermark',
                      subtitle: 'Add diagonal text stamps with adjustable opacity, size, and styling.',
                      icon: Icons.branding_watermark_rounded,
                      accentColor: AppTheme.primaryCrimson,
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
                                  color: AppTheme.primaryCrimson.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.picture_as_pdf, color: AppTheme.primaryCrimson),
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
                                    Text(_selectedDoc!.formattedSize),
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
                        'Watermark Text',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _textController,
                        onChanged: (_) => setState(() {}),
                        decoration: InputDecoration(
                          hintText: 'Enter watermark text...',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          prefixIcon: const Icon(Icons.edit_note),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Wrap(
                        spacing: 8,
                        children: _presets.map((preset) {
                          return ActionChip(
                            label: Text(preset),
                            onPressed: () {
                              setState(() {
                                _textController.text = preset;
                              });
                            },
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),
                      // Controls
                      Text('Opacity: ${(_opacity * 100).toInt()}%'),
                      Slider(
                        value: _opacity,
                        min: 0.1,
                        max: 0.9,
                        activeColor: AppTheme.primaryCrimson,
                        onChanged: (val) => setState(() => _opacity = val),
                      ),
                      const SizedBox(height: 12),
                      Text('Font Size: ${_fontSize.toInt()}pt'),
                      Slider(
                        value: _fontSize,
                        min: 24.0,
                        max: 72.0,
                        activeColor: AppTheme.primaryCrimson,
                        onChanged: (val) => setState(() => _fontSize = val),
                      ),
                      if (_savedPath != null) ...[
                        const SizedBox(height: 16),
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
                      const SizedBox(height: 32),
                      SizedBox(
                        width: double.infinity,
                        height: 52,
                        child: ElevatedButton.icon(
                          onPressed: _isProcessing ? null : _processWatermark,
                          icon: _isProcessing
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.branding_watermark),
                          label: Text(
                            _isProcessing ? 'Applying Watermark...' : 'Apply Watermark & Save',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primaryCrimson,
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
}
