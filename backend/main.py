# import os
# import shutil
# import tempfile
# import threading

# import numpy as np
# import soundfile as sf
# import torch
# import torchaudio
# from fastapi import FastAPI, UploadFile, File, Form, HTTPException
# from fastapi.middleware.cors import CORSMiddleware
# from fastapi.responses import FileResponse
# from TTS.api import TTS

# # Compatibility patch for PyTorch 2.6+ checkpoints used by some XTTS installs.
# _original_torch_load = torch.load

# def _patched_torch_load(*args, **kwargs):
#     kwargs.setdefault("weights_only", False)
#     return _original_torch_load(*args, **kwargs)

# torch.load = _patched_torch_load

# # Use SoundFile to load audio, avoiding TorchCodec issues in some environments.
# def _patched_torchaudio_load(filepath, *args, **kwargs):
#     data, sample_rate = sf.read(filepath, dtype="float32", always_2d=True)
#     tensor = torch.from_numpy(data.T.copy())
#     return tensor, sample_rate

# torchaudio.load = _patched_torchaudio_load

# os.environ.setdefault("COQUI_TOS_AGREED", "1")

# app = FastAPI(title="Voice Cloning API", version="1.1.0")
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],
#     allow_credentials=False,
#     allow_methods=["GET", "POST"],
#     allow_headers=["*"],
# )

# # Languages supported by the multilingual XTTS v2 model.
# SUPPORTED_LANGUAGES = {
#     "en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
#     "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko", "hi"
# }
# LANGUAGE_ALIASES = {"zh": "zh-cn"}

# print("Loading XTTS v2 model; first startup can take a while...")
# tts = TTS(
#     model_name="tts_models/multilingual/multi-dataset/xtts_v2",
#     progress_bar=False
# )
# print("XTTS v2 model loaded successfully!")

# # Protect the model from simultaneous calls that may exhaust memory.
# inference_lock = threading.Lock()


# @app.get("/health")
# async def health():
#     return {
#         "success": True,
#         "service": "xtts-v2",
#         "supported_languages": sorted(SUPPORTED_LANGUAGES)
#     }


# @app.post("/generate-voice")
# async def generate_voice(
#     text: str = Form(...),
#     language: str = Form("en"),
#     speaker_wav: UploadFile = File(...)
# ):
#     temp_dir = None
#     try:
#         text = (text or "").strip()
#         if not text:
#             raise HTTPException(status_code=400, detail="សូមបញ្ចូលអត្ថបទ!")

#         language = LANGUAGE_ALIASES.get((language or "en").lower(), (language or "en").lower())
#         if language not in SUPPORTED_LANGUAGES:
#             raise HTTPException(
#                 status_code=400,
#                 detail=(
#                     f"XTTS v2 មិនគាំទ្រភាសា '{language}' ទេ។ "
#                     "សូមជ្រើសរើសភាសាដែលបានបង្ហាញក្នុងបញ្ជី Supported Languages។"
#                 )
#             )

#         if not speaker_wav or not speaker_wav.filename:
#             raise HTTPException(status_code=400, detail="សូមផ្ញើសំឡេងគំរូ (speaker_wav) ជាមុនសិន។")

#         temp_dir = tempfile.mkdtemp(prefix="xtts_")
#         raw_audio_path = os.path.join(temp_dir, "speaker_input")
#         clean_wav_path = os.path.join(temp_dir, "speaker_ready.wav")
#         output_path = os.path.join(temp_dir, "cloned_output.wav")

#         with open(raw_audio_path, "wb") as out_file:
#             shutil.copyfileobj(speaker_wav.file, out_file)

#         # Normalize input to a mono, 16-bit PCM WAV. Keep original sample rate;
#         # XTTS will perform its own resampling as required.
#         try:
#             audio, sample_rate = sf.read(raw_audio_path, dtype="float32", always_2d=True)
#             if audio.size == 0 or sample_rate <= 0:
#                 raise ValueError("Audio sample is empty.")
#             mono = np.mean(audio, axis=1)
#             peak = float(np.max(np.abs(mono))) if mono.size else 0.0
#             if peak < 0.005:
#                 raise ValueError("Audio sample is silent or too quiet.")
#             # Normalize quiet recordings while avoiding clipping. This can help
#             # the speaker encoder, but cannot guarantee an exact voice match.
#             if peak > 0:
#                 mono = mono * (0.95 / peak)
#                 mono = np.clip(mono, -1.0, 1.0)
#             if len(mono) / float(sample_rate) < 3:
#                 raise ValueError("Audio sample is too short; record at least 3 seconds (5–10 seconds recommended).")
#             sf.write(clean_wav_path, mono, sample_rate, format="WAV", subtype="PCM_16")
#         except Exception as audio_error:
#             raise HTTPException(
#                 status_code=400,
#                 detail=(
#                     "មិនអាចអាន Audio Sample បានទេ។ សូមប្រើឯកសារ WAV ឬ MP3 ដែលអាចបើកបាន។ "
#                     f"ព័ត៌មានបន្ថែម៖ {audio_error}"
#                 )
#             )

#         def run_inference():
#             tts.tts_to_file(
#                 text=text,
#                 speaker_wav=clean_wav_path,
#                 language=language,
#                 file_path=output_path
#             )

#         with inference_lock:
#             run_inference()

#         if not os.path.exists(output_path) or os.path.getsize(output_path) == 0:
#             raise HTTPException(status_code=500, detail="XTTS មិនបានបង្កើតឯកសារសំឡេងទេ។")

#         # FileResponse streams the file. Background cleanup is handled below by
#         # a small response background task so the file remains available until sent.
#         from starlette.background import BackgroundTask
#         return FileResponse(
#             path=output_path,
#             media_type="audio/wav",
#             filename="generated_voice.wav",
#             background=BackgroundTask(shutil.rmtree, temp_dir, ignore_errors=True)
#         )

#     except HTTPException:
#         if temp_dir:
#             shutil.rmtree(temp_dir, ignore_errors=True)
#         raise
#     except Exception as exc:
#         if temp_dir:
#             shutil.rmtree(temp_dir, ignore_errors=True)
#         print("XTTS generation error:", repr(exc))
#         raise HTTPException(
#             status_code=500,
#             detail="ការបង្កើតសំឡេង Voice Cloning បរាជ័យ។ សូមពិនិត្យ Audio Sample និង Python server log។"
#         ) from exc
#     finally:
#         await speaker_wav.close()
