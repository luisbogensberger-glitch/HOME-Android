"""Keep optional work early while giving a valid live UI enough time to confirm health."""
from pathlib import Path
import sys

path=Path(sys.argv[1]) if len(sys.argv)>1 else Path('sync-overlay/app/src/main/java/com/luis/home/MainActivity.java')
s=path.read_text()
old='''            },15000);\n        } catch(Throwable e) {'''
new='''            },10000);\n        } catch(Throwable e) {'''
if old not in s:
    raise SystemExit('v19 watchdog timeout pattern not found')
s=s.replace(old,new,1)
old2='''        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::startOptionalServices, 900);'''
new2='''        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(this::startOptionalServices, 250);'''
if old2 not in s:
    raise SystemExit('optional services delay pattern not found')
s=s.replace(old2,new2,1)
path.write_text(s)
print(f'Patched {path}: 10s health watchdog, early non-blocking optional services')
