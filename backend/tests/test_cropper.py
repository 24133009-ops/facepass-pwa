"""Unit tests for face crop coordinates and 20% padding calculations."""
import io
import unittest
from PIL import Image
import sys
import os

# Add src to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../src")))
from common.rekognition import calculate_crop_box, crop_face_image

class TestFaceCropper(unittest.TestCase):
    def setUp(self):
        # Create a 1000x800 synthetic image
        self.img_w = 1000
        self.img_h = 800
        self.test_img = Image.new("RGB", (self.img_w, self.img_h), color="blue")

    def test_crop_box_with_padding_center(self):
        # Face in center: Left=0.4, Top=0.3, Width=0.2, Height=0.2
        # Normal pixel rect: x=400, y=240, w=200, h=160
        # 20% padding: pad_w=40, pad_h=32
        # Expected: left=360, top=208, right=640, bottom=432
        box = {"Left": 0.4, "Top": 0.3, "Width": 0.2, "Height": 0.2}
        left, top, right, bottom = calculate_crop_box(box, self.img_w, self.img_h, padding_ratio=0.20)
        
        self.assertEqual(left, 360)
        self.assertEqual(top, 208)
        self.assertEqual(right, 640)
        self.assertEqual(bottom, 432)

    def test_crop_box_clamping_at_edges(self):
        # Face at top-left edge: Left=0.01, Top=0.01, Width=0.2, Height=0.2
        # With 20% padding, left and top would go negative without clamping
        box = {"Left": 0.01, "Top": 0.01, "Width": 0.2, "Height": 0.2}
        left, top, right, bottom = calculate_crop_box(box, self.img_w, self.img_h, padding_ratio=0.20)
        
        self.assertGreaterEqual(left, 0)
        self.assertGreaterEqual(top, 0)
        self.assertLessEqual(right, self.img_w)
        self.assertLessEqual(bottom, self.img_h)

    def test_crop_face_image_returns_valid_jpeg(self):
        box = {"Left": 0.2, "Top": 0.2, "Width": 0.3, "Height": 0.3}
        cropped_bytes = crop_face_image(self.test_img, box, padding_ratio=0.20)
        
        self.assertTrue(len(cropped_bytes) > 0)
        # Verify result is a valid openable image
        cropped_img = Image.open(io.BytesIO(cropped_bytes))
        self.assertEqual(cropped_img.format, "JPEG")
        self.assertTrue(cropped_img.width > 0)
        self.assertTrue(cropped_img.height > 0)

if __name__ == "__main__":
    unittest.main()

