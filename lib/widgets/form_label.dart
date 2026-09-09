import 'package:flutter/material.dart';

class FormLabel extends StatelessWidget {
  const FormLabel({super.key, required this.number, required this.label});

  final String number;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        CircleAvatar(
          radius: 14,
          backgroundColor: Theme.of(context).colorScheme.primary,
          foregroundColor: Colors.white,
          child: Text(number, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w900)),
        ),
        const SizedBox(width: 9),
        Text(label, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w900)),
      ],
    );
  }
}
