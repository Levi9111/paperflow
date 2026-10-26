import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors inspired by PaperFlow identity
  static const Color primaryCoral = Color(0xFFFF4757);
  static const Color primaryCrimson = Color(0xFFEE5253);
  static const Color accentViolet = Color(0xFF5F27CD);
  static const Color accentIndigo = Color(0xFF341F97);
  static const Color accentCyan = Color(0xFF00D2D3);
  static const Color accentGreen = Color(0xFF10AC84);
  static const Color accentAmber = Color(0xFFFF9F43);

  // Dark Theme Palette
  static const Color darkBg = Color(0xFF0C0E14);
  static const Color darkSurface = Color(0xFF161922);
  static const Color darkSurfaceElevated = Color(0xFF1F2430);
  static const Color darkBorder = Color(0xFF2B3242);
  static const Color darkTextPrimary = Color(0xFFF1F2F6);
  static const Color darkTextSecondary = Color(0xFFA4B0BE);

  // Light Theme Palette
  static const Color lightBg = Color(0xFFF8F9FA);
  static const Color lightSurface = Color(0xFFFFFFFF);
  static const Color lightSurfaceElevated = Color(0xFFF1F2F6);
  static const Color lightBorder = Color(0xFFE4E7EB);
  static const Color lightTextPrimary = Color(0xFF2F3542);
  static const Color lightTextSecondary = Color(0xFF747D8C);

  // Gradients
  static const LinearGradient brandGradient = LinearGradient(
    colors: [primaryCoral, accentViolet],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static const LinearGradient cardGlowGradient = LinearGradient(
    colors: [Color(0x33FF4757), Color(0x335F27CD)],
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
  );

  static final String? interFont = GoogleFonts.inter().fontFamily;
  static final String? outfitFont = GoogleFonts.outfit().fontFamily;

  static ThemeData get darkTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      fontFamily: interFont,
      scaffoldBackgroundColor: darkBg,
      primaryColor: primaryCoral,
      colorScheme: const ColorScheme.dark(
        primary: primaryCoral,
        secondary: accentViolet,
        surface: darkSurface,
        surfaceContainerHighest: darkSurfaceElevated,
        onSurface: darkTextPrimary,
        outline: darkBorder,
      ),
      textTheme: TextTheme(
        headlineLarge: TextStyle(
          fontFamily: outfitFont,
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: darkTextPrimary,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontFamily: outfitFont,
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: darkTextPrimary,
        ),
        titleLarge: TextStyle(
          fontFamily: outfitFont,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: darkTextPrimary,
        ),
        bodyLarge: TextStyle(
          fontFamily: interFont,
          fontSize: 16,
          color: darkTextPrimary,
        ),
        bodyMedium: TextStyle(
          fontFamily: interFont,
          fontSize: 14,
          color: darkTextSecondary,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: darkBg,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: darkTextPrimary),
      ),
      cardTheme: CardThemeData(
        color: darkSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: darkBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryCoral,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 2,
        ),
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      fontFamily: interFont,
      scaffoldBackgroundColor: lightBg,
      primaryColor: primaryCoral,
      colorScheme: const ColorScheme.light(
        primary: primaryCoral,
        secondary: accentViolet,
        surface: lightSurface,
        surfaceContainerHighest: lightSurfaceElevated,
        onSurface: lightTextPrimary,
        outline: lightBorder,
      ),
      textTheme: TextTheme(
        headlineLarge: TextStyle(
          fontFamily: outfitFont,
          fontSize: 32,
          fontWeight: FontWeight.bold,
          color: lightTextPrimary,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontFamily: outfitFont,
          fontSize: 24,
          fontWeight: FontWeight.w700,
          color: lightTextPrimary,
        ),
        titleLarge: TextStyle(
          fontFamily: outfitFont,
          fontSize: 18,
          fontWeight: FontWeight.w600,
          color: lightTextPrimary,
        ),
        bodyLarge: TextStyle(
          fontFamily: interFont,
          fontSize: 16,
          color: lightTextPrimary,
        ),
        bodyMedium: TextStyle(
          fontFamily: interFont,
          fontSize: 14,
          color: lightTextSecondary,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: lightBg,
        elevation: 0,
        centerTitle: false,
        iconTheme: IconThemeData(color: lightTextPrimary),
      ),
      cardTheme: CardThemeData(
        color: lightSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: lightBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryCoral,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          elevation: 2,
        ),
      ),
    );
  }
}
