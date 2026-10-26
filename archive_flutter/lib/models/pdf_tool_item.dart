import 'package:flutter/material.dart';

enum ToolCategory {
  organize,
  optimize,
  convert,
  editSign,
  security,
}

class PdfToolItem {
  final String id;
  final String title;
  final String description;
  final IconData icon;
  final Color primaryColor;
  final Color secondaryColor;
  final ToolCategory category;
  final String route;
  final bool isFeatured;
  final bool isPremiumFeature;

  const PdfToolItem({
    required this.id,
    required this.title,
    required this.description,
    required this.icon,
    required this.primaryColor,
    required this.secondaryColor,
    required this.category,
    required this.route,
    this.isFeatured = false,
    this.isPremiumFeature = false,
  });
}
