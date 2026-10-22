# `viton` mobile backlog

Mobile features we want but haven't built. The phone runs the stock App Store
app, so a mobile change only reaches it through our own iOS build (paid Apple
developer account plus a Mac). Collect features here and build them together
once there are enough to be worth a build.

## Take a photo from the chat composer

The composer's **+** menu offers **Photo Library** and **Choose Files**, but no
camera. Add **Take Photo** (iOS first; Android gets it for free).

How it would be built (checked against the code on 2026-10-22):

- `apps/mobile/src/lib/composerImages.ts`: give `pickComposerMedia` a
  `source: "library" | "camera"` option. For the camera, call
  `requestCameraPermissionsAsync()` first: on iOS `launchCameraAsync` rejects
  instead of prompting when access was never granted. Then call
  `launchCameraAsync({ mediaTypes: ["images"], base64: false, quality: 1 })`.
  Images only, since video capture would also need microphone permission,
  which is disabled. The rest of the asset handling (HEIC to JPEG, 10 MB
  cap) works as is.
- `apps/mobile/src/components/ComposerAttachmentButton.tsx`: add a
  `{ id: "camera", title: "Take Photo", image: "camera" }` menu action and make
  `onPickMedia` take the source. Show the menu even when the server lacks
  file attachments (today that case skips the menu and opens the library).
- Pass the source through the callers: `onPickDraftMedia` in
  `state/use-thread-composer-state.ts` (prop types in `ThreadComposer.tsx`,
  `ThreadDetailScreen.tsx`), `handlePickMedia` in `NewTaskDraftScreen.tsx`,
  and `pick` in `QuestionAttachments.tsx`.
- `apps/mobile/app.config.ts`: the camera permission is already declared by
  the `expo-camera` plugin, worded for pairing QR codes only. Reword it to
  cover attaching photos. No new native module is needed.
- Extend `apps/mobile/src/lib/composerFiles.test.ts` (it already mocks
  `expo-image-picker`) with the granted, denied, and canceled camera cases.
