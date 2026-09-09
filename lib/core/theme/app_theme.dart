import 'package:flutter/material.dart';

/// Paleta institucional UdeG. Única fuente de color de la app:
/// ningún widget debe declarar colores literales.
class AppColors {
  const AppColors._();

  // Colores base de la identidad
  static const blue = Color(0xFF002D62); // AZUL UdeG
  static const crimson = Color(0xFFB32034); // ROJO CARMESÍ
  static const gold = Color(0xFFDAA520); // ORO UdeG

  // Variaciones del azul: superficies, degradados y fondos oscuros
  static const blueDeep = Color(0xFF001B3C);
  static const blueSteel = Color(0xFF24486F);
  static const blueLight = Color(0xFF0B4A93);
  static const blueTint = Color(0xFFE4EBF5);

  // Variaciones de los acentos
  static const crimsonDark = Color(0xFF7C1624);
  static const crimsonTint = Color(0xFFF9E6E9);
  static const goldDeep = Color(0xFFA6791A);
  static const goldDark = Color(0xFF8A6410);
  static const goldTint = Color(0xFFFBF2DD);

  // Neutros
  static const background = Color(0xFFF3F5F9);
  static const surface = Colors.white;
  static const border = Color(0xFFDCE3ED);
  static const textPrimary = Color(0xFF14203A);
  static const textSecondary = Color(0xFF5D6980);
  static const textMuted = Color(0xFF93A0B5);
}

ThemeData buildAppTheme() {
  final colorScheme = ColorScheme.fromSeed(
    seedColor: AppColors.blue,
    brightness: Brightness.light,
  ).copyWith(
    primary: AppColors.blue,
    onPrimary: Colors.white,
    primaryContainer: AppColors.blueTint,
    onPrimaryContainer: AppColors.blueDeep,
    secondary: AppColors.crimson,
    onSecondary: Colors.white,
    secondaryContainer: AppColors.crimsonTint,
    onSecondaryContainer: AppColors.crimsonDark,
    tertiary: AppColors.gold,
    onTertiary: AppColors.blueDeep,
    tertiaryContainer: AppColors.goldTint,
    onTertiaryContainer: AppColors.goldDark,
    surface: AppColors.surface,
    onSurface: AppColors.textPrimary,
    outline: AppColors.border,
  );

  final baseText = ThemeData.light().textTheme.apply(
        bodyColor: AppColors.textPrimary,
        displayColor: AppColors.textPrimary,
      );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: AppColors.background,
    fontFamily: 'Roboto',
    textTheme: baseText,
    appBarTheme: const AppBarTheme(
      elevation: 0,
      centerTitle: false,
      backgroundColor: AppColors.blue,
      foregroundColor: Colors.white,
      surfaceTintColor: Colors.transparent,
      iconTheme: IconThemeData(color: Colors.white),
      titleTextStyle: TextStyle(
        color: Colors.white,
        fontSize: 20,
        fontWeight: FontWeight.w800,
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: AppColors.blue,
      surfaceTintColor: Colors.transparent,
      indicatorColor: AppColors.gold,
      elevation: 0,
      iconTheme: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? const IconThemeData(color: AppColors.blueDeep)
            : IconThemeData(color: Colors.white.withValues(alpha: 0.75)),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (states) => TextStyle(
          fontSize: 12,
          fontWeight: states.contains(WidgetState.selected)
              ? FontWeight.w800
              : FontWeight.w500,
          color: states.contains(WidgetState.selected)
              ? Colors.white
              : Colors.white.withValues(alpha: 0.75),
        ),
      ),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: AppColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: AppColors.surface,
      hintStyle: const TextStyle(color: AppColors.textMuted),
      prefixIconColor: AppColors.textSecondary,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: AppColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: AppColors.blue, width: 1.5),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: AppColors.crimson,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: AppColors.blue),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? Colors.white
            : AppColors.textMuted,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.gold
            : AppColors.blueTint,
      ),
      trackOutlineColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? AppColors.gold
            : AppColors.border,
      ),
    ),
    listTileTheme: const ListTileThemeData(
      iconColor: AppColors.blue,
      textColor: AppColors.textPrimary,
    ),
    expansionTileTheme: const ExpansionTileThemeData(
      iconColor: AppColors.blue,
      collapsedIconColor: AppColors.textSecondary,
      textColor: AppColors.textPrimary,
      collapsedTextColor: AppColors.textPrimary,
    ),
    dividerTheme: const DividerThemeData(
      color: AppColors.border,
      thickness: 1,
    ),
    dialogTheme: const DialogThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: AppColors.surface,
      surfaceTintColor: Colors.transparent,
    ),
    snackBarTheme: const SnackBarThemeData(
      backgroundColor: AppColors.blueDeep,
      contentTextStyle: TextStyle(color: Colors.white),
    ),
  );
}
