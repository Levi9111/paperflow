import 'package:flutter_test/flutter_test.dart';
import 'package:paperflow/main.dart';

void main() {
  testWidgets('PaperFlow App smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const PaperFlowApp());
    expect(find.byType(PaperFlowApp), findsOneWidget);
  });
}
