# Chapter — Avatar studio

**Production** is the cast. Add a face, make the avatar, give that face a voice. Add another face and the same steps run again. The 8-bit tab still edits one picture. Payments are not built. The workspace it builds on is described in [8-bit status](8BIT_STATUS.md) and [8-bit motion](8BIT_MOTION.md). The short tour stays in the [README](../README.md#8-bit-studio).

The aim is an animated avatar that someone else can order: one face in, a cartoon sprite that talks, many videos out, without sending every frame back through the model.

## Why one picture

Cartoon video already proved the drawing. It also showed the limit. A 21 second clip at 2 frames a second is 44 model calls. Each call redraws the face, so the jacket, the glasses, and the mouth can drift even when the seed is locked. Playback is only smooth after those frames are stored.

The model is a renderer. It should fill a buffer. It should not sit in the play path.

Taking one approved picture and animating that picture is the shorter path, and it is the one that can be sold. A voice track on top of it is the first animation.

## The frame buffer

The buffer is the avatar's RAM. A small set of finished frames sits in the project. Play, scrub, and export only read it.

1. A face photo goes in once.
2. **AI Render** makes the master sprite. That is the flat cartoon already in the app: hard edges, solid colors, black background, cyan rim. The person approves this still before anything is animated.
3. The mouth and the blink are painted on that sprite. Closed, a small opening, a full opening, and eyes shut. The face is not drawn again.
4. The buffer stays in the project. Nothing calls Hugging Face while the video runs, so the rate stays steady.
5. A voice track picks the cell. Louder, or an open-mouth moment, shows the open mouth. Quiet shows the closed mouth. The picture is not invented again.

A live pipeline that restyles the camera, or that posts every video frame, is the wrong machine for this. The expensive work happens once, into the buffer. After that the buffer is what plays.

## The studio, not a full editor

The content studio is that buffer plus a timeline. It is specific to this 8-bit avatar. It is not a copy of a general video editor.

What it needs, because that is how a timeline editor is actually used:

| Piece | Job |
| --- | --- |
| Bin | The master sprite and the buffer cells |
| Preview | Reads the buffer only. No model call. |
| Picture track | Which cell to show, and how long to hold it |
| Voice track | The recording or the generated voice. It chooses the mouth cell. |
| Caption track | The line being said, so a video can be posted |

Cuts and holds live on the timeline. Effects do not. The 8-bit look is already in the frames.

What it does not need in the first slice: a general effects stack, color wheels, a multicam bin, or a second model pass on export.

## What a customer pays for

The product unit is a filled buffer, then as many timelines as they want from it.

- Creating the avatar spends one model call: the master sprite. The mouth and the blink are painted on it. That is the paid render.
- Making a video spends the timeline: drop a voice, the mouth follows, export a WebM. Playback and export do not spend another model call.
- A second script is another timeline on the same buffer, not another face render.

The studio stays on `127.0.0.1` until that order flow exists. This chapter does not add accounts or payments. It names the thing those would sell.

## Production

**Production** is the cast, in the app. It is a workspace of its own, next to 8-bit. Each card is one face. **Make avatar** draws the master sprite once. The mouth and the blink are painted on that picture. The voice lines belong to the selected face. Selecting another face shows that face's picture and that face's lines. **Play** and **WebM** read the stored frames. They do not call the model.

The mouth is not a second drawing of the face. One sprite stays put. Closed, mid, and open change only the mouth pixels, and the words in the line decide when it opens. That is why the hair, the shirt, and the outline do not jump.

**Keep cast** writes the faces into the open project: the photo, the sprite, the four mouth frames, the line text, and the voice. The studio saves that project under `data/projects`, which is gitignored. Nothing from the cast is written to `localStorage`, and a face photo is not committed. A refresh opens the same project and the cast comes back, so the next face can be added and run through the same steps.

The four frames are stored as JPEG. A voice is stored as WAV. The project file stays under the studio's size limit. If a cast is too large, remove a face and keep it again.

## First slice

**Talk** on the 8-bit tab is one picture. The steps are in [8-bit motion](8BIT_MOTION.md). Production is the cast of many faces.

1. **AI Render** approves the sprite.
2. **Build mouth buffer** paints `closed`, `mid`, `open`, and `blink` on that sprite. The model is not called again.
3. The cells stay in memory for the session. They are not written to `localStorage`.
4. Each **Line** has words and a voice. A vowel or a tone opens the mouth. A hiss stays smaller. Silence closes it. The lines play in order, with the words on a black bar.
5. **Play** and **WebM** read the buffer. They do not call the model. The WebM is `fraymus-talk.webm` and includes every line.

<p align="center">
  <img src="showcase/8bit-talk.png" alt="A mouth-buffer cell of the studio demo sprite: hat, glasses, closed mouth, cyan rim" width="360">
</p>

<sub>The person above is the AI demo sprite already in this repo. They are not a real person.</sub>

Phonemes can replace loudness later without changing the buffer. A timeline of several voice clips is still the later chapter.

## Continuity

| Chapter | What it covers |
| --- | --- |
| [README](../README.md#8-bit-studio) | The tour of the studio as it stands |
| [8-bit status](8BIT_STATUS.md) | What works today, including Cartoon video |
| [8-bit motion](8BIT_MOTION.md) | The controls, in order |
| This chapter | Production is the cast. Keep stores it in the project. Payments are not built |
