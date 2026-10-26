import 'package:flutter/material.dart';
import '../models/pdf_tool_item.dart';
import '../theme/app_theme.dart';
import '../widgets/tool_card.dart';
import 'merge_screen.dart';
import 'split_screen.dart';
import 'organize_screen.dart';
import 'compress_screen.dart';
import 'img_to_pdf_screen.dart';
import 'watermark_screen.dart';
import 'viewer_screen.dart';

class HomeScreen extends StatefulWidget {
  final int initialCategoryIndex;

  const HomeScreen({
    super.key,
    this.initialCategoryIndex = 0,
  });

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late int _selectedCategoryFilter;
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    _selectedCategoryFilter = widget.initialCategoryIndex;
  }

  @override
  void didUpdateWidget(covariant HomeScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.initialCategoryIndex != widget.initialCategoryIndex) {
      setState(() {
        _selectedCategoryFilter = widget.initialCategoryIndex;
      });
    }
  }

  final List<PdfToolItem> _allTools = const [
    // Organize
    PdfToolItem(
      id: 'merge',
      title: 'Merge PDF',
      description: 'Combine multiple PDF files into one unified document with custom ordering.',
      icon: Icons.call_merge_rounded,
      primaryColor: Color(0xFFFF4757),
      secondaryColor: Color(0xFFFF6B81),
      category: ToolCategory.organize,
      route: '/merge',
      isFeatured: true,
    ),
    PdfToolItem(
      id: 'split',
      title: 'Split PDF',
      description: 'Extract specific page ranges or burst all pages into individual documents.',
      icon: Icons.call_split_rounded,
      primaryColor: Color(0xFF5F27CD),
      secondaryColor: Color(0xFF341F97),
      category: ToolCategory.organize,
      route: '/split',
      isFeatured: true,
    ),
    PdfToolItem(
      id: 'organize',
      title: 'Organize Pages',
      description: 'Visual drag-and-drop grid to rotate 90°, reorder, duplicate, or delete pages.',
      icon: Icons.grid_view_rounded,
      primaryColor: Color(0xFF00D2D3),
      secondaryColor: Color(0xFF01A3A4),
      category: ToolCategory.organize,
      route: '/organize',
      isFeatured: true,
    ),

    // Optimize
    PdfToolItem(
      id: 'compress',
      title: 'Compress PDF',
      description: 'Reduce file size with Extreme, Recommended, or High-Quality presets.',
      icon: Icons.compress_rounded,
      primaryColor: Color(0xFF10AC84),
      secondaryColor: Color(0xFF1DD1A1),
      category: ToolCategory.optimize,
      route: '/compress',
      isFeatured: true,
    ),
    PdfToolItem(
      id: 'flatten',
      title: 'Flatten PDF',
      description: 'Bake interactive form fields and annotations into static document layers.',
      icon: Icons.layers_clear_rounded,
      primaryColor: Color(0xFF576574),
      secondaryColor: Color(0xFF222F3E),
      category: ToolCategory.optimize,
      route: '/compress',
    ),

    // Convert
    PdfToolItem(
      id: 'img_to_pdf',
      title: 'Images to PDF',
      description: 'Convert JPG, PNG, WebP, and TIFF photos into high-quality PDF documents.',
      icon: Icons.image_rounded,
      primaryColor: Color(0xFFFF9F43),
      secondaryColor: Color(0xFFEE5253),
      category: ToolCategory.convert,
      route: '/img_to_pdf',
      isFeatured: true,
    ),
    PdfToolItem(
      id: 'pdf_to_img',
      title: 'PDF to Images',
      description: 'Rasterize PDF pages into crystal-clear PNG or JPEG image sequences.',
      icon: Icons.photo_library_rounded,
      primaryColor: Color(0xFF54A0FF),
      secondaryColor: Color(0xFF2E86DE),
      category: ToolCategory.convert,
      route: '/organize',
    ),

    // Edit & Sign
    PdfToolItem(
      id: 'watermark',
      title: 'Add Watermark',
      description: 'Stamp custom text or confidential overlays with full opacity and size controls.',
      icon: Icons.branding_watermark_rounded,
      primaryColor: Color(0xFFEE5253),
      secondaryColor: Color(0xFFFF6B6B),
      category: ToolCategory.editSign,
      route: '/watermark',
      isFeatured: true,
    ),
    PdfToolItem(
      id: 'viewer',
      title: 'PDF Viewer & Print',
      description: 'Crisp interactive document viewer with zoom, page thumbnails, and direct printing.',
      icon: Icons.visibility_rounded,
      primaryColor: Color(0xFF341F97),
      secondaryColor: Color(0xFF5F27CD),
      category: ToolCategory.editSign,
      route: '/viewer',
    ),

    // Security
    PdfToolItem(
      id: 'protect',
      title: 'Protect PDF',
      description: 'Encrypt your document with AES-256 password protection & permission locks.',
      icon: Icons.lock_outline_rounded,
      primaryColor: Color(0xFFFF5252),
      secondaryColor: Color(0xFFFF793F),
      category: ToolCategory.security,
      route: '/watermark',
    ),
    PdfToolItem(
      id: 'unlock',
      title: 'Unlock PDF',
      description: 'Remove password protection and permissions restrictions from protected files.',
      icon: Icons.lock_open_rounded,
      primaryColor: Color(0xFF2ED573),
      secondaryColor: Color(0xFF7BED9F),
      category: ToolCategory.security,
      route: '/compress',
    ),
  ];

  List<PdfToolItem> get _filteredTools {
    return _allTools.where((tool) {
      // Category filter
      if (_selectedCategoryFilter != 0) {
        final targetCat = ToolCategory.values[_selectedCategoryFilter - 1];
        if (tool.category != targetCat) return false;
      }
      // Search query filter
      if (_searchQuery.isNotEmpty) {
        final query = _searchQuery.toLowerCase();
        final matchesTitle = tool.title.toLowerCase().contains(query);
        final matchesDesc = tool.description.toLowerCase().contains(query);
        return matchesTitle || matchesDesc;
      }
      return true;
    }).toList();
  }

  void _openTool(BuildContext context, PdfToolItem tool) {
    Widget targetScreen;
    switch (tool.id) {
      case 'merge':
        targetScreen = const MergeScreen();
        break;
      case 'split':
        targetScreen = const SplitScreen();
        break;
      case 'organize':
        targetScreen = const OrganizeScreen();
        break;
      case 'compress':
      case 'flatten':
      case 'unlock':
        targetScreen = const CompressScreen();
        break;
      case 'img_to_pdf':
        targetScreen = const ImgToPdfScreen();
        break;
      case 'watermark':
      case 'protect':
        targetScreen = const WatermarkScreen();
        break;
      case 'viewer':
      default:
        targetScreen = const ViewerScreen();
        break;
    }

    Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => targetScreen),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return SingleChildScrollView(
      padding: const EdgeInsets.symmetric(horizontal: 28.0, vertical: 24.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Hero Banner
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(28),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF2C0F2F), Color(0xFF13182C)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: AppTheme.primaryCoral.withValues(alpha: 0.25),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryCoral.withValues(alpha: 0.1),
                  blurRadius: 30,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppTheme.primaryCoral.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(
                                color: AppTheme.primaryCoral.withValues(alpha: 0.4),
                              ),
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(Icons.shield_outlined, size: 14, color: AppTheme.primaryCoral),
                                SizedBox(width: 6),
                                Text(
                                  '100% PRIVATE • ZERO CLOUD UPLOADS',
                                  style: TextStyle(
                                    color: AppTheme.primaryCoral,
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'Every tool you need to work with PDFs in one place',
                        style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: -0.5,
                            ),
                      ),
                      const SizedBox(height: 8),
                      const Text(
                        'Fast, local processing on Fedora Linux & Android. Merge, split, compress, organize, and watermark with absolute privacy.',
                        style: TextStyle(
                          color: Color(0xFFB0B7C6),
                          fontSize: 14,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 24),
                ClipRRect(
                  borderRadius: BorderRadius.circular(16),
                  child: Image.asset(
                    'assets/images/logo.jpg',
                    width: 110,
                    height: 110,
                    fit: BoxFit.cover,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 28),

          // Search & Filter Bar
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _searchController,
                  onChanged: (val) => setState(() => _searchQuery = val),
                  decoration: InputDecoration(
                    hintText: 'Search tools (e.g. merge, split, compress, watermark, images)...',
                    prefixIcon: const Icon(Icons.search),
                    suffixIcon: _searchQuery.isNotEmpty
                        ? IconButton(
                            icon: const Icon(Icons.clear),
                            onPressed: () {
                              _searchController.clear();
                              setState(() => _searchQuery = '');
                            },
                          )
                        : null,
                    filled: true,
                    fillColor: isDark ? AppTheme.darkSurface : AppTheme.lightSurface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                      ),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(
                        color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder,
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),

          // Quick category pills
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _buildCategoryPill(0, 'All Tools'),
                const SizedBox(width: 8),
                _buildCategoryPill(1, 'Organize PDF'),
                const SizedBox(width: 8),
                _buildCategoryPill(2, 'Optimize PDF'),
                const SizedBox(width: 8),
                _buildCategoryPill(3, 'Convert PDF'),
                const SizedBox(width: 8),
                _buildCategoryPill(4, 'Edit & Sign'),
                const SizedBox(width: 8),
                _buildCategoryPill(5, 'Security'),
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Tools Grid
          if (_filteredTools.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 48.0),
                child: Column(
                  children: [
                    const Icon(Icons.search_off_rounded, size: 56, color: Colors.grey),
                    const SizedBox(height: 12),
                    Text(
                      'No tools found for "$_searchQuery"',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ],
                ),
              ),
            )
          else
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
                maxCrossAxisExtent: 290,
                childAspectRatio: 0.98,
                crossAxisSpacing: 18,
                mainAxisSpacing: 18,
              ),
              itemCount: _filteredTools.length,
              itemBuilder: (context, index) {
                final tool = _filteredTools[index];
                return ToolCard(
                  tool: tool,
                  onTap: () => _openTool(context, tool),
                );
              },
            ),
          const SizedBox(height: 36),
        ],
      ),
    );
  }

  Widget _buildCategoryPill(int index, String label) {
    final isSelected = _selectedCategoryFilter == index;
    return ChoiceChip(
      label: Text(label),
      selected: isSelected,
      onSelected: (selected) {
        if (selected) {
          setState(() => _selectedCategoryFilter = index);
        }
      },
      selectedColor: AppTheme.primaryCoral,
      labelStyle: TextStyle(
        color: isSelected ? Colors.white : null,
        fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
      ),
    );
  }
}
