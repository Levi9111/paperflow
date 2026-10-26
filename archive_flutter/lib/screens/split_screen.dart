import 'package:flutter/material.dart';
import '../models/document_item.dart';
import '../services/file_service.dart';
import '../services/pdf_engine.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

class SplitScreen extends StatefulWidget {
  const SplitScreen({super.key});

  @override
  State<SplitScreen> createState() => _SplitScreenState();
}

class _SplitScreenState extends State<SplitScreen> {
  DocumentItem? _selectedDoc;
  int _totalPages = 0;
  bool _isProcessing = false;
  bool _isExtractAll = false;
  final TextEditingController _rangeController = TextEditingController(text: '1');
  String? _savedPath;
  String? _errorMessage;

  Future<void> _pickFile() async {
    final docs = await FileService.pickPdfFiles(allowMultiple: false);
    if (docs.isNotEmpty) {
      setState(() {
        _selectedDoc = docs.first;
        _isProcessing = true;
        _errorMessage = null;
        _savedPath = null;
      });

      final count = await PdfEngine.getPageCount(_selectedDoc!.bytes);
      setState(() {
        _totalPages = count;
        _selectedDoc!.pageCount = count;
        _rangeController.text = count > 1 ? '1-$count' : '1';
        _isProcessing = false;
      });
    }
  }

  List<int> _parseRanges(String input, int maxPages) {
    final Set<int> indices = {};
    final parts = input.split(',');

    for (var part in parts) {
      part = part.trim();
      if (part.contains('-')) {
        final bounds = part.split('-');
        if (bounds.length == 2) {
          final start = int.tryParse(bounds[0].trim());
          final end = int.tryParse(bounds[1].trim());
          if (start != null && end != null && start >= 1 && end <= maxPages && start <= end) {
            for (int i = start; i <= end; i++) {
              indices.add(i - 1);
            }
          }
        }
      } else {
        final page = int.tryParse(part);
        if (page != null && page >= 1 && page <= maxPages) {
          indices.add(page - 1);
        }
      }
    }

    final sorted = indices.toList()..sort();
    return sorted;
  }

  Future<void> _processSplit() async {
    if (_selectedDoc == null) return;

    List<int> pagesToExtract = [];
    if (_isExtractAll) {
      pagesToExtract = List.generate(_totalPages, (i) => i);
    } else {
      pagesToExtract = _parseRanges(_rangeController.text, _totalPages);
    }

    if (pagesToExtract.isEmpty) {
      setState(() {
        _errorMessage = 'Invalid page range. Please specify pages between 1 and $_totalPages (e.g. 1-3, 5).';
      });
      return;
    }

    setState(() {
      _isProcessing = true;
      _errorMessage = null;
      _savedPath = null;
    });

    try {
      final splitBytes = await PdfEngine.extractPages(_selectedDoc!.bytes, pagesToExtract);

      final path = await FileService.savePdfFile(
        bytes: splitBytes,
        defaultFileName: 'PaperFlow_Split_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      setState(() {
        _isProcessing = false;
        _savedPath = path;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(path != null ? 'Split PDF saved to: $path' : 'Extracted successfully!'),
            backgroundColor: AppTheme.accentGreen,
          ),
        );
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error splitting PDF: $e'),
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
        title: const Text('Split PDF Document'),
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
                      title: 'Select PDF to split or extract pages',
                      subtitle: 'Extract specific ranges or burst into single-page documents.',
                      icon: Icons.call_split_rounded,
                      accentColor: AppTheme.accentViolet,
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
                                  color: AppTheme.accentViolet.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: const Icon(Icons.picture_as_pdf, color: AppTheme.accentViolet),
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
                                    Text('${_selectedDoc!.formattedSize} • $_totalPages Total Pages'),
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
                      // Mode Selection
                      Text(
                        'Split Mode',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 18),
                      ),
                      const SizedBox(height: 12),
                      SegmentedButton<bool>(
                        segments: const [
                          ButtonSegment<bool>(
                            value: false,
                            label: Text('Custom Page Range'),
                            icon: Icon(Icons.pin_outlined),
                          ),
                          ButtonSegment<bool>(
                            value: true,
                            label: Text('Extract All Pages'),
                            icon: Icon(Icons.copy_all_outlined),
                          ),
                        ],
                        selected: {_isExtractAll},
                        onSelectionChanged: (Set<bool> newSelection) {
                          setState(() {
                            _isExtractAll = newSelection.first;
                          });
                        },
                      ),
                      const SizedBox(height: 20),
                      if (!_isExtractAll) ...[
                        Text(
                          'Page Range',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _rangeController,
                          decoration: InputDecoration(
                            hintText: 'e.g. 1-3, 5, 8-$_totalPages',
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            prefixIcon: const Icon(Icons.format_list_numbered),
                            helperText: 'Valid page numbers: 1 to $_totalPages',
                            errorText: _errorMessage,
                          ),
                        ),
                      ],
                      if (_savedPath != null) ...[
                        const SizedBox(height: 20),
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
                              Expanded(
                                child: Text('Saved to: $_savedPath', overflow: TextOverflow.ellipsis),
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
                          onPressed: _isProcessing ? null : _processSplit,
                          icon: _isProcessing
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                )
                              : const Icon(Icons.call_split),
                          label: Text(
                            _isProcessing ? 'Extracting Pages...' : 'Split & Save PDF',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.accentViolet,
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
