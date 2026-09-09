import 'package:flutter/material.dart';

import '../data/campus_buildings.dart';
import '../widgets/form_label.dart';

class ReportScreen extends StatefulWidget {
  const ReportScreen({super.key});

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  final _formKey = GlobalKey<FormState>();
  final _descriptionController = TextEditingController();
  String? _category;
  String? _location;
  bool _anonymous = true;
  bool _photoAdded = false;

  static const categories = [
    'Basura',
    'Mobiliario dañado',
    'Baños en mal estado',
    'Fuga de agua',
    'Iluminación',
    'Otro',
  ];

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        icon: const Icon(Icons.check_circle_rounded, color: Color(0xFF168A63), size: 52),
        title: const Text('Reporte preparado'),
        content: const Text(
          'La interfaz está lista. Al integrar la base de datos, el reporte se enviará a las autoridades escolares.',
          textAlign: TextAlign.center,
        ),
        actions: [
          FilledButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              _formKey.currentState?.reset();
              setState(() {
                _category = null;
                _location = null;
                _anonymous = true;
                _photoAdded = false;
                _descriptionController.clear();
              });
            },
            child: const Text('Entendido'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(18, 12, 18, 30),
        children: [
          Container(
            padding: const EdgeInsets.all(18),
            decoration: BoxDecoration(
              color: const Color(0xFFFFF2DD),
              borderRadius: BorderRadius.circular(22),
              border: Border.all(color: const Color(0xFFF0D3A0)),
            ),
            child: const Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.campaign_rounded, color: Color(0xFFA35D17)),
                SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Ayúdanos a mejorar el campus. No utilices este formulario para emergencias.',
                    style: TextStyle(color: Color(0xFF754515), height: 1.35, fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),
          const FormLabel(number: '1', label: '¿Qué ocurrió?'),
          const SizedBox(height: 9),
          DropdownButtonFormField<String>(
            initialValue: _category,
            isExpanded: true,
            decoration: const InputDecoration(
              hintText: 'Selecciona una categoría',
              prefixIcon: Icon(Icons.category_outlined),
            ),
            items: categories
                .map((category) => DropdownMenuItem(value: category, child: Text(category)))
                .toList(),
            onChanged: (value) => setState(() => _category = value),
            validator: (value) => value == null ? 'Selecciona una categoría' : null,
          ),
          const SizedBox(height: 18),
          const FormLabel(number: '2', label: 'Ubicación'),
          const SizedBox(height: 9),
          DropdownButtonFormField<String>(
            initialValue: _location,
            isExpanded: true,
            decoration: const InputDecoration(
              hintText: 'Selecciona el edificio o zona',
              prefixIcon: Icon(Icons.location_on_outlined),
            ),
            items: [
              ...campusBuildings.map(
                (building) => DropdownMenuItem(
                  value: 'Edificio ${building.number}',
                  child: Text('Edificio ${building.number} · ${building.name}'),
                ),
              ),
              const DropdownMenuItem(value: 'Explanada', child: Text('Explanada')),
              const DropdownMenuItem(value: 'Otra zona', child: Text('Otra zona')),
            ],
            onChanged: (value) => setState(() => _location = value),
            validator: (value) => value == null ? 'Indica la ubicación' : null,
          ),
          const SizedBox(height: 18),
          const FormLabel(number: '3', label: 'Fotografía'),
          const SizedBox(height: 9),
          Material(
            color: _photoAdded ? const Color(0xFFE5F3ED) : Colors.white,
            borderRadius: BorderRadius.circular(20),
            child: InkWell(
              borderRadius: BorderRadius.circular(20),
              onTap: () => setState(() => _photoAdded = !_photoAdded),
              child: Container(
                height: 120,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(
                    color: _photoAdded ? const Color(0xFF5BAE8E) : const Color(0xFFD9E3DF),
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _photoAdded ? Icons.check_circle_rounded : Icons.add_a_photo_outlined,
                      color: _photoAdded ? const Color(0xFF168A63) : const Color(0xFF60716B),
                      size: 34,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _photoAdded ? 'Fotografía agregada' : 'Toca para agregar una fotografía',
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 3),
                    const Text(
                      'Demostración de la interfaz',
                      style: TextStyle(fontSize: 12, color: Color(0xFF71807B)),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 18),
          const FormLabel(number: '4', label: 'Descripción'),
          const SizedBox(height: 9),
          TextFormField(
            controller: _descriptionController,
            minLines: 4,
            maxLines: 6,
            maxLength: 300,
            decoration: const InputDecoration(
              hintText: 'Describe brevemente el problema y alguna referencia para encontrarlo.',
              alignLabelWithHint: true,
            ),
            validator: (value) {
              if (value == null || value.trim().length < 10) {
                return 'Escribe una descripción de al menos 10 caracteres';
              }
              return null;
            },
          ),
          Card(
            child: SwitchListTile(
              value: _anonymous,
              onChanged: (value) => setState(() => _anonymous = value),
              secondary: const Icon(Icons.visibility_off_outlined),
              title: const Text('Enviar de forma anónima'),
              subtitle: const Text('No se mostrará información personal.'),
            ),
          ),
          const SizedBox(height: 18),
          SizedBox(
            height: 56,
            child: FilledButton.icon(
              onPressed: _submit,
              icon: const Icon(Icons.send_rounded),
              label: const Text('Enviar reporte'),
            ),
          ),
        ],
      ),
    );
  }
}
