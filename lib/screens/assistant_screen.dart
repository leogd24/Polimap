import 'package:flutter/material.dart';

import '../data/faq_entries.dart';
import '../widgets/empty_state.dart';
import '../widgets/polimap_logo.dart';

class AssistantScreen extends StatefulWidget {
  const AssistantScreen({super.key});

  @override
  State<AssistantScreen> createState() => _AssistantScreenState();
}

class _AssistantScreenState extends State<AssistantScreen> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final normalized = _query.toLowerCase().trim();
    final results = faqEntries.where((entry) {
      return normalized.isEmpty ||
          entry.question.toLowerCase().contains(normalized) ||
          entry.answer.toLowerCase().contains(normalized);
    }).toList();

    return Scaffold(
      appBar: AppBar(title: const Text('Asistente POLIMAP')),
      body: Column(
        children: [
          Container(
            width: double.infinity,
            margin: const EdgeInsets.fromLTRB(18, 8, 18, 16),
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFF075A63),
              borderRadius: BorderRadius.circular(24),
            ),
            child: const Row(
              children: [
                PolimapLogo(size: 50, dark: true),
                SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Hola, ¿qué estás buscando?',
                        style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w900),
                      ),
                      SizedBox(height: 3),
                      Text(
                        'Escribe un trámite, servicio o lugar.',
                        style: TextStyle(color: Color(0xFFD4E7E6)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 18),
            child: TextField(
              controller: _controller,
              autofocus: false,
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Ej. ¿Dónde saco mi kardex?',
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        onPressed: () {
                          _controller.clear();
                          setState(() => _query = '');
                        },
                        icon: const Icon(Icons.close_rounded),
                      ),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: results.isEmpty
                ? const EmptyState(
                    icon: Icons.question_answer_outlined,
                    title: 'Aún no tengo esa respuesta',
                    body: 'Intenta escribir el nombre del servicio o edificio.',
                  )
                : ListView.separated(
                    padding: const EdgeInsets.fromLTRB(18, 6, 18, 28),
                    itemCount: results.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (context, index) {
                      final entry = results[index];
                      return Card(
                        child: ExpansionTile(
                          leading: CircleAvatar(
                            backgroundColor: const Color(0xFFE0EFEC),
                            foregroundColor: const Color(0xFF075A63),
                            child: Icon(entry.icon, size: 21),
                          ),
                          title: Text(entry.question, style: const TextStyle(fontWeight: FontWeight.w800)),
                          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                          children: [
                            Align(
                              alignment: Alignment.centerLeft,
                              child: Text(
                                entry.answer,
                                style: const TextStyle(color: Color(0xFF566660), height: 1.45),
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}
