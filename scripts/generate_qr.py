import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask
from PIL import Image, ImageDraw

qr = qrcode.QRCode(
    version=5,
    error_correction=qrcode.constants.ERROR_CORRECT_H,
    box_size=20,
    border=3,
)
qr.add_data('https://share2.me')
qr.make(fit=True)

# Generate the styled QR code
img = qr.make_image(
    image_factory=StyledPilImage,
    module_drawer=RoundedModuleDrawer(),
    color_mask=SolidFillColorMask(back_color=(11, 14, 17), front_color=(255, 255, 255)),
)

# Open and resize logo
logo = Image.open('frontend/public/logo.png').convert("RGBA")
# Calculate max logo size (about 30% of QR code size)
logo_size = int(img.size[0] * 0.25)
logo.thumbnail((logo_size, logo_size), Image.Resampling.LANCZOS)

# Create a background for the logo so it stands out
logo_bg = Image.new("RGBA", (logo_size + 20, logo_size + 20), (11, 14, 17, 255))
logo_bg_draw = ImageDraw.Draw(logo_bg)
logo_bg_draw.rounded_rectangle([0, 0, logo_size + 20, logo_size + 20], radius=15, fill=(11, 14, 17, 255))
logo_bg.paste(logo, (10, 10), mask=logo)

# Calculate position to paste
pos = ((img.size[0] - logo_bg.size[0]) // 2, (img.size[1] - logo_bg.size[1]) // 2)

# Paste logo onto QR code
img = img.convert("RGBA")
img.paste(logo_bg, pos, mask=logo_bg)

img.save('share2me_qr_white.png')
print("QR Code generated successfully at share2me_qr_white.png")
