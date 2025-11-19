import os
import sys
import subprocess

def install_pillow():
    try:
        import PIL
    except ImportError:
        print("Pillow not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])

def remove_white_bg(image_path):
    from PIL import Image
    try:
        img = Image.open(image_path)
        img = img.convert("RGBA")
        datas = img.getdata()

        new_data = []
        for item in datas:
            # Change all white (also shades of whites)
            # Threshold: > 240
            if item[0] > 240 and item[1] > 240 and item[2] > 240:
                new_data.append((255, 255, 255, 0))
            else:
                new_data.append(item)

        img.putdata(new_data)
        img.save(image_path, "PNG")
        print(f"Processed {image_path}")
    except Exception as e:
        print(f"Failed {image_path}: {e}")

if __name__ == "__main__":
    install_pillow()
    
    assets_dir = "assets"
    if not os.path.exists(assets_dir):
        print("Assets dir not found")
        sys.exit(1)

    for filename in os.listdir(assets_dir):
        if filename.endswith(".png"):
            remove_white_bg(os.path.join(assets_dir, filename))
