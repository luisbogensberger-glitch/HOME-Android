"""Add v22 context-sensor JS bridge methods to the reconstructed AdaptiveBridge."""
from pathlib import Path
import sys

path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('src/luis-home-app/app/src/main/java/com/luis/home/AdaptiveBridge.java')
s = path.read_text()
anchor = '''    private String safeId(String value) {\n'''
if anchor not in s:
    raise SystemExit('AdaptiveBridge safeId anchor not found')
methods = '''    @JavascriptInterface\n    public String contextSensorStatus() {\n        return ContextSensor.status(context).toString();\n    }\n\n    @JavascriptInterface\n    public void setContextSensorsEnabled(boolean enabled) {\n        ContextSensor.setEnabled(context, enabled);\n    }\n\n    @JavascriptInterface\n    public void requestContextSensorPermissions() {\n        ContextSensor.setEnabled(context, true);\n        boolean fine = context.checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;\n        boolean coarse = context.checkSelfPermission(android.Manifest.permission.ACCESS_COARSE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED;\n        if (fine || coarse) return;\n        activity.runOnUiThread(() -> activity.requestPermissions(\n                new String[]{android.Manifest.permission.ACCESS_FINE_LOCATION, android.Manifest.permission.ACCESS_COARSE_LOCATION}, 65));\n    }\n\n    @JavascriptInterface\n    public void captureContextSignals() {\n        queue.execute(() -> {\n            ContextSensor.Sample sample = ContextSensor.capture(context);\n            try {\n                if (sample.privateActivity != null) {\n                    worker.enqueue("private_activity", sample.privateActivity);\n                    worker.flushOutbox();\n                }\n            } catch (Exception ignored) { }\n            try { deliver("onVBrainContextSignals", sample.summary); } catch (Exception ignored) { }\n        });\n    }\n\n'''
s = s.replace(anchor, methods + anchor, 1)
path.write_text(s)
print(f'Patched {path}: v22 private context sensor bridge')
