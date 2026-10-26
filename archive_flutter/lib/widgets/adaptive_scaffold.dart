import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AdaptiveScaffold extends StatefulWidget {
  final Widget body;
  final int selectedIndex;
  final ValueChanged<int> onDestinationSelected;
  final VoidCallback onToggleTheme;
  final bool isDarkMode;

  const AdaptiveScaffold({
    super.key,
    required this.body,
    required this.selectedIndex,
    required this.onDestinationSelected,
    required this.onToggleTheme,
    required this.isDarkMode,
  });

  @override
  State<AdaptiveScaffold> createState() => _AdaptiveScaffoldState();
}

class _AdaptiveScaffoldState extends State<AdaptiveScaffold> {
  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isDesktop = screenWidth >= 850;

    if (isDesktop) {
      return Scaffold(
        body: Row(
          children: [
            // Desktop Sidebar / Navigation Rail
            Container(
              width: 240,
              decoration: BoxDecoration(
                color: widget.isDarkMode ? AppTheme.darkSurface : AppTheme.lightSurface,
                border: Border(
                  right: BorderSide(
                    color: widget.isDarkMode ? AppTheme.darkBorder : AppTheme.lightBorder,
                    width: 1,
                  ),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // App Brand Header
                  Padding(
                    padding: const EdgeInsets.all(24.0),
                    child: Row(
                      children: [
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: Image.asset(
                            'assets/images/logo.jpg',
                            width: 38,
                            height: 38,
                            fit: BoxFit.cover,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'PaperFlow',
                              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: -0.5,
                                  ),
                            ),
                            Text(
                              'PDF Studio Pro',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppTheme.primaryCoral,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const Divider(height: 1),
                  const SizedBox(height: 16),
                  // Navigation Items
                  _buildRailItem(0, Icons.grid_view_rounded, 'All Tools'),
                  _buildRailItem(1, Icons.folder_copy_rounded, 'Organize'),
                  _buildRailItem(2, Icons.speed_rounded, 'Optimize'),
                  _buildRailItem(3, Icons.transform_rounded, 'Convert'),
                  _buildRailItem(4, Icons.draw_rounded, 'Edit & Sign'),
                  _buildRailItem(5, Icons.lock_outline_rounded, 'Security'),
                  const Spacer(),
                  const Divider(height: 1),
                  // Bottom controls (Theme toggle & Linux info)
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Icon(
                              Icons.computer,
                              size: 16,
                              color: widget.isDarkMode
                                  ? AppTheme.darkTextSecondary
                                  : AppTheme.lightTextSecondary,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              'Fedora Linux',
                              style: TextStyle(
                                fontSize: 12,
                                color: widget.isDarkMode
                                    ? AppTheme.darkTextSecondary
                                    : AppTheme.lightTextSecondary,
                              ),
                            ),
                          ],
                        ),
                        IconButton(
                          icon: Icon(
                            widget.isDarkMode ? Icons.light_mode : Icons.dark_mode,
                            size: 20,
                          ),
                          onPressed: widget.onToggleTheme,
                          tooltip: 'Toggle Theme',
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // Main Content Area
            Expanded(child: widget.body),
          ],
        ),
      );
    } else {
      // Mobile Layout (Android)
      return Scaffold(
        appBar: AppBar(
          title: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: Image.asset(
                  'assets/images/logo.jpg',
                  width: 30,
                  height: 30,
                ),
              ),
              const SizedBox(width: 10),
              const Text(
                'PaperFlow',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 19),
              ),
            ],
          ),
          actions: [
            IconButton(
              icon: Icon(widget.isDarkMode ? Icons.light_mode : Icons.dark_mode),
              onPressed: widget.onToggleTheme,
            ),
          ],
        ),
        body: widget.body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: widget.selectedIndex > 3 ? 0 : widget.selectedIndex,
          onDestinationSelected: widget.onDestinationSelected,
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.grid_view_outlined),
              selectedIcon: Icon(Icons.grid_view_rounded),
              label: 'Tools',
            ),
            NavigationDestination(
              icon: Icon(Icons.folder_copy_outlined),
              selectedIcon: Icon(Icons.folder_copy_rounded),
              label: 'Organize',
            ),
            NavigationDestination(
              icon: Icon(Icons.speed_outlined),
              selectedIcon: Icon(Icons.speed_rounded),
              label: 'Optimize',
            ),
            NavigationDestination(
              icon: Icon(Icons.transform_outlined),
              selectedIcon: Icon(Icons.transform_rounded),
              label: 'Convert',
            ),
          ],
        ),
      );
    }
  }

  Widget _buildRailItem(int index, IconData icon, String label) {
    final isSelected = widget.selectedIndex == index;
    final isDark = widget.isDarkMode;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3),
      child: InkWell(
        onTap: () => widget.onDestinationSelected(index),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
          decoration: BoxDecoration(
            color: isSelected
                ? AppTheme.primaryCoral.withValues(alpha: 0.12)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: isSelected
                ? Border.all(color: AppTheme.primaryCoral.withValues(alpha: 0.3))
                : null,
          ),
          child: Row(
            children: [
              Icon(
                icon,
                size: 20,
                color: isSelected
                    ? AppTheme.primaryCoral
                    : (isDark ? AppTheme.darkTextSecondary : AppTheme.lightTextSecondary),
              ),
              const SizedBox(width: 12),
              Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected
                      ? AppTheme.primaryCoral
                      : (isDark ? AppTheme.darkTextPrimary : AppTheme.lightTextPrimary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
