#!/usr/bin/env python3
import sys, os, tempfile

try:
    from basic_pitch.inference import predict_and_save
except Exception as e:
    sys.stderr.write(f"Failed to import basic_pitch: {e}\n")
    sys.exit(1)

if len(sys.argv) < 2:
    sys.stderr.write("usage: runner.py <audio_path>\n")
    sys.exit(1)

audio_path = sys.argv[1]
if not os.path.exists(audio_path):
    sys.stderr.write("audio file not found\n")
    sys.exit(1)

out_dir = tempfile.mkdtemp()
predict_and_save([audio_path], out_dir, save_midi=True, save_model_outputs=False, sonify_midi=False)

for f in os.listdir(out_dir):
    if f.endswith('.mid') or f.endswith('.midi'):
        print(os.path.join(out_dir, f))
        sys.exit(0)

sys.stderr.write("no midi produced\n")
sys.exit(2)


