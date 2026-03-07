import cv2
from ultralytics import YOLO
from flask import Flask
from flask_socketio import SocketIO
import engineio.async_drivers.threading # <-- NEW: Forces PyInstaller to pack the worker!
import threading
import logging
import time
import os
import sys

# Mute standard Flask logging
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

print("Loading AI Models (This might take a few seconds)...")
model_obj = YOLO('yolov8n.pt')
model_pose = YOLO('yolov8n-pose.pt')

# --- CONFIGURATION STATE ---
# Default to false so it waits for React to enable it
config = {
    "ai_enabled": False,
    "show_preview": False
}

@socketio.on('set_config')
def handle_config(data):
    if 'ai_enabled' in data:
        config['ai_enabled'] = data['ai_enabled']
    if 'show_preview' in data:
        config['show_preview'] = data['show_preview']
    print(f"⚙️ Config updated from React: {config}")

def run_server():
    print("🌐 WebSocket server started on port 5000...")
    socketio.run(app, port=5000, host='127.0.0.1', allow_unsafe_werkzeug=True)

if __name__ == '__main__':
    server_thread = threading.Thread(target=run_server, daemon=True)
    server_thread.start()

    cap = None
    currently_distracted = False
    frames_distracted = 0 
    frames_focused = 0 
    preview_was_showing = False

    print("🧠 AI Ready. Waiting for React to enable the camera...")

    while True:
        # If AI is disabled from React settings
        if not config["ai_enabled"]:
            if cap is not None:
                print("🛑 AI Disabled. Releasing webcam.")
                cap.release()
                cap = None
                cv2.destroyAllWindows()
                preview_was_showing = False
            time.sleep(0.5) # Sleep to save CPU power while disabled
            continue

        # If AI is enabled but webcam isn't initialized yet
        if cap is None or not cap.isOpened():
            print("📷 Initializing Webcam...")
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                print("❌ ERROR: Could not open webcam.")
                config["ai_enabled"] = False # Auto-disable on error
                continue
            print("✅ Webcam active!")

        ret, frame = cap.read()
        if not ret:
            continue
            
        phone_boxes = []

        # --- 1. DETECT PHONE (YOLO Object) ---
        results_obj = model_obj(frame, verbose=False)
        for r in results_obj:
            for box in r.boxes:
                if int(box.cls[0]) == 67: # 'cell phone' ID
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    phone_boxes.append((x1, y1, x2, y2))
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)
                    cv2.putText(frame, "PHONE", (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 0, 0), 2)

        # --- 2. DETECT GAZE & EVALUATE DISTRACTION ---
        results_pose = model_pose(frame, verbose=False)
        
        is_looking_down = False
        is_phone_near_face = False
        distracted_this_frame = False

        for r in results_pose:
            if r.keypoints is not None and len(r.keypoints.xy) > 0:
                kpts = r.keypoints.xy[0] 
                
                if len(kpts) >= 5:
                    nose_x, nose_y = float(kpts[0][0]), float(kpts[0][1])
                    left_eye_x, left_eye_y = float(kpts[1][0]), float(kpts[1][1])
                    right_eye_x, right_eye_y = float(kpts[2][0]), float(kpts[2][1])
                    left_ear_x, left_ear_y = float(kpts[3][0]), float(kpts[3][1])
                    right_ear_x, right_ear_y = float(kpts[4][0]), float(kpts[4][1])
                    
                    if left_eye_y > 0 and right_eye_y > 0 and left_ear_y > 0 and right_ear_y > 0:
                        avg_eye_y = (left_eye_y + right_eye_y) / 2
                        avg_ear_y = (left_ear_y + right_ear_y) / 2
                        
                        face_width = abs(left_ear_x - right_ear_x)
                        if face_width < 20: face_width = 100 
                        
                        if avg_ear_y < (avg_eye_y + 10):
                            is_looking_down = True
                            
                        for (px1, py1, px2, py2) in phone_boxes:
                            phone_cx = (px1 + px2) / 2
                            phone_cy = (py1 + py2) / 2
                            
                            if abs(phone_cx - nose_x) < (face_width * 1.5) and abs(phone_cy - nose_y) < (face_width * 1.5):
                                is_phone_near_face = True
                                distracted_this_frame = True
                            elif is_looking_down and phone_cy > nose_y and abs(phone_cx - nose_x) < (face_width * 2.5):
                                distracted_this_frame = True

                        face_pts_x = [nose_x, left_eye_x, right_eye_x, left_ear_x, right_ear_x]
                        face_pts_y = [nose_y, left_eye_y, right_eye_y, left_ear_y, right_ear_y]
                        min_x, max_x = min(face_pts_x), max(face_pts_x)
                        min_y, max_y = min(face_pts_y), max(face_pts_y)
                        
                        pad_w = face_width * 0.4
                        pad_h_top = face_width * 0.8
                        pad_h_bot = face_width * 0.6
                        
                        f_x1 = int(max(0, min_x - pad_w))
                        f_y1 = int(max(0, min_y - pad_h_top))
                        f_x2 = int(min(frame.shape[1], max_x + pad_w))
                        f_y2 = int(min(frame.shape[0], max_y + pad_h_bot))

                        if is_phone_near_face:
                            box_color = (0, 0, 255) 
                            status_text = "PHONE IN FACE"
                        elif is_looking_down and len(phone_boxes) > 0:
                            box_color = (0, 0, 255) 
                            status_text = "LOOKING AT PHONE"
                        elif is_looking_down:
                            box_color = (0, 165, 255) 
                            status_text = "LOOKING DOWN"
                        else:
                            box_color = (0, 255, 0) 
                            status_text = "FOCUSED"
                        
                        cv2.rectangle(frame, (f_x1, f_y1), (f_x2, f_y2), box_color, 2)
                        cv2.putText(frame, status_text, (f_x1, f_y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, box_color, 2)

                        if distracted_this_frame:
                            break
        
        if not distracted_this_frame and len(phone_boxes) > 0:
            frame_height, frame_width = frame.shape[:2]
            for (px1, py1, px2, py2) in phone_boxes:
                phone_area = (px2 - px1) * (py2 - py1)
                if phone_area > (frame_height * frame_width * 0.10):
                    distracted_this_frame = True
                    cv2.putText(frame, "PHONE BLOCKING CAM", (20, 90), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
                    break

        # --- 3. STATE MACHINE LOGIC ---
        if distracted_this_frame:
            frames_distracted += 1
            frames_focused = 0
            if frames_distracted > 10 and not currently_distracted:
                socketio.emit('distracted', {})
                currently_distracted = True
        else:
            frames_focused += 1
            frames_distracted = 0
            if frames_focused > 10 and currently_distracted:
                socketio.emit('focused', {})
                currently_distracted = False

        # --- 4. PREVIEW WINDOW HANDLER ---
        if config["show_preview"]:
            cv2.imshow('Focus AI Monitor (Preview)', frame)
            cv2.waitKey(1)
            preview_was_showing = True
        else:
            if preview_was_showing:
                cv2.destroyAllWindows()
                preview_was_showing = False
            
            # --- THE FIX ---
            # Artificially pause for 30 milliseconds (caps the loop at ~30 FPS).
            # This is REQUIRED so the WebSocket network thread has time to send messages to React!
            time.sleep(0.03) 

    if cap is not None:
        cap.release()
    cv2.destroyAllWindows()