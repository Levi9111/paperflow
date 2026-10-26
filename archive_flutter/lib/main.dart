import 'package:flutter/material.dart';
import 'theme/app_theme.dart';
import 'widgets/adaptive_scaffold.dart';
import 'screens/home_screen.dart';

import 'services/file_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await FileService.purgeTempDirectory();
  runApp(const PaperFlowApp());
}

class PaperFlowApp extends StatefulWidget {
  const PaperFlowApp({super.key});

  @override
  State<PaperFlowApp> createState() => _PaperFlowAppState();
}

class _PaperFlowAppState extends State<PaperFlowApp> {
  bool _isDarkMode = true;
  int _navIndex = 0;

  void _toggleTheme() {
    setState(() {
      _isDarkMode = !_isDarkMode;
    });
  }

  void _onNavigationSelect(int index) {
    setState(() {
      _navIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PaperFlow — Modern PDF Manager',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: _isDarkMode ? ThemeMode.dark : ThemeMode.light,
      home: AdaptiveScaffold(
        isDarkMode: _isDarkMode,
        selectedIndex: _navIndex,
        onToggleTheme: _toggleTheme,
        onDestinationSelected: _onNavigationSelect,
        body: HomeScreen(initialCategoryIndex: _navIndex),
      ),
    );
  }
}
