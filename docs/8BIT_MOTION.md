# 8-bit live camera and video

The 8-bit workspace can style a webcam and an uploaded video two ways. **Style video** uses the offline Character filter on every frame. **Cartoon video** calls the same Hugging Face render as AI Render, so the clip is a flat pixel sprite instead of a grainy photo.

## Why playback never waits on the model

AI Render posts one photo to `/api/pixel/render` (FLUX.2 Klein). A still takes about 7 seconds. The live camera does not call it. **Style video** does not call it either: both use `styleImage` in `client/src/tools/pixelMotion.js`, which calls `buildSubjectMask` and `renderPixel` in `client/src/tools/pixelEngine.js`. **Cartoon video** does call the model, once per sampled frame, and only while it is building the clip. Play and WebM then read the stored frames.

Where this is going: [8-bit status](8BIT_STATUS.md) is the current behavior. [Avatar studio](AVATAR_STUDIO.md) is the frame buffer, so a talking avatar does not render every frame.

The sliders that apply are Block, Colors, Reach, Saturation, Outline, and Cyan. Character, Trace, and Abstract follow the view buttons. The Render view uses the Character filter for motion, because that view is the AI still.

## Live camera

1. Open **8-bit** and press **Take picture**. The browser asks for the camera. A blocked permission shows "Camera permission was blocked."
2. The small window is the raw camera, so you can frame the shot. The stage is the filtered frame. The long edge is scaled to 240px before the filter, then drawn back up with nearest-neighbor so the page can keep a frame rate. The note under the stage reports that rate once a second.
3. Move the pixel sliders. The next camera frame uses the new values.
4. **Shutter** copies the full camera frame (not the 240px preview) into the still editor. Edit, AI Render, PNG, Save, and Place in project work on that photo. The camera turns off.
5. **Stop** turns the camera off without saving a photo.

## Uploaded video

1. Press **New video**, or drop an MP4, WebM, or MOV on the stage. Other files still open as pictures.
2. The note shows the file name, length, size, and how many frames will be styled. The sample rate is 10 frames a second for the whole clip. Nothing is dropped to save time. Some WebM files, including ones recorded in the browser, report an infinite length until the player seeks to the end. The studio does that measurement first, then seeks back to the start. If the length still cannot be read, styling does not start.
3. Set the sliders and the view, then press **Style video**. Each frame is seeked and scaled to 480px on the long edge. The square follows the band of the frame that has facial detail, so a flat wall or a wide hat does not become the picture and the face fills it. Video blocks are 2 pixels. Frames are kept at the render size, up to 720px, and the WebM is written at a high bitrate so the player does not blur them back into mush. A wide frame stays square on the person. The stage shows the frame that just finished, and the button counts `Frame n/total`.
4. **Stop** keeps the frames already finished. It does not invent the rest.
5. **Play** loops those frames at 10 fps. **Pause** holds the current one.
6. **WebM** records the styled frames with `MediaRecorder` to `fraymus-8bit.webm` at 10 fps, then writes the real length into the file. A browser recording otherwise saves with a length of 0:00, and the player will not move. The browser has to support WebM. If it does not, the note says so, and **Edit this frame** plus **PNG** is the still export.
7. **Edit this frame** seeks the original video to the frame on screen and loads that full-resolution image into the still editor. AI Render and the mask tools then apply to that one picture, not to the clip.
8. **Cartoon video** sends each frame to `/api/pixel/render`. It samples 2 frames a second, because one still takes about 10 seconds. The first frame's seed is reused for the rest. Real outfit keeps the clothes in the video. Avatar uses the studio costume. A style reference, if one is set, is the drawing every frame copies. Stop keeps the frames already drawn. Play and WebM use that 2 fps rate. The progress line stays visible while a video is loaded.

Changing a slider does not restyle a clip that is already playing. Press **Style video** again to rebuild it.

## Talk

The mouth buffer is the frame buffer from [Avatar studio](AVATAR_STUDIO.md). It animates one approved sprite. It does not restyle a video.

1. **AI Render** the picture you want to keep. Real outfit or Avatar, and a style reference if you use one.
2. **Build mouth buffer** paints four frames on that sprite: mouth closed, mouth slightly open, mouth open, and a blink. It does not call the model. **Stop** drops the set. The four frames are the only pictures Play will use.
3. Write a **Line** and press **Add line**. Press **Voice** on that row and choose a WAV, MP3, or M4A. **Up** and **Down** change the order. **Hold** stays on Follow voice, or pins that line to closed, mid, open, or blink for its whole length. Add another line the same way. The four names above the lines show that frame on the stage.
4. **Play** reads the buffer. A vowel, or a tone, opens the mouth. A hiss or a consonant keeps it smaller. Silence closes it, and about every 3 seconds of quiet the blink frame shows. The words of the current line sit on a black bar at the bottom. **Stop** cuts the voice.
5. **WebM** writes `fraymus-talk.webm` for the whole timeline, picture, words, and voice, and writes the length into the file.

Building the buffer paints the mouth and the blink on the approved sprite. Playing a line does not call the model.

## Files

| File | Role |
| --- | --- |
| `client/src/tools/pixelMotion.js` | Frame grab, filter, seek, WebM mime check |
| `client/src/tools/pixelTalk.js` | Mouth names, voice loudness, talk WebM mime |
| `client/src/tools/PixelPage.jsx` | Camera loop, video controls, playback, export |
| `client/src/tools/pixelEngine.js` | The filter itself (`renderPixel`) |
| `client/src/styles.css` | `.pixel-clip` hides the decoder element without `display: none`, so the browser still decodes frames |
