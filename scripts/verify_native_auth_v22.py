"""Fail the build if the native Veqrya session migration is incomplete."""
from pathlib import Path
import sys

root=Path(__file__).resolve().parents[1]
worker=Path(sys.argv[1] if len(sys.argv)>1 else root/'src/luis-home-app/app/src/main/java/com/luis/home/WorkerSync.java')
main=Path(sys.argv[2] if len(sys.argv)>2 else root/'src/luis-home-app/app/src/main/java/com/luis/home/MainActivity.java')
session=worker.parent/'VeqryaSession.java'

w=worker.read_text();m=main.read_text();v=session.read_text()
assert 'VEQRYA_MOBILE_API' in w
assert 'VeqryaSession veqrya' in w
assert 'authMode()' in w and '"veqrya"' in w
assert 'mobileApiSupports' in w
assert 'veqrya.refreshAccessToken()' in w
assert 'X-HOME-Authorization' in w
assert 'configureVeqrya()' in m and 'worker.signInVeqrya' in m
assert 'worker.clearAuth()' in m
assert 'AndroidKeyStore' in v and 'refreshToken' in v
assert 'TYPE_TEXT_VARIATION_EMAIL_ADDRESS' in m
assert 'setText("")' in m
print('PASS: Veqrya session auth, Keystore refresh tokens, mobile API routing and legacy HOME fallback')
