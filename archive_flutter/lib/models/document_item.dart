import 'dart:typed_data';

class DocumentItem {
  final String name;
  final String path;
  final int sizeInBytes;
  final Uint8List bytes;
  int pageCount;

  DocumentItem({
    required this.name,
    required this.path,
    required this.sizeInBytes,
    required this.bytes,
    this.pageCount = 1,
  });

  String get formattedSize {
    if (sizeInBytes < 1024) return '$sizeInBytes B';
    if (sizeInBytes < 1024 * 1024) {
      return '${(sizeInBytes / 1024).toStringAsFixed(1)} KB';
    }
    return '${(sizeInBytes / (1024 * 1024)).toStringAsFixed(2)} MB';
  }
}

class PageItem {
  final int originalIndex; // 0-based
  int rotation; // 0, 90, 180, 270
  bool isSelected;

  PageItem({
    required this.originalIndex,
    this.rotation = 0,
    this.isSelected = false,
  });

  int get pageNumber => originalIndex + 1;
}
