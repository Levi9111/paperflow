import 'package:flutter/material.dart';
import '../models/document_item.dart';
import '../services/file_service.dart';
import '../services/pdf_engine.dart';
import '../theme/app_theme.dart';
import '../widgets/drop_zone.dart';

class MergeScreen extends StatefulWidget {
  const MergeScreen({super.key});

  @override
  State<MergeScreen> createState() => _MergeScreenState();
}

class _MergeScreenState extends State<MergeScreen> {
  final List<DocumentItem> _documents = [];
  bool _isProcessing = false;
  double _progress = 0.0;
  String? _savedPath;

  Future<void> _pickFiles() async {
    final docs = await FileService.pickPdfFiles(allowMultiple: true);
    if (docs.isNotEmpty) {
      setState(() {
        _documents.addAll(docs);
        _savedPath = null;
      });
    }
  }

  void _removeDoc(int index) {
    setState(() {
      _documents.removeAt(index);
    });
  }


  Future<void> _processMerge() async {
    if (_documents.length < 2) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please select at least 2 PDF files to merge'),
          backgroundColor: AppTheme.primaryCrimson,
        ),
      );
      return;
    }

    setState(() {
      _isProcessing = true;
      _progress = 0.1;
      _savedPath = null;
    });

    try {
      final mergedBytes = await PdfEngine.mergePdfs(
        _documents,
        onProgress: (p) => setState(() => _progress = p),
      );

      final path = await FileService.savePdfFile(
        bytes: mergedBytes,
        defaultFileName: 'PaperFlow_Merged_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );

      setState(() {
        _isProcessing = false;
        _savedPath = path;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(path != null ? 'Merged successfully and saved to: $path' : 'Merged successfully!'),
            backgroundColor: AppTheme.accentGreen,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    } catch (e) {
      setState(() => _isProcessing = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error merging files: $e'),
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
        title: const Text('Merge PDF Files'),
        actions: [
          if (_documents.isNotEmpty)
            TextButton.icon(
              onPressed: _isProcessing ? null : _pickFiles,
              icon: const Icon(Icons.add, size: 20),
              label: const Text('Add More'),
            ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            if (_documents.isEmpty)
              Expanded(
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 600),
                    child: DropZone(
                      onTap: _pickFiles,
                      title: 'Select multiple PDF files to merge',
                      subtitle: 'Drag and drop files or browse. Reorder files before merging.',
                      icon: Icons.call_merge_rounded,
                      accentColor: AppTheme.primaryCoral,
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
                          '${_documents.length} Files Selected (Drag to reorder sequence)',
                          style: Theme.of(context).textTheme.titleLarge?.copyWith(fontSize: 16),
                        ),
                        TextButton(
                          onPressed: () => setState(() => _documents.clear()),
                          child: const Text('Clear All', style: TextStyle(color: AppTheme.primaryCrimson)),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Expanded(
                      child: ReorderableListView.builder(
                        itemCount: _documents.length,
                        onReorderItem: (oldIndex, newIndex) {
                          setState(() {
                            final item = _documents.removeAt(oldIndex);
                            _documents.insert(newIndex, item);
                          });
                        },
                        itemBuilder: (context, index) {
                          final doc = _documents[index];
                          return Card(
                            key: ValueKey(doc.path.isNotEmpty ? doc.path : doc.name + index.toString()),
                            margin: const EdgeInsets.symmetric(vertical: 6),
                            child: ListTile(
                              leading: CircleAvatar(
                                backgroundColor: AppTheme.primaryCoral.withValues(alpha: 0.15),
                                child: Text(
                                  '${index + 1}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: AppTheme.primaryCoral,
                                  ),
                                ),
                              ),
                              title: Text(
                                doc.name,
                                style: const TextStyle(fontWeight: FontWeight.w600),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              subtitle: Text(doc.formattedSize),
                              trailing: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  IconButton(
                                    icon: const Icon(Icons.delete_outline, color: AppTheme.primaryCrimson),
                                    onPressed: () => _removeDoc(index),
                                  ),
                                  const Icon(Icons.drag_handle_rounded, color: Colors.grey),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    if (_isProcessing) ...[
                      const SizedBox(height: 16),
                      LinearProgressIndicator(value: _progress, color: AppTheme.primaryCoral),
                      const SizedBox(height: 8),
                      Center(
                        child: Text(
                          'Merging documents... ${(_progress * 100).toInt()}%',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                      ),
                    ],
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
                            Expanded(
                              child: Text(
                                'Saved to: $_savedPath',
                                style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w500),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 20),
                    SizedBox(
                      width: double.infinity,
                      height: 52,
                      child: ElevatedButton.icon(
                        onPressed: _isProcessing ? null : _processMerge,
                        icon: const Icon(Icons.merge_type_rounded),
                        label: Text(
                          'Merge ${_documents.length} PDFs Now',
                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primaryCoral,
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
