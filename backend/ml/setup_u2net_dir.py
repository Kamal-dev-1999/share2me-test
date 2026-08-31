import os
import shutil

user_home = os.path.expanduser("~")
u2net_dir = os.path.join(user_home, ".u2net")
os.makedirs(u2net_dir, exist_ok=True)

models_dir = os.path.join(os.path.dirname(__file__), "models")

for model_name in ["isnet-general-use.onnx", "u2net.onnx"]:
    src = os.path.join(models_dir, model_name)
    dst = os.path.join(u2net_dir, model_name)
    if os.path.exists(src) and not os.path.exists(dst):
        print(f"Copying {model_name} to {u2net_dir}...")
        shutil.copy(src, dst)
        print(f"Copied {model_name} successfully!")

print(".u2net directory contents:", os.listdir(u2net_dir))
