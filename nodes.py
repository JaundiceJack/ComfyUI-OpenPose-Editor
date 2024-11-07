import os.path
import folder_paths
from nodes import LoadImage, MAX_RESOLUTION


class OpenPoseEditor:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "image": ( 
                    "STRING", 
                    { 
                        "default": "", 
                    }, 
                ),
            },
            "optional": {
                "pose_keypoint": ( 
                    "POSE_KEYPOINT", 
                    { 
                        "defaultInput": True, 
                        "forceInput": True 
                    } 
                ),
            },
        }

    RETURN_TYPES = ("IMAGE",)
    FUNCTION = "load_image"

    CATEGORY = "image"

    def load_image(self, image, pose_keypoint=None):
        image, mask = LoadImage.load_image(self, image)
        return (image,)


NODE_CLASS_MAPPINGS = {
    "Nui.OpenPoseEditor": OpenPoseEditor
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Nui.OpenPoseEditor": "OpenPose Editor",
}
