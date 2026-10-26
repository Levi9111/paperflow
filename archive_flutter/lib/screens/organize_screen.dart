import 'package:flutter/material.dart';
import '../models/document_item.dart';
import '../services/file_service.dart';
import '../services/pdf_engine.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

class OrganizeScreen extends StatefulWidget {
  const OrganizeScreen({super.key});

  @override
  State<OrganizeScreen> createState() => _OrganizeScreenState();
}

class _OrganizeScreenState extends State<OrganizeScreen> {
  DocumentItem? _selectedDoc;
  List<PageItem> _pages = [];
  bool _isLoading = false;
  bool _isExporting = false;
  String? _savedPath;

  Future<void> _pickFile() async {
    final docs = await FileService.pickPdfFiles(allowMultiple: false);
    if (docs.isNotEmpty) {
      setState(() {
        _selectedDoc = docs.first;
        _isLoading = true;
        _savedPath = null;
      });

      final count = await PdfEngine.getPageCount(_selectedDoc!.bytes);
      setState(() {
        _pages = List.generate(count, (index) => PageItem(originalIndex: index));
        _selectedDoc!.pageCount = count;
        _isLoading = false;
      });
    }
  }

  void _rotatePage(int index) {
    setState(() {
      _pages[index].rotation = (_pages[index].rotation + 90) % 360;
    });
  }

  void _rotateAll() {
    setState(() {
      for (final p in _pages) {
        p.rotation = (p.rotation + 90) % 360;
      }
    });
  }

  void _deletePage(int index) {
    setState(() {
      _pages.removeAt(index);
    });
  }

  void _movePage(int index, int direction) {
    final newIndex = index + direction;
    if (newIndex >= 0 && newIndex < _pages.length) {
      setState(() {
        final item = _pages.removeAt(index);
        _pages.insert(newIndex, item);
      });
    }
  }

  Future<void> _saveOrganized() async {
    if (_selectedDoc == null || _pages.isEmpty) return;

    setState(() {
      _isExporting = true;
      _savedPath = null;
    });

    try {
      final organizedBytes = await PdfEngine.organizePages(_selectedDoc!.bytes, _pages);
      final path = await FileService.savePdfFile(
        bytes: organizedBytes,
        defaultFileName: 'PaperFlow_Organized_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      setState(() {
        _isExporting = false;
        _savedPath = path;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(path != null ? 'Saved to: $path' : 'Exported successfully!'),
            backgroundColor: AppTheme.accentGreen,
          ),
        );
      }
    } catch (e) {
      setState(() => _isExporting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error organizing PDF: $e'),
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
        title: const Text('Organize & Rotate Pages'),
        actions: [
          if (_selectedDoc != null && !_isLoading) ...[
            IconButton(
              icon: const Icon(Icons.rotate_right),
              tooltip: 'Rotate All 90°',
              onPressed: _rotateAll,
            ),
            IconButton(
              icon: const Icon(Icons.refresh),
              tooltip: 'Reset Order',
              onPressed: () {
                setState(() {
                  _pages = List.generate(
                    _selectedDoc!.pageCount,
                    (index) => PageItem(originalIndex: index),
                  );
                });
              },
            ),
          ],
        ],
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
                      title: 'Select PDF to organize, rotate, or delete pages',
                      subtitle: 'Visual interactive grid with one-click page rotations and deletion.',
                      icon: Icons.grid_view_rounded,
                      accentColor: AppTheme.accentCyan,
                    ),
                  ),
                ),
              )
            else if (_isLoading)
              const Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      CircularProgressIndicator(color: AppTheme.accentCyan),
                      SizedBox(height: 16),
                      Text('Analyzing document structure...'),
                    ],
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
                          '${_pages.length} Pages • ${_selectedDoc!.name}',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 16),
                          overflow: TextOverflow.ellipsis,
                        ),
                        OutlinedButton.icon(
                          onPressed: _pickFile,
                          icon: const Icon(Icons.swap_horiz, size: 16),
                          label: const Text('Change File'),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: GridView.builder(
                        gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 220,
                          childAspectRatio: 0.72,
                          crossAxisSpacing: 16,
                          mainAxisSpacing: 16,
                        ),
                        itemCount: _pages.length,
                        itemBuilder: (context, index) {
                          final page = _pages[index];
                          return Card(
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                              side: BorderSide(
                                color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                              ),
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(10.0),
                              child: Column(
                                children: [
                                  Expanded(
                                    child: Container(
                                      decoration: BoxDecoration(
                                        color: isDark ? AppTheme.darkBg : AppTheme.lightBg,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Center(
                                        child: Transform.rotate(
                                          angle: page.rotation * 3.1415926535 / 180,
                                          child: Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              const Icon(Icons.description_outlined, size: 48, color: AppTheme.accentCyan),
                                              const SizedBox(height: 8),
                                              Text(
                                                'Page ${page.pageNumber}',
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                              ),
                                              if (page.rotation != 0)
                                                Text(
                                                  '${page.rotation}°',
                                                  style: const TextStyle(
                                                    fontSize: 11,
                                                    color: AppTheme.accentCyan,
                                                    fontWeight: FontWeight.bold,
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                                    children: [
                                      IconButton(
                                        icon: const Icon(Icons.arrow_back, size: 18),
                                        tooltip: 'Move Left',
                                        onPressed: index > 0 ? () => _movePage(index, -1) : null,
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.rotate_right, size: 18),
                                        tooltip: 'Rotate 90°',
                                        color: AppTheme.accentCyan,
                                        onPressed: () => _rotatePage(index),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.delete_outline, size: 18),
                                        tooltip: 'Delete Page',
                                        color: AppTheme.primaryCrimson,
                                        onPressed: () => _deletePage(index),
                                      ),
                                      IconButton(
                                        icon: const Icon(Icons.arrow_forward, size: 18),
                                        tooltip: 'Move Right',
                                        onPressed: index < _pages.length - 1 ? () => _movePage(index, 1) : null,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
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
                        onPressed: _isExporting ? null : _saveOrganized,
                        icon: _isExporting
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.check),
                        label: Text(
                          _isExporting ? 'Applying Changes...' : 'Save Organized PDF (${_pages.length} Pages)',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.accentCyan,
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
